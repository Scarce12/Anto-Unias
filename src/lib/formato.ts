import type { EstadoPago, EstadoTurno, MedioPago } from './types'

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const pesosConCentavos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

export function dinero(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  return Number.isInteger(v) ? pesos.format(v) : pesosConCentavos.format(v)
}

/** Convierte "15.000", "15000,50", "$ 15.000" en número */
export function parseDinero(s: string): number {
  const limpio = s.replace(/[^\d,.-]/g, '')
  if (!limpio) return 0
  // En Argentina el punto es separador de miles y la coma decimal
  const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/\.(?=\d{3}(\D|$))/g, '')
  const n = Number(normal)
  return Number.isFinite(n) ? n : 0
}

export const MEDIOS_PAGO: { valor: Exclude<MedioPago, 'credito'>; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'mercado_pago', etiqueta: 'Mercado Pago' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  otro: 'Otro',
  credito: 'Gift card / saldo',
}

export const ESTADOS_TURNO: Record<EstadoTurno, { etiqueta: string; clase: string; punto: string }> = {
  pendiente: { etiqueta: 'Pendiente', clase: 'bg-amber-50 text-amber-800 ring-amber-200', punto: 'bg-amber-400' },
  confirmado: { etiqueta: 'Confirmado', clase: 'bg-emerald-50 text-emerald-800 ring-emerald-200', punto: 'bg-emerald-500' },
  finalizado: { etiqueta: 'Finalizado', clase: 'bg-sky-50 text-sky-800 ring-sky-200', punto: 'bg-sky-500' },
  cancelado: { etiqueta: 'Cancelado', clase: 'bg-stone-100 text-stone-600 ring-stone-200', punto: 'bg-stone-400' },
  no_asistio: { etiqueta: 'No asistió', clase: 'bg-red-50 text-red-700 ring-red-200', punto: 'bg-red-500' },
}

export const ESTADOS_PAGO: Record<EstadoPago, { etiqueta: string; clase: string }> = {
  sin_cargo: { etiqueta: 'Sin cargo', clase: 'bg-stone-100 text-stone-600 ring-stone-200' },
  pagado: { etiqueta: 'Pagado', clase: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  sena: { etiqueta: 'Con seña', clase: 'bg-violet-50 text-violet-800 ring-violet-200' },
  parcial: { etiqueta: 'Pago parcial', clase: 'bg-amber-50 text-amber-800 ring-amber-200' },
  pendiente: { etiqueta: 'Sin pagar', clase: 'bg-rosa-50 text-rosa-700 ring-rosa-200' },
}

export function nombreCompleto(c: { nombre: string; apellido?: string | null } | null | undefined): string {
  if (!c) return ''
  return [c.nombre, c.apellido].filter(Boolean).join(' ')
}

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '?'
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`
}
