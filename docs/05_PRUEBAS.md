# Pruebas

## 1. Reglas de negocio y seguridad en la base (SQL)

`supabase/tests/10_pruebas.sql` — **104 verificaciones**, todas pasan. Se corren con `npm run test:db` sobre un PostgreSQL local (variables `PGBIN` y `PGPORT`; por defecto `/e/tools/pg/pgsql/bin` y `54329`). Usa `00_stub_supabase.sql` para imitar los roles y `auth.uid()` de Supabase.

Cubre, entre otras:
- Clientas solo con nombre, solo con Instagram, sin contacto; dos personas con el mismo nombre.
- WhatsApp normalizado (`11 1234-5678` = `011 15 1234-5678` = `+54 9 11…`) y duplicados rechazados; Instagram desde `@` o URL.
- Búsqueda de posibles duplicadas (sin acentos, nombre parecido, mismo WhatsApp).
- Turnos: total y duración por ítems, superposición imposible (panel y web), turno pegado permitido, cancelar libera el horario, reactivar un cancelado superpuesto falla, reprogramación.
- Precio histórico y duración se conservan al cambiar el servicio.
- Señas, pagos parciales, estado de pago y saldo; pago hereda la clienta.
- Gift cards: no se puede usar más de lo disponible; el ingreso no se duplica. Saldo a favor.
- Visitas, inasistencias, resumen financiero (ingresos − gastos), reparto 70/15/15, planilla, dashboard.
- Disponibilidad: respeta turnos, bloqueos, descanso, nueva duración del servicio, servicios inactivos.
- Reserva web: queda pendiente, exige contacto y servicio principal, no permite fuera de horario, vincula por WhatsApp existente, copia el precio vigente.
- Seguridad: anónimo no ve clientas/turnos/pagos, no puede insertar, no puede usar funciones internas; una cuenta sin perfil no ve ni modifica nada; el calendario personal es privado; solo la dueña da acceso al equipo.

## 2. Lógica del frontend

`src/lib/lib.test.ts` (Vitest, `npm test`) — 18 pruebas: teléfonos, Instagram, formato de pesos argentino, plantillas y links de WhatsApp, fechas en la zona horaria del negocio.

## 3. Pruebas de punta a punta en navegador

Con el entorno `tools/supabase-lite` (PostgreSQL + PostgREST + auth/storage locales) se probó en el navegador, en escritorio y en tamaño celular (375 px):

- Crear la cuenta administradora inicial e ingresar.
- Cargar servicios sugeridos.
- Alta de clienta con WhatsApp ya existente escrito distinto → bloqueado; homónima → advertencia y “Es otra persona, guardar”.
- Nuevo turno desde la grilla (10:00), con servicio + adicional, horarios libres sugeridos y seña configurada.
- Registrar seña por transferencia → estado “Con seña”, saldo correcto.
- Mensaje de confirmación por WhatsApp con nombre, fecha, hora y servicio.
- Reserva web en celular: el calendario solo ofrece días con lugar; los horarios excluyen el turno existente y el descanso; clienta con solo Instagram; pantalla de éxito.
- Panel en celular: pedido pendiente en Inicio, vincular a ficha nueva con datos precargados, confirmar.
- Planilla semanal, reparto y resumen financiero con los datos reales.
- Avisos: crear, sumar todas, marcar avisada, contador.
- Storage: anónimo no puede subir; la dueña sí; lectura pública OK.

Bug encontrado y corregido durante estas pruebas: al guardar una clienta nueva desde el formulario del turno, el envío se propagaba al formulario del turno (los portales de React propagan eventos). Se corrigió en `Modal` para todos los formularios anidados.

## Pendiente de verificar en el entorno real

- Ejecutar `supabase/instalar_todo.sql` en el proyecto de Supabase real (no se pudo probar contra Supabase en la nube sin una cuenta).
- Prueba en un iPhone y un Android reales (se probó con emulación de tamaño en el navegador).
- Envío real del mail de “Olvidé mi contraseña” (depende de la configuración de Supabase).
