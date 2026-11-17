# Gestión de uñas — web pública + panel administrativo

Aplicación web para el emprendimiento de manicura: la página que ven las clientas (servicios, precios, trabajos y pedido de turnos online) y el panel privado para manejar todo el negocio desde el celular (agenda, clientas, pagos y señas, finanzas, galería, cumpleaños, avisos y más).

Está pensada a partir de **cómo trabaja hoy con su agenda en papel** (ver [docs/01_REQUISITOS_Y_PROPUESTA.md](docs/01_REQUISITOS_Y_PROPUESTA.md)): la grilla diaria de 08:00 a 22:30, la planilla semanal con efectivo/transferencia, el reparto 70% sueldo · 15% ganancia · 15% insumos, la hoja de cumpleaños y la lista de clientas para avisar.

## Qué incluye

| Web pública | Panel privado |
|---|---|
| Inicio con presentación, portada, trabajos destacados, horarios y ubicación | **Inicio**: turnos de hoy y mañana, pedidos por confirmar, ingresos del día y del mes, alertas (sin seña, sin recordatorio, turnos sin cerrar, deudas), cumpleaños de la semana |
| Catálogo de servicios con precios y duración | **Agenda** día / semana / mes, bloqueos y vacaciones, sin superposiciones |
| Galería tipo Instagram con categorías | **Clientas**: solo el nombre es obligatorio, detección de duplicados, ficha con historial, pagos, deudas, inasistencias y observaciones |
| Pedido de turno en 5 pasos con horarios realmente libres | **Servicios** con adicionales (deco, retiro, French…), fotos y categorías |
| Botón de WhatsApp | **Pagos**: señas, pagos parciales, varios medios, gift cards y saldo a favor |
| Instalable en el celular (PWA) | **Finanzas**: resumen con comparación, planilla semanal (EF/T), reparto 70/15/15, ingresos, gastos, exportar a Excel |
| | **WhatsApp**: mensajes prearmados y editables (confirmación, recordatorio, seña, cambio, saldo, cumpleaños) |
| | **Cumpleaños** (grilla de 12 meses), **Avisos** (lista para avisar a todas), **Promociones**, **Mi calendario** (privado), **Ajustes**, **Equipo** |

## Tecnología

React 19 + TypeScript + Vite + Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage) · TanStack Query · Recharts · PWA · Hosting en Vercel.

La lógica crítica está en la base de datos (no se puede saltear desde el navegador): turnos sin superposición (restricción de exclusión), precios históricos, normalización de WhatsApp/Instagram, saldos de gift cards, políticas RLS en todas las tablas y una función controlada para las reservas públicas.

## Empezar

- **Instalar y publicar**: [docs/03_INSTALACION_Y_DESPLIEGUE.md](docs/03_INSTALACION_Y_DESPLIEGUE.md)
- **Guía de uso (para la manicurista)**: [docs/04_GUIA_DE_USO.md](docs/04_GUIA_DE_USO.md)
- **Base de datos**: [docs/02_BASE_DE_DATOS.md](docs/02_BASE_DE_DATOS.md)
- **Pruebas**: [docs/05_PRUEBAS.md](docs/05_PRUEBAS.md)
- **Notificaciones automáticas (futuro)**: [docs/06_NOTIFICACIONES_FUTURO.md](docs/06_NOTIFICACIONES_FUTURO.md)

```bash
npm install
npm run dev
```

## Estructura

```
src/
  app/          router, sesión, layout del panel y acciones rápidas globales
  components/   UI reutilizable (botones, campos, modales…) y mensajes de WhatsApp
  features/     acceso a datos y formularios por módulo (clientas, turnos, finanzas, …)
  lib/          supabase, fechas con zona horaria, dinero, teléfonos, WhatsApp, imágenes, CSV
  pages/        páginas públicas y del panel
supabase/
  migrations/   esquema, funciones, seguridad y storage (SQL)
  instalar_todo.sql  todo junto para pegar en el SQL Editor
  tests/        pruebas SQL de reglas de negocio y seguridad
tools/supabase-lite/  entorno de pruebas local sin Docker
```
