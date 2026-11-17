import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { datos, refrescar } from '@/lib/consultas'
import { instante, sumarDias } from '@/lib/fechas'
import { supabase } from '@/lib/supabase'
import type { CategoriaGasto, CreditoSaldo, Gasto, MedioPago, MovimientoPlanilla, ResumenDashboard, ResumenFinanzas } from '@/lib/types'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    refetchInterval: 5 * 60_000,
    queryFn: async () => datos<ResumenDashboard>(await supabase.rpc('resumen_dashboard')),
  })
}

export function useResumenFinanzas(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['finanzas', desde, hasta],
    queryFn: async () => datos<ResumenFinanzas>(await supabase.rpc('resumen_finanzas', { p_desde: desde, p_hasta: hasta })),
  })
}

export function usePlanilla(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['planilla', desde, hasta],
    queryFn: async () => datos<MovimientoPlanilla[]>(await supabase.rpc('planilla_movimientos', { p_desde: desde, p_hasta: hasta })),
  })
}

// ---------------- Pagos ----------------
export interface PagoInput {
  turno_id?: string | null
  clienta_id?: string | null
  monto: number
  medio: MedioPago
  credito_id?: string | null
  es_sena?: boolean
  concepto?: string | null
  notas?: string | null
  fecha?: string
}

export function useRegistrarPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: PagoInput) => {
      const { error } = await supabase.from('pagos').insert(p)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

export function useBorrarPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pagos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

export function useIngresos(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['ingresos', desde, hasta],
    queryFn: async () =>
      datos<{ id: string; fecha: string; monto: number; medio: MedioPago; clienta_id: string | null; turno_id: string | null; concepto: string; origen: 'pago' | 'credito' }[]>(
        await supabase
          .from('ingresos')
          .select('*')
          .gte('fecha', instante(desde, '00:00').toISOString())
          .lt('fecha', instante(sumarDias(hasta, 1), '00:00').toISOString())
          .order('fecha', { ascending: false }),
      ),
  })
}

// ---------------- Créditos (gift cards / saldo a favor) ----------------
export function useCreditos(filtro: { clienta_id?: string; conSaldo?: boolean } = {}) {
  return useQuery({
    queryKey: ['creditos', filtro],
    queryFn: async () => {
      let q = supabase.from('creditos_saldo').select('*').order('fecha', { ascending: false })
      if (filtro.clienta_id) q = q.or(`clienta_id.eq.${filtro.clienta_id},tipo.eq.gift_card`)
      if (filtro.conSaldo) q = q.gt('saldo', 0).eq('anulado', false)
      return datos<CreditoSaldo[]>(await q.limit(300))
    },
  })
}

export interface CreditoInput {
  tipo: 'gift_card' | 'saldo_a_favor'
  codigo?: string | null
  clienta_id?: string | null
  comprador_nombre?: string | null
  beneficiaria_nombre?: string | null
  monto: number
  medio: MedioPago
  vence?: string | null
  notas?: string | null
}

export function useCrearCredito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: CreditoInput) => {
      const { error } = await supabase.from('creditos').insert(c)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

export function useAnularCredito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, anulado }: { id: string; anulado: boolean }) => {
      const { error } = await supabase.from('creditos').update({ anulado }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

// ---------------- Gastos ----------------
export function useCategoriasGasto() {
  return useQuery({
    queryKey: ['categorias-gasto'],
    queryFn: async () => datos<CategoriaGasto[]>(await supabase.from('categorias_gasto').select('*').order('orden').order('nombre')),
  })
}

export function useGastos(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['gastos', desde, hasta],
    queryFn: async () =>
      datos<Gasto[]>(await supabase.from('gastos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).order('creado_en', { ascending: false })),
  })
}

export function useGuardarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...g }: Omit<Gasto, 'id'> & { id?: string }) => {
      const r = id ? await supabase.from('gastos').update(g).eq('id', id) : await supabase.from('gastos').insert(g)
      if (r.error) throw r.error
    },
    onSuccess: () => refrescar(qc, ['gastos', 'finanzas', 'dashboard']),
  })
}

export function useBorrarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gastos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc, ['gastos', 'finanzas', 'dashboard']),
  })
}

export function useGuardarCategoriaGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...c }: Partial<CategoriaGasto> & { nombre: string }) => {
      const r = id ? await supabase.from('categorias_gasto').update(c).eq('id', id) : await supabase.from('categorias_gasto').insert(c)
      if (r.error) throw r.error
    },
    onSuccess: () => refrescar(qc, ['categorias-gasto', 'finanzas']),
  })
}

export function useBorrarCategoriaGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias_gasto').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc, ['categorias-gasto', 'gastos', 'finanzas']),
  })
}
