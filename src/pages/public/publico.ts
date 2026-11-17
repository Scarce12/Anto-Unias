// Consultas de la web pública: siempre filtran lo visible (aunque quien mire tenga sesión iniciada)
import { useQuery } from '@tanstack/react-query'
import { datos } from '@/lib/consultas'
import { hoyISO } from '@/lib/fechas'
import { supabase } from '@/lib/supabase'
import type { CategoriaFoto, CategoriaServicio, Foto, Promocion, Servicio } from '@/lib/types'

export function useServiciosPublicos() {
  return useQuery({
    queryKey: ['publico', 'servicios'],
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from('servicios').select('*').eq('activo', true).eq('visible_web', true).order('es_adicional').order('orden').order('nombre'),
        supabase.from('categorias_servicio').select('*').order('orden').order('nombre'),
      ])
      return { servicios: datos<Servicio[]>(s), categorias: datos<CategoriaServicio[]>(c) }
    },
  })
}

export function useFotosPublicas(soloDestacadas = false) {
  return useQuery({
    queryKey: ['publico', 'fotos', soloDestacadas],
    queryFn: async () => {
      let q = supabase.from('fotos').select('*').eq('visible', true).order('destacada', { ascending: false }).order('orden').order('creado_en', { ascending: false })
      if (soloDestacadas) q = q.eq('destacada', true).limit(9)
      const [f, c] = await Promise.all([q, supabase.from('categorias_foto').select('*').order('orden').order('nombre')])
      return { fotos: datos<Foto[]>(f), categorias: datos<CategoriaFoto[]>(c) }
    },
  })
}

export function usePromosPublicas() {
  return useQuery({
    queryKey: ['publico', 'promos'],
    queryFn: async () => {
      const hoy = hoyISO()
      return datos<Promocion[]>(
        await supabase.from('promociones').select('*').eq('activa', true).eq('visible_web', true).lte('fecha_inicio', hoy).gte('fecha_fin', hoy),
      )
    },
  })
}
