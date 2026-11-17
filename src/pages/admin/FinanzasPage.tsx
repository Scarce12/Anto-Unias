import clsx from 'clsx'
import { Download, Gift, Plus, Receipt, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAcciones } from '@/app/acciones'
import { Badge, Cargando, Encabezado, ErrorCarga, Segmentado, Tarjeta, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { useConfirmar } from '@/components/ui/Confirmar'
import { useAjustes } from '@/features/ajustes/api'
import {
  useAnularCredito, useBorrarGasto, useCategoriasGasto, useCreditos, useGastos, useIngresos, usePlanilla, useResumenFinanzas,
} from '@/features/finanzas/api'
import { descargarCSV } from '@/lib/csv'
import { capitalizar, fechaISO, fmt, fmtDia, hoyISO, inicioSemana, sumarDias } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, ETIQUETA_MEDIO } from '@/lib/formato'
import type { MedioPago, MovimientoPlanilla } from '@/lib/types'

type Periodo = 'semana' | 'mes' | 'anio' | 'dia' | 'otro'
type Pestana = 'resumen' | 'planilla' | 'reparto' | 'movimientos' | 'gastos' | 'giftcards'

function rango(periodo: Periodo, ref: string, desde: string, hasta: string): [string, string] {
  if (periodo === 'dia') return [ref, ref]
  if (periodo === 'semana') {
    const d = inicioSemana(ref)
    return [d, sumarDias(d, 6)]
  }
  if (periodo === 'mes') {
    const [y, m] = ref.split('-').map(Number)
    return [`${ref.slice(0, 7)}-01`, fechaISO(new Date(y, m, 0, 12))]
  }
  if (periodo === 'anio') return [`${ref.slice(0, 4)}-01-01`, `${ref.slice(0, 4)}-12-31`]
  return [desde, hasta]
}

function anterior(periodo: Periodo, d: string, h: string): [string, string] {
  if (periodo === 'mes') {
    const [y, m] = d.split('-').map(Number)
    const ini = new Date(y, m - 2, 1, 12)
    return [fechaISO(ini), fechaISO(new Date(y, m - 1, 0, 12))]
  }
  if (periodo === 'anio') {
    const y = Number(d.slice(0, 4)) - 1
    return [`${y}-01-01`, `${y}-12-31`]
  }
  const dias = Math.round((Date.parse(h) - Date.parse(d)) / 86400000) + 1
  return [sumarDias(d, -dias), sumarDias(d, -1)]
}

const COLORES = ['#b7727f', '#dcc0b0', '#4a3c40', '#cb8590', '#e9dccb', '#8a7b7e']

export function FinanzasPage() {
  const [params, setParams] = useSearchParams()
  const pestana = (params.get('p') as Pestana) || 'resumen'
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [ref, setRef] = useState(hoyISO())
  const [libre, setLibre] = useState({ desde: sumarDias(hoyISO(), -30), hasta: hoyISO() })
  const [desde, hasta] = rango(periodo, ref, libre.desde, libre.hasta)
  const a = useAcciones()

  const mover = (dir: 1 | -1) => {
    if (periodo === 'dia') setRef(sumarDias(ref, dir))
    else if (periodo === 'semana') setRef(sumarDias(ref, 7 * dir))
    else if (periodo === 'mes') {
      const [y, m] = ref.split('-').map(Number)
      setRef(fechaISO(new Date(y, m - 1 + dir, 1, 12)))
    } else if (periodo === 'anio') setRef(`${Number(ref.slice(0, 4)) + dir}-01-01`)
  }

  const etiquetaPeriodo =
    periodo === 'dia' ? capitalizar(fmtDia(desde, "EEEE d 'de' MMMM")) :
    periodo === 'semana' ? `${fmtDia(desde, 'd/MM')} al ${fmtDia(hasta, 'd/MM/yyyy')}` :
    periodo === 'mes' ? capitalizar(fmtDia(desde, 'MMMM yyyy')) :
    periodo === 'anio' ? desde.slice(0, 4) : `${fmtDia(desde, 'd/MM/yy')} al ${fmtDia(hasta, 'd/MM/yy')}`

  return (
    <div>
      <Encabezado
        titulo="Finanzas"
        acciones={
          <>
            <Button variante="secundario" icono={<Receipt className="size-4" />} onClick={() => a.nuevoGasto()}>Gasto</Button>
            <Button icono={<Plus className="size-4" />} onClick={() => a.nuevoPago()}>Ingreso</Button>
          </>
        }
      />
      <div className="scroll-fino -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmentado
          valor={pestana}
          onChange={(v) => setParams({ p: v }, { replace: true })}
          opciones={[
            { valor: 'resumen', etiqueta: 'Resumen' },
            { valor: 'planilla', etiqueta: 'Planilla' },
            { valor: 'reparto', etiqueta: 'Reparto' },
            { valor: 'movimientos', etiqueta: 'Ingresos' },
            { valor: 'gastos', etiqueta: 'Gastos' },
            { valor: 'giftcards', etiqueta: 'Gift cards' },
          ]}
        />
      </div>

      {pestana !== 'giftcards' && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Segmentado
            valor={periodo}
            onChange={setPeriodo}
            opciones={[
              { valor: 'dia', etiqueta: 'Día' },
              { valor: 'semana', etiqueta: 'Semana' },
              { valor: 'mes', etiqueta: 'Mes' },
              { valor: 'anio', etiqueta: 'Año' },
              { valor: 'otro', etiqueta: 'Fechas' },
            ]}
          />
          {periodo === 'otro' ? (
            <div className="flex items-center gap-2">
              <input type="date" value={libre.desde} onChange={(e) => setLibre({ ...libre, desde: e.target.value })} className="rounded-full border border-linea bg-white px-3 py-1.5 text-sm" aria-label="Desde" />
              <span className="text-gris">a</span>
              <input type="date" value={libre.hasta} onChange={(e) => setLibre({ ...libre, hasta: e.target.value })} className="rounded-full border border-linea bg-white px-3 py-1.5 text-sm" aria-label="Hasta" />
            </div>
          ) : (
            <div className="flex items-center">
              <button onClick={() => mover(-1)} className="rounded-full px-3 py-1.5 hover:bg-nude-100" aria-label="Anterior">‹</button>
              <span className="min-w-36 text-center text-sm font-medium">{etiquetaPeriodo}</span>
              <button onClick={() => mover(1)} className="rounded-full px-3 py-1.5 hover:bg-nude-100" aria-label="Siguiente">›</button>
            </div>
          )}
        </div>
      )}

      {pestana === 'resumen' && <Resumen desde={desde} hasta={hasta} periodo={periodo} />}
      {pestana === 'planilla' && <Planilla desde={desde} hasta={hasta} />}
      {pestana === 'reparto' && <Reparto desde={desde} hasta={hasta} />}
      {pestana === 'movimientos' && <Movimientos desde={desde} hasta={hasta} />}
      {pestana === 'gastos' && <Gastos desde={desde} hasta={hasta} />}
      {pestana === 'giftcards' && <GiftCards />}
    </div>
  )
}

// ------------------------------------------------------------------ Resumen
function Resumen({ desde, hasta, periodo }: { desde: string; hasta: string; periodo: Periodo }) {
  const q = useResumenFinanzas(desde, hasta)
  const [pd, ph] = anterior(periodo, desde, hasta)
  const prev = useResumenFinanzas(pd, ph)
  if (q.error) return <ErrorCarga error={q.error} reintentar={() => q.refetch()} />
  if (q.isLoading || !q.data) return <Cargando />
  const r = q.data
  const p = prev.data
  const variacion = (act: number, ant?: number) => (ant ? Math.round(((act - ant) / ant) * 100) : null)
  const datosDia = r.por_dia.map((d) => ({ ...d, etiqueta: fmtDia(d.dia, r.por_dia.length > 31 ? 'MMM' : 'd/MM') }))
  // Para un año, agrupamos por mes
  const serie = r.por_dia.length > 62
    ? Object.values(datosDia.reduce<Record<string, { etiqueta: string; ingresos: number; gastos: number }>>((acc, d) => {
        const k = d.dia.slice(0, 7)
        acc[k] ??= { etiqueta: capitalizar(fmtDia(d.dia, 'MMM')), ingresos: 0, gastos: 0 }
        acc[k].ingresos += Number(d.ingresos)
        acc[k].gastos += Number(d.gastos)
        return acc
      }, {}))
    : datosDia

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Ingresos" valor={r.ingresos} variacion={variacion(r.ingresos, p?.ingresos)} />
        <Kpi etiqueta="Gastos" valor={r.gastos} variacion={variacion(r.gastos, p?.gastos)} invertido />
        <Kpi etiqueta="Ganancia neta" valor={r.neto} variacion={variacion(r.neto, p?.neto)} destacado />
        <div className="tarjeta p-4">
          <p className="text-sm text-gris">Turnos finalizados</p>
          <p className="mt-1 text-2xl font-semibold">{r.turnos.finalizados}</p>
          <p className="text-xs text-gris">{r.turnos.cancelados} cancelados · {r.turnos.no_asistio} no asistieron</p>
        </div>
      </div>
      {p && <p className="-mt-2 text-xs text-gris">Comparado con el período anterior ({fmtDia(pd, 'd/MM')} al {fmtDia(ph, 'd/MM/yy')}): ingresos {dinero(p.ingresos)}, gastos {dinero(p.gastos)}.</p>}

      <Tarjeta className="min-w-0 p-5">
        <h3 className="titulo-display mb-3 text-xl">Ingresos y gastos</h3>
        {r.ingresos === 0 && r.gastos === 0 ? <p className="py-8 text-center text-sm text-gris">Sin movimientos en este período.</p> : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={serie} margin={{ left: -10, right: 4 }}>
                <CartesianGrid vertical={false} stroke="#eadfda" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#8a7b7e' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#8a7b7e' }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip formatter={(v) => dinero(Number(v))} cursor={{ fill: '#fbf1f2' }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#b7727f" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#dcc0b0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Tarjeta className="p-5">
          <h3 className="titulo-display mb-3 text-xl">Medios de pago</h3>
          {r.por_medio.length === 0 ? <p className="text-sm text-gris">Sin ingresos.</p> : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="size-36 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={r.por_medio} dataKey="monto" nameKey="medio" innerRadius={38} outerRadius={64} paddingAngle={2}>
                      {r.por_medio.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => dinero(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
                {r.por_medio.map((m, i) => (
                  <li key={m.medio} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                    <span className="flex-1">{ETIQUETA_MEDIO[m.medio]} <span className="text-gris">({m.cantidad})</span></span>
                    <span className="font-medium">{dinero(m.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Tarjeta>
        <Tarjeta className="p-5">
          <h3 className="titulo-display mb-3 text-xl">Servicios más rentables</h3>
          {r.servicios.length === 0 ? <p className="text-sm text-gris">Sin turnos finalizados en este período.</p> : (
            <ul className="space-y-2 text-sm">
              {r.servicios.slice(0, 8).map((s) => {
                const max = Number(r.servicios[0].facturado) || 1
                return (
                  <li key={s.nombre}>
                    <div className="flex justify-between"><span>{s.nombre} <span className="text-gris">×{s.cantidad}</span></span><span className="font-medium">{dinero(s.facturado)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-nude-100"><div className="h-full rounded-full bg-rosa-400" style={{ width: `${(Number(s.facturado) / max) * 100}%` }} /></div>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>
      </div>

      {r.gastos_por_categoria.length > 0 && (
        <Tarjeta className="p-5">
          <h3 className="titulo-display mb-3 text-xl">Gastos por categoría</h3>
          <ul className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            {r.gastos_por_categoria.map((g) => (
              <li key={g.categoria} className="flex justify-between"><span>{g.categoria}</span><span className="font-medium">{dinero(g.monto)}</span></li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}

function Kpi({ etiqueta, valor, variacion, invertido, destacado }: { etiqueta: string; valor: number; variacion: number | null; invertido?: boolean; destacado?: boolean }) {
  const bueno = variacion !== null && (invertido ? variacion <= 0 : variacion >= 0)
  return (
    <div className={clsx('tarjeta p-4', destacado && 'border-rosa-200 bg-rosa-50/50')}>
      <p className="text-sm text-gris">{etiqueta}</p>
      <p className={clsx('mt-1 text-2xl font-semibold', valor < 0 && 'text-red-700')}>{dinero(valor)}</p>
      {variacion !== null && Number.isFinite(variacion) && (
        <p className={clsx('mt-0.5 flex items-center gap-1 text-xs', bueno ? 'text-emerald-700' : 'text-red-700')}>
          {variacion >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {variacion > 0 ? '+' : ''}{variacion}% vs. anterior
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Planilla (como en la agenda)
const COLUMNAS: { medio: MedioPago; corto: string }[] = [
  { medio: 'efectivo', corto: 'EF' },
  { medio: 'transferencia', corto: 'T' },
  { medio: 'mercado_pago', corto: 'MP' },
  { medio: 'otro', corto: 'Otro' },
]

function Planilla({ desde, hasta }: { desde: string; hasta: string }) {
  const q = usePlanilla(desde, hasta)
  const a = useAcciones()
  if (q.error) return <ErrorCarga error={q.error} reintentar={() => q.refetch()} />
  if (q.isLoading) return <Cargando />
  const filas = q.data!
  // Agrupar por semana (lunes a domingo) como en la planilla de papel
  const semanas = new Map<string, MovimientoPlanilla[]>()
  for (const f of filas) {
    const s = inicioSemana(fechaISO(f.fecha))
    semanas.set(s, [...(semanas.get(s) ?? []), f])
  }
  const columnasUsadas = COLUMNAS.filter((c) => c.medio === 'efectivo' || c.medio === 'transferencia' || filas.some((f) => f.medio === c.medio))

  const exportar = () =>
    descargarCSV(`planilla_${desde}_${hasta}`, ['Día', 'Clienta', 'Procedimiento', 'Valor', 'Medio'], filas.map((f) => [fmt(f.fecha, 'dd/MM/yyyy'), f.clienta, f.detalle, Number(f.valor), ETIQUETA_MEDIO[f.medio]]))

  if (!filas.length) return <Vacio icono={<Receipt />} titulo="Sin cobros en este período" texto="Acá se arma sola la planilla de Clienta / Procedimiento / Valor / Efectivo / Transferencia a medida que registrás pagos." />

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variante="secundario" tamano="sm" icono={<Download className="size-4" />} onClick={exportar}>Exportar a Excel (CSV)</Button>
      </div>
      {[...semanas.entries()].map(([semana, items]) => {
        const tot = (m: MedioPago) => items.filter((i) => i.medio === m).reduce((s, i) => s + Number(i.valor), 0)
        const total = items.reduce((s, i) => s + Number(i.valor), 0)
        return (
          <div key={semana} className="tarjeta overflow-hidden">
            <div className="bg-rosa-100/70 px-4 py-2 text-sm font-semibold text-rosa-700">Semana del {fmtDia(semana, "d 'de' MMMM")}</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-xs uppercase tracking-wide text-gris">
                    <th className="px-3 py-2">Día</th>
                    <th className="px-3 py-2">Clienta</th>
                    <th className="px-3 py-2">Procedimiento</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    {columnasUsadas.map((c) => <th key={c.medio} className="w-12 px-2 py-2 text-center">{c.corto}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {items.map((f, i) => (
                    <tr key={i} className={clsx(f.turno_id && 'cursor-pointer hover:bg-nude-50')} onClick={() => f.turno_id && a.verTurno(f.turno_id)}>
                      <td className="px-3 py-2 text-gris">{fmt(f.fecha, 'd/MM')}</td>
                      <td className="px-3 py-2 font-medium">{f.clienta ?? '—'}</td>
                      <td className="px-3 py-2">{f.detalle}</td>
                      <td className="px-3 py-2 text-right">{dinero(f.valor)}</td>
                      {columnasUsadas.map((c) => <td key={c.medio} className="px-2 py-2 text-center text-rosa-600">{f.medio === c.medio ? '✕' : ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 bg-rosa-100/70 px-4 py-2.5 text-sm">
              <span className="font-semibold">Total de la semana:</span>
              {columnasUsadas.map((c) => <span key={c.medio}>{c.corto}: <b>{dinero(tot(c.medio))}</b></span>)}
              <span>TT: <b>{dinero(total)}</b></span>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-gris">Las gift cards se cuentan cuando se venden; cuando se usan en un turno no vuelven a sumar.</p>
    </div>
  )
}

// ------------------------------------------------------------------ Reparto 70 / 15 / 15
function Reparto({ desde, hasta }: { desde: string; hasta: string }) {
  const r = useResumenFinanzas(desde, hasta)
  const planilla = usePlanilla(desde, hasta)
  const { data: ajustes } = useAjustes()
  if (r.isLoading || planilla.isLoading || !r.data) return <Cargando />
  const rep = r.data.reparto
  const pct = (n: number, p: number) => Math.round((n * p) / 100)
  const porDia = new Map<string, { servicios: string[]; total: number }>()
  for (const f of planilla.data ?? []) {
    const d = fechaISO(f.fecha)
    const x = porDia.get(d) ?? { servicios: [], total: 0 }
    if (f.detalle) x.servicios.push(f.detalle)
    x.total += Number(f.valor)
    porDia.set(d, x)
  }
  const insumosDisponibles = rep.insumos - r.data.gastos_insumos

  const exportar = () =>
    descargarCSV(`reparto_${desde}_${hasta}`, ['Día', 'Servicios', 'Total', `${rep.ganancia_pct}% ganancia`, `${rep.insumos_pct}% insumos`, `${rep.sueldo_pct}% sueldo`],
      [...porDia.entries()].map(([d, x]) => [fmtDia(d, 'dd/MM/yyyy'), x.servicios.join(' / '), x.total, pct(x.total, rep.ganancia_pct), pct(x.total, rep.insumos_pct), pct(x.total, rep.sueldo_pct)]))

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <ParteReparto etiqueta="Sueldo" pct={rep.sueldo_pct} valor={rep.sueldo} color="bg-rosa-500" />
        <ParteReparto etiqueta="Ganancia / ahorro" pct={rep.ganancia_pct} valor={rep.ganancia} color="bg-tinta" />
        <ParteReparto etiqueta="Insumos" pct={rep.insumos_pct} valor={rep.insumos} color="bg-nude-300" extra={
          <span className={insumosDisponibles >= 0 ? 'text-emerald-700' : 'text-red-700'}>
            Gastado en insumos: {dinero(r.data.gastos_insumos)} · {insumosDisponibles >= 0 ? `Queda ${dinero(insumosDisponibles)}` : `Te pasaste ${dinero(-insumosDisponibles)}`}
          </span>
        } />
      </div>
      <p className="text-sm text-gris">
        Sobre {dinero(r.data.ingresos)} de ingresos. Los porcentajes se cambian en <a href="/admin/ajustes" className="text-rosa-600 underline">Ajustes</a>
        {ajustes ? ` (hoy: ${ajustes.reparto_sueldo_pct}% / ${ajustes.reparto_ganancia_pct}% / ${ajustes.reparto_insumos_pct}%)` : ''}.
      </p>
      {porDia.size > 0 && (
        <div className="tarjeta overflow-hidden">
          <div className="flex items-center justify-between bg-nude-100 px-4 py-2">
            <span className="text-sm font-semibold">Detalle por día</span>
            <Button variante="fantasma" tamano="sm" icono={<Download className="size-4" />} onClick={exportar}>CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-xs uppercase tracking-wide text-gris">
                  <th className="px-3 py-2">Día</th><th className="px-3 py-2">Servicios</th><th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">{rep.ganancia_pct}% gan.</th><th className="px-3 py-2 text-right">{rep.insumos_pct}% ins.</th><th className="px-3 py-2 text-right">{rep.sueldo_pct}% sueldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {[...porDia.entries()].map(([d, x]) => (
                  <tr key={d}>
                    <td className="px-3 py-2 text-gris">{fmtDia(d, 'd/MM')}</td>
                    <td className="max-w-xs truncate px-3 py-2">{x.servicios.join(' / ')}</td>
                    <td className="px-3 py-2 text-right font-medium">{dinero(x.total)}</td>
                    <td className="px-3 py-2 text-right">{dinero(pct(x.total, rep.ganancia_pct))}</td>
                    <td className="px-3 py-2 text-right">{dinero(pct(x.total, rep.insumos_pct))}</td>
                    <td className="px-3 py-2 text-right">{dinero(pct(x.total, rep.sueldo_pct))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ParteReparto({ etiqueta, pct, valor, color, extra }: { etiqueta: string; pct: number; valor: number; color: string; extra?: React.ReactNode }) {
  return (
    <div className="tarjeta p-4">
      <div className="flex items-center gap-2 text-sm text-gris"><span className={clsx('size-2.5 rounded-full', color)} />{etiqueta} · {pct}%</div>
      <p className="mt-1 text-2xl font-semibold">{dinero(valor)}</p>
      {extra && <p className="mt-1 text-xs">{extra}</p>}
    </div>
  )
}

// ------------------------------------------------------------------ Ingresos
function Movimientos({ desde, hasta }: { desde: string; hasta: string }) {
  const q = useIngresos(desde, hasta)
  const a = useAcciones()
  if (q.isLoading) return <Cargando />
  if (q.error) return <ErrorCarga error={q.error} />
  const total = q.data!.reduce((s, i) => s + Number(i.monto), 0)
  if (!q.data!.length) return <Vacio titulo="Sin ingresos en este período" accion={<Button onClick={() => a.nuevoPago()}>Registrar ingreso</Button>} />
  return (
    <div className="tarjeta divide-y divide-linea">
      <div className="flex justify-between px-4 py-3 text-sm"><span className="text-gris">{q.data!.length} movimientos</span><b>{dinero(total)}</b></div>
      {q.data!.map((i) => (
        <button key={i.id} disabled={!i.turno_id} onClick={() => i.turno_id && a.verTurno(i.turno_id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm enabled:hover:bg-nude-50">
          <span className="w-20 shrink-0 text-gris">{fmt(i.fecha, 'd/MM HH:mm')}</span>
          <span className="flex-1">{i.concepto}</span>
          <Badge>{ETIQUETA_MEDIO[i.medio]}</Badge>
          <span className="w-24 text-right font-medium">{dinero(i.monto)}</span>
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Gastos
function Gastos({ desde, hasta }: { desde: string; hasta: string }) {
  const q = useGastos(desde, hasta)
  const cats = useCategoriasGasto()
  const borrar = useBorrarGasto()
  const confirmar = useConfirmar()
  const a = useAcciones()
  const nombreCat = useMemo(() => new Map(cats.data?.map((c) => [c.id, c.nombre])), [cats.data])
  if (q.isLoading) return <Cargando />
  if (q.error) return <ErrorCarga error={q.error} />
  const total = q.data!.reduce((s, g) => s + Number(g.monto), 0)
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <Button variante="secundario" tamano="sm" icono={<Download className="size-4" />} disabled={!q.data!.length}
          onClick={() => descargarCSV(`gastos_${desde}_${hasta}`, ['Fecha', 'Descripción', 'Categoría', 'Importe', 'Medio', 'Observaciones'],
            q.data!.map((g) => [fmtDia(g.fecha, 'dd/MM/yyyy'), g.descripcion, nombreCat.get(g.categoria_id ?? '') ?? '', Number(g.monto), ETIQUETA_MEDIO[g.medio], g.notas]))}>
          Exportar
        </Button>
        <Button tamano="sm" icono={<Plus className="size-4" />} onClick={() => a.nuevoGasto()}>Registrar gasto</Button>
      </div>
      {!q.data!.length ? <Vacio icono={<Receipt />} titulo="Sin gastos en este período" texto="Registrá compras de esmaltes, materiales, herramientas, etc." /> : (
        <div className="tarjeta divide-y divide-linea">
          <div className="flex justify-between px-4 py-3 text-sm"><span className="text-gris">{q.data!.length} gastos</span><b>{dinero(total)}</b></div>
          {q.data!.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <button className="flex flex-1 items-center gap-3 text-left" onClick={() => a.nuevoGasto(g)}>
                <span className="w-14 shrink-0 text-gris">{fmtDia(g.fecha, 'd/MM')}</span>
                <span className="flex-1"><span className="font-medium">{g.descripcion}</span>{g.categoria_id && <span className="text-gris"> · {nombreCat.get(g.categoria_id)}</span>}</span>
                <span className="font-medium">{dinero(g.monto)}</span>
              </button>
              <button aria-label="Borrar gasto" className="rounded-full p-1.5 text-gris hover:text-red-600" onClick={async () => {
                if (await confirmar({ titulo: '¿Borrar este gasto?', mensaje: `${g.descripcion} · ${dinero(g.monto)}`, confirmar: 'Borrar', peligro: true })) borrar.mutate(g.id, { onError: (e) => toast.error(mensajeError(e)) })
              }}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Gift cards
function GiftCards() {
  const q = useCreditos()
  const anular = useAnularCredito()
  const confirmar = useConfirmar()
  const a = useAcciones()
  if (q.isLoading) return <Cargando />
  const lista = q.data ?? []
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variante="secundario" tamano="sm" onClick={() => a.nuevoCredito('saldo_a_favor')}>Saldo a favor</Button>
        <Button tamano="sm" icono={<Gift className="size-4" />} onClick={() => a.nuevoCredito('gift_card')}>Vender gift card</Button>
      </div>
      {!lista.length ? <Vacio icono={<Gift />} titulo="Sin gift cards ni saldos" texto="Registrá las gift cards que vendés: el sistema controla cuánto queda de cada una." /> : (
        <div className="tarjeta divide-y divide-linea">
          {lista.map((c) => (
            <div key={c.id} className={clsx('flex flex-wrap items-center gap-3 px-4 py-3 text-sm', c.anulado && 'opacity-50')}>
              <span className="flex-1">
                <span className="font-medium">{c.tipo === 'gift_card' ? `Gift card ${c.codigo ?? ''}` : 'Saldo a favor'}</span>
                <span className="block text-xs text-gris">
                  {fmt(c.fecha, 'd/MM/yy')} · {[c.clienta_nombre, c.beneficiaria_nombre && `para ${c.beneficiaria_nombre}`, c.comprador_nombre && `de ${c.comprador_nombre}`].filter(Boolean).join(' · ')}
                  {c.vence && ` · vence ${fmtDia(c.vence, 'd/MM/yy')}`}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-medium">{dinero(c.saldo)}</span>
                <span className="block text-xs text-gris">de {dinero(c.monto)}</span>
              </span>
              {c.anulado ? <Badge>Anulada</Badge> : Number(c.saldo) === 0 ? <Badge className="bg-stone-100 text-stone-600 ring-stone-200">Usada</Badge> : (
                <button className="text-xs text-gris hover:text-red-600" onClick={async () => {
                  if (await confirmar({ titulo: '¿Anular?', mensaje: 'Deja de poder usarse y su venta ya no cuenta como ingreso.', confirmar: 'Anular', peligro: true }))
                    anular.mutate({ id: c.id, anulado: true }, { onError: (e) => toast.error(mensajeError(e)) })
                }}>Anular</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
