// =====================================================================
// "Supabase liviano" SOLO PARA PRUEBAS LOCALES (sin Docker).
// Imita lo mínimo de Supabase que usa la app:
//   /rest/v1/*     → proxy a PostgREST (misma API que Supabase)
//   /auth/v1/*     → login con email y contraseña, alta, sesión (JWT HS256)
//   /storage/v1/*  → subir / servir / borrar imágenes del bucket "fotos" en disco
// NO usar en producción: en producción se usa Supabase real.
// =====================================================================
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createServer, request as httpRequest } from 'node:http'
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import pg from 'pg'

const PUERTO = Number(process.env.PUERTO ?? 54321)
const POSTGREST = process.env.POSTGREST ?? 'http://127.0.0.1:54331'
const SECRETO = process.env.JWT_SECRET ?? 'super-secreto-de-pruebas-locales-con-32-caracteres-o-mas'
const DIR_STORAGE = process.env.DIR_STORAGE ?? join(process.cwd(), '.storage-local')
const pool = new pg.Pool({ connectionString: process.env.DB_URL ?? 'postgres://postgres@localhost:54329/manicura_dev' })

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
export function firmar(payload) {
  const cab = b64({ alg: 'HS256', typ: 'JWT' })
  const cuerpo = b64(payload)
  const firma = createHmac('sha256', SECRETO).update(`${cab}.${cuerpo}`).digest('base64url')
  return `${cab}.${cuerpo}.${firma}`
}
function verificar(token) {
  const [cab, cuerpo, firma] = (token ?? '').split('.')
  if (!firma) return null
  const esperada = createHmac('sha256', SECRETO).update(`${cab}.${cuerpo}`).digest('base64url')
  if (esperada !== firma) return null
  const p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
  if (p.exp && p.exp < Date.now() / 1000) return null
  return p
}

export const ANON_KEY = firmar({ role: 'anon', iss: 'supabase-lite', iat: 1700000000, exp: 2000000000 })
const refrescos = new Map()

function usuarioJson(u) {
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.creado ?? new Date().toISOString(), phone: '',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.raw_user_meta_data ?? {},
    identities: [], created_at: u.creado ?? new Date().toISOString(), updated_at: new Date().toISOString(),
  }
}
function sesion(u) {
  const ahora = Math.floor(Date.now() / 1000)
  const access_token = firmar({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, iat: ahora, exp: ahora + 3600 })
  const refresh_token = randomBytes(24).toString('hex')
  refrescos.set(refresh_token, u.id)
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token, user: usuarioJson(u) }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Profile, Range-Unit, Preference-Applied',
}
function json(res, status, body) {
  res.writeHead(status, { ...cors, 'Content-Type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const leer = (req) => new Promise((ok) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => ok(Buffer.concat(ch))) })
const errorAuth = (res, msg, status = 400) => json(res, status, { error: 'invalid_grant', error_description: msg, msg, message: msg, code: status })

async function buscarUsuario(id) {
  const r = await pool.query('select id, email, raw_user_meta_data, created_at::text as creado from auth.users where id = $1', [id])
  return r.rows[0]
}

async function auth(req, res, ruta, url) {
  const cuerpo = req.method === 'GET' ? {} : JSON.parse((await leer(req)).toString() || '{}')
  if (ruta === '/signup' && req.method === 'POST') {
    if (!cuerpo.email || (cuerpo.password ?? '').length < 6) return errorAuth(res, 'Password should be at least 6 characters')
    const ya = await pool.query('select 1 from auth.users where lower(email) = lower($1)', [cuerpo.email])
    if (ya.rowCount) return errorAuth(res, 'User already registered', 422)
    const r = await pool.query(
      `insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, extensions.crypt($2, extensions.gen_salt('bf')), $3)
       returning id, email, raw_user_meta_data, created_at::text as creado`,
      [cuerpo.email, cuerpo.password, cuerpo.data ?? {}],
    )
    return json(res, 200, sesion(r.rows[0]))
  }
  if (ruta === '/token' && req.method === 'POST') {
    const tipo = url.searchParams.get('grant_type')
    if (tipo === 'password') {
      const r = await pool.query(
        `select id, email, raw_user_meta_data, created_at::text as creado from auth.users
          where lower(email) = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)`,
        [cuerpo.email, cuerpo.password ?? ''],
      )
      if (!r.rowCount) return errorAuth(res, 'Invalid login credentials')
      return json(res, 200, sesion(r.rows[0]))
    }
    if (tipo === 'refresh_token') {
      const id = refrescos.get(cuerpo.refresh_token)
      if (!id) return errorAuth(res, 'Invalid Refresh Token: Refresh Token Not Found')
      refrescos.delete(cuerpo.refresh_token)
      return json(res, 200, sesion(await buscarUsuario(id)))
    }
  }
  const p = verificar((req.headers.authorization ?? '').replace(/^Bearer /i, ''))
  if (ruta === '/user') {
    if (!p?.sub) return errorAuth(res, 'invalid JWT', 401)
    if (req.method === 'PUT' && cuerpo.password) {
      await pool.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1`, [p.sub, cuerpo.password])
    }
    return json(res, 200, usuarioJson(await buscarUsuario(p.sub)))
  }
  if (ruta === '/logout') return json(res, 204)
  if (ruta === '/recover') return json(res, 200, {})
  return json(res, 404, { message: 'no implementado en supabase-lite: ' + ruta })
}

const TIPOS = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
function rutaSegura(bucket, path) {
  const destino = normalize(join(DIR_STORAGE, bucket, path))
  if (!destino.startsWith(normalize(DIR_STORAGE))) throw new Error('ruta inválida')
  return destino
}
async function esStaff(req) {
  const p = verificar((req.headers.authorization ?? '').replace(/^Bearer /i, ''))
  if (!p?.sub) return false
  const r = await pool.query('select 1 from public.perfiles where id = $1', [p.sub])
  return r.rowCount > 0
}

async function storage(req, res, ruta) {
  let m = ruta.match(/^\/object\/public\/([^/]+)\/(.+)$/)
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    const f = rutaSegura(m[1], decodeURIComponent(m[2]))
    if (!existsSync(f)) return json(res, 404, { message: 'Object not found' })
    res.writeHead(200, { ...cors, 'Content-Type': TIPOS[f.split('.').pop()] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' })
    return res.end(req.method === 'HEAD' ? undefined : readFileSync(f))
  }
  m = ruta.match(/^\/object\/([^/]+)\/(.+)$/)
  if (m && (req.method === 'POST' || req.method === 'PUT')) {
    if (!(await esStaff(req))) return json(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
    const datos = await leer(req)
    if (datos.length > 8 * 1024 * 1024) return json(res, 413, { message: 'Payload too large' })
    const f = rutaSegura(m[1], decodeURIComponent(m[2]))
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, datos)
    return json(res, 200, { Id: randomUUID(), Key: `${m[1]}/${m[2]}` })
  }
  m = ruta.match(/^\/object\/([^/]+)\/?$/)
  if (m && req.method === 'DELETE') {
    if (!(await esStaff(req))) return json(res, 403, { message: 'Unauthorized' })
    const { prefixes = [] } = JSON.parse((await leer(req)).toString() || '{}')
    for (const p of prefixes) rmSync(rutaSegura(m[1], p), { force: true })
    return json(res, 200, prefixes.map((name) => ({ name })))
  }
  return json(res, 404, { message: 'no implementado en supabase-lite: ' + ruta })
}

function proxyRest(req, res, ruta, url) {
  const headers = { ...req.headers, host: new URL(POSTGREST).host }
  delete headers.apikey
  const pr = httpRequest(POSTGREST + ruta + url.search, { method: req.method, headers }, (r) => {
    const h = Object.fromEntries(Object.entries(r.headers).filter(([k]) => !k.toLowerCase().startsWith('access-control-')))
    res.writeHead(r.statusCode ?? 502, { ...h, ...cors })
    r.pipe(res)
  })
  pr.on('error', (e) => json(res, 502, { message: 'PostgREST no responde: ' + e.message }))
  req.pipe(pr)
}

createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 204)
    const url = new URL(req.url, 'http://x')
    if (url.pathname.startsWith('/rest/v1')) return proxyRest(req, res, url.pathname.slice(8) || '/', url)
    if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url.pathname.slice(8), url)
    if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url.pathname.slice(11))
    json(res, 404, { message: 'ruta desconocida' })
  } catch (e) {
    console.error(e)
    json(res, 500, { message: String(e?.message ?? e) })
  }
}).listen(PUERTO, () => {
  console.log(`supabase-lite escuchando en http://localhost:${PUERTO}`)
  console.log(`VITE_SUPABASE_ANON_KEY=${ANON_KEY}`)
})
