-- =====================================================================
-- Datos iniciales de Pochitas Nails (tomados de su Instagram y su agenda)
-- Correr UNA vez en Supabase → SQL Editor, después de las migraciones.
-- Todo se puede corregir después desde el panel (Ajustes, Servicios, Galería).
-- =====================================================================

-- Datos del negocio
update public.ajustes_negocio set
  nombre_negocio = 'Pochitas Nails',
  nombre_manicurista = 'Antonella Scarcelli',
  eslogan = 'Manicura profesional ♡ Baradero',
  presentacion = 'Soy Antonella Scarcelli, manicurista profesional en Baradero. Me formé en esmaltado semipermanente, kapping y esculpidas en gel, nail art, soft gel y bioseguridad, y sigo capacitándome para que tus uñas queden prolijas, sanas y duraderas.' || chr(10) || 'Todo lo que es hecho con amor se logra ♡',
  instagram = '@pochitas_nails',
  zona = 'Baradero',
  logo_path = '/contenido/marca/logo.webp',
  portada_path = '/contenido/marca/portada.webp',
  medios_pago = 'Efectivo, Mercado Pago y transferencia',
  datos_transferencia = 'Alias: ANTO.POCHITAS / ANTONELLA.POCHI',
  -- En su Instagram dice "Próximamente turnos disponibles": las reservas online arrancan pausadas
  reservas_web_activas = false,
  politica_cancelacion =
    'Si el turno está confirmado, la cancelación fuera de término o la inasistencia dará lugar al abono del 50% del servicio, ya que ese turno se perdió. Sin excepción, para poder reprogramar.' || chr(10) ||
    'Pasados los 10 minutos de tolerancia, el turno queda cancelado, ya que me atraso con los turnos siguientes.' || chr(10) ||
    'El turno confirmado se puede cancelar o cambiar hasta el día anterior, con un mínimo de 12 horas de anticipación. No el mismo día, ni a la noche si el turno es a la mañana.',
  formacion =
    'Esmaltado semipermanente y decoración · NNEMELS Escuela de Belleza (2021)' || chr(10) ||
    'Nail Art 1: botánicos, abstractos y 3D · NNEMELS (2021)' || chr(10) ||
    'Nail Art 2: efectos varios y encapsulados · NNEMELS (2021)' || chr(10) ||
    'Kapping en gel · NNEMELS (2021)' || chr(10) ||
    'Uñas esculpidas en gel · NNEMELS (2021)' || chr(10) ||
    'Soft gel y manicuría americana · Nails Congress (2024)' || chr(10) ||
    'Perfect en cromos · Zao Nails (2024)' || chr(10) ||
    'Nail art avanzado · Nails Congress (2024)' || chr(10) ||
    'Bioseguridad en gabinete y patologías ungueales · Nails Congress (2024)' || chr(10) ||
    'Finanzas para manicuras · Nails Congress (2024)',
  cuidados =
    'Tus uñas no son herramientas: no las uses para abrir latas o apretar botones; usá la yema de los dedos o los nudillos.' || chr(10) ||
    'Usá guantes para lavar los platos, limpiar o cuando tengas las manos en agua o productos químicos.' || chr(10) ||
    'No te las lleves a la boca.' || chr(10) ||
    'Nunca te arranques el semi, kapping o esculpidas: la uña natural está formada por capas de queratina y al arrancarlo se van con el producto, la uña se afina, puede doler y hasta infectarse. Pedí que te lo retire tu manicura.' || chr(10) ||
    'Usá aceite de cutícula: hidrata la cutícula y la piel alrededor de la uña.' || chr(10) ||
    'El semipermanente no daña tus uñas: lo que las daña es una mala preparación, un retiro inadecuado o productos de mala calidad.' || chr(10) ||
    'La duración depende de cada clienta: puede durar de 14 días a un mes. Hacé tu retoque a tiempo.' || chr(10) ||
    'Una uña nueva tarda de 3 a 6 meses en crecer por completo.'
where id = 1;

-- Categorías de servicios
insert into public.categorias_servicio (nombre, orden) values
  ('Semipermanente', 1), ('Capping gel', 2), ('Esculpidas en gel', 3), ('Retiros', 4), ('Adicionales', 5)
on conflict (nombre) do nothing;

-- Servicios. activo = true: precio tomado de su agenda (lo más reciente).
-- activo = false: falta confirmar el precio (quedan ocultos hasta que lo complete en el panel).
insert into public.servicios (categoria_id, nombre, descripcion, precio, duracion_min, es_adicional, activo, visible_web, orden)
select c.id, v.nombre, v.descripcion, v.precio, v.duracion, v.adicional, v.activo, true, v.orden
from (values
  ('Semipermanente', 'Semipermanente liso', 'Esmaltado semipermanente en un solo color.', 9500, 60, false, true, 1),
  ('Semipermanente', 'Semipermanente con deco', 'Esmaltado semipermanente con deco o diseño en 4 uñas en total.', 11500, 75, false, true, 2),
  ('Semipermanente', 'Semipermanente con francesitas', null, 0, 75, false, false, 3),
  ('Semipermanente', 'Semipermanente con francesitas combinadas', 'Francesitas combinadas en 1 o 2 uñas.', 0, 75, false, false, 4),
  ('Capping gel', 'Capping gel liso', 'Capping en gel con esmaltado liso.', 13000, 90, false, true, 1),
  ('Capping gel', 'Capping gel con deco', 'Capping en gel con deco o diseño en 4 uñas en total.', 13500, 105, false, true, 2),
  ('Capping gel', 'Capping gel con francesitas', null, 0, 105, false, false, 3),
  ('Capping gel', 'Capping gel con francesitas combinadas', 'Francesitas combinadas en 1 o 2 uñas.', 0, 105, false, false, 4),
  ('Esculpidas en gel', 'Esculpidas en gel lisas', 'Uñas esculpidas en gel con esmaltado liso.', 0, 150, false, false, 1),
  ('Esculpidas en gel', 'Esculpidas en gel con deco', 'Deco o diseño en 4 uñas en total.', 0, 165, false, false, 2),
  ('Esculpidas en gel', 'Esculpidas en gel con francesitas', null, 0, 165, false, false, 3),
  ('Esculpidas en gel', 'Service de esculpidas', 'Mantenimiento de esculpidas. Incluye esmaltado liso.', 0, 120, false, false, 4),
  ('Esculpidas en gel', 'Service de esculpidas con deco', 'Mantenimiento de esculpidas con deco o diseño.', 18000, 135, false, true, 5),
  ('Retiros', 'Retiro de servicio', 'Retirado del servicio, propio o de otra colega.', 6000, 45, false, true, 1),
  ('Adicionales', 'Uña extra con deco o diseño', 'Precio por cada uña adicional.', 0, 10, true, false, 1),
  ('Adicionales', 'Reparar uña (semipermanente)', null, 0, 15, true, false, 2),
  ('Adicionales', 'Reparar uña (capping gel)', null, 0, 20, true, false, 3),
  ('Adicionales', 'Reparar uña (esculpida)', null, 0, 25, true, false, 4)
) as v(categoria, nombre, descripcion, precio, duracion, adicional, activo, orden)
join public.categorias_servicio c on c.nombre = v.categoria
where not exists (select 1 from public.servicios s where s.nombre = v.nombre);

-- Galería (fotos incluidas en el sitio, carpeta public/contenido)
insert into public.categorias_foto (nombre, orden) values
  ('Esculpidas', 1), ('Nail art', 2), ('Clásicas y color', 3), ('Mi espacio', 4), ('Certificados', 5)
on conflict (nombre) do nothing;

insert into public.fotos (storage_path, categoria_id, descripcion, destacada, visible, orden)
select v.path, c.id, v.descripcion, v.destacada, true, v.orden
from (values
  ('/contenido/galeria/esculpidas-01.webp', 'Esculpidas', null::text, true, 0),
  ('/contenido/galeria/esculpidas-02.webp', 'Esculpidas', null::text, false, 1),
  ('/contenido/galeria/esculpidas-03.webp', 'Esculpidas', null::text, true, 2),
  ('/contenido/galeria/esculpidas-04.webp', 'Esculpidas', null::text, false, 3),
  ('/contenido/galeria/esculpidas-05.webp', 'Esculpidas', null::text, true, 4),
  ('/contenido/galeria/esculpidas-06.webp', 'Esculpidas', null::text, false, 5),
  ('/contenido/galeria/esculpidas-07.webp', 'Esculpidas', null::text, false, 6),
  ('/contenido/galeria/esculpidas-08.webp', 'Esculpidas', null::text, false, 7),
  ('/contenido/galeria/nail-art-01.webp', 'Nail art', null::text, true, 8),
  ('/contenido/galeria/nail-art-02.webp', 'Nail art', null::text, false, 9),
  ('/contenido/galeria/nail-art-03.webp', 'Nail art', null::text, true, 10),
  ('/contenido/galeria/nail-art-04.webp', 'Nail art', null::text, false, 11),
  ('/contenido/galeria/nail-art-05.webp', 'Nail art', null::text, true, 12),
  ('/contenido/galeria/nail-art-06.webp', 'Nail art', null::text, false, 13),
  ('/contenido/galeria/nail-art-07.webp', 'Nail art', null::text, false, 14),
  ('/contenido/galeria/nail-art-08.webp', 'Nail art', null::text, true, 15),
  ('/contenido/galeria/nail-art-09.webp', 'Nail art', null::text, false, 16),
  ('/contenido/galeria/nail-art-10.webp', 'Nail art', null::text, false, 17),
  ('/contenido/galeria/nail-art-11.webp', 'Nail art', null::text, false, 18),
  ('/contenido/galeria/nail-art-12.webp', 'Nail art', null::text, false, 19),
  ('/contenido/galeria/clasicas-01.webp', 'Clásicas y color', null::text, false, 20),
  ('/contenido/galeria/clasicas-02.webp', 'Clásicas y color', null::text, false, 21),
  ('/contenido/galeria/clasicas-03.webp', 'Clásicas y color', null::text, true, 22),
  ('/contenido/galeria/clasicas-04.webp', 'Clásicas y color', null::text, false, 23),
  ('/contenido/galeria/clasicas-05.webp', 'Clásicas y color', null::text, false, 24),
  ('/contenido/galeria/clasicas-06.webp', 'Clásicas y color', null::text, false, 25),
  ('/contenido/galeria/clasicas-07.webp', 'Clásicas y color', null::text, false, 26),
  ('/contenido/galeria/clasicas-08.webp', 'Clásicas y color', null::text, true, 27),
  ('/contenido/galeria/clasicas-09.webp', 'Clásicas y color', null::text, false, 28),
  ('/contenido/galeria/clasicas-10.webp', 'Clásicas y color', null::text, false, 29),
  ('/contenido/galeria/clasicas-11.webp', 'Clásicas y color', null::text, false, 30),
  ('/contenido/galeria/clasicas-12.webp', 'Clásicas y color', null::text, false, 31),
  ('/contenido/galeria/clasicas-13.webp', 'Clásicas y color', null::text, false, 32),
  ('/contenido/galeria/clasicas-14.webp', 'Clásicas y color', null::text, false, 33),
  ('/contenido/galeria/mi-espacio-01.webp', 'Mi espacio', 'Mi espacio de trabajo', false, 34),
  ('/contenido/galeria/mi-espacio-02.webp', 'Mi espacio', 'Mi espacio de trabajo', false, 35),
  ('/contenido/galeria/certificado-01.webp', 'Certificados', 'Certificado de formación', false, 36),
  ('/contenido/galeria/certificado-02.webp', 'Certificados', 'Certificado de formación', false, 37),
  ('/contenido/galeria/certificado-03.webp', 'Certificados', 'Certificado de formación', false, 38),
  ('/contenido/galeria/certificado-04.webp', 'Certificados', 'Certificado de formación', false, 39),
  ('/contenido/galeria/certificado-05.webp', 'Certificados', 'Certificado de formación', false, 40),
  ('/contenido/galeria/certificado-06.webp', 'Certificados', 'Certificado de formación', false, 41),
  ('/contenido/galeria/certificado-07.webp', 'Certificados', 'Certificado de formación', false, 42),
  ('/contenido/galeria/certificado-08.webp', 'Certificados', 'Certificado de formación', false, 43),
  ('/contenido/galeria/certificado-09.webp', 'Certificados', 'Certificado de formación', false, 44),
  ('/contenido/galeria/certificado-10.webp', 'Certificados', 'Certificado de formación', false, 45)
) as v(path, categoria, descripcion, destacada, orden)
join public.categorias_foto c on c.nombre = v.categoria
on conflict (storage_path) do nothing;
