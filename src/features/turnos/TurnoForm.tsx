import clsx from 'clsx'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { useAjustes } from '@/features/ajustes/api'
import { useClienta } from '@/features/clientas/api'
import { ClientaPicker } from '@/features/clientas/ClientaPicker'
import { useServicios } from '@/features/servicios/api'
import { usePromociones } from '@/features/varios/api'
import { duracionTexto, fechaISO, horaTexto, hoyISO, instante } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, parseDinero } from '@/lib/formato'
import type { EstadoTurno, Promocion, Servicio } from '@/lib/types'
import { conflictosHorario, horariosLibres, useGuardarTurno, useTurno, type ItemInput } from './api'

export interface TurnoFormProps {
  abierto: boolean
  onCerrar: () => void
  turnoId?: string | null
  fecha?: string
  hora?: string
  clientaId?: string | null
  onGuardado?: (id: string) => void
}

interface Estado {
  clienta_id: string | null
  fecha: string
  hora: string
  items: (ItemInput & { clave: string })[]
  duracionManual: string
  estado: EstadoTurno
  promocion_id: string
  descuento: string
  sena: string
  notas: string
}

let contador = 0
const clave = () => `i${++contador}`

export function TurnoForm({ abierto, onCerrar, turnoId, fecha, hora, clientaId, onGuardado }: TurnoFormProps) {
  const { data: ajustes } = useAjustes()
  const servicios = useServicios(true)
  const promos = usePromociones()
  const existente = useTurno(turnoId)
  const guardar = useGuardarTurno()
  const [s, setS] = useState<Estado | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [libres, setLibres] = useState<string[] | null>(null)
  const [conflictos, setConflictos] = useState<Awaited<ReturnType<typeof conflictosHorario>>>([])
  const [personalizado, setPersonalizado] = useState(false)

  // Inicialización al abrir
  useEffect(() => {
    if (!abierto) {
      setS(null)
      return
    }
    if (turnoId) {
      if (!existente.data) return
      const { turno, items } = existente.data
      setS({
        clienta_id: turno.clienta_id,
        fecha: fechaISO(turno.inicio),
        hora: horaTexto(turno.inicio),
        items: items.map((i) => ({ servicio_id: i.servicio_id, nombre: i.nombre, precio: Number(i.precio), duracion_min: i.duracion_min, es_adicional: i.es_adicional, clave: clave() })),
        duracionManual: String(Math.round((new Date(turno.fin).getTime() - new Date(turno.inicio).getTime()) / 60000)),
        estado: turno.estado,
        promocion_id: turno.promocion_id ?? '',
        descuento: turno.descuento ? String(turno.descuento) : '',
        sena: turno.sena_esperada ? String(turno.sena_esperada) : '',
        notas: turno.notas ?? '',
      })
    } else {
      setS({
        clienta_id: clientaId ?? null,
        fecha: fecha ?? hoyISO(),
        hora: hora ?? '',
        items: [],
        duracionManual: '',
        estado: 'confirmado',
        promocion_id: '',
        descuento: '',
        sena: '',
        notas: '',
      })
    }
    setErrores({})
    setPersonalizado(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, turnoId, existente.data])

  const clienta = useClienta(s?.clienta_id ?? undefined)
  const subtotal = useMemo(() => s?.items.reduce((a, i) => a + Number(i.precio || 0), 0) ?? 0, [s?.items])
  const duracionItems = useMemo(() => s?.items.reduce((a, i) => a + Number(i.duracion_min || 0), 0) ?? 0, [s?.items])
  const duracion = s?.duracionManual ? Number(s.duracionManual) : duracionItems
  const descuento = s ? parseDinero(s.descuento) : 0
  const total = Math.max(subtotal - descuento, 0)

  // Seña sugerida según ajustes (solo si no la tocó)
  const senaSugerida = useMemo(() => {
    if (!ajustes?.sena_requerida) return 0
    return ajustes.sena_tipo === 'porcentaje' ? Math.round((total * Number(ajustes.sena_valor)) / 100) : Math.min(Number(ajustes.sena_valor), total)
  }, [ajustes, total])

  // Horarios libres del día para la duración elegida
  useEffect(() => {
    if (!s?.fecha || duracion <= 0) return setLibres(null)
    let vivo = true
    horariosLibres(s.fecha, duracion, turnoId).then((r) => vivo && setLibres(r)).catch(() => vivo && setLibres(null))
    return () => {
      vivo = false
    }
  }, [s?.fecha, duracion, turnoId])

  // Avisos de conflicto (no bloquean salvo superposición con otro turno)
  useEffect(() => {
    if (!s?.fecha || !s.hora || duracion <= 0) return setConflictos([])
    const t = setTimeout(() => {
      const ini = instante(s.fecha, s.hora)
      conflictosHorario(ini, new Date(ini.getTime() + duracion * 60000), turnoId).then(setConflictos).catch(() => setConflictos([]))
    }, 300)
    return () => clearTimeout(t)
  }, [s?.fecha, s?.hora, duracion, turnoId])

  const promosAplicables = useMemo(() => {
    if (!promos.data || !s) return []
    const hoy = s.fecha
    return promos.data.filter((p) => p.activa && p.fecha_inicio <= hoy && p.fecha_fin >= hoy)
  }, [promos.data, s])

  if (!abierto) return null
  const cargandoInicial = !s || (turnoId && existente.isLoading)

  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setS((x) => (x ? { ...x, [k]: v } : x))

  const alternarServicio = (sv: Servicio) => {
    if (!s) return
    const ya = s.items.find((i) => i.servicio_id === sv.id)
    if (ya) set('items', s.items.filter((i) => i !== ya))
    else
      set('items', [
        ...s.items,
        { servicio_id: sv.id, nombre: sv.nombre, precio: Number(sv.precio), duracion_min: sv.duracion_min, es_adicional: sv.es_adicional, clave: clave() },
      ])
  }

  const aplicarPromo = (p: Promocion | undefined) => {
    if (!s) return
    if (!p) return setS({ ...s, promocion_id: '', descuento: '' })
    const ids = p.promocion_servicios?.map((x) => x.servicio_id) ?? []
    const base = ids.length ? s.items.filter((i) => i.servicio_id && ids.includes(i.servicio_id)).reduce((a, i) => a + i.precio, 0) : subtotal
    let d = 0
    if (p.tipo === 'porcentaje') d = Math.round((base * Number(p.valor)) / 100)
    else d = Math.min(Number(p.valor), subtotal)
    if (p.tipo === 'combo' && ids.length && !ids.every((id) => s.items.some((i) => i.servicio_id === id))) {
      toast.warning('Este combo requiere todos sus servicios. Revisá el descuento.')
    }
    setS({ ...s, promocion_id: p.id, descuento: String(d) })
  }

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!s) return
    const e: Record<string, string> = {}
    if (!s.clienta_id && !turnoId) e.clienta = 'Elegí o registrá la clienta.'
    if (!s.items.length) e.items = 'Agregá al menos un servicio.'
    if (!s.fecha) e.fecha = 'Elegí la fecha.'
    if (!s.hora) e.hora = 'Elegí la hora.'
    if (duracion <= 0) e.duracion = 'La duración tiene que ser mayor a 0.'
    if (s.items.some((i) => !i.nombre.trim())) e.items = 'Cada servicio necesita un nombre.'
    setErrores(e)
    if (Object.keys(e).length) return
    try {
      const id = await guardar.mutateAsync({
        id: turnoId,
        clienta_id: s.clienta_id,
        inicio: instante(s.fecha, s.hora),
        items: s.items.map(({ clave: _c, ...i }) => i),
        duracion_min: s.duracionManual ? Number(s.duracionManual) : null,
        estado: s.estado,
        descuento,
        promocion_id: s.promocion_id || null,
        sena_esperada: s.sena ? parseDinero(s.sena) : 0,
        notas: s.notas.trim() || null,
      })
      toast.success(turnoId ? 'Turno actualizado' : 'Turno agendado')
      onGuardado?.(id)
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  const principales = servicios.data?.filter((x) => !x.es_adicional) ?? []
  const adicionales = servicios.data?.filter((x) => x.es_adicional) ?? []
  const superpone = conflictos.some((c) => c.tipo === 'turno')
  const promoFidelidad = (p: Promocion) => p.min_visitas && (clienta.data?.visitas ?? 0) < p.min_visitas

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={turnoId ? 'Editar turno' : 'Nuevo turno'}
      ancho="lg"
      pie={
        <>
          <div className="mr-auto self-center text-sm text-gris">
            {duracion > 0 && <span>{duracionTexto(duracion)} · </span>}
            <span className="font-semibold text-tinta">{dinero(total)}</span>
          </div>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-turno" cargando={guardar.isPending} disabled={!!cargandoInicial || superpone}>
            {turnoId ? 'Guardar cambios' : 'Agendar'}
          </Button>
        </>
      }
    >
      {cargandoInicial ? (
        <p className="py-10 text-center text-gris">Cargando…</p>
      ) : (
        <form id="form-turno" onSubmit={enviar} className="space-y-6" noValidate>
          {/* Clienta */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gris">Clienta</h3>
            {turnoId && !s!.clienta_id && existente.data?.turno.solicitante_nombre && (
              <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Pedido web de <b>{existente.data.turno.solicitante_nombre}</b>
                {existente.data.turno.solicitante_whatsapp && ` · ${existente.data.turno.solicitante_whatsapp}`}
                {existente.data.turno.solicitante_instagram && ` · ${existente.data.turno.solicitante_instagram}`}. Vinculala con su ficha:
              </p>
            )}
            <ClientaPicker
              valor={s!.clienta_id}
              onChange={(id) => set('clienta_id', id)}
              error={errores.clienta}
              inicialNueva={
                existente.data?.turno
                  ? {
                      nombre: existente.data.turno.solicitante_nombre ?? undefined,
                      whatsapp: existente.data.turno.solicitante_whatsapp ?? undefined,
                      instagram: existente.data.turno.solicitante_instagram ?? undefined,
                    }
                  : undefined
              }
            />
          </section>

          {/* Servicios */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gris">Servicios</h3>
            {servicios.data && servicios.data.length === 0 && (
              <p className="mb-2 text-sm text-gris">Todavía no cargaste servicios activos. Podés agregar uno personalizado o cargarlos en “Servicios”.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {principales.map((sv) => (
                <ChipServicio key={sv.id} sv={sv} activo={s!.items.some((i) => i.servicio_id === sv.id)} onClick={() => alternarServicio(sv)} />
              ))}
            </div>
            {adicionales.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 text-xs font-medium text-gris">Adicionales</p>
                <div className="flex flex-wrap gap-2">
                  {adicionales.map((sv) => (
                    <ChipServicio key={sv.id} sv={sv} activo={s!.items.some((i) => i.servicio_id === sv.id)} onClick={() => alternarServicio(sv)} adicional />
                  ))}
                </div>
              </>
            )}
            {errores.items && <p className="mt-2 text-sm text-red-600">{errores.items}</p>}

            {s!.items.length > 0 && (
              <ul className="mt-4 divide-y divide-linea rounded-2xl border border-linea bg-white">
                {s!.items.map((it, idx) => (
                  <li key={it.clave} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    {it.servicio_id ? (
                      <span className="min-w-0 flex-1 text-[15px]">{it.nombre}</span>
                    ) : (
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-linea px-2 py-1.5"
                        value={it.nombre}
                        placeholder="Descripción"
                        onChange={(e) => set('items', s!.items.map((x, j) => (j === idx ? { ...x, nombre: e.target.value } : x)))}
                      />
                    )}
                    <label className="flex items-center gap-1 text-sm text-gris">
                      min
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-linea px-2 py-1.5 text-right text-tinta"
                        value={it.duracion_min}
                        onChange={(e) => set('items', s!.items.map((x, j) => (j === idx ? { ...x, duracion_min: Number(e.target.value) } : x)))}
                        aria-label="Duración en minutos"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-sm text-gris">
                      $
                      <input
                        inputMode="decimal"
                        className="w-24 rounded-lg border border-linea px-2 py-1.5 text-right text-tinta"
                        value={it.precio}
                        onChange={(e) => set('items', s!.items.map((x, j) => (j === idx ? { ...x, precio: parseDinero(e.target.value) } : x)))}
                        aria-label="Precio"
                      />
                    </label>
                    <button type="button" className="rounded-full p-1.5 text-gris hover:bg-red-50 hover:text-red-600" onClick={() => set('items', s!.items.filter((_, j) => j !== idx))} aria-label="Quitar">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!personalizado ? (
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-rosa-600 hover:underline" onClick={() => {
                setPersonalizado(true)
                set('items', [...s!.items, { servicio_id: null, nombre: '', precio: 0, duracion_min: 30, es_adicional: false, clave: clave() }])
              }}>
                <Plus className="size-4" /> Ítem personalizado
              </button>
            ) : null}
            <p className="mt-2 text-xs text-gris">El precio queda guardado en el turno: si después cambiás la lista de precios, este turno no se modifica.</p>
          </section>

          {/* Fecha y hora */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gris">Fecha y hora</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Input type="date" etiqueta="Fecha" value={s!.fecha} onChange={(e) => set('fecha', e.target.value)} error={errores.fecha} />
              <Input type="time" etiqueta="Hora" step={(ajustes?.intervalo_turnos_min ?? 30) * 60} value={s!.hora} onChange={(e) => set('hora', e.target.value)} error={errores.hora} />
              <Input
                type="number"
                inputMode="numeric"
                etiqueta="Duración (min)"
                placeholder={String(duracionItems || '')}
                value={s!.duracionManual}
                onChange={(e) => set('duracionManual', e.target.value)}
                error={errores.duracion}
                ayuda={s!.duracionManual ? 'Duración ajustada a mano' : 'Suma de los servicios'}
                contenedor="col-span-2 sm:col-span-1"
              />
            </div>
            {libres && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-gris">
                  {libres.length ? 'Horarios libres ese día (según tu horario de atención):' : 'No quedan horarios libres en tu horario de atención ese día. Igual podés elegir otra hora.'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {libres.map((l) => {
                    const h = horaTexto(l)
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => set('hora', h)}
                        className={clsx('rounded-full px-3 py-1 text-sm ring-1 transition', s!.hora === h ? 'bg-rosa-500 text-white ring-rosa-500' : 'bg-white text-tinta-soft ring-linea hover:ring-rosa-300')}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {conflictos.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {conflictos.map((c, i) => (
                  <li key={i} className={clsx('flex items-start gap-2 rounded-xl px-3 py-2 text-sm', c.tipo === 'turno' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}>
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {c.tipo === 'turno' && <>Se superpone con <b>{c.detalle}</b> ({horaTexto(c.inicio)}–{horaTexto(c.fin)}). Elegí otro horario.</>}
                      {c.tipo === 'bloqueo' && <>Ese horario está bloqueado: <b>{c.detalle}</b>. Podés agendarlo igual si querés.</>}
                      {c.tipo === 'fuera_de_horario' && <>{c.detalle}. Podés agendarlo igual si querés.</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Importes */}
          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gris sm:col-span-2">Precio, promo y seña</h3>
            {promosAplicables.length > 0 && (
              <Select
                etiqueta="Promoción"
                opcional
                value={s!.promocion_id}
                onChange={(e) => aplicarPromo(promosAplicables.find((p) => p.id === e.target.value))}
                ayuda="Se aplica solo si la elegís."
              >
                <option value="">Sin promoción</option>
                {promosAplicables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.tipo === 'porcentaje' ? `${p.valor}%` : dinero(p.valor)})
                    {promoFidelidad(p) ? ` · requiere ${p.min_visitas} visitas` : ''}
                  </option>
                ))}
              </Select>
            )}
            <Input etiqueta="Descuento" opcional inputMode="decimal" prefijo="$" value={s!.descuento} onChange={(e) => set('descuento', e.target.value)} />
            <Input
              etiqueta="Seña a pedir"
              opcional
              inputMode="decimal"
              prefijo="$"
              value={s!.sena}
              placeholder={senaSugerida ? String(senaSugerida) : '0'}
              onChange={(e) => set('sena', e.target.value)}
              ayuda={senaSugerida && !s!.sena ? (
                <button type="button" className="text-rosa-600 underline" onClick={() => set('sena', String(senaSugerida))}>
                  Usar seña configurada: {dinero(senaSugerida)}
                </button>
              ) : 'Los pagos se registran desde el detalle del turno.'}
            />
            <Select etiqueta="Estado" value={s!.estado} onChange={(e) => set('estado', e.target.value as EstadoTurno)}>
              <option value="confirmado">Confirmado</option>
              <option value="pendiente">Pendiente de confirmación</option>
              {turnoId && (
                <>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="no_asistio">No asistió</option>
                </>
              )}
            </Select>
            <div className="flex items-end justify-between rounded-2xl bg-nude-50 px-4 py-3 sm:col-span-2">
              <span className="text-sm text-gris">
                Subtotal {dinero(subtotal)}
                {descuento > 0 && <> · Descuento −{dinero(descuento)}</>}
              </span>
              <span className="titulo-display text-2xl">{dinero(total)}</span>
            </div>
            <Textarea contenedor="sm:col-span-2" etiqueta="Notas del turno" opcional rows={2} value={s!.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Diseño pedido, foto de referencia, etc." />
          </section>
        </form>
      )}
    </Modal>
  )
}

function ChipServicio({ sv, activo, onClick, adicional }: { sv: Servicio; activo: boolean; onClick: () => void; adicional?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={clsx(
        'rounded-2xl px-3 py-2 text-left text-sm ring-1 transition',
        activo ? 'bg-rosa-500 text-white ring-rosa-500' : 'bg-white text-tinta ring-linea hover:ring-rosa-300',
        adicional && !activo && 'bg-nude-50',
      )}
    >
      <span className="block font-medium">{adicional ? '+ ' : ''}{sv.nombre}</span>
      <span className={clsx('block text-xs', activo ? 'text-white/85' : 'text-gris')}>
        {dinero(sv.precio)} · {duracionTexto(sv.duracion_min)}
      </span>
    </button>
  )
}
