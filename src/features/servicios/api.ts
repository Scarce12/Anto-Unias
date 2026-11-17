import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { datos } from '@/lib/consultas'
import { supabase } from '@/lib/supabase'
import type { CategoriaServicio, Servicio } from '@/lib/types'

/** Panel: todos los servicios. Público: RLS ya filtra activos y visibles. */
export function useServicios(soloActivos = false) {
  return useQuery({
    queryKey: ['servicios', soloActivos],
    queryFn: async () => {
      let q = supabase.from('servicios').select('*').order('es_adicional').order('orden').order('nombre')
      if (soloActivos) q = q.eq('activo', true)
      return datos<Servicio[]>(await q)
    },
  })
}

export function useCategoriasServicio() {
  return useQuery({
    queryKey: ['categorias-servicio'],
    queryFn: async () => datos<CategoriaServicio[]>(await supabase.from('categorias_servicio').select('*').order('orden').order('nombre')),
  })
}

export type ServicioInput = Omit<Servicio, 'id'>

export function useGuardarServicio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...s }: Partial<ServicioInput> & { id?: string }) => {
      if (id) return datos<Servicio>(await supabase.from('servicios').update(s).eq('id', id).select().single())
      return datos<Servicio>(await supabase.from('servicios').insert(s).select().single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicios'] }),
  })
}

export function useBorrarServicio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('servicios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicios'] }),
  })
}

export function useGuardarCategoriaServicio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, nombre, orden }: { id?: string; nombre: string; orden?: number }) => {
      if (id) return datos<CategoriaServicio>(await supabase.from('categorias_servicio').update({ nombre, orden }).eq('id', id).select().single())
      return datos<CategoriaServicio>(await supabase.from('categorias_servicio').insert({ nombre, orden: orden ?? 0 }).select().single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias-servicio'] }),
  })
}

export function useBorrarCategoriaServicio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias_servicio').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias-servicio'] })
      qc.invalidateQueries({ queryKey: ['servicios'] })
    },
  })
}

/**
 * Nombres que aparecen en su agenda en papel. Se cargan SIN precio e inactivos:
 * ella completa precio y duración y los activa. No se inventan valores comerciales.
 */
export const SUGERENCIAS_SERVICIOS: { nombre: string; es_adicional: boolean; categoria: string }[] = [
  { nombre: 'Semipermanente liso', es_adicional: false, categoria: 'Semipermanente' },
  { nombre: 'Semipermanente + deco', es_adicional: false, categoria: 'Semipermanente' },
  { nombre: 'Capping liso', es_adicional: false, categoria: 'Capping' },
  { nombre: 'Capping + deco', es_adicional: false, categoria: 'Capping' },
  { nombre: 'Capping + French', es_adicional: false, categoria: 'Capping' },
  { nombre: 'Esculpidas', es_adicional: false, categoria: 'Esculpidas' },
  { nombre: 'Service de esculpidas', es_adicional: false, categoria: 'Esculpidas' },
  { nombre: 'Soft gel', es_adicional: false, categoria: 'Esculpidas' },
  { nombre: 'Esmaltado tradicional', es_adicional: false, categoria: 'Tradicional' },
  { nombre: 'Retiro de sistema', es_adicional: false, categoria: 'Retiros' },
  { nombre: 'Retiro (adicional)', es_adicional: true, categoria: 'Adicionales' },
  { nombre: 'Deco / nail art', es_adicional: true, categoria: 'Adicionales' },
  { nombre: 'French', es_adicional: true, categoria: 'Adicionales' },
  { nombre: 'Arreglo de uña', es_adicional: true, categoria: 'Adicionales' },
]

export function useCargarSugerencias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (elegidas: typeof SUGERENCIAS_SERVICIOS) => {
      const cats = [...new Set(elegidas.map((e) => e.categoria))]
      const existentes = datos<CategoriaServicio[]>(await supabase.from('categorias_servicio').select('*'))
      const mapa = new Map(existentes.map((c) => [c.nombre, c.id]))
      const nuevas = cats.filter((c) => !mapa.has(c))
      if (nuevas.length) {
        const creadas = datos<CategoriaServicio[]>(
          await supabase.from('categorias_servicio').insert(nuevas.map((nombre, i) => ({ nombre, orden: existentes.length + i }))).select(),
        )
        creadas.forEach((c) => mapa.set(c.nombre, c.id))
      }
      const { error } = await supabase.from('servicios').insert(
        elegidas.map((e, i) => ({
          nombre: e.nombre,
          es_adicional: e.es_adicional,
          categoria_id: mapa.get(e.categoria) ?? null,
          precio: 0,
          duracion_min: e.es_adicional ? 15 : 60,
          activo: false,
          orden: i,
        })),
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicios'] })
      qc.invalidateQueries({ queryKey: ['categorias-servicio'] })
    },
  })
}
