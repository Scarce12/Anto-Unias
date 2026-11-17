-- =====================================================================
-- Esquema principal — Sistema de gestión para manicurista
-- =====================================================================
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.estado_turno as enum ('pendiente', 'confirmado', 'finalizado', 'cancelado', 'no_asistio');
create type public.medio_pago   as enum ('efectivo', 'transferencia', 'mercado_pago', 'otro', 'credito');
create type public.rol_usuario  as enum ('duena', 'staff');
create type public.tipo_credito as enum ('gift_card', 'saldo_a_favor');
create type public.origen_registro as enum ('panel', 'web');

-- ---------------------------------------------------------------------
-- Perfiles (usuarias del panel)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text,
  rol        public.rol_usuario not null default 'staff',
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ajustes del negocio (una sola fila, id = 1)
-- Nada de esto se inventa: arranca vacío y se completa desde el panel.
-- ---------------------------------------------------------------------
create table public.ajustes_negocio (
  id                        smallint primary key default 1 check (id = 1),
  nombre_negocio            text,
  eslogan                   text,
  presentacion              text,
  nombre_manicurista        text,
  logo_path                 text,
  portada_path              text,
  foto_perfil_path          text,
  whatsapp                  text,
  instagram                 text,
  direccion                 text,
  zona                      text,
  maps_url                  text,
  horarios_texto            text,
  zona_horaria              text not null default 'America/Argentina/Buenos_Aires',
  codigo_pais               text not null default '54',
  -- Agenda
  agenda_hora_inicio        time not null default '08:00',
  agenda_hora_fin           time not null default '22:30',
  intervalo_turnos_min      smallint not null default 30 check (intervalo_turnos_min between 5 and 120),
  -- Reservas web
  reservas_web_activas      boolean not null default true,
  confirmacion_automatica   boolean not null default false,
  anticipacion_min_horas    smallint not null default 2 check (anticipacion_min_horas between 0 and 720),
  ventana_reserva_dias      smallint not null default 60 check (ventana_reserva_dias between 1 and 365),
  max_pendientes_por_contacto smallint not null default 2 check (max_pendientes_por_contacto between 1 and 20),
  -- Señas
  sena_requerida            boolean not null default false,
  sena_tipo                 text not null default 'monto' check (sena_tipo in ('monto', 'porcentaje')),
  sena_valor                numeric(12,2) not null default 0 check (sena_valor >= 0),
  datos_transferencia       text,
  politica_cancelacion      text,
  -- Reparto de ingresos (lo que hoy hace en la agenda: 70% sueldo, 30% = 15% ganancia + 15% insumos)
  reparto_sueldo_pct        numeric(5,2) not null default 70,
  reparto_ganancia_pct      numeric(5,2) not null default 15,
  reparto_insumos_pct       numeric(5,2) not null default 15,
  -- Plantillas de WhatsApp. Variables: {nombre} {fecha} {hora} {servicio} {total} {sena} {saldo} {negocio}
  plantilla_confirmacion    text not null default '¡Hola, {nombre}! 💅 Te confirmo tu turno para el día {fecha} a las {hora} para {servicio}. ¡Te espero!',
  plantilla_recordatorio    text not null default '¡Hola, {nombre}! Te recuerdo que mañana tenés tu turno a las {hora}. ¡Nos vemos!',
  plantilla_sena            text not null default '¡Hola, {nombre}! Te recuerdo que para confirmar tu turno necesitamos registrar la seña correspondiente. ¡Gracias!',
  plantilla_cambio          text not null default '¡Hola, {nombre}! Necesito comunicarte un cambio relacionado con tu turno del día {fecha}.',
  plantilla_saldo           text not null default '¡Hola, {nombre}! Te paso el detalle: te quedó un saldo pendiente de {saldo}. ¡Gracias!',
  plantilla_cumpleanos      text not null default '¡Feliz cumpleaños, {nombre}! 🎉💅 Que tengas un día hermoso.',
  actualizado_en            timestamptz not null default now(),
  constraint reparto_suma_100 check (reparto_sueldo_pct + reparto_ganancia_pct + reparto_insumos_pct = 100),
  constraint reparto_no_negativo check (reparto_sueldo_pct >= 0 and reparto_ganancia_pct >= 0 and reparto_insumos_pct >= 0),
  constraint agenda_rango check (agenda_hora_fin > agenda_hora_inicio)
);
insert into public.ajustes_negocio (id) values (1);

-- ---------------------------------------------------------------------
-- Clientas — solo el nombre es obligatorio
-- ---------------------------------------------------------------------
create table public.clientas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(btrim(nombre)) between 1 and 80),
  apellido        text check (apellido is null or length(btrim(apellido)) <= 80),
  whatsapp        text check (whatsapp is null or length(whatsapp) <= 30),
  whatsapp_norm   text,
  instagram       text check (instagram is null or length(instagram) <= 60),
  instagram_norm  text,
  cumple_dia      smallint check (cumple_dia between 1 and 31),
  cumple_mes      smallint check (cumple_mes between 1 and 12),
  cumple_anio     smallint check (cumple_anio between 1900 and 2100),
  es_fija         boolean not null default false,
  alergias        text,
  observaciones   text,
  origen          public.origen_registro not null default 'panel',
  activa          boolean not null default true,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now(),
  constraint cumple_completo check ((cumple_dia is null) = (cumple_mes is null))
);
-- Un WhatsApp / Instagram no puede quedar en dos fichas. El nombre NO es único.
create unique index clientas_whatsapp_unico  on public.clientas (whatsapp_norm)  where whatsapp_norm is not null;
create unique index clientas_instagram_unico on public.clientas (instagram_norm) where instagram_norm is not null;
create index clientas_nombre_trgm on public.clientas using gin ((lower(nombre || ' ' || coalesce(apellido, ''))) extensions.gin_trgm_ops);
create index clientas_cumple on public.clientas (cumple_mes, cumple_dia);

-- ---------------------------------------------------------------------
-- Servicios
-- ---------------------------------------------------------------------
create table public.categorias_servicio (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique check (length(btrim(nombre)) between 1 and 60),
  orden   int not null default 0
);

create table public.servicios (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid references public.categorias_servicio (id) on delete set null,
  nombre         text not null check (length(btrim(nombre)) between 1 and 80),
  descripcion    text,
  precio         numeric(12,2) not null default 0 check (precio >= 0),
  duracion_min   int not null default 60 check (duracion_min between 5 and 600),
  es_adicional   boolean not null default false,   -- deco, arreglo, French… se suman a un servicio base
  foto_path      text,
  activo         boolean not null default true,
  visible_web    boolean not null default true,
  orden          int not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index servicios_activos on public.servicios (activo, visible_web, orden);

-- ---------------------------------------------------------------------
-- Disponibilidad
-- ---------------------------------------------------------------------
-- Varias franjas por día permiten cortes (descansos fijos): ej. 9-13 y 15-20.
create table public.horarios_laborales (
  id           uuid primary key default gen_random_uuid(),
  dia_semana   smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora_inicio  time not null,
  hora_fin     time not null,
  constraint franja_valida check (hora_fin > hora_inicio),
  constraint franjas_sin_superponer exclude using gist (
    dia_semana with =,
    tsrange(('2000-01-01'::date + hora_inicio), ('2000-01-01'::date + hora_fin)) with &&
  )
);

create table public.bloqueos (
  id          uuid primary key default gen_random_uuid(),
  inicio      timestamptz not null,
  fin         timestamptz not null,
  motivo      text check (motivo is null or length(motivo) <= 120),
  tipo        text not null default 'personal' check (tipo in ('personal', 'vacaciones', 'descanso', 'feriado', 'otro')),
  todo_el_dia boolean not null default false,
  creado_en   timestamptz not null default now(),
  constraint bloqueo_valido check (fin > inicio)
);
create index bloqueos_rango on public.bloqueos using gist (tstzrange(inicio, fin, '[)'));

-- ---------------------------------------------------------------------
-- Promociones (antes que turnos, porque un turno puede referenciarlas)
-- ---------------------------------------------------------------------
create table public.promociones (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (length(btrim(nombre)) between 1 and 80),
  descripcion   text,
  tipo          text not null check (tipo in ('porcentaje', 'monto_fijo', 'combo')),
  valor         numeric(12,2) not null check (valor >= 0),
  fecha_inicio  date not null,
  fecha_fin     date not null,
  min_visitas   int check (min_visitas is null or min_visitas > 0), -- beneficio por fidelidad
  activa        boolean not null default true,
  visible_web   boolean not null default false,
  creado_en     timestamptz not null default now(),
  constraint promo_fechas check (fecha_fin >= fecha_inicio),
  constraint promo_pct check (tipo <> 'porcentaje' or valor <= 100)
);

create table public.promocion_servicios (
  promocion_id uuid not null references public.promociones (id) on delete cascade,
  servicio_id  uuid not null references public.servicios (id) on delete cascade,
  primary key (promocion_id, servicio_id)
);

-- ---------------------------------------------------------------------
-- Turnos
-- ---------------------------------------------------------------------
create table public.turnos (
  id                     uuid primary key default gen_random_uuid(),
  clienta_id             uuid references public.clientas (id) on delete restrict,
  inicio                 timestamptz not null,
  fin                    timestamptz not null,
  estado                 public.estado_turno not null default 'pendiente',
  origen                 public.origen_registro not null default 'panel',
  -- Datos que deja la clienta al pedir turno desde la web (por si todavía no tiene ficha)
  solicitante_nombre     text,
  solicitante_whatsapp   text,
  solicitante_instagram  text,
  solicitante_nota       text,
  -- Importes (copia histórica: no cambian si cambia el precio del servicio)
  subtotal               numeric(12,2) not null default 0 check (subtotal >= 0),
  descuento              numeric(12,2) not null default 0 check (descuento >= 0),
  total                  numeric(12,2) generated always as (greatest(subtotal - descuento, 0)) stored,
  sena_esperada          numeric(12,2) not null default 0 check (sena_esperada >= 0),
  promocion_id           uuid references public.promociones (id) on delete set null,
  notas                  text,
  nota_estado            text,  -- motivo de cancelación / observación de inasistencia
  confirmado_en          timestamptz,
  finalizado_en          timestamptz,
  cancelado_en           timestamptz,
  confirmacion_enviada_en timestamptz,
  recordatorio_enviado_en timestamptz,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  constraint turno_rango check (fin > inicio),
  constraint turno_identificable check (clienta_id is not null or solicitante_nombre is not null),
  -- Dos turnos activos nunca pueden superponerse.
  constraint turnos_sin_superposicion exclude using gist (
    tstzrange(inicio, fin, '[)') with &&
  ) where (estado in ('pendiente', 'confirmado', 'finalizado'))
);
create index turnos_inicio on public.turnos (inicio);
create index turnos_clienta on public.turnos (clienta_id, inicio desc);
create index turnos_estado on public.turnos (estado, inicio);

create table public.turno_items (
  id            uuid primary key default gen_random_uuid(),
  turno_id      uuid not null references public.turnos (id) on delete cascade,
  servicio_id   uuid references public.servicios (id) on delete set null,
  nombre        text not null,
  precio        numeric(12,2) not null check (precio >= 0),
  duracion_min  int not null check (duracion_min between 0 and 600),
  es_adicional  boolean not null default false,
  orden         smallint not null default 0
);
create index turno_items_turno on public.turno_items (turno_id);
create index turno_items_servicio on public.turno_items (servicio_id);

-- ---------------------------------------------------------------------
-- Créditos: gift cards y saldo a favor
-- El dinero entra cuando se vende la gift card / se deja el saldo a favor.
-- ---------------------------------------------------------------------
create table public.creditos (
  id                  uuid primary key default gen_random_uuid(),
  tipo                public.tipo_credito not null,
  codigo              text unique,
  clienta_id          uuid references public.clientas (id) on delete restrict,
  comprador_nombre    text,
  beneficiaria_nombre text,
  monto               numeric(12,2) not null check (monto > 0),
  medio               public.medio_pago not null check (medio <> 'credito'),
  fecha               timestamptz not null default now(),
  vence               date,
  notas               text,
  anulado             boolean not null default false,
  creado_en           timestamptz not null default now(),
  constraint saldo_con_clienta check (tipo <> 'saldo_a_favor' or clienta_id is not null)
);
create index creditos_clienta on public.creditos (clienta_id);

-- ---------------------------------------------------------------------
-- Pagos (señas, pagos parciales, pagos totales, ingresos sueltos)
-- ---------------------------------------------------------------------
create table public.pagos (
  id          uuid primary key default gen_random_uuid(),
  fecha       timestamptz not null default now(),
  turno_id    uuid references public.turnos (id) on delete restrict,
  clienta_id  uuid references public.clientas (id) on delete restrict,
  monto       numeric(12,2) not null check (monto > 0),
  medio       public.medio_pago not null,
  credito_id  uuid references public.creditos (id) on delete restrict,
  es_sena     boolean not null default false,
  concepto    text,
  notas       text,
  creado_en   timestamptz not null default now(),
  constraint pago_credito check ((medio = 'credito') = (credito_id is not null))
);
create index pagos_fecha on public.pagos (fecha);
create index pagos_turno on public.pagos (turno_id);
create index pagos_clienta on public.pagos (clienta_id);
create index pagos_credito on public.pagos (credito_id);

-- ---------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------
create table public.categorias_gasto (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique check (length(btrim(nombre)) between 1 and 60),
  es_insumo boolean not null default false,  -- se compara contra el % de insumos del reparto
  orden     int not null default 0
);
insert into public.categorias_gasto (nombre, es_insumo, orden) values
  ('Materiales', true, 1),
  ('Esmaltes', true, 2),
  ('Herramientas', true, 3),
  ('Productos', true, 4),
  ('Mantenimiento', false, 5),
  ('Otros', false, 6);

create table public.gastos (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  descripcion   text not null check (length(btrim(descripcion)) between 1 and 120),
  categoria_id  uuid references public.categorias_gasto (id) on delete set null,
  monto         numeric(12,2) not null check (monto > 0),
  medio         public.medio_pago not null check (medio <> 'credito'),
  notas         text,
  creado_en     timestamptz not null default now()
);
create index gastos_fecha on public.gastos (fecha);

-- ---------------------------------------------------------------------
-- Galería
-- ---------------------------------------------------------------------
create table public.categorias_foto (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique check (length(btrim(nombre)) between 1 and 60),
  orden   int not null default 0
);

create table public.fotos (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  categoria_id  uuid references public.categorias_foto (id) on delete set null,
  servicio_id   uuid references public.servicios (id) on delete set null,
  descripcion   text check (descripcion is null or length(descripcion) <= 300),
  destacada     boolean not null default false,
  visible       boolean not null default true,
  orden         int not null default 0,
  creado_en     timestamptz not null default now()
);
create index fotos_visibles on public.fotos (visible, destacada, orden);

-- ---------------------------------------------------------------------
-- Cumpleaños y fechas que no son de clientas (familia, amigas, "Día de la manicura")
-- ---------------------------------------------------------------------
create table public.cumpleanos_extra (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null check (length(btrim(nombre)) between 1 and 80),
  dia     smallint not null check (dia between 1 and 31),
  mes     smallint not null check (mes between 1 and 12),
  anio    smallint check (anio between 1900 and 2100),
  tipo    text not null default 'personal' check (tipo in ('personal', 'fecha_especial')),
  notas   text
);

-- ---------------------------------------------------------------------
-- Avisos (la "Lista de Pochitas": avisar a todas para que ninguna se quede sin turno)
-- ---------------------------------------------------------------------
create table public.avisos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (length(btrim(titulo)) between 1 and 80),
  mensaje    text not null default '',
  archivado  boolean not null default false,
  creado_en  timestamptz not null default now()
);

create table public.aviso_clientas (
  aviso_id    uuid not null references public.avisos (id) on delete cascade,
  clienta_id  uuid not null references public.clientas (id) on delete cascade,
  avisada     boolean not null default false,
  avisada_en  timestamptz,
  nota        text,
  primary key (aviso_id, clienta_id)
);

-- ---------------------------------------------------------------------
-- Calendario personal (privado de cada usuaria)
-- ---------------------------------------------------------------------
create table public.calendario_personal (
  perfil_id  uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  fecha      date not null,
  marca      text not null check (marca in ('periodo', 'sintoma', 'nota')),
  nota       text,
  primary key (perfil_id, fecha, marca)
);
