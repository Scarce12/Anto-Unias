import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { datos, refrescar } from '@/lib/consultas'
import { instante, sumarDias } from '@/lib/fechas'
import { supabase } from '@/lib/supabase'
import type { Bloqueo, EstadoTurno, Pago, TurnoDetalle, TurnoItem } from '@/lib/types'

/** Turnos entre dos fechas locales (desde inclusive, hasta inclusive) */
export function useTurnosRango(desde: string, hasta: string, incluirCancelados = true) {
  return useQuery({
    queryKey: ['turnos', 'rango', desde, hasta, incluirCancelados],
    queryFn: async () => {
      let q = supabase
        .from('turnos_detalle')
        .select('*')
        .gte('inicio', instante(desde, '00:00').toISOString())
        .lt('inicio', instante(sumarDias(hasta, 1), '00:00').toISOString())
        .order('inicio')
      if (!incluirCancelados) q = q.in('estado', ['pendiente', 'confirmado', 'finalizado'])
      return datos<TurnoDetalle[]>(await q)
    },
  })
}

export function useBloqueosRango(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['bloqueos', desde, hasta],
    queryFn: async () =>
      datos<Bloqueo[]>(
        await supabase
          .from('bloqueos')
          .select('*')
          .lt('inicio', instante(sumarDias(hasta, 1), '00:00').toISOString())
          .gt('fin', instante(desde, '00:00').toISOString())
          .order('inicio'),
      ),
  })
}

export function useBloqueosFuturos() {
  return useQuery({
    queryKey: ['bloqueos', 'futuros'],
    queryFn: async () =>
      datos<Bloqueo[]>(await supabase.from('bloqueos').select('*').gt('fin', new Date().toISOString()).order('inicio').limit(100)),
  })
}

export function useTurnosPendientes() {
  return useQuery({
    queryKey: ['turnos', 'pendientes'],
    queryFn: async () =>
      datos<TurnoDetalle[]>(
        await supabase.from('turnos_detalle').select('*').eq('estado', 'pendiente').gte('fin', new Date().toISOString()).order('inicio'),
      ),
  })
}

/** Turnos que ya pasaron y siguen pendientes/confirmados: hay que cerrarlos */
export function useTurnosSinCerrar() {
  return useQuery({
    queryKey: ['turnos', 'sin-cerrar'],
    queryFn: async () =>
      datos<TurnoDetalle[]>(
        await supabase.from('turnos_detalle').select('*').in('estado', ['pendiente', 'confirmado']).lt('fin', new Date().toISOString()).order('inicio').limit(50),
      ),
  })
}

export function useTurno(id: string | null | undefined) {
  return useQuery({
    queryKey: ['turno', id],
    enabled: !!id,
    queryFn: async () => {
      const [t, items, pagos] = await Promise.all([
        supabase.from('turnos_detalle').select('*').eq('id', id!).single(),
        supabase.from('turno_items').select('*').eq('turno_id', id!).order('orden'),
        supabase.from('pagos').select('*').eq('turno_id', id!).order('fecha'),
      ])
      return { turno: datos<TurnoDetalle>(t), items: datos<TurnoItem[]>(items), pagos: datos<Pago[]>(pagos) }
    },
  })
}

export interface ItemInput {
  servicio_id: string | null
  nombre: string
  precio: number
  duracion_min: number
  es_adicional: boolean
}

export interface GuardarTurnoInput {
  id?: string | null
  clienta_id: string | null
  inicio: Date
  items: ItemInput[]
  duracion_min?: number | null
  estado: EstadoTurno
  descuento: number
  promocion_id: string | null
  sena_esperada: number
  notas: string | null
}

export function useGuardarTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: GuardarTurnoInput) => {
      const r = await supabase.rpc('guardar_turno', {
        p_id: t.id ?? null,
        p_clienta_id: t.clienta_id,
        p_inicio: t.inicio.toISOString(),
        p_items: t.items,
        p_duracion_min: t.duracion_min ?? null,
        p_estado: t.estado,
        p_descuento: t.descuento,
        p_promocion_id: t.promocion_id,
        p_sena_esperada: t.sena_esperada,
        p_notas: t.notas,
      })
      return datos<string>(r)
    },
    onSuccess: () => refrescar(qc),
  })
}

export function useCambiarEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado, nota }: { id: string; estado: EstadoTurno; nota?: string | null }) => {
      const cambios: Record<string, unknown> = { estado }
      if (nota !== undefined) cambios.nota_estado = nota
      const { error } = await supabase.from('turnos').update(cambios).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

export function useMarcarMensaje() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, campo }: { id: string; campo: 'confirmacion_enviada_en' | 'recordatorio_enviado_en' }) => {
      const { error } = await supabase.from('turnos').update({ [campo]: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc, ['turno', 'turnos', 'dashboard']),
  })
}

export function useVincularClienta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ turno, clienta }: { turno: string; clienta: string }) => {
      const { error } = await supabase.rpc('vincular_turno_clienta', { p_turno: turno, p_clienta: clienta })
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

export function useBorrarTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('turnos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc),
  })
}

export async function conflictosHorario(inicio: Date, fin: Date, excluir?: string | null) {
  const r = await supabase.rpc('conflictos_horario', {
    p_inicio: inicio.toISOString(),
    p_fin: fin.toISOString(),
    p_excluir_turno: excluir ?? null,
  })
  return datos<{ tipo: 'turno' | 'bloqueo' | 'fuera_de_horario'; detalle: string; inicio: string; fin: string }[]>(r)
}

export async function horariosLibres(fecha: string, duracion: number, excluir?: string | null) {
  const r = await supabase.rpc('horarios_disponibles', {
    p_fecha: fecha,
    p_duracion_min: duracion,
    p_excluir_turno: excluir ?? null,
    p_publico: false,
  })
  return datos<string[]>(r)
}

// Bloqueos
export function useGuardarBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...b }: Omit<Bloqueo, 'id'> & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from('bloqueos').update(b).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('bloqueos').insert(b)
        if (error) throw error
      }
    },
    onSuccess: () => refrescar(qc, ['bloqueos', 'turnos']),
  })
}

export function useBorrarBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bloqueos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc, ['bloqueos']),
  })
}
