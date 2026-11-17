# supabase-lite — entorno de pruebas local (sin Docker)

Imita lo mínimo de Supabase para probar la app en esta PC. **No es para producción.**

Componentes:
- PostgreSQL portable (puerto 54329) con la base `manicura_dev` (`bash tools/supabase-lite/crear-db.sh [--reset]`).
- PostgREST (puerto 54331), config de ejemplo:
  ```
  db-uri = "postgres://authenticator:authenticator@localhost:54329/manicura_dev"
  db-schemas = "public"
  db-anon-role = "anon"
  jwt-secret = "super-secreto-de-pruebas-locales-con-32-caracteres-o-mas"
  server-port = 54331
  ```
- `node tools/supabase-lite/servidor.mjs` (puerto 54321): auth, storage y proxy. Al iniciar imprime la `VITE_SUPABASE_ANON_KEY` para `.env.local`, con `VITE_SUPABASE_URL=http://localhost:54321`.

Cuenta de prueba creada en la base local (solo existe acá):
- Email: `prueba@local.test`
- Contraseña: `Prueba-local-2026`
