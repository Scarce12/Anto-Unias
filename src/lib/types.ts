// Tipos de las tablas y vistas de la base (ver supabase/migrations)

export type EstadoTurno = 'pendiente' | 'confirmado' | 'finalizado' | 'cancelado' | 'no_asistio'
export type MedioPago = 'efectivo' | 'transferencia' | 'mercado_pago' | 'otro' | 'credito'
export type EstadoPago = 'sin_cargo' | 'pagado' | 'sena' | 'parcial' | 'pendiente'
export type Origen = 'panel' | 'web'

export interface Ajustes {
  id: 1
  nombre_negocio: string | null
  eslogan: string | null
  presentacion: string | null
  nombre_manicurista: string | null
  logo_path: string | null
  portada_path: string | null
  foto_perfil_path: string | null
  whatsapp: string | null
  instagram: string | null
  direccion: string | null
  zona: string | null
  maps_url: string | null
  horarios_texto: string | null
  zona_horaria: string
  codigo_pais: string
  agenda_hora_inicio: string
  agenda_hora_fin: string
  intervalo_turnos_min: number
  reservas_web_activas: boolean
  confirmacion_automatica: boolean
  anticipacion_min_horas: number
  ventana_reserva_dias: number
  max_pendientes_por_contacto: number
  sena_requerida: boolean
  sena_tipo: 'monto' | 'porcentaje'
  sena_valor: number
  datos_transferencia: string | null
  politica_cancelacion: string | null
  reparto_sueldo_pct: number
  reparto_ganancia_pct: number
  reparto_insumos_pct: number
  plantilla_confirmacion: string
  plantilla_recordatorio: string
  plantilla_sena: string
  plantilla_cambio: string
  plantilla_saldo: string
  plantilla_cumpleanos: string
}

export interface AjustesPublicos {
  nombre_negocio: string | null
  eslogan: string | null
  presentacion: string | null
  nombre_manicurista: string | null
  logo_path: string | null
  portada_path: string | null
  foto_perfil_path: string | null
  whatsapp: string | null
  whatsapp_norm: string | null
  instagram: string | null
  direccion: string | null
  zona: string | null
  maps_url: string | null
  horarios_texto: string | null
  zona_horaria: string
  reservas_web_activas: boolean
  confirmacion_automatica: boolean
  ventana_reserva_dias: number
  sena_requerida: boolean
  sena_tipo: 'monto' | 'porcentaje'
  sena_valor: number
  datos_transferencia: string | null
  politica_cancelacion: string | null
  horarios: { dia: number; inicio: string; fin: string }[]
}

export interface Clienta {
  id: string
  nombre: string
  apellido: string | null
  whatsapp: string | null
  whatsapp_norm: string | null
  instagram: string | null
  instagram_norm: string | null
  cumple_dia: number | null
  cumple_mes: number | null
  cumple_anio: number | null
  es_fija: boolean
  alergias: string | null
  observaciones: string | null
  origen: Origen
  activa: boolean
  creada_en: string
  actualizada_en: string
}

export interface ClientaResumen extends Clienta {
  visitas: number
  ultima_visita: string | null
  primera_visita: string | null
  inasistencias: number
  cancelaciones: number
  proximo_turno: string | null
  deuda: number
  saldo_a_favor: number
}

export interface PosibleDuplicada {
  id: string
  nombre: string
  apellido: string | null
  whatsapp: string | null
  instagram: string | null
  motivo: string
  bloqueante: boolean
}

export interface CategoriaServicio {
  id: string
  nombre: string
  orden: number
}

export interface Servicio {
  id: string
  categoria_id: string | null
  nombre: string
  descripcion: string | null
  precio: number
  duracion_min: number
  es_adicional: boolean
  foto_path: string | null
  activo: boolean
  visible_web: boolean
  orden: number
}

export interface HorarioLaboral {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export interface Bloqueo {
  id: string
  inicio: string
  fin: string
  motivo: string | null
  tipo: 'personal' | 'vacaciones' | 'descanso' | 'feriado' | 'otro'
  todo_el_dia: boolean
}

export interface TurnoItem {
  id: string
  turno_id: string
  servicio_id: string | null
  nombre: string
  precio: number
  duracion_min: number
  es_adicional: boolean
  orden: number
}

export interface Turno {
  id: string
  clienta_id: string | null
  inicio: string
  fin: string
  estado: EstadoTurno
  origen: Origen
  solicitante_nombre: string | null
  solicitante_whatsapp: string | null
  solicitante_instagram: string | null
  solicitante_nota: string | null
  subtotal: number
  descuento: number
  total: number
  sena_esperada: number
  promocion_id: string | null
  notas: string | null
  nota_estado: string | null
  confirmado_en: string | null
  finalizado_en: string | null
  cancelado_en: string | null
  confirmacion_enviada_en: string | null
  recordatorio_enviado_en: string | null
  creado_en: string
}

export interface TurnoDetalle extends Turno {
  clienta_nombre: string | null
  clienta_nombre_pila: string | null
  contacto_whatsapp: string | null
  contacto_instagram: string | null
  clienta_alergias: string | null
  clienta_fija: boolean | null
  servicios_texto: string
  pagado: number
  sena_pagada: number
  saldo: number
  estado_pago: EstadoPago
}

export interface Pago {
  id: string
  fecha: string
  turno_id: string | null
  clienta_id: string | null
  monto: number
  medio: MedioPago
  credito_id: string | null
  es_sena: boolean
  concepto: string | null
  notas: string | null
}

export interface Credito {
  id: string
  tipo: 'gift_card' | 'saldo_a_favor'
  codigo: string | null
  clienta_id: string | null
  comprador_nombre: string | null
  beneficiaria_nombre: string | null
  monto: number
  medio: MedioPago
  fecha: string
  vence: string | null
  notas: string | null
  anulado: boolean
}

export interface CreditoSaldo extends Credito {
  saldo: number
  clienta_nombre: string | null
}

export interface CategoriaGasto {
  id: string
  nombre: string
  es_insumo: boolean
  orden: number
}

export interface Gasto {
  id: string
  fecha: string
  descripcion: string
  categoria_id: string | null
  monto: number
  medio: MedioPago
  notas: string | null
}

export interface CategoriaFoto {
  id: string
  nombre: string
  orden: number
}

export interface Foto {
  id: string
  storage_path: string
  categoria_id: string | null
  servicio_id: string | null
  descripcion: string | null
  destacada: boolean
  visible: boolean
  orden: number
  creado_en: string
}

export interface Promocion {
  id: string
  nombre: string
  descripcion: string | null
  tipo: 'porcentaje' | 'monto_fijo' | 'combo'
  valor: number
  fecha_inicio: string
  fecha_fin: string
  min_visitas: number | null
  activa: boolean
  visible_web: boolean
  promocion_servicios?: { servicio_id: string }[]
}

export interface CumpleExtra {
  id: string
  nombre: string
  dia: number
  mes: number
  anio: number | null
  tipo: 'personal' | 'fecha_especial'
  notas: string | null
}

export interface Aviso {
  id: string
  titulo: string
  mensaje: string
  archivado: boolean
  creado_en: string
}

export interface AvisoClienta {
  aviso_id: string
  clienta_id: string
  avisada: boolean
  avisada_en: string | null
  nota: string | null
  clientas?: Pick<Clienta, 'id' | 'nombre' | 'apellido' | 'whatsapp' | 'instagram' | 'es_fija'>
}

export interface MarcaCalendario {
  perfil_id: string
  fecha: string
  marca: 'periodo' | 'sintoma' | 'nota'
  nota: string | null
}

export interface ResumenFinanzas {
  desde: string
  hasta: string
  ingresos: number
  gastos: number
  neto: number
  gastos_insumos: number
  reparto: {
    sueldo_pct: number
    ganancia_pct: number
    insumos_pct: number
    sueldo: number
    ganancia: number
    insumos: number
  }
  por_medio: { medio: MedioPago; monto: number; cantidad: number }[]
  por_dia: { dia: string; ingresos: number; gastos: number }[]
  gastos_por_categoria: { categoria: string; monto: number }[]
  servicios: { nombre: string; cantidad: number; facturado: number }[]
  turnos: { finalizados: number; cancelados: number; no_asistio: number; facturado: number }
}

export interface MovimientoPlanilla {
  fecha: string
  clienta: string | null
  detalle: string | null
  valor: number
  medio: MedioPago
  turno_id: string | null
  origen: 'pago' | 'credito'
}

export interface ResumenDashboard {
  hoy: string
  turnos_hoy: number
  pendientes: number
  turnos_manana: number
  clientas: number
  clientas_fijas: number
  ingresos_hoy: number
  ingresos_mes: number
  gastos_mes: number
  sin_cerrar: number
  sin_sena: number
  con_deuda: number
  sin_recordatorio_manana: number
  top_servicios: { nombre: string; cantidad: number }[]
  cumpleanos: { nombre: string; dia: number; mes: number; clienta_id: string | null; whatsapp: string | null; en_dias: number }[]
}
