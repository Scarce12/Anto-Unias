import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { datos, refrescar } from '@/lib/consultas'
import { supabase } from '@/lib/supabase'
import type { Clienta, ClientaResumen, Pago, PosibleDuplicada, TurnoDetalle } from '@/lib/types'

export type ClientaInput = Pick<
  Clienta,
  'nombre' | 'apellido' | 'whatsapp' | 'instagram' | 'cumple_dia' | 'cumple_mes' | 'cumple_anio' | 'es_fija' | 'alergias' | 'observaciones'
>

export function useClientas(filtro: { busqueda?: string; soloFijas?: boolean; inactivas?: boolean; orden?: 'nombre' | 'visitas' | 'ultima' } = {}) {
  return useQuery({
    queryKey: ['clientas', filtro],
    queryFn: async () => {
      let q = supabase.from('clientas_resumen').select('*').eq('activa', !filtro.inactivas)
      if (filtro.soloFijas) q = q.eq('es_fija', true)
      // Se quitan los caracteres con significado especial en los filtros de la API
      const s = (filtro.busqueda ?? '').replace(/[^\p{L}\p{N}@._\s+-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
      if (s) {
        const digitos = s.replace(/\D/g, '')
        const ors = [`nombre.ilike.%${s}%`, `apellido.ilike.%${s}%`, `instagram_norm.ilike.%${s.replace(/^@/, '').toLowerCase()}%`]
        if (digitos.length >= 3) ors.push(`whatsapp_norm.ilike.%${digitos}%`)
        // "maria lopez": nombre + apellido
        const partes = s.split(/\s+/)
        if (partes.length > 1) ors.push(`and(nombre.ilike.%${partes[0]}%,apellido.ilike.%${partes.slice(1).join(' ')}%)`)
        q = q.or(ors.join(','))
      }
      if (filtro.orden === 'visitas') q = q.order('visitas', { ascending: false }).order('nombre')
      else if (filtro.orden === 'ultima') q = q.order('ultima_visita', { ascending: false, nullsFirst: false })
      else q = q.order('nombre').order('apellido', { nullsFirst: true })
      return datos<ClientaResumen[]>(await q.limit(500))
    },
  })
}

export function useClienta(id: string | undefined) {
  return useQuery({
    queryKey: ['clienta', id],
    enabled: !!id,
    queryFn: async () => datos<ClientaResumen>(await supabase.from('clientas_resumen').select('*').eq('id', id!).single()),
  })
}

export function useHistorialClienta(id: string | undefined) {
  return useQuery({
    queryKey: ['clienta', id, 'historial'],
    enabled: !!id,
    queryFn: async () => {
      const [turnos, pagos] = await Promise.all([
        supabase.from('turnos_detalle').select('*').eq('clienta_id', id!).order('inicio', { ascending: false }).limit(200),
        supabase.from('pagos').select('*').eq('clienta_id', id!).order('fecha', { ascending: false }).limit(200),
      ])
      return { turnos: datos<TurnoDetalle[]>(turnos), pagos: datos<Pago[]>(pagos) }
    },
  })
}

export async function buscarDuplicadas(c: Partial<ClientaInput>, excluir?: string) {
  if (!c.nombre?.trim() && !c.whatsapp && !c.instagram) return []
  const r = await supabase.rpc('buscar_posibles_duplicadas', {
    p_nombre: c.nombre ?? '',
    p_apellido: c.apellido || null,
    p_whatsapp: c.whatsapp || null,
    p_instagram: c.instagram || null,
    p_excluir: excluir ?? null,
  })
  return datos<PosibleDuplicada[]>(r)
}

function limpiar(c: Partial<ClientaInput>) {
  const out: Record<string, unknown> = { ...c }
  for (const k of ['apellido', 'whatsapp', 'instagram', 'alergias', 'observaciones'] as const) {
    if (typeof out[k] === 'string' && !(out[k] as string).trim()) out[k] = null
  }
  return out
}

export function useGuardarClienta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...c }: Partial<ClientaInput> & { id?: string }) => {
      if (id) {
        return datos<Clienta>(await supabase.from('clientas').update(limpiar(c)).eq('id', id).select().single())
      }
      return datos<Clienta>(await supabase.from('clientas').insert(limpiar(c)).select().single())
    },
    onSuccess: () => refrescar(qc, ['clientas', 'clienta', 'turnos', 'dashboard', 'cumpleanos']),
  })
}

export function useArchivarClienta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase.from('clientas').update({ activa }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refrescar(qc, ['clientas', 'clienta', 'dashboard']),
  })
}
