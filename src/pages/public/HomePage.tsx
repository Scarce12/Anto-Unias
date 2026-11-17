import { Award, CalendarHeart, Clock, CreditCard, HeartHandshake, MapPin, MessageCircle, Sparkles, Tag } from 'lucide-react'
import { Instagram } from '@/components/IconoInstagram'
import { Link } from 'react-router-dom'
import { claseBoton } from '@/components/ui/Button'
import { Esqueleto } from '@/components/ui/Basicos'
import { useAjustesPublicos } from '@/features/ajustes/api'
import { DIAS_SEMANA, duracionTexto } from '@/lib/fechas'
import { dinero } from '@/lib/formato'
import { urlPublica } from '@/lib/supabase'
import { linkInstagram, urlSegura } from '@/lib/telefono'
import type { AjustesPublicos } from '@/lib/types'
import { linkWhatsApp } from '@/lib/whatsapp'
import { useFotosPublicas, usePromosPublicas, useServiciosPublicos } from './publico'

function lineas(t: string | null | undefined): string[] {
  return (t ?? '').split(/\r?\n/).map((l) => l.replace(/^[-•·*]\s*/, '').trim()).filter(Boolean)
}

export function horariosLegibles(a: AjustesPublicos | undefined): string[] {
  if (!a) return []
  if (a.horarios_texto) return a.horarios_texto.split('\n').filter(Boolean)
  const porDia = new Map<number, string[]>()
  a.horarios.forEach((h) => porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), `${h.inicio.slice(0, 5)} a ${h.fin.slice(0, 5)}`]))
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => porDia.has(d)).map((d) => `${DIAS_SEMANA[d]}: ${porDia.get(d)!.join(' y ')}`)
}

export function HomePage() {
  const { data: a, isLoading } = useAjustesPublicos()
  const fotos = useFotosPublicas(true)
  const servicios = useServiciosPublicos()
  const promos = usePromosPublicas()
  const insta = linkInstagram(a?.instagram)
  const portada = urlPublica(a?.portada_path) ?? urlPublica(fotos.data?.fotos[0]?.storage_path)
  const ordenCat = new Map(servicios.data?.categorias.map((c) => [c.id, c.orden]) ?? [])
  const principales = [...(servicios.data?.servicios.filter((s) => !s.es_adicional) ?? [])]
    .sort((x, y) => (ordenCat.get(x.categoria_id ?? '') ?? 99) - (ordenCat.get(y.categoria_id ?? '') ?? 99) || x.orden - y.orden)
    .slice(0, 6)
  const horarios = horariosLegibles(a)

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
          <div className="animate-subir">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-rosa-50 px-3 py-1 text-sm text-rosa-700">
              <Sparkles className="size-4" /> Uñas · Turnos online
            </p>
            {isLoading ? <Esqueleto className="h-16 w-3/4" /> : (
              <h1 className="titulo-display text-5xl leading-[1.05] sm:text-6xl">{a?.nombre_negocio || 'Uñas cuidadas, hechas con dedicación'}</h1>
            )}
            {a?.eslogan && <p className="mt-4 text-lg text-tinta-soft">{a.eslogan}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {a?.reservas_web_activas !== false ? (
                <Link to="/reservar" className={claseBoton('oscuro', 'lg')}><CalendarHeart className="size-5" /> Pedir turno</Link>
              ) : a?.whatsapp ? (
                <a href={linkWhatsApp(a.whatsapp, '¡Hola! Quería pedir un turno 💅')} target="_blank" rel="noreferrer" className={claseBoton('oscuro', 'lg')}><MessageCircle className="size-5" /> Pedir turno por WhatsApp</a>
              ) : insta ? (
                <a href={insta} target="_blank" rel="noreferrer" className={claseBoton('oscuro', 'lg')}><Instagram className="size-5" /> Escribime por Instagram</a>
              ) : null}
              <Link to="/servicios" className={claseBoton('secundario', 'lg')}>Ver servicios y precios</Link>
            </div>
            <div className="mt-6 flex gap-4 text-sm text-gris">
              {a?.whatsapp && <a href={linkWhatsApp(a.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-tinta"><MessageCircle className="size-4" /> WhatsApp</a>}
              {insta && <a href={insta} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-tinta"><Instagram className="size-4" /> Instagram</a>}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -right-10 -top-10 size-64 rounded-full bg-rosa-100 blur-3xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-gradient-to-br from-rosa-100 via-nude-100 to-beige shadow-flotante">
              {portada ? <img src={portada} alt="Trabajo de uñas" className="size-full object-cover" /> : (
                <div className="flex size-full items-center justify-center"><Sparkles className="size-16 text-rosa-300" /></div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Promos */}
      {!!promos.data?.length && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {promos.data.map((p) => (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl bg-tinta px-5 py-4 text-white">
                <Tag className="size-6 shrink-0 text-rosa-300" />
                <div className="flex-1">
                  <p className="font-semibold">{p.nombre}</p>
                  {p.descripcion && <p className="text-sm text-white/75">{p.descripcion}</p>}
                </div>
                <span className="titulo-display text-3xl text-rosa-200">{p.tipo === 'porcentaje' ? `${p.valor}%` : dinero(p.valor)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Presentación */}
      {(a?.presentacion || a?.foto_perfil_path) && (
        <section className="mx-auto mt-16 grid max-w-6xl items-center gap-8 px-4 sm:px-6 md:grid-cols-[280px_1fr]">
          {a.foto_perfil_path && <img src={urlPublica(a.foto_perfil_path)!} alt={a.nombre_manicurista ?? ''} className="mx-auto aspect-square w-56 rounded-full object-cover shadow-suave md:w-full" />}
          <div>
            <h2 className="titulo-display text-4xl">{a.nombre_manicurista ? `Hola, soy ${a.nombre_manicurista}` : 'Sobre mí'}</h2>
            {a.presentacion && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-tinta-soft">{a.presentacion}</p>}
          </div>
        </section>
      )}

      {/* Formación */}
      {lineas(a?.formacion).length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
          <div className="rounded-[2rem] bg-nude-50 px-6 py-8 sm:px-10">
            <h2 className="titulo-display mb-4 flex items-center gap-2 text-3xl"><Award className="size-6 text-rosa-500" /> Formación</h2>
            <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {lineas(a?.formacion).map((l) => (
                <li key={l} className="flex gap-2 text-tinta-soft"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-rosa-400" />{l}</li>
              ))}
            </ul>
            <Link to="/trabajos?categoria=certificados" className="mt-4 inline-block text-sm text-rosa-600 hover:underline">Ver certificados</Link>
          </div>
        </section>
      )}

      {/* Servicios */}
      {principales.length > 0 && (
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="titulo-display text-4xl">Servicios</h2>
            <Link to="/servicios" className="text-sm text-rosa-600 hover:underline">Ver todos</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {principales.map((s) => (
              <Link key={s.id} to={`/reservar?servicio=${s.id}`} className="tarjeta group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-flotante">
                {s.foto_path && <img src={urlPublica(s.foto_path)!} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{s.nombre}</h3>
                    <span className="shrink-0 font-semibold text-rosa-600">{dinero(s.precio)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-gris"><Clock className="size-3.5" /> {duracionTexto(s.duracion_min)}</p>
                  {s.descripcion && <p className="mt-2 line-clamp-2 text-sm text-tinta-soft">{s.descripcion}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trabajos destacados */}
      {!!fotos.data?.fotos.length && (
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="titulo-display text-4xl">Trabajos</h2>
            <Link to="/trabajos" className="text-sm text-rosa-600 hover:underline">Ver galería</Link>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {fotos.data.fotos.slice(0, 9).map((f) => (
              <Link to="/trabajos" key={f.id} className="aspect-square overflow-hidden rounded-xl bg-nude-100 sm:rounded-2xl">
                <img src={urlPublica(f.storage_path)!} alt={f.descripcion ?? 'Trabajo de uñas'} loading="lazy" className="size-full object-cover transition duration-300 hover:scale-105" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cuidados y antes de tu turno */}
      {(lineas(a?.cuidados).length > 0 || a?.medios_pago || a?.politica_cancelacion) && (
        <section className="mx-auto mt-20 grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
          {lineas(a?.cuidados).length > 0 && (
            <div className="tarjeta p-6">
              <h2 className="titulo-display mb-3 flex items-center gap-2 text-3xl"><HeartHandshake className="size-6 text-rosa-500" /> Cuidados</h2>
              <ul className="space-y-2.5">
                {lineas(a?.cuidados).map((l) => (
                  <li key={l} className="flex gap-2 text-[15px] text-tinta-soft"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-rosa-400" />{l}</li>
                ))}
              </ul>
            </div>
          )}
          {(a?.medios_pago || a?.politica_cancelacion) && (
            <div className="tarjeta p-6">
              <h2 className="titulo-display mb-3 flex items-center gap-2 text-3xl"><CreditCard className="size-6 text-rosa-500" /> Antes de tu turno</h2>
              {a?.medios_pago && <p className="mb-3 text-tinta-soft"><b className="text-tinta">Medios de pago:</b> {a.medios_pago}</p>}
              {a?.politica_cancelacion && <p className="whitespace-pre-line text-[15px] text-tinta-soft">{a.politica_cancelacion}</p>}
            </div>
          )}
        </section>
      )}

      {/* Ubicación y horarios */}
      {(horarios.length > 0 || a?.direccion || a?.zona) && (
        <section className="mx-auto mt-20 grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
          {horarios.length > 0 && (
            <div className="tarjeta p-6">
              <h2 className="titulo-display mb-3 flex items-center gap-2 text-3xl"><Clock className="size-6 text-rosa-500" /> Horarios</h2>
              <ul className="space-y-1.5 text-tinta-soft">{horarios.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          {(a?.direccion || a?.zona) && (
            <div className="tarjeta p-6">
              <h2 className="titulo-display mb-3 flex items-center gap-2 text-3xl"><MapPin className="size-6 text-rosa-500" /> Ubicación</h2>
              <p className="text-tinta-soft">{[a.direccion, a.zona].filter(Boolean).join(', ')}</p>
              {urlSegura(a.maps_url) && <a href={urlSegura(a.maps_url)!} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-rosa-600 hover:underline">Abrir en Google Maps</a>}
            </div>
          )}
        </section>
      )}

      {/* Llamado final */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-rosa-100 via-nude-100 to-beige px-6 py-12 text-center">
          {a?.reservas_web_activas !== false ? (
            <>
              <h2 className="titulo-display text-4xl">¿Te reservo un lugar?</h2>
              <p className="mx-auto mt-2 max-w-md text-tinta-soft">Elegí el servicio, mirá los horarios libres y pedí tu turno en un minuto.</p>
              <Link to="/reservar" className={claseBoton('oscuro', 'lg', 'mt-6')}>Pedir turno</Link>
            </>
          ) : (
            <>
              <h2 className="titulo-display text-4xl">Muy pronto, turnos online</h2>
              <p className="mx-auto mt-2 max-w-md text-tinta-soft">Mientras tanto, escribime y coordinamos.</p>
              {a?.whatsapp ? (
                <a href={linkWhatsApp(a.whatsapp, '¡Hola! Quería consultar por un turno 💅')} target="_blank" rel="noreferrer" className={claseBoton('oscuro', 'lg', 'mt-6')}><MessageCircle className="size-5" /> Escribime por WhatsApp</a>
              ) : insta ? (
                <a href={insta} target="_blank" rel="noreferrer" className={claseBoton('oscuro', 'lg', 'mt-6')}><Instagram className="size-5" /> Escribime por Instagram</a>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  )
}
