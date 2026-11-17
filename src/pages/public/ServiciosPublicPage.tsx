import { Clock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Basicos'
import { claseBoton } from '@/components/ui/Button'
import { duracionTexto } from '@/lib/fechas'
import { dinero } from '@/lib/formato'
import { urlPublica } from '@/lib/supabase'
import { useAjustesPublicos } from '@/features/ajustes/api'
import { BotonTurno } from './BotonTurno'
import { useServiciosPublicos } from './publico'

export function ServiciosPublicPage() {
  const q = useServiciosPublicos()
  const { data: a } = useAjustesPublicos()
  if (q.error) return <div className="mx-auto max-w-3xl p-6"><ErrorCarga error={q.error} reintentar={() => q.refetch()} /></div>
  if (q.isLoading) return <Cargando className="min-h-[50vh]" />
  const { servicios, categorias } = q.data!
  const principales = servicios.filter((s) => !s.es_adicional)
  const adicionales = servicios.filter((s) => s.es_adicional)
  const grupos = [
    ...categorias.map((c) => ({ id: c.id, nombre: c.nombre, items: principales.filter((s) => s.categoria_id === c.id) })),
    { id: 'otros', nombre: categorias.length ? 'Otros' : '', items: principales.filter((s) => !s.categoria_id || !categorias.some((c) => c.id === s.categoria_id)) },
  ].filter((g) => g.items.length)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="titulo-display text-5xl">Servicios y precios</h1>
      <p className="mt-2 text-tinta-soft">Precios vigentes. La duración es aproximada.</p>
      {servicios.length === 0 ? (
        <Vacio icono={<Sparkles />} titulo="Muy pronto" texto="Estamos cargando los servicios. Mientras tanto, escribinos." />
      ) : (
        <div className="mt-10 space-y-12">
          {grupos.map((g) => (
            <section key={g.id}>
              {g.nombre && <h2 className="titulo-display mb-4 text-3xl text-rosa-600">{g.nombre}</h2>}
              <div className="divide-y divide-linea">
                {g.items.map((s) => (
                  <div key={s.id} className="flex gap-4 py-5">
                    {s.foto_path && <img src={urlPublica(s.foto_path)!} alt="" loading="lazy" className="size-20 shrink-0 rounded-2xl object-cover sm:size-24" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-lg font-semibold">{s.nombre}</h3>
                        <span className="shrink-0 text-lg font-semibold">{dinero(s.precio)}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-gris"><Clock className="size-3.5" /> {duracionTexto(s.duracion_min)}</p>
                      {s.descripcion && <p className="mt-2 whitespace-pre-line text-[15px] text-tinta-soft">{s.descripcion}</p>}
                      {a?.reservas_web_activas !== false && <Link to={`/reservar?servicio=${s.id}`} className="mt-3 inline-block text-sm font-medium text-rosa-600 hover:underline">Reservar →</Link>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {adicionales.length > 0 && (
            <section className="rounded-3xl bg-nude-50 p-6">
              <h2 className="titulo-display mb-1 text-3xl">Adicionales</h2>
              <p className="mb-4 text-sm text-gris">Se suman a cualquier servicio.</p>
              <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {adicionales.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span>{s.nombre}{s.descripcion && <span className="block text-xs text-gris">{s.descripcion}</span>}</span>
                    <span className="font-medium">+ {dinero(s.precio)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="text-center"><BotonTurno a={a} conIcono className={claseBoton('oscuro', 'lg')} /></div>
        </div>
      )}
    </div>
  )
}
