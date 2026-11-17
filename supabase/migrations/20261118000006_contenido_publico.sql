-- =====================================================================
-- Contenido público extra y fotos incluidas en el sitio
-- - Campos de texto para la web: cuidados, formación y medios de pago
-- - Las fotos pueden estar en Supabase Storage (subidas desde el panel)
--   o incluidas en el sitio (/contenido/..., publicadas desde GitHub)
-- =====================================================================

alter table public.ajustes_negocio
  add column if not exists cuidados    text,
  add column if not exists formacion   text,
  add column if not exists medios_pago text,
  add constraint ajustes_contenido_largo check (
    coalesce(length(cuidados), 0) <= 4000 and coalesce(length(formacion), 0) <= 3000
    and coalesce(length(medios_pago), 0) <= 500);

-- Rutas permitidas: carpeta propia del bucket o carpeta /contenido/ del sitio
alter table public.fotos drop constraint fotos_path_seguro;
alter table public.fotos add constraint fotos_path_seguro
  check (storage_path ~ '^(galeria/|/contenido/galeria/)[A-Za-z0-9._-]+$');

alter table public.servicios drop constraint servicios_foto_segura;
alter table public.servicios add constraint servicios_foto_segura
  check (foto_path is null or foto_path ~ '^(servicios/|/contenido/servicios/)[A-Za-z0-9._-]+$');

alter table public.ajustes_negocio drop constraint ajustes_paths_seguros;
alter table public.ajustes_negocio add constraint ajustes_paths_seguros check (
  (logo_path is null or logo_path ~ '^(marca/|/contenido/marca/)[A-Za-z0-9._-]+$')
  and (portada_path is null or portada_path ~ '^(marca/|/contenido/marca/)[A-Za-z0-9._-]+$')
  and (foto_perfil_path is null or foto_perfil_path ~ '^(marca/|/contenido/marca/)[A-Za-z0-9._-]+$'));

create or replace function public.ajustes_publicos()
returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp
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
    'cuidados', a.cuidados, 'formacion', a.formacion, 'medios_pago', a.medios_pago,
    'horarios', coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia_semana, 'inicio', h.hora_inicio, 'fin', h.hora_fin)
                                           order by h.dia_semana, h.hora_inicio)
                            from public.horarios_laborales h), '[]'::jsonb))
  from public.ajustes_negocio a where a.id = 1;
$$;
revoke execute on function public.ajustes_publicos() from public;
grant execute on function public.ajustes_publicos() to anon, authenticated;
