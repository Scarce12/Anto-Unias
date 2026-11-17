# Notificaciones automáticas (para una versión futura)

Hoy los mensajes se abren en WhatsApp ya escritos y la manicurista los envía (sin costo y sin riesgo de bloqueo). Para automatizarlos de verdad hay que usar la **API oficial de WhatsApp Business (WhatsApp Cloud API de Meta)**. No se simula nada.

## Qué hace falta

1. Una cuenta de **Meta Business** verificada y un número dedicado (no puede ser el mismo WhatsApp que usa en el celular con la app común, salvo que se migre).
2. **Plantillas aprobadas** por Meta para mensajes iniciados por el negocio (recordatorio, confirmación). Cada conversación iniciada por el negocio tiene costo según la tarifa de Meta para Argentina.
3. Un token permanente de la API (se guarda como *secret* en Supabase, nunca en el frontend).

## Cómo encaja en lo que ya está hecho

- Los turnos ya guardan `confirmacion_enviada_en` y `recordatorio_enviado_en`.
- Se agrega una **Supabase Edge Function** `enviar-recordatorios` que:
  1. Busca turnos `confirmado` de mañana con `recordatorio_enviado_en is null` y clienta con WhatsApp.
  2. Llama a `POST https://graph.facebook.com/v{version}/{phone-number-id}/messages` con la plantilla aprobada.
  3. Marca `recordatorio_enviado_en`.
- Se programa con **Supabase Cron** (`pg_cron`) una vez por día (ej. 10:00).
- Opcional: webhook de Meta para guardar respuestas (“confirmo”, “no puedo”).

Alternativas más simples: recordatorios por **email** (Supabase + Resend) o notificaciones **push** de la PWA a la manicurista (“tenés 3 pedidos nuevos”).
