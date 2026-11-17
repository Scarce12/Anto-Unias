# Instalación y despliegue

Costo: Supabase y Vercel tienen planes gratuitos que alcanzan de sobra para un emprendimiento.

## 1. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com>, creá una cuenta y un **New project**. Región: *South America (São Paulo)*. Guardá la contraseña de la base en un lugar seguro.
2. Cuando termine de crearse, abrí **SQL Editor → New query**, pegá **todo** el contenido de `supabase/instalar_todo.sql` y tocá **Run**. Tiene que terminar sin errores.
   - Alternativa con la CLI: `npx supabase login`, `npx supabase link --project-ref TU_REF` y `npx supabase db push`.
3. **Authentication → Sign In / Providers → Email**:
   - Dejá habilitado *Email*.
   - Si querés entrar apenas creás la cuenta, desactivá *Confirm email*; si lo dejás activo, vas a tener que confirmar desde el mail.
4. **Authentication → URL Configuration**: en *Site URL* poné la dirección de Vercel (paso 3), por ejemplo `https://tu-proyecto.vercel.app`. Agregala también en *Redirect URLs* (sirve para “Olvidé mi contraseña”).
5. **Project Settings → API**: copiá *Project URL* y la *Publishable key* (empieza con `sb_publishable_`).

> El bucket de fotos (`fotos`) y sus permisos se crean solos con el SQL.

## 2. Probar en tu computadora (opcional)

Necesitás Node.js 22.12 o superior.

```bash
npm install
```

Copiá `.env.example` como `.env.local` y completá:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

```bash
npm run dev
```

Abrí <http://localhost:5173>.

## 3. Publicar en Vercel

1. Subí el proyecto a un repositorio de GitHub (privado está bien).
2. En <https://vercel.com> → **Add New → Project** → importá el repositorio. Vercel detecta Vite solo.
3. En **Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. **Deploy**. El archivo `vercel.json` ya resuelve las rutas internas y agrega encabezados de seguridad.
5. (Opcional) En **Settings → Domains** podés conectar un dominio propio.

## 4. Primer uso

1. Entrá a `https://tu-sitio/ingresar` → **Primera vez: crear la cuenta administradora**. Esa cuenta queda como dueña.
2. Completá **Ajustes**: nombre, presentación, WhatsApp, Instagram, horarios de atención, seña y textos.
3. Cargá **Servicios** (podés partir de los nombres sugeridos) y algunas fotos en **Galería**.
4. Desde el celular, abrí el sitio y elegí *Agregar a pantalla de inicio* para usarlo como app.

### Seguridad recomendada

- Después de crear tu cuenta podés desactivar **Allow new users to sign up** en Supabase (Authentication → Sign In / Providers). Si más adelante sumás a alguien, lo activás un momento, esa persona crea su cuenta, y vos le das acceso desde **Ajustes → Cuenta → Equipo**. Igual, cualquier cuenta que no agregues no ve ningún dato.
- Nunca compartas la *service_role key*; la app no la necesita.
- Las copias automáticas de Supabase dependen del plan. Usá **Ajustes → Cuenta → Descargar copia** una vez por mes. Más detalles en [07_SEGURIDAD.md](07_SEGURIDAD.md).

## Desarrollo

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (verifica tipos) |
| `npm test` | Pruebas de lógica del frontend (Vitest) |
| `npm run test:db` | Pruebas SQL sobre un PostgreSQL local (ver `docs/05_PRUEBAS.md`) |
| `npm run sql:unir` | Regenera `supabase/instalar_todo.sql` desde las migraciones |

Para cambios futuros del esquema: crear un archivo nuevo en `supabase/migrations/` (no modificar los ya aplicados) y aplicarlo en Supabase (SQL Editor o `supabase db push`).
