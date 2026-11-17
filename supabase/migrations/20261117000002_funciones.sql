-- =====================================================================
-- Funciones, triggers y RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.es_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid());
$$;

create or replace function public.zona_negocio()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((select zona_horaria from public.ajustes_negocio where id = 1), 'America/Argentina/Buenos_Aires');
$$;

-- Normaliza un teléfono al formato internacional que usa WhatsApp (solo dígitos).
-- Pensado para Argentina: quita 0 de larga distancia y el 15 de celulares, agrega 549.
-- La misma lógica existe en src/lib/phone.ts
create or replace function public.normalizar_telefono(p text, p_pais text default '54')
returns text
language plpgsql immutable
as $$
declare
  d text;
  internacional boolean;
  a int;
begin
  if p is null or btrim(p) = '' then return null; end if;
  internacional := btrim(p) like '+%' or btrim(p) like '00%';
  d := regexp_replace(p, '\D', '', 'g');
  if d = '' then return null; end if;
  if d like '00%' then d := substr(d, 3); end if;

  if p_pais = '54' then
    if d like '549%' and length(d) = 13 then return d; end if;
    if d like '54%' and length(d) = 12 then return '549' || substr(d, 3); end if;
    if internacional and not d like '54%' then return d; end if;
    if d like '0%' then d := substr(d, 2); end if;
    if length(d) = 12 then
      -- código de área de 2, 3 o 4 dígitos seguido de 15
      for a in 2..4 loop
        if substr(d, a + 1, 2) = '15' then
          d := substr(d, 1, a) || substr(d, a + 3);
          exit;
        end if;
      end loop;
    end if;
    if length(d) = 10 then return '549' || d; end if;
    return d;
  end if;

  if internacional or d like p_pais || '%' then return d; end if;
  return p_pais || d;
end;
$$;

create or replace function public.normalizar_instagram(p text)
returns text
language sql immutable
as $$
  select nullif(
    lower(regexp_replace(regexp_replace(btrim(coalesce(p, '')),
      '^(https?://)?(www\.)?instagram\.com/', '', 'i'), '^@+|/.*$', '', 'g')),
    '');
$$;

create or replace function public.normalizar_texto(p text)
returns text
language sql stable
as $$
  select lower(btrim(regexp_replace(extensions.unaccent(coalesce(p, '')), '\s+', ' ', 'g')));
$$;

create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'clientas' then
    new.actualizada_en := now();
  else
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfiles: la primera persona que se registra es la dueña.
-- El resto no obtiene acceso salvo que la dueña lo agregue.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_inicial()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.perfiles) then
    insert into public.perfiles (id, nombre, rol)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)), 'duena');
  end if;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_inicial();

-- ---------------------------------------------------------------------
-- Clientas: normalización
-- ---------------------------------------------------------------------
create or replace function public.clientas_normalizar()
returns trigger language plpgsql as $$
declare
  pais text := coalesce((select codigo_pais from public.ajustes_negocio where id = 1), '54');
begin
  new.nombre := btrim(regexp_replace(new.nombre, '\s+', ' ', 'g'));
  new.apellido := nullif(btrim(regexp_replace(coalesce(new.apellido, ''), '\s+', ' ', 'g')), '');
  new.whatsapp := nullif(btrim(coalesce(new.whatsapp, '')), '');
  new.instagram := nullif(btrim(coalesce(new.instagram, '')), '');
  new.whatsapp_norm := public.normalizar_telefono(new.whatsapp, pais);
  new.instagram_norm := public.normalizar_instagram(new.instagram);
  if new.instagram_norm is not null then
    new.instagram := '@' || new.instagram_norm;
  end if;
  return new;
end;
$$;

create trigger clientas_normalizar
  before insert or update on public.clientas
  for each row execute function public.clientas_normalizar();
create trigger clientas_actualizada
  before update on public.clientas
  for each row execute function public.tocar_actualizado();
create trigger servicios_actualizado
  before update on public.servicios
  for each row execute function public.tocar_actualizado();
create trigger turnos_actualizado
  before update on public.turnos
  for each row execute function public.tocar_actualizado();
create trigger ajustes_actualizado
  before update on public.ajustes_negocio
  for each row execute function public.tocar_actualizado();

-- Posibles duplicados antes de crear/editar una clienta (no fusiona nada).
create or replace function public.buscar_posibles_duplicadas(
  p_nombre text, p_apellido text default null, p_whatsapp text default null,
  p_instagram text default null, p_excluir uuid default null)
returns table (id uuid, nombre text, apellido text, whatsapp text, instagram text, motivo text, bloqueante boolean)
language plpgsql stable
as $$
declare
  pais text := coalesce((select codigo_pais from public.ajustes_negocio where ajustes_negocio.id = 1), '54');
  w text := public.normalizar_telefono(p_whatsapp, pais);
  i text := public.normalizar_instagram(p_instagram);
  completo text := public.normalizar_texto(coalesce(p_nombre, '') || ' ' || coalesce(p_apellido, ''));
begin
  return query
  select c.id, c.nombre, c.apellido, c.whatsapp, c.instagram,
         case
           when w is not null and c.whatsapp_norm = w then 'Mismo WhatsApp'
           when i is not null and c.instagram_norm = i then 'Mismo Instagram'
           when public.normalizar_texto(c.nombre || ' ' || coalesce(c.apellido, '')) = completo then 'Mismo nombre'
           else 'Nombre parecido'
         end,
         (w is not null and c.whatsapp_norm = w) or (i is not null and c.instagram_norm = i)
  from public.clientas c
  where (p_excluir is null or c.id <> p_excluir)
    and (
      (w is not null and c.whatsapp_norm = w)
      or (i is not null and c.instagram_norm = i)
      or (length(completo) >= 3 and (
            public.normalizar_texto(c.nombre || ' ' || coalesce(c.apellido, '')) = completo
            or extensions.similarity(lower(c.nombre || ' ' || coalesce(c.apellido, '')), completo) >= 0.55
            -- solo nombre de pila cargado ("Camila") contra "Camila Pérez"
            or (p_apellido is null and public.normalizar_texto(c.nombre) = public.normalizar_texto(p_nombre))
         ))
    )
  order by 7 desc, 6
  limit 10;
end;
$$;

-- ---------------------------------------------------------------------
-- Turnos: subtotal a partir de los ítems
-- ---------------------------------------------------------------------
create or replace function public.recalcular_subtotal()
returns trigger language plpgsql as $$
declare
  t uuid := coalesce(new.turno_id, old.turno_id);
begin
  update public.turnos
     set subtotal = coalesce((select sum(precio) from public.turno_items where turno_id = t), 0)
   where id = t;
  return null;
end;
$$;

create trigger turno_items_subtotal
  after insert or update or delete on public.turno_items
  for each row execute function public.recalcular_subtotal();

-- Marcas de tiempo automáticas al cambiar de estado
create or replace function public.turnos_estado_marcas()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'confirmado' then new.confirmado_en := coalesce(new.confirmado_en, now()); end if;
    if new.estado = 'finalizado' then new.finalizado_en := now(); end if;
    if new.estado = 'cancelado' then new.cancelado_en := now(); end if;
  end if;
  return new;
end;
$$;

create trigger turnos_estado_marcas
  before insert or update on public.turnos
  for each row execute function public.turnos_estado_marcas();

-- ---------------------------------------------------------------------
-- Créditos: saldo disponible y control de canje
-- ---------------------------------------------------------------------
create or replace function public.saldo_credito(p_credito uuid)
returns numeric
language sql stable
as $$
  select c.monto - coalesce((select sum(p.monto) from public.pagos p where p.credito_id = c.id), 0)
  from public.creditos c where c.id = p_credito;
$$;

create or replace function public.pagos_validar()
returns trigger language plpgsql as $$
declare
  c public.creditos;
  usado numeric;
begin
  if new.credito_id is not null then
    select * into c from public.creditos where id = new.credito_id for update;
    if c.anulado then
      raise exception 'Esa gift card / saldo está anulado.' using errcode = 'P0001';
    end if;
    if c.vence is not null and c.vence < (new.fecha at time zone public.zona_negocio())::date then
      raise exception 'La gift card está vencida.' using errcode = 'P0001';
    end if;
    select coalesce(sum(monto), 0) into usado from public.pagos
     where credito_id = c.id and id <> new.id;
    if usado + new.monto > c.monto then
      raise exception 'El crédito no alcanza: quedan % disponibles.', (c.monto - usado) using errcode = 'P0001';
    end if;
  end if;
  -- Si el pago es de un turno, hereda la clienta del turno
  if new.turno_id is not null and new.clienta_id is null then
    select clienta_id into new.clienta_id from public.turnos where id = new.turno_id;
  end if;
  return new;
end;
$$;

create trigger pagos_validar
  before insert or update on public.pagos
  for each row execute function public.pagos_validar();

-- ---------------------------------------------------------------------
-- Vistas (security_invoker: respetan RLS de quien consulta)
-- ---------------------------------------------------------------------
create or replace view public.turnos_detalle
with (security_invoker = true) as
select
  t.*,
  coalesce(c.nombre || coalesce(' ' || c.apellido, ''), t.solicitante_nombre) as clienta_nombre,
  c.nombre                                     as clienta_nombre_pila,
  coalesce(c.whatsapp, t.solicitante_whatsapp) as contacto_whatsapp,
  coalesce(c.instagram, t.solicitante_instagram) as contacto_instagram,
  c.alergias                                   as clienta_alergias,
  c.es_fija                                    as clienta_fija,
  coalesce((select string_agg(i.nombre, ' + ' order by i.es_adicional, i.orden)
              from public.turno_items i where i.turno_id = t.id), '') as servicios_texto,
  coalesce(pg.pagado, 0)                       as pagado,
  coalesce(pg.sena_pagada, 0)                  as sena_pagada,
  greatest(t.total - coalesce(pg.pagado, 0), 0) as saldo,
  case
    when t.total = 0 then 'sin_cargo'
    when coalesce(pg.pagado, 0) >= t.total then 'pagado'
    when coalesce(pg.pagado, 0) > 0 and coalesce(pg.pagado, 0) = coalesce(pg.sena_pagada, 0) then 'sena'
    when coalesce(pg.pagado, 0) > 0 then 'parcial'
    else 'pendiente'
  end as estado_pago
from public.turnos t
left join public.clientas c on c.id = t.clienta_id
left join lateral (
  select sum(p.monto) as pagado,
         sum(p.monto) filter (where p.es_sena) as sena_pagada
    from public.pagos p where p.turno_id = t.id
) pg on true;

-- Ingresos reales: pagos (salvo canjes de crédito) + ventas de gift card / saldos a favor
create or replace view public.ingresos
with (security_invoker = true) as
select p.id, p.fecha, p.monto, p.medio, p.clienta_id, p.turno_id,
       coalesce(p.concepto, case when p.es_sena then 'Seña' else 'Pago' end) as concepto,
       'pago'::text as origen
  from public.pagos p
 where p.medio <> 'credito'
union all
select c.id, c.fecha, c.monto, c.medio, c.clienta_id, null::uuid,
       case c.tipo when 'gift_card' then 'Gift card' || coalesce(' ' || c.codigo, '') else 'Saldo a favor' end,
       'credito'::text
  from public.creditos c
 where not c.anulado;

create or replace view public.clientas_resumen
with (security_invoker = true) as
select
  c.*,
  coalesce(v.visitas, 0)        as visitas,
  v.ultima_visita,
  v.primera_visita,
  coalesce(v.inasistencias, 0)  as inasistencias,
  coalesce(v.cancelaciones, 0)  as cancelaciones,
  v.proximo_turno,
  coalesce(v.deuda, 0)          as deuda,
  coalesce(cr.saldo_a_favor, 0) as saldo_a_favor
from public.clientas c
left join lateral (
  select
    count(*) filter (where t.estado = 'finalizado') as visitas,
    max(t.inicio) filter (where t.estado = 'finalizado') as ultima_visita,
    min(t.inicio) filter (where t.estado = 'finalizado') as primera_visita,
    count(*) filter (where t.estado = 'no_asistio') as inasistencias,
    count(*) filter (where t.estado = 'cancelado') as cancelaciones,
    min(t.inicio) filter (where t.estado in ('pendiente', 'confirmado') and t.inicio >= now()) as proximo_turno,
    sum(greatest(t.total - coalesce((select sum(p.monto) from public.pagos p where p.turno_id = t.id), 0), 0))
      filter (where t.estado = 'finalizado') as deuda
  from public.turnos t where t.clienta_id = c.id
) v on true
left join lateral (
  select sum(public.saldo_credito(cr.id)) as saldo_a_favor
  from public.creditos cr
  where cr.clienta_id = c.id and cr.tipo = 'saldo_a_favor' and not cr.anulado
) cr on true;

create or replace view public.creditos_saldo
with (security_invoker = true) as
select c.*,
       c.monto - coalesce((select sum(p.monto) from public.pagos p where p.credito_id = c.id), 0) as saldo,
       cl.nombre || coalesce(' ' || cl.apellido, '') as clienta_nombre
  from public.creditos c
  left join public.clientas cl on cl.id = c.clienta_id;

-- ---------------------------------------------------------------------
-- Disponibilidad (usada por la web pública y por el panel)
-- ---------------------------------------------------------------------
create or replace function public.horarios_disponibles(
  p_fecha date, p_duracion_min int, p_excluir_turno uuid default null, p_publico boolean default true)
returns setof timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  a public.ajustes_negocio;
  h record;
  slot timestamptz;
  ventana_fin timestamptz;
  paso interval;
  dur interval := make_interval(mins => p_duracion_min);
  minimo timestamptz;
  hoy date;
begin
  select * into a from public.ajustes_negocio where id = 1;
  if p_duracion_min is null or p_duracion_min <= 0 then return; end if;
  if not p_publico and not public.es_staff() then p_publico := true; end if;
  paso := make_interval(mins => a.intervalo_turnos_min);
  hoy := (now() at time zone a.zona_horaria)::date;

  if p_publico then
    if not a.reservas_web_activas then return; end if;
    if p_fecha < hoy or p_fecha > hoy + a.ventana_reserva_dias then return; end if;
    minimo := now() + make_interval(hours => a.anticipacion_min_horas);
  else
    minimo := '-infinity';
  end if;

  for h in
    select hora_inicio, hora_fin from public.horarios_laborales
     where dia_semana = extract(dow from p_fecha)::int
     order by hora_inicio
  loop
    slot := (p_fecha + h.hora_inicio) at time zone a.zona_horaria;
    ventana_fin := (p_fecha + h.hora_fin) at time zone a.zona_horaria;
    while slot + dur <= ventana_fin loop
      if slot >= minimo
         and not exists (
           select 1 from public.turnos t
            where t.estado in ('pendiente', 'confirmado', 'finalizado')
              and (p_excluir_turno is null or t.id <> p_excluir_turno)
              and tstzrange(t.inicio, t.fin, '[)') && tstzrange(slot, slot + dur, '[)'))
         and not exists (
           select 1 from public.bloqueos b
            where tstzrange(b.inicio, b.fin, '[)') && tstzrange(slot, slot + dur, '[)'))
      then
        return next slot;
      end if;
      slot := slot + paso;
    end loop;
  end loop;
end;
$$;

-- Duración total de los servicios elegidos en la web (solo activos y visibles)
create or replace function public.duracion_servicios_publicos(p_servicios uuid[])
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(s.duracion_min), 0)::int
    from public.servicios s
   where s.id = any (p_servicios) and s.activo and s.visible_web;
$$;

create or replace function public.horarios_disponibles_web(p_servicios uuid[], p_fecha date)
returns setof timestamptz
language sql stable security definer set search_path = public
as $$
  select public.horarios_disponibles(p_fecha, public.duracion_servicios_publicos(p_servicios), null, true);
$$;

create or replace function public.dias_disponibles_web(p_servicios uuid[], p_desde date, p_hasta date)
returns setof date
language plpgsql stable security definer set search_path = public
as $$
declare
  d date;
  dur int := public.duracion_servicios_publicos(p_servicios);
begin
  if dur <= 0 or p_hasta < p_desde or p_hasta - p_desde > 92 then return; end if;
  d := p_desde;
  while d <= p_hasta loop
    if exists (select 1 from public.horarios_disponibles(d, dur, null, true)) then
      return next d;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Reserva desde la web pública
-- ---------------------------------------------------------------------
create or replace function public.solicitar_turno(
  p_servicios uuid[], p_inicio timestamptz, p_nombre text,
  p_whatsapp text default null, p_instagram text default null, p_nota text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  a public.ajustes_negocio;
  dur int;
  fecha_local date;
  nuevo uuid;
  w text;
  i text;
  clienta uuid;
  pendientes int;
  estado_inicial public.estado_turno;
  srv record;
  n int := 0;
begin
  select * into a from public.ajustes_negocio where id = 1;
  if not a.reservas_web_activas then
    raise exception 'Las reservas online están pausadas en este momento.' using errcode = 'P0001';
  end if;

  p_nombre := btrim(coalesce(p_nombre, ''));
  if length(p_nombre) < 2 or length(p_nombre) > 80 then
    raise exception 'Ingresá tu nombre.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_nota, '')) > 500 then
    raise exception 'La nota es demasiado larga.' using errcode = 'P0001';
  end if;

  w := public.normalizar_telefono(p_whatsapp, a.codigo_pais);
  i := public.normalizar_instagram(p_instagram);
  if w is null and i is null then
    raise exception 'Dejanos un WhatsApp o un Instagram para poder confirmarte el turno.' using errcode = 'P0001';
  end if;
  if w is not null and (length(w) < 8 or length(w) > 15) then
    raise exception 'El número de WhatsApp no parece válido.' using errcode = 'P0001';
  end if;

  if p_servicios is null or cardinality(p_servicios) = 0 or cardinality(p_servicios) > 6 then
    raise exception 'Elegí al menos un servicio.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.servicios s where s.id = any (p_servicios) and s.activo and s.visible_web)
     <> cardinality(array(select distinct unnest(p_servicios))) then
    raise exception 'Alguno de los servicios elegidos ya no está disponible.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.servicios s where s.id = any (p_servicios) and not s.es_adicional) then
    raise exception 'Elegí un servicio principal (los adicionales se suman a un servicio).' using errcode = 'P0001';
  end if;

  dur := public.duracion_servicios_publicos(p_servicios);
  fecha_local := (p_inicio at time zone a.zona_horaria)::date;

  -- Serializa reservas concurrentes del mismo día
  perform pg_advisory_xact_lock(hashtext('reserva:' || fecha_local::text));

  if not exists (select 1 from public.horarios_disponibles(fecha_local, dur, null, true) s where s = p_inicio) then
    raise exception 'Ese horario ya no está disponible. Elegí otro, por favor.' using errcode = 'P0001';
  end if;

  -- Vincula con una ficha existente solo si coincide un dato único (WhatsApp o Instagram)
  select c.id into clienta from public.clientas c
   where (w is not null and c.whatsapp_norm = w) or (i is not null and c.instagram_norm = i)
   order by (w is not null and c.whatsapp_norm = w) desc
   limit 1;

  select count(*) into pendientes from public.turnos t
   where t.estado = 'pendiente' and t.inicio >= now()
     and ((clienta is not null and t.clienta_id = clienta)
          or (w is not null and public.normalizar_telefono(t.solicitante_whatsapp, a.codigo_pais) = w)
          or (i is not null and public.normalizar_instagram(t.solicitante_instagram) = i));
  if pendientes >= a.max_pendientes_por_contacto then
    raise exception 'Ya tenés solicitudes pendientes. Esperá la confirmación o escribinos por WhatsApp.' using errcode = 'P0001';
  end if;

  estado_inicial := case when a.confirmacion_automatica then 'confirmado' else 'pendiente' end;

  insert into public.turnos (clienta_id, inicio, fin, estado, origen, solicitante_nombre,
                             solicitante_whatsapp, solicitante_instagram, solicitante_nota, sena_esperada)
  values (clienta, p_inicio, p_inicio + make_interval(mins => dur), estado_inicial, 'web', p_nombre,
          nullif(btrim(coalesce(p_whatsapp, '')), ''), case when i is null then null else '@' || i end,
          nullif(btrim(coalesce(p_nota, '')), ''), 0)
  returning id into nuevo;

  for srv in
    select s.* from public.servicios s where s.id = any (p_servicios)
     order by s.es_adicional, s.orden, s.nombre
  loop
    insert into public.turno_items (turno_id, servicio_id, nombre, precio, duracion_min, es_adicional, orden)
    values (nuevo, srv.id, srv.nombre, srv.precio, srv.duracion_min, srv.es_adicional, n);
    n := n + 1;
  end loop;

  if a.sena_requerida then
    update public.turnos set sena_esperada =
      case when a.sena_tipo = 'porcentaje' then round(subtotal * a.sena_valor / 100) else least(a.sena_valor, subtotal) end
     where id = nuevo;
  end if;

  return (select jsonb_build_object(
    'id', t.id, 'estado', t.estado, 'inicio', t.inicio, 'fin', t.fin,
    'total', t.total, 'sena', t.sena_esperada)
    from public.turnos t where t.id = nuevo);
exception
  when exclusion_violation then
    raise exception 'Ese horario acaba de ser reservado. Elegí otro, por favor.' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- Guardar turno desde el panel (alta, edición y reprogramación en una transacción)
-- p_items: [{ "servicio_id": uuid|null, "nombre": text, "precio": num, "duracion_min": int, "es_adicional": bool }]
-- ---------------------------------------------------------------------
create or replace function public.guardar_turno(
  p_id uuid, p_clienta_id uuid, p_inicio timestamptz, p_items jsonb,
  p_duracion_min int default null, p_estado public.estado_turno default 'confirmado',
  p_descuento numeric default 0, p_promocion_id uuid default null,
  p_sena_esperada numeric default 0, p_notas text default null)
returns uuid
language plpgsql volatile
as $$
declare
  dur int;
  tid uuid := p_id;
  it jsonb;
  n int := 0;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agregá al menos un servicio.' using errcode = 'P0001';
  end if;
  if p_clienta_id is null and p_id is null then
    raise exception 'Elegí o registrá una clienta.' using errcode = 'P0001';
  end if;

  dur := coalesce(p_duracion_min,
                  (select sum(coalesce((x ->> 'duracion_min')::int, 0)) from jsonb_array_elements(p_items) x));
  if dur is null or dur <= 0 then
    raise exception 'La duración del turno tiene que ser mayor a cero.' using errcode = 'P0001';
  end if;

  if tid is null then
    insert into public.turnos (clienta_id, inicio, fin, estado, origen, descuento, promocion_id, sena_esperada, notas)
    values (p_clienta_id, p_inicio, p_inicio + make_interval(mins => dur), p_estado, 'panel',
            coalesce(p_descuento, 0), p_promocion_id, coalesce(p_sena_esperada, 0), p_notas)
    returning id into tid;
  else
    update public.turnos
       set clienta_id = coalesce(p_clienta_id, clienta_id),
           inicio = p_inicio,
           fin = p_inicio + make_interval(mins => dur),
           estado = p_estado,
           descuento = coalesce(p_descuento, 0),
           promocion_id = p_promocion_id,
           sena_esperada = coalesce(p_sena_esperada, 0),
           notas = p_notas
     where id = tid;
    if not found then
      raise exception 'El turno no existe.' using errcode = 'P0001';
    end if;
    delete from public.turno_items where turno_id = tid;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.turno_items (turno_id, servicio_id, nombre, precio, duracion_min, es_adicional, orden)
    values (tid,
            nullif(it ->> 'servicio_id', '')::uuid,
            coalesce(nullif(btrim(it ->> 'nombre'), ''), 'Servicio'),
            coalesce((it ->> 'precio')::numeric, 0),
            coalesce((it ->> 'duracion_min')::int, 0),
            coalesce((it ->> 'es_adicional')::boolean, false),
            n);
    n := n + 1;
  end loop;

  return tid;
exception
  when exclusion_violation then
    raise exception 'Ese horario se superpone con otro turno.' using errcode = 'P0001';
end;
$$;

-- Avisos no bloqueantes para el panel: fuera de horario o sobre un bloqueo
create or replace function public.conflictos_horario(p_inicio timestamptz, p_fin timestamptz, p_excluir_turno uuid default null)
returns table (tipo text, detalle text, inicio timestamptz, fin timestamptz)
language plpgsql stable
as $$
declare
  tz text := public.zona_negocio();
  li timestamp := p_inicio at time zone tz;
  lf timestamp := p_fin at time zone tz;
begin
  return query
  select 'turno'::text, coalesce(d.clienta_nombre, 'Turno') || ' · ' || d.servicios_texto, d.inicio, d.fin
    from public.turnos_detalle d
   where d.estado in ('pendiente', 'confirmado', 'finalizado')
     and (p_excluir_turno is null or d.id <> p_excluir_turno)
     and tstzrange(d.inicio, d.fin, '[)') && tstzrange(p_inicio, p_fin, '[)');

  return query
  select 'bloqueo'::text, coalesce(b.motivo, 'Horario bloqueado'), b.inicio, b.fin
    from public.bloqueos b
   where tstzrange(b.inicio, b.fin, '[)') && tstzrange(p_inicio, p_fin, '[)');

  if li::date = lf::date or lf = (li::date + 1)::timestamp then
    if not exists (
      select 1 from public.horarios_laborales h
       where h.dia_semana = extract(dow from li)::int
         and li::time >= h.hora_inicio
         and (case when lf = (li::date + 1)::timestamp then time '24:00' else lf::time end) <= h.hora_fin
    ) then
      return query select 'fuera_de_horario'::text, 'Fuera del horario de atención'::text, p_inicio, p_fin;
    end if;
  else
    return query select 'fuera_de_horario'::text, 'El turno pasa de un día a otro'::text, p_inicio, p_fin;
  end if;
end;
$$;

-- Vincular la solicitud web con una clienta (existente o nueva). Nunca fusiona fichas.
create or replace function public.vincular_turno_clienta(p_turno uuid, p_clienta uuid)
returns void
language plpgsql volatile
as $$
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.turnos set clienta_id = p_clienta where id = p_turno;
  update public.pagos set clienta_id = p_clienta where turno_id = p_turno and clienta_id is null;
end;
$$;

-- ---------------------------------------------------------------------
-- Ajustes públicos (sin plantillas ni reparto)
-- ---------------------------------------------------------------------
create or replace function public.ajustes_publicos()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'nombre_negocio', a.nombre_negocio, 'eslogan', a.eslogan, 'presentacion', a.presentacion,
    'nombre_manicurista', a.nombre_manicurista, 'logo_path', a.logo_path, 'portada_path', a.portada_path,
    'foto_perfil_path', a.foto_perfil_path, 'whatsapp', a.whatsapp,
    'whatsapp_norm', public.normalizar_telefono(a.whatsapp, a.codigo_pais), 'instagram', a.instagram,
    'direccion', a.direccion, 'zona', a.zona, 'maps_url', a.maps_url, 'horarios_texto', a.horarios_texto,
    'zona_horaria', a.zona_horaria, 'reservas_web_activas', a.reservas_web_activas,
    'confirmacion_automatica', a.confirmacion_automatica, 'ventana_reserva_dias', a.ventana_reserva_dias,
    'sena_requerida', a.sena_requerida, 'sena_tipo', a.sena_tipo, 'sena_valor', a.sena_valor,
    'datos_transferencia', case when a.sena_requerida then a.datos_transferencia end,
    'politica_cancelacion', a.politica_cancelacion,
    'horarios', coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia_semana, 'inicio', h.hora_inicio, 'fin', h.hora_fin)
                                           order by h.dia_semana, h.hora_inicio)
                            from public.horarios_laborales h), '[]'::jsonb))
  from public.ajustes_negocio a where a.id = 1;
$$;

-- ---------------------------------------------------------------------
-- Finanzas: resumen de un período (fechas locales, ambos extremos incluidos)
-- ---------------------------------------------------------------------
create or replace function public.resumen_finanzas(p_desde date, p_hasta date)
returns jsonb
language plpgsql stable
as $$
declare
  tz text := public.zona_negocio();
  a public.ajustes_negocio;
  v_ini timestamptz;
  v_fin timestamptz;
  r jsonb;
  total_ing numeric;
  total_gas numeric;
  gas_insumos numeric;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into a from public.ajustes_negocio where id = 1;
  v_ini := p_desde::timestamp at time zone tz;
  v_fin := (p_hasta + 1)::timestamp at time zone tz;

  select coalesce(sum(monto), 0) into total_ing from public.ingresos where fecha >= v_ini and fecha < v_fin;
  select coalesce(sum(g.monto), 0), coalesce(sum(g.monto) filter (where cg.es_insumo), 0)
    into total_gas, gas_insumos
    from public.gastos g left join public.categorias_gasto cg on cg.id = g.categoria_id
   where g.fecha between p_desde and p_hasta;

  r := jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'ingresos', total_ing,
    'gastos', total_gas,
    'neto', total_ing - total_gas,
    'gastos_insumos', gas_insumos,
    'reparto', jsonb_build_object(
      'sueldo_pct', a.reparto_sueldo_pct, 'ganancia_pct', a.reparto_ganancia_pct, 'insumos_pct', a.reparto_insumos_pct,
      'sueldo', round(total_ing * a.reparto_sueldo_pct / 100, 2),
      'ganancia', round(total_ing * a.reparto_ganancia_pct / 100, 2),
      'insumos', round(total_ing * a.reparto_insumos_pct / 100, 2)),
    'por_medio', coalesce((select jsonb_agg(x order by x ->> 'medio') from (
        select jsonb_build_object('medio', medio, 'monto', sum(monto), 'cantidad', count(*)) x
          from public.ingresos where fecha >= v_ini and fecha < v_fin group by medio) s), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(x order by x ->> 'dia') from (
        select jsonb_build_object('dia', d, 'ingresos', coalesce(i.m, 0), 'gastos', coalesce(g.m, 0)) x
          from generate_series(p_desde, p_hasta, interval '1 day') d
          left join (select (fecha at time zone tz)::date dia, sum(monto) m from public.ingresos
                      where fecha >= v_ini and fecha < v_fin group by 1) i on i.dia = d::date
          left join (select fecha dia, sum(monto) m from public.gastos
                      where fecha between p_desde and p_hasta group by 1) g on g.dia = d::date) s), '[]'::jsonb),
    'gastos_por_categoria', coalesce((select jsonb_agg(x order by (x ->> 'monto')::numeric desc) from (
        select jsonb_build_object('categoria', coalesce(cg.nombre, 'Sin categoría'), 'monto', sum(g.monto)) x
          from public.gastos g left join public.categorias_gasto cg on cg.id = g.categoria_id
         where g.fecha between p_desde and p_hasta group by cg.nombre) s), '[]'::jsonb),
    'servicios', coalesce((select jsonb_agg(x order by (x ->> 'facturado')::numeric desc) from (
        select jsonb_build_object('nombre', i.nombre, 'cantidad', count(*), 'facturado', sum(i.precio)) x
          from public.turno_items i join public.turnos t on t.id = i.turno_id
         where t.estado = 'finalizado' and t.inicio >= v_ini and t.inicio < v_fin
         group by i.nombre) s), '[]'::jsonb),
    'turnos', (select jsonb_build_object(
        'finalizados', count(*) filter (where estado = 'finalizado'),
        'cancelados', count(*) filter (where estado = 'cancelado'),
        'no_asistio', count(*) filter (where estado = 'no_asistio'),
        'facturado', coalesce(sum(total) filter (where estado = 'finalizado'), 0))
        from public.turnos where inicio >= v_ini and inicio < v_fin)
  );
  return r;
end;
$$;

-- Planilla semanal / mensual: la misma tabla que hoy arma a mano en la agenda
create or replace function public.planilla_movimientos(p_desde date, p_hasta date)
returns table (fecha timestamptz, clienta text, detalle text, valor numeric, medio public.medio_pago,
               turno_id uuid, origen text)
language sql stable
as $$
  select i.fecha,
         coalesce(cl.nombre || coalesce(' ' || cl.apellido, ''), t.solicitante_nombre,
                  (select coalesce(c.beneficiaria_nombre, c.comprador_nombre) from public.creditos c where c.id = i.id)),
         coalesce((select string_agg(it.nombre, ' + ' order by it.es_adicional, it.orden)
                     from public.turno_items it where it.turno_id = i.turno_id) ||
                  case when i.concepto in ('Seña') then ' (seña)' else '' end,
                  i.concepto),
         i.monto, i.medio, i.turno_id, i.origen
    from public.ingresos i
    left join public.clientas cl on cl.id = i.clienta_id
    left join public.turnos t on t.id = i.turno_id
   where public.es_staff()
     and i.fecha >= p_desde::timestamp at time zone public.zona_negocio()
     and i.fecha < (p_hasta + 1)::timestamp at time zone public.zona_negocio()
   order by i.fecha;
$$;

-- ---------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------
create or replace function public.resumen_dashboard()
returns jsonb
language plpgsql stable
as $$
declare
  tz text := public.zona_negocio();
  hoy date := (now() at time zone tz)::date;
  ini_hoy timestamptz := hoy::timestamp at time zone tz;
  ini_man timestamptz := (hoy + 1)::timestamp at time zone tz;
  fin_man timestamptz := (hoy + 2)::timestamp at time zone tz;
  ini_mes timestamptz := date_trunc('month', hoy)::timestamp at time zone tz;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'hoy', hoy,
    'turnos_hoy', (select count(*) from public.turnos where inicio >= ini_hoy and inicio < ini_man
                     and estado in ('pendiente', 'confirmado', 'finalizado')),
    'pendientes', (select count(*) from public.turnos where estado = 'pendiente' and inicio >= now()),
    'turnos_manana', (select count(*) from public.turnos where inicio >= ini_man and inicio < fin_man
                        and estado in ('pendiente', 'confirmado')),
    'clientas', (select count(*) from public.clientas where activa),
    'clientas_fijas', (select count(*) from public.clientas where activa and es_fija),
    'ingresos_hoy', (select coalesce(sum(monto), 0) from public.ingresos where fecha >= ini_hoy and fecha < ini_man),
    'ingresos_mes', (select coalesce(sum(monto), 0) from public.ingresos where fecha >= ini_mes),
    'gastos_mes', (select coalesce(sum(monto), 0) from public.gastos where fecha >= date_trunc('month', hoy)::date),
    'sin_cerrar', (select count(*) from public.turnos where estado in ('pendiente', 'confirmado') and fin < now()),
    'sin_sena', (select count(*) from public.turnos_detalle where estado in ('pendiente', 'confirmado')
                   and inicio >= now() and sena_esperada > 0 and sena_pagada < sena_esperada),
    'con_deuda', (select count(*) from public.clientas_resumen where deuda > 0),
    'sin_recordatorio_manana', (select count(*) from public.turnos where inicio >= ini_man and inicio < fin_man
                   and estado = 'confirmado' and recordatorio_enviado_en is null),
    'top_servicios', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('nombre', i.nombre, 'cantidad', count(*)) x
          from public.turno_items i join public.turnos t on t.id = i.turno_id
         where t.estado in ('confirmado', 'finalizado') and t.inicio >= now() - interval '90 days'
         group by i.nombre order by count(*) desc limit 5) s), '[]'::jsonb),
    'cumpleanos', coalesce((select jsonb_agg(x order by (x ->> 'en_dias')::int) from (
        select jsonb_build_object('nombre', nombre, 'dia', dia, 'mes', mes, 'clienta_id', clienta_id,
                                  'whatsapp', whatsapp, 'en_dias', en_dias) x
          from (
            select c.nombre || coalesce(' ' || c.apellido, '') nombre, c.cumple_dia dia, c.cumple_mes mes,
                   c.id clienta_id, c.whatsapp,
                   public.dias_hasta_cumple(c.cumple_dia, c.cumple_mes, hoy) en_dias
              from public.clientas c where c.cumple_dia is not null and c.activa
            union all
            select e.nombre, e.dia, e.mes, null, null, public.dias_hasta_cumple(e.dia, e.mes, hoy)
              from public.cumpleanos_extra e
          ) q where en_dias <= 7) s), '[]'::jsonb)
  );
end;
$$;

create or replace function public.dias_hasta_cumple(p_dia int, p_mes int, p_hoy date)
returns int
language plpgsql immutable
as $$
declare
  anio int := extract(year from p_hoy)::int;
  f date;
  d int;
begin
  if p_dia is null or p_mes is null then return null; end if;
  for k in 0..1 loop
    -- 29/2 en años no bisiestos se festeja el 28/2
    d := least(p_dia, extract(day from (make_date(anio + k, p_mes, 1) + interval '1 month - 1 day'))::int);
    f := make_date(anio + k, p_mes, d);
    if f >= p_hoy then return f - p_hoy; end if;
  end loop;
  return null;
end;
$$;

-- Agregar clientas a un aviso en bloque (todas / solo fijas)
create or replace function public.aviso_agregar_clientas(p_aviso uuid, p_solo_fijas boolean)
returns int
language plpgsql volatile
as $$
declare n int;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  insert into public.aviso_clientas (aviso_id, clienta_id)
  select p_aviso, c.id from public.clientas c
   where c.activa and (not p_solo_fijas or c.es_fija)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ¿Ya existe la cuenta de la dueña? (la pantalla de ingreso ofrece crearla solo la primera vez)
create or replace function public.hay_duena()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where rol = 'duena');
$$;

-- Equipo: la dueña da acceso a otra persona que ya creó su cuenta (por email)
create or replace function public.agregar_staff(p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  u record;
begin
  if not public.es_duena() then
    raise exception 'Solo la dueña puede dar acceso.' using errcode = '42501';
  end if;
  select id, email into u from auth.users where lower(email) = lower(btrim(p_email));
  if u.id is null then
    raise exception 'No hay ninguna cuenta con ese email. Pedile que primero cree su cuenta desde la pantalla de ingreso.' using errcode = 'P0001';
  end if;
  insert into public.perfiles (id, nombre, rol) values (u.id, split_part(u.email, '@', 1), 'staff')
  on conflict (id) do nothing;
  return jsonb_build_object('id', u.id, 'email', u.email);
end;
$$;

create or replace function public.listar_equipo()
returns table (id uuid, nombre text, rol public.rol_usuario, email text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nombre, p.rol, u.email::text
    from public.perfiles p join auth.users u on u.id = p.id
   where public.es_staff()
   order by p.rol, p.nombre;
$$;
