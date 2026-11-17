import clsx from 'clsx'
import { Ban, CalendarPlus, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAcciones } from '@/app/acciones'
import { Badge, Cargando, Encabezado, ErrorCarga, Segmentado, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { useAjustes, useHorarios } from '@/features/ajustes/api'
import { useBloqueosFuturos, useBloqueosRango, useTurnosPendientes, useTurnosRango } from '@/features/turnos/api'
import {
  capitalizar, DIAS_CORTOS, diaSemana, fechaISO, fmt, fmtDia, horaTexto, hoyISO, inicioSemana, minutosAHora,
  minutosDesdeMedianoche, sumarDias,
} from '@/lib/fechas'
import { dinero, ESTADOS_PAGO, ESTADOS_TURNO } from '@/lib/formato'
import type { Bloqueo, HorarioLaboral, TurnoDetalle } from '@/lib/types'
import { ListaTurnos } from './DashboardPage'

type Vista = 'dia' | 'semana' | 'mes' | 'pendientes'
const PX_POR_MIN = 1.5

export function AgendaPage() {
  const [params, setParams] = useSearchParams()
  const vista = (params.get('vista') as Vista) || 'dia'
  const diaParam = params.get('dia')
  const dia = diaParam === 'manana' ? sumarDias(hoyISO(), 1) : diaParam || hoyISO()
  const a = useAcciones()

  const ir = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) p.set(k, v)
    setParams(p, { replace: true })
  }

  const mover = (dir: 1 | -1) => {
    if (vista === 'dia') ir({ dia: sumarDias(dia, dir) })
    else if (vista === 'semana') ir({ dia: sumarDias(dia, 7 * dir) })
    else {
      const [y, m] = dia.split('-').map(Number)
      const d = new Date(y, m - 1 + dir, 1)
      ir({ dia: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
    }
  }

  const titulo =
    vista === 'dia'
      ? capitalizar(fmtDia(dia, "EEEE d 'de' MMMM"))
      : vista === 'semana'
        ? `Semana del ${fmtDia(inicioSemana(dia), "d 'de' MMMM")}`
        : vista === 'mes'
          ? capitalizar(fmtDia(dia, "MMMM yyyy"))
          : 'Pedidos por confirmar'

  return (
    <div>
      <Encabezado
        titulo="Agenda"
        acciones={
          <>
            <Button variante="secundario" icono={<Ban className="size-4" />} onClick={() => a.bloquear({ fecha: dia })}>
              Bloquear
            </Button>
            <Button icono={<CalendarPlus className="size-4" />} onClick={() => a.nuevoTurno({ fecha: dia })}>
              Nuevo turno
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmentado
          valor={vista}
          onChange={(v) => ir({ vista: v })}
          opciones={[
            { valor: 'dia', etiqueta: 'Día' },
            { valor: 'semana', etiqueta: 'Semana' },
            { valor: 'mes', etiqueta: 'Mes' },
            { valor: 'pendientes', etiqueta: 'Pendientes' },
          ]}
        />
        {vista !== 'pendientes' && (
          <div className="flex items-center gap-1">
            <button className="rounded-full p-2 hover:bg-nude-100" onClick={() => mover(-1)} aria-label="Anterior">
              <ChevronLeft className="size-5" />
            </button>
            <button className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-nude-100" onClick={() => ir({ dia: hoyISO() })}>
              Hoy
            </button>
            <button className="rounded-full p-2 hover:bg-nude-100" onClick={() => mover(1)} aria-label="Siguiente">
              <ChevronRight className="size-5" />
            </button>
            <input type="date" value={dia} onChange={(e) => e.target.value && ir({ dia: e.target.value })} className="ml-1 rounded-full border border-linea bg-white px-3 py-1.5 text-sm" aria-label="Ir a fecha" />
          </div>
        )}
      </div>
      <h2 className="titulo-display mb-3 text-2xl">{titulo}</h2>

      {vista === 'dia' && <VistaDia dia={dia} />}
      {vista === 'semana' && <VistaSemana dia={dia} onDia={(d) => ir({ vista: 'dia', dia: d })} />}
      {vista === 'mes' && <VistaMes dia={dia} onDia={(d) => ir({ vista: 'dia', dia: d })} />}
      {vista === 'pendientes' && <VistaPendientes />}
    </div>
  )
}

// ---------------------------------------------------------------- Día
function useRangoHoras() {
  const { data: ajustes } = useAjustes()
  const ini = minutosDesdeMedianoche(ajustes?.agenda_hora_inicio ?? '08:00')
  const fin = minutosDesdeMedianoche(ajustes?.agenda_hora_fin ?? '22:30') + 30
  return { ini, fin, paso: ajustes?.intervalo_turnos_min ?? 30 }
}

function VistaDia({ dia }: { dia: string }) {
  const turnos = useTurnosRango(dia, dia)
  const bloqueos = useBloqueosRango(dia, dia)
  const horarios = useHorarios()
  if (turnos.error) return <ErrorCarga error={turnos.error} reintentar={() => turnos.refetch()} />
  if (turnos.isLoading) return <Cargando />
  const activos = turnos.data!.filter((t) => t.estado !== 'cancelado')
  const cancelados = turnos.data!.filter((t) => t.estado === 'cancelado')
  return (
    <div className="space-y-4">
      <ResumenDia turnos={turnos.data!} />
      <GrillaDia dia={dia} turnos={activos} bloqueos={bloqueos.data ?? []} horarios={horarios.data ?? []} />
      {cancelados.length > 0 && (
        <details className="tarjeta p-4">
          <summary className="cursor-pointer text-sm font-medium text-gris">{cancelados.length} cancelado(s) este día</summary>
          <div className="mt-2">
            <ListaTurnosAcciones turnos={cancelados} />
          </div>
        </details>
      )}
    </div>
  )
}

function ListaTurnosAcciones({ turnos }: { turnos: TurnoDetalle[] }) {
  const a = useAcciones()
  return <ListaTurnos turnos={turnos} onClick={a.verTurno} />
}

function ResumenDia({ turnos }: { turnos: TurnoDetalle[] }) {
  const validos = turnos.filter((t) => t.estado !== 'cancelado' && t.estado !== 'no_asistio')
  if (!validos.length) return null
  const total = validos.reduce((s, t) => s + Number(t.total), 0)
  const cobrado = validos.reduce((s, t) => s + Number(t.pagado), 0)
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gris">
      <span><b className="text-tinta">{validos.length}</b> turno(s)</span>
      <span>Previsto <b className="text-tinta">{dinero(total)}</b></span>
      <span>Cobrado <b className="text-tinta">{dinero(cobrado)}</b></span>
    </div>
  )
}

function GrillaDia({ dia, turnos, bloqueos, horarios, compacta }: { dia: string; turnos: TurnoDetalle[]; bloqueos: Bloqueo[]; horarios: HorarioLaboral[]; compacta?: boolean }) {
  const a = useAcciones()
  const { ini, fin, paso } = useRangoHoras()
  const [menu, setMenu] = useState<string | null>(null)
  const filas = useMemo(() => {
    const r: number[] = []
    for (let m = ini; m < fin; m += 30) r.push(m)
    return r
  }, [ini, fin])
  const franjas = horarios.filter((h) => h.dia_semana === diaSemana(dia))
  const enHorario = (m: number) => franjas.some((f) => m >= minutosDesdeMedianoche(f.hora_inicio) && m < minutosDesdeMedianoche(f.hora_fin))
  const altura = (fin - ini) * PX_POR_MIN

  const posicion = (inicio: string, finI: string) => {
    const di = fechaISO(inicio) < dia ? ini : minutosDesdeMedianoche(horaTexto(inicio))
    const df = fechaISO(finI) > dia ? fin : minutosDesdeMedianoche(horaTexto(finI))
    const top = Math.max(di, ini) - ini
    const h = Math.max(Math.min(df, fin) - Math.max(di, ini), paso / 2)
    return { top: top * PX_POR_MIN, height: h * PX_POR_MIN }
  }

  return (
    <div className="tarjeta relative overflow-hidden">
      <div className="relative" style={{ height: altura }}>
        {filas.map((m) => (
          <div
            key={m}
            className={clsx('group absolute inset-x-0 flex border-t', m % 60 === 0 ? 'border-linea' : 'border-dashed border-linea/60', !enHorario(m) && 'bg-nude-50/70')}
            style={{ top: (m - ini) * PX_POR_MIN, height: 30 * PX_POR_MIN }}
          >
            {!compacta && <span className="w-14 shrink-0 pr-2 pt-0.5 text-right text-xs text-gris">{minutosAHora(m)}</span>}
            <button
              className="flex-1 text-left opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              aria-label={`Agregar a las ${minutosAHora(m)}`}
              onClick={() => setMenu(minutosAHora(m))}
            >
              <span className="ml-2 text-xs text-rosa-500">+ {minutosAHora(m)}</span>
            </button>
          </div>
        ))}

        {bloqueos.map((b) => {
          const p = posicion(b.inicio, b.fin)
          return (
            <button
              key={b.id}
              onClick={() => a.bloquear({ bloqueo: b })}
              className={clsx('absolute right-1.5 flex items-start gap-1.5 overflow-hidden rounded-lg border border-dashed border-stone-300 bg-[repeating-linear-gradient(135deg,#f5f0ee,#f5f0ee_6px,#ece4e0_6px,#ece4e0_12px)] px-2 py-1 text-left text-xs text-stone-600', compacta ? 'left-1' : 'left-16')}
              style={p}
            >
              <Lock className="mt-0.5 size-3 shrink-0" />
              <span className="truncate">{b.motivo || 'Bloqueado'}</span>
            </button>
          )
        })}

        {turnos.map((t) => {
          const p = posicion(t.inicio, t.fin)
          return (
            <button
              key={t.id}
              onClick={() => a.verTurno(t.id)}
              className={clsx(
                'absolute right-1.5 overflow-hidden rounded-xl border-l-4 px-2.5 py-1.5 text-left shadow-sm transition hover:shadow-md',
                compacta ? 'left-1' : 'left-16',
                t.estado === 'pendiente' && 'border-amber-400 bg-amber-50',
                t.estado === 'confirmado' && 'border-rosa-500 bg-rosa-50',
                t.estado === 'finalizado' && 'border-sky-400 bg-sky-50',
                t.estado === 'no_asistio' && 'border-red-400 bg-red-50 opacity-70',
              )}
              style={p}
            >
              <span className={clsx('block truncate font-medium leading-tight', compacta ? 'text-xs' : 'text-sm')}>
                {horaTexto(t.inicio)} · {t.clienta_nombre}
              </span>
              {p.height > 34 && <span className="block truncate text-xs text-tinta-soft">{t.servicios_texto}</span>}
              {p.height > 52 && !compacta && (
                <span className="mt-1 flex gap-1">
                  <Badge className={ESTADOS_PAGO[t.estado_pago].clase}>{ESTADOS_PAGO[t.estado_pago].etiqueta}</Badge>
                  {t.clienta_alergias && <Badge className="bg-red-50 text-red-700 ring-red-200">⚠ alergia</Badge>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {menu && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-tinta/30 sm:items-center" onClick={() => setMenu(null)}>
          <div className="safe-bottom w-full max-w-xs animate-subir space-y-2 rounded-t-3xl bg-crema p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 text-sm text-gris">{capitalizar(fmtDia(dia, "EEEE d/MM"))} · {menu}</p>
            <Button bloque icono={<CalendarPlus className="size-4" />} onClick={() => { a.nuevoTurno({ fecha: dia, hora: menu }); setMenu(null) }}>
              Nuevo turno
            </Button>
            <Button bloque variante="secundario" icono={<Ban className="size-4" />} onClick={() => { a.bloquear({ fecha: dia, hora: menu }); setMenu(null) }}>
              Bloquear horario
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Semana
function VistaSemana({ dia, onDia }: { dia: string; onDia: (d: string) => void }) {
  const desde = inicioSemana(dia)
  const hasta = sumarDias(desde, 6)
  const turnos = useTurnosRango(desde, hasta, false)
  const bloqueos = useBloqueosRango(desde, hasta)
  const horarios = useHorarios()
  const a = useAcciones()
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i))
  if (turnos.error) return <ErrorCarga error={turnos.error} reintentar={() => turnos.refetch()} />
  if (turnos.isLoading) return <Cargando />
  const porDia = (d: string) => turnos.data!.filter((t) => fechaISO(t.inicio) === d)
  const bloqDia = (d: string) => (bloqueos.data ?? []).filter((b) => fechaISO(b.inicio) <= d && fechaISO(new Date(new Date(b.fin).getTime() - 1)) >= d)
  const hoy = hoyISO()

  return (
    <>
      {/* Celular: lista por día */}
      <div className="space-y-3 md:hidden">
        {dias.map((d) => (
          <div key={d} className={clsx('tarjeta p-4', d === hoy && 'ring-2 ring-rosa-200')}>
            <button onClick={() => onDia(d)} className="mb-1 flex w-full items-baseline justify-between">
              <span className="font-semibold">{capitalizar(fmtDia(d, 'EEEE d'))}</span>
              <span className="text-xs text-gris">{porDia(d).length} turno(s)</span>
            </button>
            {bloqDia(d).map((b) => (
              <p key={b.id} className="flex items-center gap-1.5 text-xs text-stone-500"><Lock className="size-3" /> {b.todo_el_dia ? 'Todo el día' : `${horaTexto(b.inicio)}–${horaTexto(b.fin)}`} · {b.motivo || 'Bloqueado'}</p>
            ))}
            {porDia(d).length ? <ListaTurnos turnos={porDia(d)} onClick={a.verTurno} /> : <p className="py-1 text-sm text-gris">Libre</p>}
          </div>
        ))}
      </div>
      {/* Escritorio: grilla */}
      <div className="hidden md:block">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {dias.map((d) => (
            <button key={d} onClick={() => onDia(d)} className={clsx('rounded-xl py-1.5 text-center text-sm hover:bg-nude-100', d === hoy && 'bg-rosa-50 font-semibold text-rosa-700')}>
              {DIAS_CORTOS[diaSemana(d)]} {fmtDia(d, 'd')}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {dias.map((d) => (
            <GrillaDia key={d} dia={d} turnos={porDia(d)} bloqueos={bloqDia(d)} horarios={horarios.data ?? []} compacta />
          ))}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Mes
function VistaMes({ dia, onDia }: { dia: string; onDia: (d: string) => void }) {
  const primero = dia.slice(0, 8) + '01'
  const desde = inicioSemana(primero)
  const [y, m] = primero.split('-').map(Number)
  const ultimo = fechaISO(new Date(y, m, 0, 12))
  const hasta = sumarDias(inicioSemana(ultimo), 6)
  const turnos = useTurnosRango(desde, hasta, false)
  const bloqueos = useBloqueosRango(desde, hasta)
  const total = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1
  const dias = Array.from({ length: total }, (_, i) => sumarDias(desde, i))
  const hoy = hoyISO()
  if (turnos.isLoading) return <Cargando />

  return (
    <div className="tarjeta overflow-hidden">
      <div className="grid grid-cols-7 border-b border-linea bg-nude-50 text-center text-xs font-medium text-gris">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const ts = turnos.data?.filter((t) => fechaISO(t.inicio) === d) ?? []
          const bloq = bloqueos.data?.some((b) => fechaISO(b.inicio) <= d && fechaISO(new Date(new Date(b.fin).getTime() - 1)) >= d && b.todo_el_dia)
          const fuera = d.slice(0, 7) !== primero.slice(0, 7)
          return (
            <button
              key={d}
              onClick={() => onDia(d)}
              className={clsx('min-h-20 border-b border-r border-linea p-1.5 text-left align-top transition hover:bg-rosa-50/50 sm:min-h-24', fuera && 'bg-nude-50/50 text-gris', bloq && 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,#f1e9e5_6px,#f1e9e5_12px)]')}
            >
              <span className={clsx('inline-flex size-7 items-center justify-center rounded-full text-sm', d === hoy && 'bg-rosa-500 font-semibold text-white')}>{Number(d.slice(8))}</span>
              <div className="mt-0.5 space-y-0.5">
                {ts.slice(0, 3).map((t) => (
                  <div key={t.id} className="hidden truncate rounded px-1 text-[11px] sm:block" style={{ background: 'var(--color-rosa-50)' }}>
                    {horaTexto(t.inicio)} {t.clienta_nombre}
                  </div>
                ))}
                {ts.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {ts.slice(0, 6).map((t) => (
                      <span key={t.id} className={clsx('size-1.5 rounded-full', ESTADOS_TURNO[t.estado].punto)} />
                    ))}
                  </div>
                )}
                {ts.length > 3 && <div className="hidden text-[11px] text-gris sm:block">+{ts.length - 3} más</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Pendientes y bloqueos
function VistaPendientes() {
  const pendientes = useTurnosPendientes()
  const bloqueos = useBloqueosFuturos()
  const a = useAcciones()
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="tarjeta p-5">
        <h3 className="titulo-display mb-2 text-xl">Pedidos de turno</h3>
        {pendientes.isLoading ? (
          <Cargando />
        ) : !pendientes.data?.length ? (
          <Vacio titulo="No hay pedidos pendientes" texto="Cuando una clienta pida turno desde la web, aparece acá para que lo confirmes." />
        ) : (
          <ul className="divide-y divide-linea">
            {pendientes.data.map((t) => (
              <li key={t.id}>
                <button onClick={() => a.verTurno(t.id)} className="w-full py-3 text-left">
                  <p className="font-medium">{t.clienta_nombre} {!t.clienta_id && <Badge className="ml-1 bg-amber-50 text-amber-800 ring-amber-200">Sin vincular</Badge>}</p>
                  <p className="text-sm text-gris">{capitalizar(fmt(t.inicio, "EEEE d/MM 'a las' HH:mm"))} · {t.servicios_texto}</p>
                  {t.solicitante_nota && <p className="mt-1 text-sm italic text-tinta-soft">“{t.solicitante_nota}”</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tarjeta p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="titulo-display text-xl">Bloqueos y vacaciones</h3>
          <Button tamano="sm" variante="secundario" onClick={() => a.bloquear()}>Agregar</Button>
        </div>
        {!bloqueos.data?.length ? (
          <p className="py-4 text-sm text-gris">No hay bloqueos próximos.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {bloqueos.data.map((b) => (
              <li key={b.id}>
                <button onClick={() => a.bloquear({ bloqueo: b })} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <Lock className="size-4 text-stone-400" />
                  <span className="flex-1">
                    <span className="block font-medium">{b.motivo || 'Bloqueado'}</span>
                    <span className="block text-sm text-gris">
                      {b.todo_el_dia
                        ? `${fmt(b.inicio, 'd/MM')} al ${fmt(new Date(new Date(b.fin).getTime() - 1), 'd/MM')}`
                        : `${fmt(b.inicio, "EEE d/MM HH:mm")} a ${horaTexto(b.fin)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
