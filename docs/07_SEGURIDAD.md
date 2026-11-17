# Seguridad

## Qué protege la app

| Riesgo | Protección |
|---|---|
| **Inyección SQL** | La app nunca arma SQL con texto: todo pasa por la API de Supabase (PostgREST) con parámetros, y las funciones de la base usan variables tipadas. El buscador además limpia los caracteres especiales. |
| **Robo de datos por un visitante** | El rol anónimo (cualquiera que entra a la web) **no tiene permiso** sobre ninguna tabla interna: clientas, turnos, pagos, finanzas, ajustes, calendario y auditoría devuelven *permission denied*. Solo puede leer servicios, fotos y promociones visibles, y usar 5 funciones públicas controladas (ver horarios, pedir turno). |
| **Robo de datos por alguien que crea una cuenta** | Una cuenta nueva no tiene perfil: RLS no le muestra ninguna fila. Solo la dueña da acceso desde *Ajustes → Cuenta → Equipo*. |
| **Spam de reservas** | Límite de pedidos pendientes por persona y límite global por hora (configurable). Validación de nombre, WhatsApp, Instagram y largo de textos en el servidor. |
| **Turnos encimados o datos inconsistentes** | Restricciones en la base (exclusión de horarios, montos positivos, créditos que no se exceden, reparto que suma 100%). |
| **Links o archivos maliciosos** | El link de Maps solo acepta `https://`; las rutas de fotos solo pueden ser de las carpetas propias; el bucket solo acepta JPG/PNG/WebP de hasta 8 MB. |
| **XSS (código inyectado en la página)** | React escapa todo el texto; no se usa HTML crudo. Además, la política **CSP** de `vercel.json` solo permite ejecutar scripts del propio sitio y conectarse a Supabase. |
| **Clickjacking / sniffing** | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`. |
| **Funciones secuestradas** | Todas las funciones tienen `search_path` fijo. |
| **Quedarse sin acceso** | No se puede borrar ni degradar a la última dueña, ni quitarse el acceso a sí misma desde la app. |
| **Borrados o cambios por error** | **Auditoría**: cada modificación o borrado de clientas, pagos, créditos, gastos, servicios, ajustes y cada turno eliminado queda guardado con los datos anteriores. Solo la dueña la puede leer y nadie la puede borrar desde la app. |
| **Pérdida de datos** | Botón *Ajustes → Cuenta → Descargar copia* (solo dueña): baja todos los datos en un archivo. Recomendado una vez por mes. |
| **Claves expuestas** | El frontend solo lleva la *publishable key* (pública por diseño). Si alguien cargara la secret key, la app se niega a arrancar. |

Todo esto está cubierto por pruebas automáticas (`supabase/tests/10_pruebas.sql`).

## Configuración en Supabase (hacerlo una vez)

1. **Después de que tu hermana cree su cuenta**: *Authentication → Sign In / Providers* → desactivar **Allow new users to sign up**. Si más adelante suman a alguien, se activa un momento.
2. *Authentication → Sign In / Providers → Email*: **Minimum password length** en 10 o más y, si aparece, *Password requirements* con letras y números.
3. *Authentication → Rate Limits*: dejar los valores por defecto (frenan intentos de adivinar contraseñas).
4. *Project Settings → API Keys*: **rotar la secret key** (crear una nueva y borrar la vieja). La app no la usa.
5. *Advisors → Security Advisor*: tocar **Rerun** y revisar que no queden alertas importantes (si aparece alguna, pasámela).
6. Las copias automáticas de Supabase dependen del plan; por eso está el botón de copia manual.

## Configuración en Vercel y GitHub

- *Vercel → Settings → Environment Variables*: dejar solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Si la integración agregó otras (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `POSTGRES_*`), se pueden borrar.
- Repositorio de GitHub en **privado**.
- Activar verificación en dos pasos (2FA) en GitHub, Vercel y Supabase: quien entra a esas cuentas tiene acceso a todo.

## Recomendaciones para el uso diario

- Contraseña larga y única para el panel (no la misma del mail o Instagram).
- No compartir capturas del panel con datos de clientas.
- Si se pierde el celular: cambiar la contraseña desde otra compu (*Ajustes → Cuenta*). Las sesiones viejas quedan inválidas al expirar el token.
