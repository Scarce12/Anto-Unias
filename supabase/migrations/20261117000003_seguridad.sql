-- =====================================================================
-- Seguridad: Row Level Security
-- Regla general: solo el staff (usuarias con perfil) ve y modifica datos.
-- El público solo puede LEER lo que se muestra en la web y reservar vía RPC.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'perfiles', 'ajustes_negocio', 'clientas', 'categorias_servicio', 'servicios', 'horarios_laborales',
    'bloqueos', 'promociones', 'promocion_servicios', 'turnos', 'turno_items', 'creditos', 'pagos',
    'categorias_gasto', 'gastos', 'categorias_foto', 'fotos', 'cumpleanos_extra', 'avisos',
    'aviso_clientas', 'calendario_personal']
  loop
    execute format('alter table public.%I enable row level security', t);
    if t not in ('perfiles', 'calendario_personal') then
      execute format(
        'create policy staff_todo on public.%I for all to authenticated using (public.es_staff()) with check (public.es_staff())', t);
    end if;
  end loop;
end $$;

-- Perfiles: cada usuaria ve el suyo; la dueña ve y administra todos
create policy perfil_propio on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_staff());
create or replace function public.es_duena()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'duena');
$$;

create policy perfil_duena on public.perfiles
  for all to authenticated
  using (public.es_duena())
  with check (public.es_duena());

-- Calendario personal: privado de cada usuaria
create policy calendario_propio on public.calendario_personal
  for all to authenticated
  using (perfil_id = auth.uid() and public.es_staff())
  with check (perfil_id = auth.uid() and public.es_staff());

-- Lectura pública de lo que muestra la web
create policy publico_servicios on public.servicios
  for select to anon, authenticated using (activo and visible_web);
create policy publico_categorias_servicio on public.categorias_servicio
  for select to anon, authenticated using (true);
create policy publico_fotos on public.fotos
  for select to anon, authenticated using (visible);
create policy publico_categorias_foto on public.categorias_foto
  for select to anon, authenticated using (true);
create policy publico_promociones on public.promociones
  for select to anon, authenticated
  using (activa and visible_web and current_date between fecha_inicio and fecha_fin);
create policy publico_promocion_servicios on public.promocion_servicios
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- Permisos sobre funciones: las internas no se exponen al público
-- ---------------------------------------------------------------------
revoke execute on function public.guardar_turno(uuid, uuid, timestamptz, jsonb, int, public.estado_turno, numeric, uuid, numeric, text) from public, anon;
revoke execute on function public.vincular_turno_clienta(uuid, uuid) from public, anon;
revoke execute on function public.resumen_finanzas(date, date) from public, anon;
revoke execute on function public.resumen_dashboard() from public, anon;
revoke execute on function public.planilla_movimientos(date, date) from public, anon;
revoke execute on function public.aviso_agregar_clientas(uuid, boolean) from public, anon;
revoke execute on function public.buscar_posibles_duplicadas(text, text, text, text, uuid) from public, anon;
revoke execute on function public.conflictos_horario(timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.horarios_disponibles(date, int, uuid, boolean) from public, anon;

grant execute on function public.guardar_turno(uuid, uuid, timestamptz, jsonb, int, public.estado_turno, numeric, uuid, numeric, text) to authenticated;
grant execute on function public.vincular_turno_clienta(uuid, uuid) to authenticated;
grant execute on function public.resumen_finanzas(date, date) to authenticated;
grant execute on function public.resumen_dashboard() to authenticated;
grant execute on function public.planilla_movimientos(date, date) to authenticated;
grant execute on function public.aviso_agregar_clientas(uuid, boolean) to authenticated;
grant execute on function public.buscar_posibles_duplicadas(text, text, text, text, uuid) to authenticated;
grant execute on function public.conflictos_horario(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.horarios_disponibles(date, int, uuid, boolean) to authenticated;

-- Funciones públicas de la web
grant execute on function public.ajustes_publicos() to anon, authenticated;
grant execute on function public.horarios_disponibles_web(uuid[], date) to anon, authenticated;
grant execute on function public.dias_disponibles_web(uuid[], date, date) to anon, authenticated;
grant execute on function public.solicitar_turno(uuid[], timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.hay_duena() to anon, authenticated;
revoke execute on function public.agregar_staff(text) from public, anon;
revoke execute on function public.listar_equipo() from public, anon;
grant execute on function public.agregar_staff(text) to authenticated;
grant execute on function public.listar_equipo() to authenticated;
