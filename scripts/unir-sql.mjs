// Une todas las migraciones en un solo archivo para pegar en el SQL Editor de Supabase.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const dir = 'supabase/migrations'
const partes = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => `-- ===================== ${f} =====================\n${readFileSync(join(dir, f), 'utf8')}`)
writeFileSync('supabase/instalar_todo.sql', `-- GENERADO con "npm run sql:unir". No editar a mano: editar supabase/migrations/.\n-- Pegar completo en Supabase → SQL Editor → Run (una sola vez, en un proyecto nuevo).\n\n${partes.join('\n\n')}\n`)
console.log('supabase/instalar_todo.sql generado con', partes.length, 'migraciones')
