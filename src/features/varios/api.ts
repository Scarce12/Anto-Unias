// Galería, promociones, cumpleaños, avisos y calendario personal
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { datos } from '@/lib/consultas'
import { borrarImagen } from '@/lib/imagenes'
import { supabase } from '@/lib/supabase'
import type { Aviso, AvisoClienta, CategoriaFoto, CumpleExtra, Foto, MarcaCalendario, Promocion } from '@/lib/types'

// ---------------- Galería ----------------
export function useFotos(soloDestacadas = false) {
  return useQuery({
    queryKey: ['fotos', soloDestacadas],
    queryFn: async () => {
      let q = supabase.from('fotos').select('*').order('destacada', { ascending: false }).order('orden').order('creado_en', { ascending: false })
      if (soloDestacadas) q = q.eq('destacada', true)
      return datos<Foto[]>(await q.limit(300))
    },
  })
}

export function useCategoriasFoto() {
  return useQuery({
    queryKey: ['categorias-foto'],
    queryFn: async () => datos<CategoriaFoto[]>(await supabase.from('categorias_foto').select('*').order('orden').order('nombre')),
  })
}

export function useGuardarFoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...f }: Partial<Foto> & { id?: string }) => {
      const r = id ? await supabase.from('fotos').update(f).eq('id', id) : await supabase.from('fotos').insert(f)
      if (r.error) throw r.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fotos'] }),
  })
}

export function useBorrarFoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: Foto) => {
      const { error } = await supabase.from('fotos').delete().eq('id', f.id)
      if (error) throw error
      await borrarImagen(f.storage_path)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fotos'] }),
  })
}

export function useGuardarCategoriaFoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, nombre }: { id?: string; nombre: string }) => {
      const r = id ? await supabase.from('categorias_foto').update({ nombre }).eq('id', id) : await supabase.from('categorias_foto').insert({ nombre })
      if (r.error) throw r.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias-foto'] }),
  })
}

export function useBorrarCategoriaFoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias_foto').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias-foto'] })
      qc.invalidateQueries({ queryKey: ['fotos'] })
    },
  })
}

// ---------------- Promociones ----------------
export function usePromociones() {
  return useQuery({
    queryKey: ['promociones'],
    queryFn: async () =>
      datos<Promocion[]>(await supabase.from('promociones').select('*, promocion_servicios(servicio_id)').order('fecha_fin', { ascending: false })),
  })
}

export function useGuardarPromocion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, servicios, ...p }: Omit<Promocion, 'id' | 'promocion_servicios'> & { id?: string; servicios: string[] }) => {
      let pid = id
      if (id) {
        const { error } = await supabase.from('promociones').update(p).eq('id', id)
        if (error) throw error
        const { error: e2 } = await supabase.from('promocion_servicios').delete().eq('promocion_id', id)
        if (e2) throw e2
      } else {
        pid = datos<{ id: string }>(await supabase.from('promociones').insert(p).select('id').single()).id
      }
      if (servicios.length) {
        const { error } = await supabase.from('promocion_servicios').insert(servicios.map((s) => ({ promocion_id: pid, servicio_id: s })))
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promociones'] }),
  })
}

export function useBorrarPromocion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promociones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promociones'] }),
  })
}

// ---------------- Cumpleaños ----------------
export function useCumpleanos() {
  return useQuery({
    queryKey: ['cumpleanos'],
    queryFn: async () => {
      const [cl, ex] = await Promise.all([
        supabase.from('clientas').select('id, nombre, apellido, whatsapp, cumple_dia, cumple_mes, cumple_anio').eq('activa', true).not('cumple_mes', 'is', null),
        supabase.from('cumpleanos_extra').select('*'),
      ])
      return {
        clientas: datos<{ id: string; nombre: string; apellido: string | null; whatsapp: string | null; cumple_dia: number; cumple_mes: number; cumple_anio: number | null }[]>(cl),
        extras: datos<CumpleExtra[]>(ex),
      }
    },
  })
}

export function useGuardarCumpleExtra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...c }: Omit<CumpleExtra, 'id'> & { id?: string }) => {
      const r = id ? await supabase.from('cumpleanos_extra').update(c).eq('id', id) : await supabase.from('cumpleanos_extra').insert(c)
      if (r.error) throw r.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cumpleanos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBorrarCumpleExtra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cumpleanos_extra').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cumpleanos'] }),
  })
}

// ---------------- Avisos ----------------
export function useAvisos() {
  return useQuery({
    queryKey: ['avisos'],
    queryFn: async () => {
      const r = await supabase.from('avisos').select('*, aviso_clientas(avisada)').order('archivado').order('creado_en', { ascending: false })
      return datos<(Aviso & { aviso_clientas: { avisada: boolean }[] })[]>(r)
    },
  })
}

export function useAviso(id: string | undefined) {
  return useQuery({
    queryKey: ['avisos', id],
    enabled: !!id,
    queryFn: async () => {
      const [a, lista] = await Promise.all([
        supabase.from('avisos').select('*').eq('id', id!).single(),
        supabase.from('aviso_clientas').select('*, clientas(id, nombre, apellido, whatsapp, instagram, es_fija)').eq('aviso_id', id!),
      ])
      const filas = datos<AvisoClienta[]>(lista).sort((x, y) => (x.clientas?.nombre ?? '').localeCompare(y.clientas?.nombre ?? '', 'es'))
      return { aviso: datos<Aviso>(a), filas }
    },
  })
}

export function useGuardarAviso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...a }: Partial<Aviso> & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from('avisos').update(a).eq('id', id)
        if (error) throw error
        return id
      }
      return datos<{ id: string }>(await supabase.from('avisos').insert(a).select('id').single()).id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  })
}

export function useBorrarAviso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avisos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  })
}

export function useAvisoAgregarClientas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aviso, ids, soloFijas }: { aviso: string; ids?: string[]; soloFijas?: boolean }) => {
      if (ids) {
        const { error } = await supabase.from('aviso_clientas').upsert(ids.map((c) => ({ aviso_id: aviso, clienta_id: c })), { ignoreDuplicates: true })
        if (error) throw error
        return ids.length
      }
      return datos<number>(await supabase.rpc('aviso_agregar_clientas', { p_aviso: aviso, p_solo_fijas: !!soloFijas }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  })
}

export function useMarcarAvisada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aviso, clienta, avisada, nota }: { aviso: string; clienta: string; avisada?: boolean; nota?: string | null }) => {
      const cambios: Record<string, unknown> = {}
      if (avisada !== undefined) {
        cambios.avisada = avisada
        cambios.avisada_en = avisada ? new Date().toISOString() : null
      }
      if (nota !== undefined) cambios.nota = nota
      const { error } = await supabase.from('aviso_clientas').update(cambios).eq('aviso_id', aviso).eq('clienta_id', clienta)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  })
}

export function useQuitarDeAviso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aviso, clienta }: { aviso: string; clienta: string }) => {
      const { error } = await supabase.from('aviso_clientas').delete().eq('aviso_id', aviso).eq('clienta_id', clienta)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  })
}

// ---------------- Calendario personal ----------------
/** Marcas entre dos fechas (yyyy-MM-dd, inclusive) */
export function useCalendario(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['calendario', desde, hasta],
    queryFn: async () =>
      datos<MarcaCalendario[]>(
        await supabase.from('calendario_personal').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      ),
  })
}

export interface DiaCalendario {
  fecha: string
  periodo: boolean
  sintomas: string[]
  nota: string
}

/** Guarda todo lo de un día de una vez: período, síntomas (lista) y nota */
export function useGuardarDia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DiaCalendario) => {
      const filas: { marca: MarcaCalendario['marca']; activa: boolean; nota: string | null }[] = [
        { marca: 'periodo', activa: d.periodo, nota: null },
        { marca: 'sintoma', activa: d.sintomas.length > 0, nota: d.sintomas.join(', ') || null },
        { marca: 'nota', activa: d.nota.trim().length > 0, nota: d.nota.trim() || null },
      ]
      const poner = filas.filter((f) => f.activa).map((f) => ({ fecha: d.fecha, marca: f.marca, nota: f.nota }))
      const sacar = filas.filter((f) => !f.activa).map((f) => f.marca)
      if (poner.length) {
        const { error } = await supabase.from('calendario_personal').upsert(poner, { onConflict: 'perfil_id,fecha,marca' })
        if (error) throw error
      }
      if (sacar.length) {
        const { error } = await supabase.from('calendario_personal').delete().eq('fecha', d.fecha).in('marca', sacar)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendario'] }),
  })
}
