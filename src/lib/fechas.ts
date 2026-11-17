import { TZDate } from '@date-fns/tz'
import { addDays, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

// Zona horaria del negocio. Se actualiza al cargar los ajustes.
let zona = 'America/Argentina/Buenos_Aires'

export function setZonaHoraria(tz: string | null | undefined) {
  if (tz) zona = tz
}
export function getZonaHoraria() {
  return zona
}

/** Fecha/hora "vista desde el negocio" */
export function enZona(fecha: string | Date | number): TZDate {
  return new TZDate(typeof fecha === 'string' ? Date.parse(fecha) : +fecha, zona)
}

export function ahora(): TZDate {
  return TZDate.tz(zona)
}

/** "2026-11-17" de hoy en la zona del negocio */
export function hoyISO(): string {
  return format(ahora(), 'yyyy-MM-dd')
}

/** Construye un instante a partir de fecha local (yyyy-MM-dd) y hora local (HH:mm) del negocio */
export function instante(fechaISO: string, hora: string): Date {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  return new Date(new TZDate(y, m - 1, d, hh, mm, zona).getTime())
}

/** yyyy-MM-dd de un instante, visto en la zona del negocio */
export function fechaISO(fecha: string | Date): string {
  return format(enZona(fecha), 'yyyy-MM-dd')
}

export function horaTexto(fecha: string | Date): string {
  return format(enZona(fecha), 'HH:mm')
}

export function fmt(fecha: string | Date, patron: string): string {
  return format(enZona(fecha), patron, { locale: es })
}

/** Fecha de calendario (sin hora), p.ej. columnas date de la base */
export function fmtDia(fechaISO: string, patron = "EEEE d 'de' MMMM"): string {
  const [y, m, d] = fechaISO.slice(0, 10).split('-').map(Number)
  return format(new Date(y, m - 1, d), patron, { locale: es })
}

export function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return format(addDays(new Date(y, m - 1, d), dias), 'yyyy-MM-dd')
}

export function inicioSemana(fechaISO: string): string {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return format(startOfWeek(new Date(y, m - 1, d), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function diaSemana(fechaISO: string): number {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutosAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function duracionTexto(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
