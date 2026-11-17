import type { QueryClient } from '@tanstack/react-query'

// Claves que dependen de turnos/pagos: al cambiar algo, se refresca todo lo relacionado
export const CLAVES_OPERATIVAS = ['turnos', 'turno', 'dashboard', 'clientas', 'clienta', 'finanzas', 'planilla', 'pagos', 'creditos', 'ingresos']

export function refrescar(qc: QueryClient, claves: string[] = CLAVES_OPERATIVAS) {
  for (const k of claves) qc.invalidateQueries({ queryKey: [k] })
}

/** Lanza el error de Supabase si existe y devuelve los datos tipados */
export function datos<T>(r: { data: unknown; error: unknown }): T {
  if (r.error) throw r.error
  return r.data as T
}
