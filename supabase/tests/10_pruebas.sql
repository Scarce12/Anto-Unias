-- Pruebas de reglas de negocio y seguridad.
-- Uso: psql -v ON_ERROR_STOP=1 -f 10_pruebas.sql  (sobre una base con stub + migraciones aplicadas)
\set ON_ERROR_STOP 1
\pset pager off
drop schema if exists pruebas cascade;
create schema pruebas;

create or replace function pruebas.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Ejecuta SQL y verifica que falle con un mensaje que contenga "esperado"
create or replace function pruebas.falla(sql text, esperado text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if position(lower(esperado) in lower(sqlerrm)) > 0 then
      raise notice 'ok - % (error esperado: %)', msg, sqlerrm;
      return;
    end if;
    raise exception 'FALLÓ: % — error inesperado: %', msg, sqlerrm;
  end;
  raise exception 'FALLÓ: % — debía fallar y no falló', msg;
end $$;
grant usage on schema pruebas to anon, authenticated;
grant execute on all functions in schema pruebas to anon, authenticated;

-- ---------------------------------------------------------------------
-- Usuarias: la primera es la dueña, la segunda no tiene acceso
-- ---------------------------------------------------------------------
insert into auth.users (email) values ('duena@test.local') returning id as duena \gset
insert into auth.users (email) values ('intrusa@test.local') returning id as intrusa \gset
select pruebas.ok((select rol from perfiles where id = :'duena') = 'duena', 'primera usuaria es dueña');
select pruebas.ok(not exists (select 1 from perfiles where id = :'intrusa'), 'segunda usuaria no obtiene perfil');

-- Martes de la semana que viene (o la siguiente) y lunes
select (current_date + ((2 - extract(dow from current_date)::int + 7) % 7) + 7) as martes \gset
select pruebas.ok(extract(dow from :'martes'::date) = 2, 'fecha de prueba es martes');

-- ---------------------------------------------------------------------
-- Como dueña
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'duena', false);
select pruebas.ok(public.es_staff(), 'dueña es staff');

-- Clientas flexibles
insert into clientas (nombre, apellido, whatsapp) values ('María', 'López', '11 1234-5678') returning id as maria \gset
insert into clientas (nombre, instagram) values ('Camila', '@Camila123') returning id as camila \gset
insert into clientas (nombre, apellido) values ('Sofía', 'Martínez') returning id as sofia \gset
insert into clientas (nombre, whatsapp, instagram) values ('Florencia', '+54 9 351 555-1234', 'https://www.instagram.com/flor.nails/') returning id as flor \gset
insert into clientas (nombre, apellido) values ('María', 'López') returning id as maria2 \gset

select pruebas.ok((select whatsapp_norm from clientas where id = :'maria') = '5491112345678', 'WhatsApp normalizado 11 1234-5678');
select pruebas.ok((select instagram_norm from clientas where id = :'camila') = 'camila123', 'Instagram normalizado');
select pruebas.ok((select instagram from clientas where id = :'flor') = '@flor.nails', 'Instagram desde URL');
select pruebas.ok((select whatsapp_norm from clientas where id = :'flor') = '5493515551234', 'WhatsApp con +54 9');
select pruebas.ok(public.normalizar_telefono('011 15 1234-5678') = '5491112345678', 'normaliza 011 15');
select pruebas.ok(public.normalizar_telefono('0351 15 555 1234') = '5493515551234', 'normaliza 0351 15');
select pruebas.ok(public.normalizar_telefono('+34 600 123 456') = '34600123456', 'número extranjero');
select pruebas.ok((select count(*) from clientas where nombre = 'María' and apellido = 'López') = 2, 'dos clientas con el mismo nombre permitidas');

select pruebas.falla($$insert into clientas (nombre, whatsapp) values ('Otra', '011 15 1234 5678')$$, 'clientas_whatsapp_unico', 'WhatsApp duplicado rechazado');
select pruebas.falla($$insert into clientas (nombre, instagram) values ('Otra', 'instagram.com/CAMILA123')$$, 'clientas_instagram_unico', 'Instagram duplicado rechazado');
select pruebas.falla($$insert into clientas (nombre) values ('   ')$$, 'check', 'nombre vacío rechazado');

select pruebas.ok((select count(*) from buscar_posibles_duplicadas('maria', 'lopez')) >= 2, 'detecta posibles duplicadas por nombre (sin acentos)');
select pruebas.ok((select bool_or(bloqueante) from buscar_posibles_duplicadas('Mari', null, '1112345678')), 'detecta duplicado bloqueante por WhatsApp');
select pruebas.ok((select count(*) from buscar_posibles_duplicadas('Camila', null)) >= 1, 'solo nombre encuentra a Camila');

-- Servicios
insert into servicios (nombre, precio, duracion_min) values ('Semi liso', 15000, 60) returning id as semi \gset
insert into servicios (nombre, precio, duracion_min, es_adicional) values ('Deco', 2000, 30, true) returning id as deco \gset
insert into servicios (nombre, precio, duracion_min, activo) values ('Viejo', 1000, 30, false) returning id as viejo \gset

-- Horario: martes 9-13 y 15-20
insert into horarios_laborales (dia_semana, hora_inicio, hora_fin) values (2, '09:00', '13:00'), (2, '15:00', '20:00');
select pruebas.falla($$insert into horarios_laborales (dia_semana, hora_inicio, hora_fin) values (2, '12:00', '14:00')$$, 'franjas_sin_superponer', 'franjas del mismo día no se superponen');

-- Turnos desde el panel
select guardar_turno(null, :'maria', (:'martes'::date + time '10:00') at time zone 'America/Argentina/Buenos_Aires',
  jsonb_build_array(jsonb_build_object('servicio_id', :'semi', 'nombre', 'Semi liso', 'precio', 15000, 'duracion_min', 60)),
  null, 'confirmado', 0, null, 5000, null) as t1 \gset
select pruebas.ok((select total from turnos where id = :'t1') = 15000, 'total del turno = suma de ítems');
select pruebas.ok((select fin - inicio from turnos where id = :'t1') = interval '60 minutes', 'fin calculado por duración');
select pruebas.ok((select confirmado_en is not null from turnos where id = :'t1'), 'marca confirmado_en');

select pruebas.falla(format($$select guardar_turno(null, %L, %L, %L::jsonb)$$, :'camila',
  (:'martes'::date + time '10:30') at time zone 'America/Argentina/Buenos_Aires',
  jsonb_build_array(jsonb_build_object('nombre', 'Semi', 'precio', 1, 'duracion_min', 60))), 'superpone', 'no permite turnos superpuestos');

-- Turno pegado (11:00) sí se permite
select guardar_turno(null, :'camila', (:'martes'::date + time '11:00') at time zone 'America/Argentina/Buenos_Aires',
  jsonb_build_array(jsonb_build_object('servicio_id', :'semi', 'nombre', 'Semi liso', 'precio', 15000, 'duracion_min', 60),
                    jsonb_build_object('servicio_id', :'deco', 'nombre', 'Deco', 'precio', 2000, 'duracion_min', 30, 'es_adicional', true))) as t2 \gset
select pruebas.ok((select total from turnos where id = :'t2') = 17000, 'servicio + adicional suman precio');
select pruebas.ok((select fin - inicio from turnos where id = :'t2') = interval '90 minutes', 'servicio + adicional suman duración');
select pruebas.ok((select servicios_texto from turnos_detalle where id = :'t2') = 'Semi liso + Deco', 'texto de servicios');

-- Conflictos no bloqueantes
select pruebas.ok(exists (select 1 from conflictos_horario((:'martes'::date + time '13:30') at time zone 'America/Argentina/Buenos_Aires',
  (:'martes'::date + time '14:00') at time zone 'America/Argentina/Buenos_Aires') where tipo = 'fuera_de_horario'), 'avisa fuera de horario (descanso)');

-- Cancelar libera el horario
update turnos set estado = 'cancelado', nota_estado = 'Se enfermó' where id = :'t2';
select guardar_turno(null, :'sofia', (:'martes'::date + time '11:30') at time zone 'America/Argentina/Buenos_Aires',
  jsonb_build_array(jsonb_build_object('nombre', 'Semi liso', 'precio', 15000, 'duracion_min', 60))) as t3 \gset
select pruebas.ok(:'t3' is not null, 'turno cancelado libera el horario');
select pruebas.falla(format($$update turnos set estado = 'confirmado' where id = %L$$, :'t2'), 'turnos_sin_superposicion', 'reactivar turno cancelado superpuesto falla');

-- Reprogramar (mover t3 a 16:00)
select guardar_turno(:'t3', null, (:'martes'::date + time '16:00') at time zone 'America/Argentina/Buenos_Aires',
  jsonb_build_array(jsonb_build_object('nombre', 'Semi liso', 'precio', 15000, 'duracion_min', 60))) is not null as ok \gset
select pruebas.ok((select (inicio at time zone 'America/Argentina/Buenos_Aires')::time from turnos where id = :'t3') = '16:00', 'reprogramación');

-- Precio histórico
update servicios set precio = 20000, duracion_min = 90 where id = :'semi';
select pruebas.ok((select precio from turno_items where turno_id = :'t1') = 15000, 'precio histórico se conserva');
select pruebas.ok((select fin - inicio from turnos where id = :'t1') = interval '60 minutes', 'duración del turno ya agendado no cambia');

-- Señas y pagos parciales
insert into pagos (turno_id, monto, medio, es_sena) values (:'t1', 5000, 'transferencia', true);
select pruebas.ok((select estado_pago from turnos_detalle where id = :'t1') = 'sena', 'estado de pago: seña');
select pruebas.ok((select saldo from turnos_detalle where id = :'t1') = 10000, 'saldo pendiente 10000');
select pruebas.ok((select clienta_id from pagos where turno_id = :'t1' limit 1) = :'maria', 'pago hereda clienta del turno');
insert into pagos (turno_id, monto, medio) values (:'t1', 4000, 'efectivo');
select pruebas.ok((select estado_pago from turnos_detalle where id = :'t1') = 'parcial', 'estado de pago: parcial');
insert into pagos (turno_id, monto, medio) values (:'t1', 6000, 'mercado_pago');
select pruebas.ok((select estado_pago from turnos_detalle where id = :'t1') = 'pagado' and (select saldo from turnos_detalle where id = :'t1') = 0, 'estado de pago: pagado');

-- Gift card
insert into creditos (tipo, codigo, comprador_nombre, beneficiaria_nombre, monto, medio)
values ('gift_card', 'GC-001', 'Novio de Flor', 'Florencia', 11500, 'transferencia') returning id as gc \gset
insert into pagos (turno_id, monto, medio, credito_id) values (:'t3', 11500, 'credito', :'gc');
select pruebas.ok(saldo_credito(:'gc') = 0, 'gift card consumida');
select pruebas.falla(format($$insert into pagos (turno_id, monto, medio, credito_id) values (%L, 1, 'credito', %L)$$, :'t3', :'gc'), 'no alcanza', 'no se puede usar más crédito del disponible');
select pruebas.falla(format($$insert into pagos (turno_id, monto, medio) values (%L, 1, 'credito')$$, :'t3'), 'pago_credito', 'pago con crédito exige crédito');
-- Ingresos: venta de gift card cuenta 1 vez, el canje no
select pruebas.ok((select sum(monto) from ingresos) = 5000 + 4000 + 6000 + 11500, 'ingresos no duplican gift card');

-- Saldo a favor
insert into creditos (tipo, clienta_id, monto, medio) values ('saldo_a_favor', :'maria', 3000, 'efectivo');
select pruebas.ok((select saldo_a_favor from clientas_resumen where id = :'maria') = 3000, 'saldo a favor en ficha');

-- Inasistencia y finalización
update turnos set estado = 'finalizado' where id = :'t1';
select pruebas.ok((select visitas from clientas_resumen where id = :'maria') = 1, 'visitas cuenta finalizados');
update turnos set estado = 'no_asistio', nota_estado = 'No avisó' where id = :'t3';
select pruebas.ok((select inasistencias from clientas_resumen where id = :'sofia') = 1, 'inasistencias registradas');

-- Gastos y finanzas
insert into gastos (fecha, descripcion, categoria_id, monto, medio)
values (current_date, 'Esmaltes', (select id from categorias_gasto where nombre = 'Esmaltes'), 8000, 'efectivo');
select resumen_finanzas(current_date - 1, current_date) as fin \gset
select pruebas.ok((:'fin'::jsonb ->> 'ingresos')::numeric = 29500, 'resumen: ingresos');
select pruebas.ok((:'fin'::jsonb ->> 'gastos')::numeric = 8000, 'resumen: gastos');
select pruebas.ok((:'fin'::jsonb ->> 'neto')::numeric = 21500, 'resumen: neto = ingresos - gastos');
select pruebas.ok((:'fin'::jsonb -> 'reparto' ->> 'sueldo')::numeric = 20650, 'reparto 70% sueldo');
select pruebas.ok((:'fin'::jsonb ->> 'gastos_insumos')::numeric = 8000, 'gastos de insumos');
select pruebas.ok((select count(*) from planilla_movimientos(current_date - 1, current_date)) = 5, 'planilla de movimientos');
select pruebas.ok(resumen_dashboard() ? 'ingresos_mes', 'dashboard responde');

-- Reparto inválido
select pruebas.falla($$update ajustes_negocio set reparto_sueldo_pct = 80 where id = 1$$, 'reparto_suma_100', 'reparto debe sumar 100');

-- Cumpleaños
select pruebas.ok(dias_hasta_cumple(1, 1, date '2026-12-31') = 1, 'días hasta cumpleaños cruza año');
select pruebas.ok(dias_hasta_cumple(29, 2, date '2027-02-01') = 27, '29/2 en año no bisiesto');

-- Avisos
insert into avisos (titulo, mensaje) values ('Turnos de diciembre', 'Hola {nombre}!') returning id as av \gset
update clientas set es_fija = true where id in (:'maria', :'camila');
select pruebas.ok(aviso_agregar_clientas(:'av', true) = 2, 'aviso: agrega solo fijas');
select pruebas.ok(aviso_agregar_clientas(:'av', false) = 3, 'aviso: agrega el resto sin duplicar');

-- Calendario personal
insert into calendario_personal (fecha, marca) values (current_date, 'periodo');
select pruebas.ok((select count(*) from calendario_personal) = 1, 'calendario personal propio');

-- ---------------------------------------------------------------------
-- Bloqueos y reservas web (como público)
-- ---------------------------------------------------------------------
insert into bloqueos (inicio, fin, motivo) values ((:'martes'::date + time '17:00') at time zone 'America/Argentina/Buenos_Aires',
  (:'martes'::date + time '18:00') at time zone 'America/Argentina/Buenos_Aires', 'Yoga');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pruebas.falla($$select count(*) from clientas$$, 'permission denied', 'anon no puede leer clientas');
select pruebas.falla($$select count(*) from turnos$$, 'permission denied', 'anon no puede leer turnos');
select pruebas.falla($$select count(*) from pagos$$, 'permission denied', 'anon no puede leer pagos');
select pruebas.falla($$select count(*) from turnos_detalle$$, 'permission denied', 'anon no puede leer la vista de turnos');
select pruebas.falla($$select count(*) from clientas_resumen$$, 'permission denied', 'anon no puede leer la vista de clientas');
select pruebas.falla($$select count(*) from ingresos$$, 'permission denied', 'anon no puede leer ingresos');
select pruebas.falla($$select * from ajustes_negocio$$, 'permission denied', 'anon no puede leer ajustes internos');
select pruebas.falla($$select * from calendario_personal$$, 'permission denied', 'anon no puede leer calendarios');
select pruebas.falla($$select * from auditoria$$, 'permission denied', 'anon no puede leer auditoría');
select pruebas.falla($$select normalizar_telefono('1')$$, 'permission denied', 'anon no puede ejecutar funciones internas');
select pruebas.falla($$update servicios set precio = 1$$, 'permission denied', 'anon no puede modificar servicios');
select pruebas.falla($$delete from fotos$$, 'permission denied', 'anon no puede borrar fotos');
select pruebas.ok((select count(*) from servicios) = 2, 'anon ve solo servicios activos');
select pruebas.ok((ajustes_publicos() ->> 'zona_horaria') is not null and not (ajustes_publicos() ? 'plantilla_confirmacion'), 'ajustes públicos sin datos internos');
select pruebas.falla($$select resumen_dashboard()$$, 'permission denied', 'anon no puede usar el dashboard');
select pruebas.falla($$insert into clientas (nombre) values ('hack')$$, 'permission denied', 'anon no puede crear clientas');
select pruebas.falla($$select * from horarios_disponibles(current_date + 7, 60, null, false)$$, 'permission denied', 'anon no usa disponibilidad interna');

-- Semi ahora dura 90 min. Martes: 9-13 (turno María 10-11 finalizado) y 15-20 (bloqueo 17-18)
select array_agg(to_char(s at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') order by s) as slots
  from horarios_disponibles_web(array[:'semi'::uuid], :'martes'::date) s \gset
\echo Horarios disponibles martes (90 min): :slots
select pruebas.ok(:'slots' = '{11:00,11:30,15:00,15:30,18:00,18:30}', 'disponibilidad respeta turnos, bloqueos, descanso y nueva duración');
select pruebas.ok((select count(*) from dias_disponibles_web(array[:'semi'::uuid], current_date, current_date + 20)) >= 2, 'días disponibles');
select pruebas.ok((select count(*) from horarios_disponibles_web(array[:'viejo'::uuid], :'martes'::date)) = 0, 'servicio inactivo no da horarios');

select solicitar_turno(array[:'semi'::uuid], (:'martes'::date + time '15:00') at time zone 'America/Argentina/Buenos_Aires',
  'Lucía', '11 4444-5555', null, 'Quiero color nude') as web1 \gset
select pruebas.ok((:'web1'::jsonb ->> 'estado') = 'pendiente', 'reserva web queda pendiente');
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, 'Otra', '1199998888')$$, :'semi',
  (:'martes'::date + time '15:30') at time zone 'America/Argentina/Buenos_Aires'), 'no está disponible', 'web no permite superposición');
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, 'Sin contacto')$$, :'semi',
  (:'martes'::date + time '18:00') at time zone 'America/Argentina/Buenos_Aires'), 'whatsapp o un instagram', 'web exige algún contacto');
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, 'Solo deco', '1133332222')$$, :'deco',
  (:'martes'::date + time '18:00') at time zone 'America/Argentina/Buenos_Aires'), 'servicio principal', 'web exige servicio principal');
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, 'Fuera', '1133332222')$$, :'semi',
  (:'martes'::date + time '13:00') at time zone 'America/Argentina/Buenos_Aires'), 'no está disponible', 'web no permite fuera de horario');
-- María (WhatsApp ya registrado) reserva: se vincula a su ficha
select solicitar_turno(array[:'semi'::uuid], (:'martes'::date + time '18:00') at time zone 'America/Argentina/Buenos_Aires',
  'Mary', '1112345678') as web2 \gset
reset role;
select pruebas.ok((select clienta_id from turnos where id = (:'web2'::jsonb ->> 'id')::uuid) = :'maria', 'reserva web se vincula por WhatsApp');
select pruebas.ok((select clienta_id from turnos where id = (:'web1'::jsonb ->> 'id')::uuid) is null, 'reserva web sin coincidencia queda sin vincular');
select pruebas.ok((select precio from turno_items where turno_id = (:'web1'::jsonb ->> 'id')::uuid) = 20000, 'reserva web copia precio vigente');

-- ---------------------------------------------------------------------
-- Usuaria autenticada sin perfil (no es staff)
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'intrusa', false);
select pruebas.ok((select count(*) from clientas) = 0, 'usuaria sin perfil no ve clientas');
select pruebas.ok((select count(*) from calendario_personal) = 0, 'no ve el calendario de otra');
select pruebas.falla($$select resumen_dashboard()$$, 'no autorizado', 'usuaria sin perfil no usa dashboard');
select pruebas.falla(format($$select guardar_turno(null, %L, now() + interval '30 days', '[{"nombre":"x","precio":1,"duracion_min":30}]'::jsonb)$$, :'maria'), 'no autorizado', 'usuaria sin perfil no crea turnos');
update ajustes_negocio set nombre_negocio = 'hack' where id = 1;
reset role;
select pruebas.ok((select nombre_negocio from ajustes_negocio) is null, 'usuaria sin perfil no modificó ajustes');


-- Equipo
set role authenticated;
select set_config('request.jwt.claim.sub', :'intrusa', false);
select pruebas.falla($$select agregar_staff('intrusa@test.local')$$, 'solo la dueña', 'una usuaria sin perfil no puede darse acceso');
select set_config('request.jwt.claim.sub', :'duena', false);
select pruebas.falla($$select agregar_staff('nadie@test.local')$$, 'no hay ninguna cuenta', 'agregar email inexistente avisa');
select agregar_staff('intrusa@test.local') is not null as ok \gset
select pruebas.ok((select count(*) from listar_equipo()) = 2, 'dueña agrega staff y lo lista');
reset role;


-- ---------------------------------------------------------------------
-- Seguridad extra
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'duena', false);
select pruebas.falla($$update ajustes_negocio set maps_url = 'javascript:alert(1)' where id = 1$$, 'ajustes_maps_https', 'maps_url solo acepta https');
update ajustes_negocio set maps_url = 'https://maps.app.goo.gl/abc123' where id = 1;
select pruebas.falla($$insert into fotos (storage_path) values ('../../etc/passwd')$$, 'fotos_path_seguro', 'ruta de foto maliciosa rechazada');
select pruebas.falla($$insert into clientas (nombre, observaciones) values ('Larga', repeat('x', 5000))$$, 'clientas_observaciones_largo', 'textos gigantes rechazados');
select pruebas.falla(format($$delete from perfiles where id = %L$$, :'duena'), 'a vos misma', 'la dueña no puede quitarse el acceso');
select pruebas.falla(format($$update perfiles set rol = 'staff' where id = %L$$, :'duena'), 'al menos una dueña', 'no se puede degradar a la única dueña');
-- auditoría: borrar un gasto deja registro con los datos previos
delete from gastos where descripcion = 'Esmaltes';
select pruebas.ok((select datos_previos ->> 'descripcion' from auditoria where tabla = 'gastos' and operacion = 'DELETE' order by id desc limit 1) = 'Esmaltes', 'auditoría guarda lo borrado');
select pruebas.falla($$delete from auditoria$$, 'permission denied', 'nadie puede borrar la auditoría desde la app');
select pruebas.ok((select count(*) from auditoria) > 0, 'la dueña puede leer la auditoría');
update ajustes_negocio set max_reservas_web_por_hora = 2 where id = 1;
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, 'Spam', '1177776666')$$, :'semi',
  (:'martes'::date + time '19:00') at time zone 'America/Argentina/Buenos_Aires'), 'muchos pedidos', 'límite global de pedidos web por hora');
reset role;
update ajustes_negocio set max_reservas_web_por_hora = 10 where id = 1;
set role anon;
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, '!!!', '1177776666')$$, :'semi',
  (:'martes'::date + time '19:00') at time zone 'America/Argentina/Buenos_Aires'), 'tu nombre', 'nombre sin letras rechazado');
select pruebas.falla(format($$select solicitar_turno(array[%L::uuid], %L, 'Ana', null, '<script>')$$, :'semi',
  (:'martes'::date + time '19:00') at time zone 'America/Argentina/Buenos_Aires'), 'no parece válido', 'instagram con caracteres raros rechazado');
reset role;

\echo '==== TODAS LAS PRUEBAS PASARON ===='
