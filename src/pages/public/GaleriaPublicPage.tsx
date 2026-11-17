import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Basicos'
import { urlPublica } from '@/lib/supabase'
import { useFotosPublicas } from './publico'

export function GaleriaPublicPage() {
  const q = useFotosPublicas()
  const [params] = useSearchParams()
  const [cat, setCat] = useState('')
  // /trabajos?categoria=certificados abre directo esa categoría
  useEffect(() => {
    const pedida = params.get('categoria')?.toLowerCase()
    const c = q.data?.categorias.find((x) => x.nombre.toLowerCase() === pedida)
    if (c) setCat(c.id)
  }, [params, q.data])
  const [abierta, setAbierta] = useState<number | null>(null)
  const fotos = q.data?.fotos.filter((f) => !cat || f.categoria_id === cat) ?? []
  const cats = q.data?.categorias.filter((c) => q.data!.fotos.some((f) => f.categoria_id === c.id)) ?? []

  useEffect(() => {
    if (abierta === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null)
      if (e.key === 'ArrowRight') setAbierta((i) => (i === null ? i : (i + 1) % fotos.length))
      if (e.key === 'ArrowLeft') setAbierta((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [abierta, fotos.length])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="titulo-display text-5xl">Trabajos</h1>
      <p className="mt-2 text-tinta-soft">Fotos reales de uñas hechas en el estudio.</p>
      {cats.length > 0 && (
        <div className="scroll-fino -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: '', nombre: 'Todo' }, ...cats].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={clsx('shrink-0 rounded-full px-4 py-2 text-sm ring-1 transition', cat === c.id ? 'bg-tinta text-white ring-tinta' : 'bg-white ring-linea')}>{c.nombre}</button>
          ))}
        </div>
      )}
      <div className="mt-6">
        {q.error ? <ErrorCarga error={q.error} /> : q.isLoading ? <Cargando /> : !fotos.length ? (
          <Vacio icono={<Images />} titulo="Muy pronto" texto="Estamos subiendo fotos de los trabajos." />
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {fotos.map((f, i) => (
              <button key={f.id} onClick={() => setAbierta(i)} className="group relative aspect-square overflow-hidden bg-nude-100 sm:rounded-xl">
                <img src={urlPublica(f.storage_path)!} alt={f.descripcion ?? 'Trabajo de uñas'} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />
              </button>
            ))}
          </div>
        )}
      </div>

      {abierta !== null && fotos[abierta] && (
        <div className="fixed inset-0 z-50 flex animate-aparecer flex-col bg-black/90" role="dialog" aria-modal="true">
          <div className="flex justify-end p-3">
            <button onClick={() => setAbierta(null)} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Cerrar"><X className="size-7" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2" onClick={() => setAbierta(null)}>
            <img src={urlPublica(fotos[abierta].storage_path)!} alt={fotos[abierta].descripcion ?? ''} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
            {fotos.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setAbierta((abierta - 1 + fotos.length) % fotos.length) }} className="absolute left-2 rounded-full bg-black/40 p-2 text-white" aria-label="Anterior"><ChevronLeft className="size-6" /></button>
                <button onClick={(e) => { e.stopPropagation(); setAbierta((abierta + 1) % fotos.length) }} className="absolute right-2 rounded-full bg-black/40 p-2 text-white" aria-label="Siguiente"><ChevronRight className="size-6" /></button>
              </>
            )}
          </div>
          <p className="min-h-14 px-6 py-4 text-center text-white/90">{fotos[abierta].descripcion}</p>
        </div>
      )}
    </div>
  )
}
