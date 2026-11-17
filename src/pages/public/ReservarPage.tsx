import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, MessageCircle, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Basicos'
import { Button, claseBoton } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Campos'
import { useAjustesPublicos } from '@/features/ajustes/api'
import { capitalizar, duracionTexto, fechaISO, fmt, fmtDia, horaTexto, hoyISO, inicioSemana, sumarDias } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { telefonoValido } from '@/lib/telefono'
import { linkWhatsApp } from '@/lib/whatsapp'
import { useServiciosPublicos } from './publico'

const PASOS = ['Servicio', 'Fecha', 'Horario', 'Tus datos', 'Confirmar']

interface Resultado {
  id: string
  estado: 'pendiente' | 'confirmado'
  inicio: string
  total: number
  sena: number
}

export function ReservarPage() {
  const [params] = useSearchParams()
  const { data: a, isLoading: cargandoAjustes } = useAjustesPublicos()
  const q = useServiciosPublicos()
  const [paso, setPaso] = useState(0)
  const [principal, setPrincipal] = useState<string | null>(params.get('servicio'))
  const [extras, setExtras] = useState<string[]>([])
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [datos, setDatos] = useState({ nombre: '', whatsapp: '', instagram: '', nota: '' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const servicios = q.data?.servicios ?? []
  const elegidos = useMemo(() => servicios.filter((s) => s.id === principal || extras.includes(s.id)), [servicios, principal, extras])
  const ids = elegidos.map((s) => s.id)
  const total = elegidos.reduce((s, x) => s + Number(x.precio), 0)
  const duracion = elegidos.reduce((s, x) => s + x.duracion_min, 0)
  const sena = a?.sena_requerida ? (a.sena_tipo === 'porcentaje' ? Math.round((total * Number(a.sena_valor)) / 100) : Math.min(Number(a.sena_valor), total)) : 0

  if (cargandoAjustes || q.isLoading) return <Cargando className="min-h-[60vh]" />
  if (q.error) return <div className="mx-auto max-w-xl p-6"><ErrorCarga error={q.error} reintentar={() => q.refetch()} /></div>

  if (a && !a.reservas_web_activas) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Vacio titulo="Las reservas online están pausadas" texto="Escribinos por WhatsApp y te pasamos los horarios disponibles."
          accion={a.whatsapp ? <a href={linkWhatsApp(a.whatsapp, '¡Hola! Quería pedir un turno 💅')} target="_blank" rel="noreferrer" className={claseBoton('oscuro')}>Escribir por WhatsApp</a> : undefined} />
      </div>
    )
  }
  if (!servicios.some((s) => !s.es_adicional)) {
    return <div className="mx-auto max-w-xl px-4 py-16"><Vacio titulo="Muy pronto vas a poder reservar acá" texto="Todavía no hay servicios disponibles para reservar online." /></div>
  }

  if (resultado) return <Exito r={resultado} servicios={elegidos.map((s) => s.nombre).join(' + ')} nombre={datos.nombre} />

  const validarDatos = () => {
    const e: Record<string, string> = {}
    if (datos.nombre.trim().length < 2) e.nombre = 'Escribí tu nombre.'
    if (!datos.whatsapp.trim() && !datos.instagram.trim()) e.whatsapp = 'Dejanos un WhatsApp o un Instagram para confirmarte.'
    if (datos.whatsapp.trim() && !telefonoValido(datos.whatsapp)) e.whatsapp = 'Revisá el número (con código de área, ej: 11 2345-6789).'
    setErrores(e)
    return !Object.keys(e).length
  }

  const confirmar = async () => {
    if (!fecha || !hora) return
    setEnviando(true)
    setErrorEnvio('')
    const { data, error } = await supabase.rpc('solicitar_turno', {
      p_servicios: ids,
      p_inicio: hora,
      p_nombre: datos.nombre.trim(),
      p_whatsapp: datos.whatsapp.trim() || null,
      p_instagram: datos.instagram.trim() || null,
      p_nota: datos.nota.trim() || null,
    })
    setEnviando(false)
    if (error) {
      setErrorEnvio(mensajeError(error))
      if (/disponible|reservado/i.test(error.message)) {
        setHora(null)
        setPaso(2)
      }
      return
    }
    setResultado(data as Resultado)
    window.scrollTo(0, 0)
  }

  const puedeSeguir = [!!principal, !!fecha, !!hora, true, true][paso]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="titulo-display text-4xl sm:text-5xl">Pedir turno</h1>
      {/* Progreso */}
      <ol className="mt-6 flex gap-1.5" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p} className="flex-1">
            <div className={clsx('h-1.5 rounded-full transition-colors', i <= paso ? 'bg-rosa-500' : 'bg-nude-200')} />
            <span className={clsx('mt-1.5 hidden text-xs sm:block', i === paso ? 'font-medium text-tinta' : 'text-gris')}>{p}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-gris sm:hidden">Paso {paso + 1} de {PASOS.length}: {PASOS[paso]}</p>

      <div key={paso} className="mt-8 animate-subir">
        {paso === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-semibold">¿Qué te querés hacer?</h2>
              <div className="grid gap-2.5">
                {servicios.filter((s) => !s.es_adicional).map((s) => (
                  <button key={s.id} onClick={() => { setPrincipal(s.id); setFecha(null); setHora(null) }}
                    className={clsx('flex items-center gap-3 rounded-2xl border p-4 text-left transition', principal === s.id ? 'border-rosa-400 bg-rosa-50 ring-2 ring-rosa-200' : 'border-linea bg-white hover:border-rosa-200')}>
                    <span className={clsx('flex size-6 shrink-0 items-center justify-center rounded-full border-2', principal === s.id ? 'border-rosa-500 bg-rosa-500 text-white' : 'border-nude-300')}>
                      {principal === s.id && <Check className="size-3.5" />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{s.nombre}</span>
                      <span className="block text-sm text-gris">{duracionTexto(s.duracion_min)}{s.descripcion ? ` · ${s.descripcion}` : ''}</span>
                    </span>
                    <span className="font-semibold">{dinero(s.precio)}</span>
                  </button>
                ))}
              </div>
            </div>
            {servicios.some((s) => s.es_adicional) && principal && (
              <div>
                <h2 className="mb-3 text-lg font-semibold">¿Algún adicional? <span className="text-sm font-normal text-gris">(opcional)</span></h2>
                <div className="flex flex-wrap gap-2">
                  {servicios.filter((s) => s.es_adicional).map((s) => {
                    const on = extras.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => { setExtras(on ? extras.filter((x) => x !== s.id) : [...extras, s.id]); setFecha(null); setHora(null) }}
                        className={clsx('rounded-full px-4 py-2 text-sm ring-1 transition', on ? 'bg-rosa-500 text-white ring-rosa-500' : 'bg-white ring-linea hover:ring-rosa-300')}>
                        {s.nombre} · +{dinero(s.precio)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {paso === 1 && <ElegirFecha ids={ids} valor={fecha} onChange={(f) => { setFecha(f); setHora(null) }} ventana={a?.ventana_reserva_dias ?? 60} />}

        {paso === 2 && fecha && <ElegirHora ids={ids} fecha={fecha} valor={hora} onChange={setHora} />}

        {paso === 3 && (
          <div className="space-y-4">
            <Input etiqueta="Nombre" autoComplete="given-name" maxLength={80} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} error={errores.nombre} />
            <Input etiqueta="WhatsApp" maxLength={30} type="tel" inputMode="tel" autoComplete="tel" placeholder="11 2345-6789" value={datos.whatsapp} onChange={(e) => setDatos({ ...datos, whatsapp: e.target.value })} error={errores.whatsapp} />
            <Input etiqueta="Instagram" opcional maxLength={60} placeholder="@usuario" autoCapitalize="none" value={datos.instagram} onChange={(e) => setDatos({ ...datos, instagram: e.target.value })} ayuda="Con WhatsApp o Instagram alcanza." />
            <Textarea etiqueta="¿Algo que quieras contarnos?" opcional maxLength={500} rows={3} value={datos.nota} onChange={(e) => setDatos({ ...datos, nota: e.target.value })} placeholder="Diseño que te gustaría, si tenés producto puesto, alergias…" />
            <p className="text-xs text-gris">Tus datos se usan solo para coordinar el turno.</p>
          </div>
        )}

        {paso === 4 && fecha && hora && (
          <div className="space-y-4">
            <div className="tarjeta divide-y divide-linea">
              <Fila etiqueta="Servicio" valor={elegidos.map((s) => s.nombre).join(' + ')} />
              <Fila etiqueta="Día" valor={capitalizar(fmt(hora, "EEEE d 'de' MMMM"))} />
              <Fila etiqueta="Hora" valor={`${horaTexto(hora)} (${duracionTexto(duracion)} aprox.)`} />
              <Fila etiqueta="A nombre de" valor={[datos.nombre, datos.whatsapp, datos.instagram].filter(Boolean).join(' · ')} />
              <Fila etiqueta="Total" valor={<b>{dinero(total)}</b>} />
              {sena > 0 && <Fila etiqueta="Seña para confirmar" valor={dinero(sena)} />}
            </div>
            {a?.politica_cancelacion && <p className="rounded-2xl bg-nude-50 p-4 text-sm text-tinta-soft">{a.politica_cancelacion}</p>}
            {!a?.confirmacion_automatica && <p className="text-sm text-gris">Tu pedido queda pendiente hasta que te lo confirmemos por mensaje.</p>}
            {errorEnvio && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert">{errorEnvio}</p>}
          </div>
        )}
      </div>

      {/* Navegación */}
      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-linea bg-crema/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        {elegidos.length > 0 && paso < 4 && (
          <p className="mb-3 text-sm text-gris">{elegidos.map((s) => s.nombre).join(' + ')} · <b className="text-tinta">{dinero(total)}</b>{fecha && ` · ${fmtDia(fecha, 'EEE d/MM')}`}{hora && ` ${horaTexto(hora)}`}</p>
        )}
        <div className="flex gap-3">
          {paso > 0 && <Button variante="secundario" tamano="lg" icono={<ArrowLeft className="size-4" />} onClick={() => setPaso(paso - 1)}>Atrás</Button>}
          {paso < 4 ? (
            <Button tamano="lg" bloque variante="oscuro" disabled={!puedeSeguir} onClick={() => { if (paso === 3 && !validarDatos()) return; setPaso(paso + 1) }}>
              Continuar
            </Button>
          ) : (
            <Button tamano="lg" bloque cargando={enviando} onClick={confirmar}>Confirmar pedido</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return <div className="flex justify-between gap-4 px-4 py-3"><span className="text-gris">{etiqueta}</span><span className="text-right">{valor}</span></div>
}

function ElegirFecha({ ids, valor, onChange, ventana }: { ids: string[]; valor: string | null; onChange: (f: string) => void; ventana: number }) {
  const hoy = hoyISO()
  const [mes, setMes] = useState((valor ?? hoy).slice(0, 7) + '-01')
  const [y, m] = mes.split('-').map(Number)
  const ultimo = fechaISO(new Date(y, m, 0, 12))
  const limite = sumarDias(hoy, ventana)
  const desde = mes < hoy ? hoy : mes
  const hasta = ultimo > limite ? limite : ultimo
  const dias = useQuery({
    queryKey: ['publico', 'dias', ids, desde, hasta],
    enabled: desde <= hasta,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dias_disponibles_web', { p_servicios: ids, p_desde: desde, p_hasta: hasta })
      if (error) throw error
      return new Set(data as string[])
    },
  })
  const inicio = inicioSemana(mes)
  const diasHastaFin = Math.round((Date.parse(ultimo) - Date.parse(inicio)) / 86400000) + 1
  const celdas = Array.from({ length: Math.ceil(diasHastaFin / 7) * 7 }, (_, i) => sumarDias(inicio, i))
  const puedeAntes = mes > hoy.slice(0, 7) + '-01'
  const puedeDespues = sumarDias(ultimo, 1) <= limite
  const cambiarMes = (dir: 1 | -1) => setMes(fechaISO(new Date(y, m - 1 + dir, 1, 12)))

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Elegí el día</h2>
      <div className="tarjeta p-4">
        <div className="mb-3 flex items-center justify-between">
          <button disabled={!puedeAntes} onClick={() => cambiarMes(-1)} className="rounded-full p-2 hover:bg-nude-100 disabled:opacity-30" aria-label="Mes anterior"><ChevronLeft className="size-5" /></button>
          <span className="font-semibold">{capitalizar(fmtDia(mes, 'MMMM yyyy'))}</span>
          <button disabled={!puedeDespues} onClick={() => cambiarMes(1)} className="rounded-full p-2 hover:bg-nude-100 disabled:opacity-30" aria-label="Mes siguiente"><ChevronRight className="size-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gris">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d) => {
            const delMes = d.slice(0, 7) === mes.slice(0, 7)
            const libre = dias.data?.has(d)
            return (
              <button key={d} disabled={!delMes || !libre} onClick={() => onChange(d)}
                className={clsx('aspect-square rounded-full text-[15px] transition', !delMes && 'invisible',
                  valor === d ? 'bg-rosa-500 font-semibold text-white' : libre ? 'bg-rosa-50 font-medium text-tinta hover:bg-rosa-100' : 'text-gris/50')}>
                {Number(d.slice(8))}
              </button>
            )
          })}
        </div>
        {dias.isLoading && <p className="mt-3 text-center text-sm text-gris">Buscando días libres…</p>}
        {dias.error && <p className="mt-3 text-center text-sm text-red-600">{mensajeError(dias.error)}</p>}
        {dias.data && dias.data.size === 0 && <p className="mt-3 text-center text-sm text-gris">No quedan días libres este mes{puedeDespues ? ', probá con el siguiente' : ''}.</p>}
      </div>
    </div>
  )
}

function ElegirHora({ ids, fecha, valor, onChange }: { ids: string[]; fecha: string; valor: string | null; onChange: (h: string) => void }) {
  const q = useQuery({
    queryKey: ['publico', 'horas', ids, fecha],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('horarios_disponibles_web', { p_servicios: ids, p_fecha: fecha })
      if (error) throw error
      return data as string[]
    },
  })
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Elegí el horario</h2>
      <p className="mb-4 text-sm text-gris">{capitalizar(fmtDia(fecha, "EEEE d 'de' MMMM"))}</p>
      {q.isLoading ? <Cargando /> : q.error ? <ErrorCarga error={q.error} reintentar={() => q.refetch()} /> : !q.data?.length ? (
        <p className="rounded-2xl bg-nude-50 p-4 text-sm">Ese día ya no tiene horarios libres. Volvé atrás y elegí otro.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {q.data.map((h) => (
            <button key={h} onClick={() => onChange(h)} className={clsx('flex items-center justify-center gap-1.5 rounded-2xl py-3 font-medium ring-1 transition', valor === h ? 'bg-rosa-500 text-white ring-rosa-500' : 'bg-white ring-linea hover:ring-rosa-300')}>
              <Clock className="size-4 opacity-70" /> {horaTexto(h)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Exito({ r, servicios, nombre }: { r: Resultado; servicios: string; nombre: string }) {
  const { data: a } = useAjustesPublicos()
  const cuando = capitalizar(fmt(r.inicio, "EEEE d 'de' MMMM 'a las' HH:mm"))
  const msg = `¡Hola! Soy ${nombre}. Pedí un turno por la web para el ${cuando.toLowerCase()} (${servicios}).${r.sena > 0 ? ' Te envío el comprobante de la seña.' : ''}`
  return (
    <div className="mx-auto max-w-xl px-4 py-14 text-center sm:px-6">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rosa-100 text-rosa-600"><PartyPopper className="size-8" /></div>
      <h1 className="titulo-display mt-5 text-4xl">{r.estado === 'confirmado' ? '¡Turno reservado!' : '¡Pedido enviado!'}</h1>
      <p className="mt-3 text-lg text-tinta-soft">{cuando}</p>
      <p className="text-tinta-soft">{servicios} · {dinero(r.total)}</p>
      {r.estado === 'pendiente' && <p className="mt-4 text-sm text-gris">Te vamos a escribir para confirmarlo. Si querés, avisanos ahora por WhatsApp.</p>}
      {r.sena > 0 && (
        <div className="mt-6 rounded-2xl bg-nude-50 p-5 text-left">
          <p className="font-semibold">Seña para confirmar: {dinero(r.sena)}</p>
          {a?.datos_transferencia && <p className="mt-2 whitespace-pre-line text-sm text-tinta-soft">{a.datos_transferencia}</p>}
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3">
        {a?.whatsapp && <a href={linkWhatsApp(a.whatsapp, msg)} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] font-medium text-white"><MessageCircle className="size-5" /> Avisar por WhatsApp</a>}
        <Link to="/" className={claseBoton('secundario', 'lg')}>Volver al inicio</Link>
      </div>
    </div>
  )
}
