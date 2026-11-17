-- =====================================================================
-- Seguridad extra (defensa en profundidad)
-- 1. El rol anónimo (visitantes de la web) pierde TODO permiso directo,
--    salvo leer lo que se muestra en la web y llamar a las 5 funciones públicas.
-- 2. search_path fijo en todas las funciones (evita secuestro de funciones).
-- 3. Límites de largo en todos los textos y URLs solo https.
-- 4. Límite global de pedidos web por hora (anti-spam).
-- 5. No se puede borrar/degradar a la última dueña ni quitarse el acceso a sí misma.
-- 6. Auditoría: queda registro de lo que se modifica o borra (para recuperar datos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permisos mínimos para visitantes (anon)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

grant select on public.servicios, public.categorias_servicio, public.fotos, public.categorias_foto,
                public.promociones, public.promocion_servicios to anon;

grant execute on function public.ajustes_publicos() to anon;
grant execute on function public.horarios_disponibles_web(uuid[], date) to anon;
grant execute on function public.dias_disponibles_web(uuid[], date, date) to anon;
grant execute on function public.solicitar_turno(uuid[], timestamptz, text, text, text, text) to anon;
grant execute on function public.hay_duena() to anon;

-- Las usuarias con sesión necesitan ejecutar funciones (las internas verifican es_staff())
grant execute on all functions in schema public to authenticated;

-- Lo que se cree en el futuro tampoco queda abierto al público por defecto
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------
-- 3. Largo de textos y URLs seguras
-- ---------------------------------------------------------------------
alter table public.clientas
  add constraint clientas_alergias_largo check (alergias is null or length(alergias) <= 1000),
  add constraint clientas_observaciones_largo check (observaciones is null or length(observaciones) <= 3000);

alter table public.turnos
  add constraint turnos_textos_largo check (
    coalesce(length(notas), 0) <= 1000 and coalesce(length(nota_estado), 0) <= 500
    and coalesce(length(solicitante_nombre), 0) <= 80 and coalesce(length(solicitante_whatsapp), 0) <= 30
    and coalesce(length(solicitante_instagram), 0) <= 60 and coalesce(length(solicitante_nota), 0) <= 500);

alter table public.turno_items add constraint turno_items_nombre_largo check (length(nombre) <= 120);
alter table public.pagos add constraint pagos_textos_largo check (coalesce(length(concepto), 0) <= 120 and coalesce(length(notas), 0) <= 500);
alter table public.gastos add constraint gastos_notas_largo check (coalesce(length(notas), 0) <= 500);
alter table public.creditos add constraint creditos_textos_largo check (
  coalesce(length(codigo), 0) <= 30 and coalesce(length(comprador_nombre), 0) <= 80
  and coalesce(length(beneficiaria_nombre), 0) <= 80 and coalesce(length(notas), 0) <= 500);
alter table public.servicios add constraint servicios_descripcion_largo check (coalesce(length(descripcion), 0) <= 1000);
alter table public.promociones add constraint promociones_descripcion_largo check (coalesce(length(descripcion), 0) <= 500);
alter table public.cumpleanos_extra add constraint cumpleanos_notas_largo check (coalesce(length(notas), 0) <= 300);
alter table public.avisos add constraint avisos_mensaje_largo check (length(mensaje) <= 2000);
alter table public.aviso_clientas add constraint aviso_nota_largo check (coalesce(length(nota), 0) <= 300);
alter table public.calendario_personal add constraint calendario_nota_largo check (coalesce(length(nota), 0) <= 1000);
alter table public.bloqueos add constraint bloqueos_rango_razonable check (fin - inicio <= interval '366 days');
alter table public.perfiles add constraint perfiles_nombre_largo check (coalesce(length(nombre), 0) <= 80);

alter table public.ajustes_negocio
  add column max_reservas_web_por_hora smallint not null default 10 check (max_reservas_web_por_hora between 1 and 200),
  add constraint ajustes_maps_https check (maps_url is null or maps_url ~* '^https://[^\s"<>]+$'),
  add constraint ajustes_textos_largo check (
    coalesce(length(nombre_negocio), 0) <= 80 and coalesce(length(eslogan), 0) <= 160
    and coalesce(length(presentacion), 0) <= 2000 and coalesce(length(nombre_manicurista), 0) <= 80
    and coalesce(length(whatsapp), 0) <= 30 and coalesce(length(instagram), 0) <= 60
    and coalesce(length(direccion), 0) <= 160 and coalesce(length(zona), 0) <= 80
    and coalesce(length(maps_url), 0) <= 500 and coalesce(length(horarios_texto), 0) <= 500
    and coalesce(length(datos_transferencia), 0) <= 500 and coalesce(length(politica_cancelacion), 0) <= 1000
    and length(plantilla_confirmacion) <= 1000 and length(plantilla_recordatorio) <= 1000
    and length(plantilla_sena) <= 1000 and length(plantilla_cambio) <= 1000
    and length(plantilla_saldo) <= 1000 and length(plantilla_cumpleanos) <= 1000),
  add constraint ajustes_paths_seguros check (
    (logo_path is null or logo_path ~ '^marca/[A-Za-z0-9._-]+$')
    and (portada_path is null or portada_path ~ '^marca/[A-Za-z0-9._-]+$')
    and (foto_perfil_path is null or foto_perfil_path ~ '^marca/[A-Za-z0-9._-]+$'));

alter table public.fotos add constraint fotos_path_seguro check (storage_path ~ '^galeria/[A-Za-z0-9._-]+$');
alter table public.servicios add constraint servicios_foto_segura check (foto_path is null or foto_path ~ '^servicios/[A-Za-z0-9._-]+$');

-- Solo se pueden subir imágenes a las carpetas esperadas del bucket
drop policy if exists fotos_alta on storage.objects;
create policy fotos_alta on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_staff()
              and name ~ '^(galeria|servicios|marca)/[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png)$');

-- ---------------------------------------------------------------------
-- 4. Reservas web: límite global por hora + validaciones más estrictas
-- ---------------------------------------------------------------------
create or replace function public.solicitar_turno(
  p_servicios uuid[], p_inicio timestamptz, p_nombre text,
  p_whatsapp text default null, p_instagram text default null, p_nota text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions, pg_temp
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
  recientes int;
  estado_inicial public.estado_turno;
  srv record;
  n int := 0;
begin
  select * into a from public.ajustes_negocio where id = 1;
  if not a.reservas_web_activas then
    raise exception 'Las reservas online están pausadas en este momento.' using errcode = 'P0001';
  end if;

  -- Anti-spam global: si llegan demasiados pedidos en una hora, se frena
  select count(*) into recientes from public.turnos
   where origen = 'web' and creado_en > now() - interval '1 hour';
  if recientes >= a.max_reservas_web_por_hora then
    raise exception 'Estamos recibiendo muchos pedidos. Probá de nuevo en un rato o escribinos por WhatsApp.' using errcode = 'P0001';
  end if;

  p_nombre := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  if length(p_nombre) < 2 or length(p_nombre) > 80 or p_nombre !~ '[[:alpha:]]' then
    raise exception 'Ingresá tu nombre.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_nota, '')) > 500 then
    raise exception 'La nota es demasiado larga.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_whatsapp, '')) > 30 or length(coalesce(p_instagram, '')) > 60 then
    raise exception 'Revisá los datos de contacto.' using errcode = 'P0001';
  end if;

  w := public.normalizar_telefono(p_whatsapp, a.codigo_pais);
  i := public.normalizar_instagram(p_instagram);
  if i is not null and i !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'El usuario de Instagram no parece válido.' using errcode = 'P0001';
  end if;
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

  perform pg_advisory_xact_lock(hashtext('reserva:' || fecha_local::text));

  if not exists (select 1 from public.horarios_disponibles(fecha_local, dur, null, true) s where s = p_inicio) then
    raise exception 'Ese horario ya no está disponible. Elegí otro, por favor.' using errcode = 'P0001';
  end if;

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
revoke execute on function public.solicitar_turno(uuid[], timestamptz, text, text, text, text) from public;
grant execute on function public.solicitar_turno(uuid[], timestamptz, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Protección de la cuenta dueña
-- ---------------------------------------------------------------------
create or replace function public.proteger_perfiles()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- Cambios hechos desde la app (con sesión). Desde el panel de Supabase (sin sesión) no se bloquea.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and old.id = auth.uid() then
    raise exception 'No podés quitarte el acceso a vos misma.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'No se puede cambiar el identificador de un perfil.' using errcode = 'P0001';
  end if;
  if old.rol = 'duena' and (tg_op = 'DELETE' or new.rol <> 'duena')
     and not exists (select 1 from public.perfiles p where p.rol = 'duena' and p.id <> old.id) then
    raise exception 'Tiene que quedar al menos una dueña.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger proteger_perfiles
  before update or delete on public.perfiles
  for each row execute function public.proteger_perfiles();

-- ---------------------------------------------------------------------
-- 6. Auditoría (solo la dueña la puede leer; nadie la puede modificar desde la app)
-- ---------------------------------------------------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  usuario      uuid default auth.uid(),
  tabla        text not null,
  operacion    text not null,
  registro_id  text,
  datos_previos jsonb
);
create index auditoria_fecha on public.auditoria (fecha desc);
alter table public.auditoria enable row level security;
create policy auditoria_lectura_duena on public.auditoria for select to authenticated using (public.es_duena());
revoke all on public.auditoria from anon;
revoke insert, update, delete, truncate on public.auditoria from authenticated;

create or replace function public.auditar()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) - 'actualizado_en' - 'actualizada_en' = to_jsonb(new) - 'actualizado_en' - 'actualizada_en' then
    return new;
  end if;
  insert into public.auditoria (tabla, operacion, registro_id, datos_previos)
  values (tg_table_name, tg_op, to_jsonb(old) ->> 'id', to_jsonb(old));
  return coalesce(new, old);
end;
$$;

create trigger auditar_clientas after update or delete on public.clientas for each row execute function public.auditar();
create trigger auditar_pagos after update or delete on public.pagos for each row execute function public.auditar();
create trigger auditar_creditos after update or delete on public.creditos for each row execute function public.auditar();
create trigger auditar_gastos after update or delete on public.gastos for each row execute function public.auditar();
create trigger auditar_servicios after update or delete on public.servicios for each row execute function public.auditar();
create trigger auditar_turnos after delete on public.turnos for each row execute function public.auditar();
create trigger auditar_ajustes after update on public.ajustes_negocio for each row execute function public.auditar();

-- La auditoría se limpia sola después de 2 años (la llama la dueña desde la app o un cron)
create or replace function public.limpiar_auditoria()
returns int
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare n int;
begin
  if not public.es_duena() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  delete from public.auditoria where fecha < now() - interval '2 years';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. search_path fijo en TODAS las funciones del esquema public
-- ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.firma);
  end loop;
end $$;

-- Permisos finales de las funciones nuevas
revoke execute on function public.proteger_perfiles() from anon, public;
revoke execute on function public.auditar() from anon, public;
revoke execute on function public.limpiar_auditoria() from anon, public;
grant execute on function public.limpiar_auditoria() to authenticated;
