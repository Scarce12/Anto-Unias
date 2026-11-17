# Requisitos y propuesta técnica

Este documento cruza **el video de la agenda en papel** (`_analisis/`) con el prompt general y fija las decisiones del proyecto.

## 1. Lo que muestra el video (cómo trabaja hoy)

| Hoja de la agenda | Qué contiene | Cómo se traduce en la app |
|---|---|---|
| **Cumpleaños** (12 recuadros, uno por mes) | Nombres de clientas, familia y amigas; también "14 de mayo — Día de la manicura" | Sección **Cumpleaños** con la misma grilla de 12 meses. Cumpleaños de clientas (desde su ficha) + cumpleaños/fechas personales sueltas. Aviso de cumpleaños próximos y mensaje de saludo por WhatsApp. |
| **Calendario personal** | Grilla anual de puntos | Sección privada opcional **Mi calendario** (grilla anual con marcas). Ella dijo que ahora no lo usa pero lo va a usar. |
| **Agenda diaria** (08:00 a 22:30, cada 30 min) | Nombre de la clienta en el horario; línea hasta que termina; tachado = cancelado; también cosas personales (yoga, sesión de fotos) | **Agenda** día/semana/mes con la misma franja horaria configurable. Cancelados se ven tachados. Las cosas personales son **bloqueos** con motivo. |
| **Planilla semanal** | Día · Clienta · Procedimiento · Valor · EF · T; al pie: total semana en efectivo, en transferencia y total | Reporte **Planilla semanal** idéntico (con Mercado Pago y otros medios además), exportable a CSV. Se arma sola a partir de los turnos y pagos. |
| Anotaciones "A favor $3.000" y "x + $3.000" | Plata a favor de la clienta / pagos divididos | **Saldo a favor** de la clienta y **pagos múltiples** por turno (seña + resto, mitad efectivo y mitad transferencia). |
| Fila "Gift Card — Semi + Deco" | Venden gift cards | **Gift cards**: se venden (cuenta como ingreso ese día) y se canjean en un turno (no se cuenta dos veces). |
| **Hoja de reparto** (últimas hojas) | Día · Servicio · Total · 30% uñas · 70% sueldo. En el audio aclara que el 30% lo divide en 15% ganancia + 15% insumos | **Reparto de ingresos** configurable (por defecto 70% sueldo · 15% ganancia · 15% insumos) por día, semana y mes. Se compara el 15% de insumos con los gastos reales. |
| **"Lista de Pochitas"** | N°, nombre y apellido, teléfono, si la avisó (✓/✗), si es clienta fija | Ficha de clienta con marca **Clienta fija**. Módulo **Avisos** (ej. "Turnos de diciembre"): lista de clientas con tilde de avisada, botón de WhatsApp con mensaje prearmado y contador. |
| Procedimientos escritos | Semi liso, Semi + deco, Semi + retiro + arreglo, Tradicional, Capping liso, Capping + deco, Capping + French, Retiro de sistema, Service de esculpidas + deco, "Deco x10", "Arreglo"… | **Servicios** + **adicionales** (deco, arreglo, retiro, French) que suman precio y duración. El importe de cada turno se puede ajustar a mano. Se ofrecen estos nombres como *sugerencias* para cargar con un clic (sin precios inventados). |

## 2. Decisiones de producto

- **Clientas**: solo el nombre es obligatorio. WhatsApp e Instagram opcionales, únicos si existen (normalizados). Aviso de posibles duplicados antes de guardar; nunca se fusiona solo.
- **Reservas web**: quedan *pendientes* (salvo confirmación automática activada). Los datos de contacto viajan con la solicitud; al confirmar, ella decide si es una clienta existente (con sugerencias) o una nueva.
- **Precios históricos**: el turno guarda nombre, precio y duración de cada servicio en el momento de reservarlo.
- **Superposición**: imposible a nivel base de datos (restricción de exclusión sobre rangos de tiempo) y también se valida en la interfaz.
- **Ingresos** = pagos recibidos (efectivo, transferencia, Mercado Pago, otro). Canjear gift card o saldo a favor no es ingreso nuevo.
- **Sin datos inventados**: nombre del negocio, horarios, precios, links, etc. se cargan en *Ajustes*. La web pública muestra estados vacíos prolijos hasta tener datos.
- **WhatsApp**: enlaces `wa.me` con mensajes prearmados editables. Sin envíos automáticos simulados (se documenta la API oficial para el futuro).

## 3. Arquitectura

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS. React Router, TanStack Query (caché y sincronización), React Hook Form + Zod (validación), date-fns (fechas), Recharts (gráficos), lucide-react (íconos). **PWA**: se puede instalar en el celular como una app.
- **Backend**: Supabase (PostgreSQL + Auth + Storage). La lógica crítica vive en la base: restricciones, triggers y funciones RPC (`disponibilidad`, `solicitar_turno`, totales).
- **Seguridad**: RLS en todas las tablas. El público solo lee servicios/galería/promos activas y ajustes públicos, y reserva únicamente mediante una función controlada. Todo lo demás requiere usuaria con rol de staff.
- **Zona horaria**: `America/Argentina/Buenos_Aires` (configurable). Fechas guardadas como `timestamptz`.
- **Escalable**: tabla de `perfiles` con rol (`duena`, `staff`) para sumar personas en el futuro.

### Estructura de carpetas

```
src/
  app/            router, providers, layout raíz
  components/ui/  botones, inputs, modales, badges… (reutilizables)
  components/     piezas compartidas (WhatsAppButton, ClientPicker…)
  features/       un módulo por área (agenda, clientas, servicios, finanzas, …)
    <modulo>/api.ts        acceso a datos (Supabase)
    <modulo>/hooks.ts      React Query
    <modulo>/schemas.ts    validaciones Zod
    <modulo>/components/   UI del módulo
  lib/            supabase client, fechas, dinero, normalización, whatsapp
  pages/          páginas públicas y del panel
supabase/
  migrations/     SQL versionado
  tests/          pruebas SQL
```

## 4. Modelo de datos (resumen)

`ajustes_negocio`, `perfiles`, `clientas`, `categorias_servicio`, `servicios`, `horarios_laborales`, `bloqueos`, `turnos`, `turno_items`, `pagos`, `creditos` (gift cards y saldo a favor), `gastos`, `categorias_gasto`, `fotos`, `categorias_foto`, `promociones`, `promocion_servicios`, `cumpleanos_extra`, `avisos`, `aviso_clientas`, `mensajes_plantilla`, `calendario_personal`.

Detalle completo en `docs/02_BASE_DE_DATOS.md` y en `supabase/migrations/`.
