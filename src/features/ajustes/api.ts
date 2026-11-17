import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { setZonaHoraria } from '@/lib/fechas'
import { supabase } from '@/lib/supabase'
import type { Ajustes, AjustesPublicos, HorarioLaboral } from '@/lib/types'

export function useAjustesPublicos() {
  return useQuery({
    queryKey: ['ajustes-publicos'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ajustes_publicos')
      if (error) throw error
      const a = data as AjustesPublicos
      setZonaHoraria(a?.zona_horaria)
      return a
    },
  })
}

export function useAjustes() {
  return useQuery({
    queryKey: ['ajustes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ajustes_negocio').select('*').eq('id', 1).single()
      if (error) throw error
      const a = data as Ajustes
      setZonaHoraria(a.zona_horaria)
      return a
    },
  })
}

export function useGuardarAjustes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cambios: Partial<Ajustes>) => {
      const { error } = await supabase.from('ajustes_negocio').update(cambios).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ajustes'] })
      qc.invalidateQueries({ queryKey: ['ajustes-publicos'] })
    },
  })
}

export function useHorarios() {
  return useQuery({
    queryKey: ['horarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('horarios_laborales').select('*').order('dia_semana').order('hora_inicio')
      if (error) throw error
      return data as HorarioLaboral[]
    },
  })
}

/** Reemplaza todas las franjas de la semana */
export function useGuardarHorarios() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (franjas: Omit<HorarioLaboral, 'id'>[]) => {
      const { error: e1 } = await supabase.from('horarios_laborales').delete().gte('dia_semana', 0)
      if (e1) throw e1
      if (franjas.length) {
        const { error } = await supabase.from('horarios_laborales').insert(franjas)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['horarios'] })
      qc.invalidateQueries({ queryKey: ['ajustes-publicos'] })
    },
  })
}
