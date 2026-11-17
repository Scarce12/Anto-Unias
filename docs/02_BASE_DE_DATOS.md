# Base de datos

PostgreSQL en Supabase. Todo el SQL está en `supabase/migrations/` (en orden) y unido en `supabase/instalar_todo.sql`.

## Tablas

| Tabla | Para qué | Reglas importantes |
|---|---|---|
| `perfiles` | Usuarias del panel (`duena` / `staff`) | La primera cuenta creada es la dueña (trigger). Otras cuentas no tienen acceso hasta que la dueña las agrega. |
| `ajustes_negocio` | Una sola fila: datos del negocio, horarios de grilla, reservas, seña, reparto, plantillas de WhatsApp | El reparto tiene que sumar 100%. Arranca vacía: no se inventan datos. |
| `clientas` | Base de clientas | Solo `nombre` obligatorio. `whatsapp_norm` e `instagram_norm` se calculan solos y son **únicos si existen**. El nombre no es único. |
| `categorias_servicio`, `servicios` | Catálogo | `es_adicional` para deco/retiro/French. `activo` y `visible_web`. |
| `horarios_laborales` | Franjas de atención por día (0 = domingo) | Varias por día (descansos). No se superponen. |
| `bloqueos` | Horarios bloqueados, días completos, vacaciones | No se ofrecen en la web. En el panel se avisa pero se permite. |
| `turnos` | Agenda | **Restricción de exclusión**: dos turnos pendientes/confirmados/finalizados no pueden superponerse. `total = subtotal − descuento` (calculado). |
| `turno_items` | Servicios de cada turno | **Copia** nombre, precio y duración al reservar: los cambios de precio no afectan turnos existentes. |
| `pagos` | Señas, pagos parciales y totales, ingresos sueltos | Monto > 0. Si el medio es `credito` debe indicar la gift card/saldo y no puede superar lo disponible. |
| `creditos` | Gift cards y saldo a favor | El dinero cuenta como ingreso al venderse; el canje no se vuelve a contar. |
| `categorias_gasto`, `gastos` | Gastos | Categorías marcadas `es_insumo` se comparan con el % de insumos. |
| `categorias_foto`, `fotos` | Galería | Archivos en Storage (bucket `fotos`). |
| `promociones`, `promocion_servicios` | Promos por %, monto fijo, combo, por fidelidad (`min_visitas`) | Nunca se aplican solas. |
| `cumpleanos_extra` | Cumpleaños/fechas que no son de clientas | |
| `avisos`, `aviso_clientas` | Listas para avisar (ej. turnos de diciembre) | |
| `calendario_personal` | Calendario privado | Cada usuaria ve solo lo suyo. |

## Vistas (respetan RLS: `security_invoker`)

- `turnos_detalle`: turno + nombre de clienta + servicios + pagado + saldo + `estado_pago` (`pendiente`, `sena`, `parcial`, `pagado`, `sin_cargo`).
- `clientas_resumen`: visitas, última visita, inasistencias, cancelaciones, próximo turno, deuda y saldo a favor.
- `ingresos`: pagos reales (sin canjes) + ventas de gift cards / saldos a favor.
- `creditos_saldo`: créditos con saldo disponible.

## Funciones (RPC)

Públicas (las usa la web): `ajustes_publicos()`, `horarios_disponibles_web(servicios, fecha)`, `dias_disponibles_web(servicios, desde, hasta)`, `solicitar_turno(...)`, `hay_duena()`.

`solicitar_turno` valida todo del lado del servidor: servicios activos, al menos un servicio principal, nombre y un contacto (WhatsApp o Instagram), que el horario siga libre (con bloqueo para reservas simultáneas), límite de pedidos pendientes por persona, y guarda el precio vigente. Si el WhatsApp o Instagram coincide con una ficha existente la vincula; si no, queda para que la manicurista decida.

Del panel (requieren ser staff): `guardar_turno`, `conflictos_horario`, `horarios_disponibles`, `vincular_turno_clienta`, `buscar_posibles_duplicadas`, `resumen_finanzas`, `planilla_movimientos`, `resumen_dashboard`, `aviso_agregar_clientas`, `agregar_staff`, `listar_equipo`.

## Seguridad

- RLS activado en **todas** las tablas. Política general: solo staff (`es_staff()`).
- El público solo puede **leer** servicios activos y visibles, fotos visibles, categorías y promociones vigentes visibles. No puede leer clientas, turnos, pagos ni finanzas.
- Las funciones internas tienen `EXECUTE` revocado para `anon`.
- Storage: lectura pública del bucket `fotos` (es el portfolio), escritura solo staff, máximo 8 MB, solo JPG/PNG/WebP. Las fotos se comprimen en el celular antes de subir.
- La `anon key` del frontend es pública por diseño; la `service_role` key nunca se usa en el frontend.

## Zona horaria

Los horarios se guardan como `timestamptz` y se interpretan en `ajustes_negocio.zona_horaria` (por defecto `America/Argentina/Buenos_Aires`), tanto en la base como en la app. Una clienta que reserva desde otro país ve los horarios del negocio.

## Normalización de teléfonos

`normalizar_telefono()` (y su copia en `src/lib/telefono.ts`) lleva cualquier formato al usado por WhatsApp: `11 1234-5678`, `011 15 1234-5678` y `+54 9 11 1234 5678` → `5491112345678`. Así se detectan duplicados aunque se escriban distinto.
