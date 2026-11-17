import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Clave pública del proyecto: la nueva "publishable key" (sb_publishable_…) o la "anon key" clásica.
// Nunca usar acá la secret / service_role key.
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
if (anonKey?.startsWith('sb_secret_')) {
  throw new Error('Configuración insegura: se cargó la SECRET key en el frontend. Usá la publishable key.')
}

export const supabaseConfigurado = Boolean(url && anonKey)

// Si faltan las variables, la app muestra una pantalla de configuración en lugar de romperse.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'falta-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const BUCKET_FOTOS = 'fotos'

export function urlPublica(path: string | null | undefined): string | null {
  if (!path) return null
  // Imágenes incluidas en el sitio (public/contenido) o URLs completas
  if (path.startsWith('/contenido/') || /^https:\/\//.test(path)) return path
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path).data.publicUrl
}
