import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Droplet, Lock, NotebookPen, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Cargando, Encabezado, Segmentado, Tarjeta } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { useCalendario, useGuardarDia, type DiaCalendario } from '@/features/varios/api'
import { capitalizar, fechaISO, fmtDia, hoyISO, inicioSemana, MESES, sumarDias } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import type { MarcaCalendario } from '@/lib/types'

/** Calendario personal privado (cada usuaria ve solo el suyo) */

const SINTOMAS = ['Dolor', 'Dolor de cabeza', 'Cansancio', 'Hinchazón', 'Antojos', 'Cambios de humor', 'Granitos', 'Sensibilidad']
const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const ultimoDiaMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return fechaISO(new Date(y, m, 0, 12))
}

interface InfoDia {
  periodo: boolean
  sintomas: string[]
  nota: string
}

function agrupar(marcas: MarcaCalendario[] | undefined) {
  const mapa = new Map<string, InfoDia>()
  for (const m of marcas ?? []) {
    const d = mapa.get(m.fecha) ?? { periodo: false, sintomas: [], nota: '' }
    if (m.marca === 'periodo') d.periodo = true
    if (m.marca === 'sintoma') d.sintomas = (m.nota ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (m.marca === 'nota') d.nota = m.nota ?? ''
    mapa.set(m.fecha, d)
  }
  return mapa
}

/** Ciclo: inicios de período (días marcados seguidos = un período), promedios y próxima fecha estimada */
function calcularCiclo(mapa: Map<string, InfoDia>) {
  const dias = [...mapa.entries()].filter(([, d]) => d.periodo).map(([f]) => f).sort()
  const tramos: { inicio: string; dias: number }[] = []
  for (const f of dias) {
    const ultimo = tramos[tramos.length - 1]
    // un hueco de 1 día igual cuenta como el mismo período
    if (ultimo && diasEntre(sumarDias(ultimo.inicio, ultimo.dias - 1), f) <= 2) ultimo.dias = diasEntre(ultimo.inicio, f) + 1
    else tramos.push({ inicio: f, dias: 1 })
  }
  if (!tramos.length) return null
  const ciclos = tramos.slice(1).map((t, i) => diasEntre(tramos[i].inicio, t.inicio)).filter((c) => c >= 18 && c <= 45).slice(-6)
  const promedioCiclo = ciclos.length ? Math.round(ciclos.reduce((a, b) => a + b, 0) / ciclos.length) : null
  const duraciones = tramos.slice(-6).map((t) => t.dias)
  const promedioPeriodo = Math.max(1, Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length))
  const ultimo = tramos[tramos.length - 1]
  const proximo = promedioCiclo ? sumarDias(ultimo.inicio, promedioCiclo) : null
  const diaDelCiclo = diasEntre(ultimo.inicio, hoyISO()) + 1
  return { ultimoInicio: ultimo.inicio, promedioCiclo, promedioPeriodo, proximo, diaDelCiclo, registrados: tramos.length }
}

export function MiCalendarioPage() {
  const hoy = hoyISO()
  const [vista, setVista] = useState<'mes' | 'anio'>('mes')
  const [mes, setMes] = useState(hoy.slice(0, 8) + '01')
  const [dia, setDia] = useState<string | null>(null)
  const anio = Number(mes.slice(0, 4))

  // Se trae desde un año antes para poder calcular el ciclo, hasta fin del año que se mira
  const desde = `${anio - 1}-01-01`
  const hasta = `${anio}-12-31`
  const q = useCalendario(desde, hasta)
  const mapa = useMemo(() => agrupar(q.data), [q.data])
  const ciclo = useMemo(() => calcularCiclo(mapa), [mapa])

  // Días estimados del próximo período (solo si hay al menos dos períodos registrados)
  const estimados = useMemo(() => {
    const s = new Set<string>()
    if (ciclo?.proximo) {
      let inicio = ciclo.proximo
      // si el estimado ya pasó sin registrarse, se proyecta el siguiente
      while (ciclo.promedioCiclo && diasEntre(inicio, hoy) > ciclo.promedioPeriodo) inicio = sumarDias(inicio, ciclo.promedioCiclo)
      for (let i = 0; i < ciclo.promedioPeriodo; i++) s.add(sumarDias(inicio, i))
    }
    return s
  }, [ciclo, hoy])

  const moverMes = (dir: 1 | -1) => {
    const [y, m] = mes.split('-').map(Number)
    setMes(fechaISO(new Date(y, m - 1 + dir, 1, 12)).slice(0, 8) + '01')
  }

  const notasDelMes = [...mapa.entries()]
    .filter(([f, d]) => f.startsWith(mes.slice(0, 7)) && (d.nota || d.sintomas.length))
    .sort(([a], [b]) => a.localeCompare(b))

  return (
    <div>
      <Encabezado
        titulo="Mi calendario"
        subtitulo={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Privado: solo lo ves vos con tu cuenta.</span>}
        acciones={<Segmentado valor={vista} onChange={setVista} opciones={[{ valor: 'mes', etiqueta: 'Mes' }, { valor: 'anio', etiqueta: 'Año' }]} />}
      />

      {q.isLoading ? <Cargando /> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-5">
            {vista === 'mes' ? (
              <Tarjeta className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <button onClick={() => moverMes(-1)} className="rounded-full p-2 hover:bg-nude-100" aria-label="Mes anterior"><ChevronLeft className="size-5" /></button>
                  <div className="text-center">
                    <h2 className="titulo-display text-2xl sm:text-3xl">{capitalizar(fmtDia(mes, 'MMMM yyyy'))}</h2>
                    {mes.slice(0, 7) !== hoy.slice(0, 7) && (
                      <button onClick={() => setMes(hoy.slice(0, 8) + '01')} className="text-xs text-rosa-600 hover:underline">Volver a hoy</button>
                    )}
                  </div>
                  <button onClick={() => moverMes(1)} className="rounded-full p-2 hover:bg-nude-100" aria-label="Mes siguiente"><ChevronRight className="size-5" /></button>
                </div>
                <Mes mes={mes} mapa={mapa} estimados={estimados} hoy={hoy} onDia={setDia} grande />
                <Leyenda />
              </Tarjeta>
            ) : (
              <Tarjeta className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <button onClick={() => setMes(`${anio - 1}-01-01`)} className="rounded-full p-2 hover:bg-nude-100" aria-label="Año anterior"><ChevronLeft className="size-5" /></button>
                  <h2 className="titulo-display text-3xl">{anio}</h2>
                  <button onClick={() => setMes(`${anio + 1}-01-01`)} className="rounded-full p-2 hover:bg-nude-100" aria-label="Año siguiente"><ChevronRight className="size-5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
                  {MESES.map((nombre, i) => {
                    const m = `${anio}-${String(i + 1).padStart(2, '0')}-01`
                    return (
                      <div key={nombre}>
                        <button onClick={() => { setMes(m); setVista('mes') }} className="mb-1.5 text-sm font-semibold text-tinta hover:text-rosa-600">{nombre}</button>
                        <Mes mes={m} mapa={mapa} estimados={estimados} hoy={hoy} onDia={setDia} />
                      </div>
                    )
                  })}
                </div>
                <Leyenda />
              </Tarjeta>
            )}
          </div>

          <div className="space-y-5">
            <Tarjeta className="p-5">
              <h3 className="titulo-display mb-3 flex items-center gap-2 text-xl"><Sparkles className="size-5 text-rosa-500" /> Mi ciclo</h3>
              {!ciclo ? (
                <p className="text-sm text-gris">Tocá un día y marcá <b>Período</b>. Con dos períodos registrados te calculo cuándo viene el próximo.</p>
              ) : (
                <dl className="space-y-2 text-[15px]">
                  {ciclo.diaDelCiclo > 0 && ciclo.diaDelCiclo <= 60 && <Fila etiqueta="Hoy" valor={`Día ${ciclo.diaDelCiclo} del ciclo`} />}
                  <Fila etiqueta="Último período" valor={capitalizar(fmtDia(ciclo.ultimoInicio, "d 'de' MMMM"))} />
                  <Fila etiqueta="Duración promedio" valor={`${ciclo.promedioPeriodo} ${ciclo.promedioPeriodo === 1 ? 'día' : 'días'}`} />
                  <Fila etiqueta="Ciclo promedio" valor={ciclo.promedioCiclo ? `${ciclo.promedioCiclo} días` : 'Faltan datos'} />
                  {estimados.size > 0 && (
                    <div className="mt-3 rounded-2xl bg-rosa-50 px-4 py-3">
                      <p className="text-xs text-rosa-700">Próximo período estimado</p>
                      <p className="font-semibold text-rosa-700">
                        {capitalizar(fmtDia([...estimados][0], "EEEE d 'de' MMMM"))}
                        {(() => {
                          const faltan = diasEntre(hoy, [...estimados][0])
                          return faltan > 0 ? <span className="font-normal"> · en {faltan} {faltan === 1 ? 'día' : 'días'}</span> : null
                        })()}
                      </p>
                    </div>
                  )}
                </dl>
              )}
              <p className="mt-3 text-xs text-gris">Es solo una estimación a partir de lo que registrás.</p>
            </Tarjeta>

            {vista === 'mes' && (
              <Tarjeta className="p-5">
                <h3 className="titulo-display mb-3 flex items-center gap-2 text-xl"><NotebookPen className="size-5 text-rosa-500" /> Notas de {MESES[Number(mes.slice(5, 7)) - 1].toLowerCase()}</h3>
                {notasDelMes.length === 0 ? (
                  <p className="text-sm text-gris">Sin notas este mes. Tocá un día para escribir una.</p>
                ) : (
                  <ul className="space-y-3">
                    {notasDelMes.map(([f, d]) => (
                      <li key={f}>
                        <button onClick={() => setDia(f)} className="w-full rounded-xl px-2 py-1.5 text-left hover:bg-nude-50">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gris">{capitalizar(fmtDia(f, "EEEE d"))}</p>
                          {d.sintomas.length > 0 && <p className="text-sm text-violet-700">{d.sintomas.join(' · ')}</p>}
                          {d.nota && <p className="whitespace-pre-line text-[15px] text-tinta">{d.nota}</p>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            )}
          </div>
        </div>
      )}

      <EditarDia fecha={dia} info={dia ? mapa.get(dia) : undefined} estimado={!!dia && estimados.has(dia)} onCerrar={() => setDia(null)} />
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-gris">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  )
}

function Mes({ mes, mapa, estimados, hoy, onDia, grande }: { mes: string; mapa: Map<string, InfoDia>; estimados: Set<string>; hoy: string; onDia: (f: string) => void; grande?: boolean }) {
  const inicio = inicioSemana(mes)
  const fin = ultimoDiaMes(mes)
  const total = Math.ceil((diasEntre(inicio, fin) + 1) / 7) * 7
  const celdas = Array.from({ length: total }, (_, i) => sumarDias(inicio, i))

  return (
    <div>
      <div className={clsx('grid grid-cols-7 text-center font-medium text-gris', grande ? 'mb-2 text-xs' : 'mb-0.5 text-[10px]')}>
        {DIAS_CORTOS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className={clsx('grid grid-cols-7', grande ? 'gap-1 sm:gap-1.5' : 'gap-0.5')}>
        {celdas.map((f) => {
          if (f.slice(0, 7) !== mes.slice(0, 7)) return <span key={f} />
          const d = mapa.get(f)
          const est = !d?.periodo && estimados.has(f)
          const esHoy = f === hoy
          return (
            <button
              key={f}
              onClick={() => onDia(f)}
              aria-label={capitalizar(fmtDia(f, "EEEE d 'de' MMMM"))}
              className={clsx(
                'relative flex aspect-square items-center justify-center rounded-full transition',
                grande ? 'text-[15px]' : 'text-[11px]',
                d?.periodo ? 'bg-rosa-500 font-semibold text-white hover:bg-rosa-600' : 'hover:bg-nude-100',
                est && 'border-2 border-dashed border-rosa-300 text-rosa-700',
                esHoy && !d?.periodo && 'font-bold text-tinta ring-2 ring-tinta',
                esHoy && d?.periodo && 'ring-2 ring-tinta ring-offset-2',
                f > hoy && !d && !est && 'text-gris',
              )}
            >
              {Number(f.slice(8))}
              {grande && (d?.sintomas.length || d?.nota) ? (
                <span className="absolute bottom-[12%] left-1/2 flex -translate-x-1/2 gap-0.5">
                  {!!d?.sintomas.length && <span className={clsx('size-1.5 rounded-full', d.periodo ? 'bg-white' : 'bg-violet-500')} />}
                  {!!d?.nota && <span className={clsx('size-1.5 rounded-full', d.periodo ? 'bg-white/70' : 'bg-tinta-soft')} />}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Leyenda() {
  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-linea pt-4 text-xs text-gris">
      <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-full bg-rosa-500" /> Período</span>
      <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-full border-2 border-dashed border-rosa-300" /> Estimado</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet-500" /> Síntomas</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-tinta-soft" /> Nota</span>
      <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-full ring-2 ring-tinta" /> Hoy</span>
    </div>
  )
}

function EditarDia({ fecha, info, estimado, onCerrar }: { fecha: string | null; info?: InfoDia; estimado: boolean; onCerrar: () => void }) {
  const guardar = useGuardarDia()
  const [d, setD] = useState<DiaCalendario>({ fecha: '', periodo: false, sintomas: [], nota: '' })

  useEffect(() => {
    if (fecha) setD({ fecha, periodo: info?.periodo ?? false, sintomas: info?.sintomas ?? [], nota: info?.nota ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  const alternarSintoma = (s: string) => setD((x) => ({ ...x, sintomas: x.sintomas.includes(s) ? x.sintomas.filter((y) => y !== s) : [...x.sintomas, s] }))
  const otros = d.sintomas.filter((s) => !SINTOMAS.includes(s))

  const enviar = async () => {
    try {
      await guardar.mutateAsync(d)
      toast.success('Guardado')
      onCerrar()
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  return (
    <Modal
      abierto={!!fecha}
      onCerrar={onCerrar}
      titulo={fecha ? capitalizar(fmtDia(fecha, "EEEE d 'de' MMMM")) : ''}
      subtitulo={estimado ? 'Período estimado para este día' : undefined}
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={enviar} cargando={guardar.isPending}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setD({ ...d, periodo: !d.periodo })}
          aria-pressed={d.periodo}
          className={clsx(
            'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition',
            d.periodo ? 'border-rosa-400 bg-rosa-500 text-white' : 'border-linea bg-white hover:border-rosa-300',
          )}
        >
          <span className={clsx('flex size-10 items-center justify-center rounded-full', d.periodo ? 'bg-white/20' : 'bg-rosa-50 text-rosa-500')}>
            <Droplet className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Período</span>
            <span className={clsx('block text-sm', d.periodo ? 'text-white/85' : 'text-gris')}>{d.periodo ? 'Marcado. Tocá para quitarlo.' : 'Tocá para marcar este día.'}</span>
          </span>
        </button>

        <div>
          <p className="mb-2 text-sm font-medium text-tinta-soft">Síntomas</p>
          <div className="flex flex-wrap gap-2">
            {[...SINTOMAS, ...otros].map((s) => {
              const on = d.sintomas.includes(s)
              return (
                <button key={s} type="button" onClick={() => alternarSintoma(s)}
                  className={clsx('rounded-full px-3.5 py-1.5 text-sm ring-1 transition', on ? 'bg-violet-500 text-white ring-violet-500' : 'bg-white text-tinta-soft ring-linea hover:ring-violet-300')}>
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <Textarea etiqueta="Nota" opcional rows={4} value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Cómo te sentiste, algo para recordar…" />
      </div>
    </Modal>
  )
}
