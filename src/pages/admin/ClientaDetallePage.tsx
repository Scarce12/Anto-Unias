import { Archive, ArrowLeft, CalendarPlus, MessageCircle, Pencil, PiggyBank, Star } from 'lucide-react'
import { Instagram } from '@/components/IconoInstagram'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAcciones } from '@/app/acciones'
import { MensajeWhatsApp } from '@/components/Mensajes'
import { Avatar, Badge, Cargando, Dato, ErrorCarga, Tarjeta } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { useConfirmar } from '@/components/ui/Confirmar'
import { useArchivarClienta, useClienta, useHistorialClienta } from '@/features/clientas/api'
import { ClientaForm } from '@/features/clientas/ClientaForm'
import { useCreditos } from '@/features/finanzas/api'
import { capitalizar, fmt, MESES } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, ESTADOS_PAGO, ESTADOS_TURNO, ETIQUETA_MEDIO, nombreCompleto } from '@/lib/formato'
import { linkInstagram } from '@/lib/telefono'

export function ClientaDetallePage() {
  const { id } = useParams()
  const c = useClienta(id)
  const h = useHistorialClienta(id)
  const creditos = useCreditos({ clienta_id: id })
  const archivar = useArchivarClienta()
  const confirmar = useConfirmar()
  const a = useAcciones()
  const [editar, setEditar] = useState(false)
  const [msg, setMsg] = useState(false)

  if (c.error) return <ErrorCarga error={c.error} reintentar={() => c.refetch()} />
  if (c.isLoading || !c.data) return <Cargando />
  const cl = c.data
  const turnos = h.data?.turnos ?? []
  const proximos = turnos.filter((t) => new Date(t.inicio) >= new Date() && (t.estado === 'pendiente' || t.estado === 'confirmado')).reverse()
  const pasados = turnos.filter((t) => !proximos.includes(t))
  const conteoServicios = new Map<string, number>()
  turnos.filter((t) => t.estado === 'finalizado').forEach((t) => t.servicios_texto.split(' + ').forEach((s) => conteoServicios.set(s, (conteoServicios.get(s) ?? 0) + 1)))
  const favoritos = [...conteoServicios.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)
  const insta = linkInstagram(cl.instagram)
  const saldosCliente = creditos.data?.filter((x) => x.clienta_id === cl.id && !x.anulado) ?? []

  return (
    <div className="space-y-5">
      <Link to="/admin/clientas" className="inline-flex items-center gap-1 text-sm text-gris hover:text-tinta">
        <ArrowLeft className="size-4" /> Clientas
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar nombre={nombreCompleto(cl)} className="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="titulo-display flex items-center gap-2 text-3xl sm:text-4xl">
            {nombreCompleto(cl)} {cl.es_fija && <Star className="size-5 fill-rosa-400 text-rosa-400" aria-label="Clienta fija" />}
          </h1>
          <p className="text-sm text-gris">
            Registrada el {fmt(cl.creada_en, "d 'de' MMMM yyyy")}{cl.origen === 'web' ? ' · desde la web' : ''}
            {!cl.activa && ' · archivada'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icono={<CalendarPlus className="size-4" />} onClick={() => a.nuevoTurno({ clientaId: cl.id })}>Turno</Button>
          <Button variante="secundario" icono={<MessageCircle className="size-4" />} onClick={() => setMsg(true)}>Mensaje</Button>
          <Button variante="secundario" icono={<Pencil className="size-4" />} onClick={() => setEditar(true)}>Editar</Button>
        </div>
      </div>

      {cl.alergias && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"><b>Alergias / cuidados:</b> {cl.alergias}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini etiqueta="Visitas" valor={cl.visitas} />
        <Mini etiqueta="Última visita" valor={cl.ultima_visita ? fmt(cl.ultima_visita, 'd/MM/yy') : '—'} />
        <Mini etiqueta="Inasistencias" valor={cl.inasistencias} alerta={cl.inasistencias > 0} />
        <Mini etiqueta={cl.deuda > 0 ? 'Debe' : 'Saldo a favor'} valor={dinero(cl.deuda > 0 ? cl.deuda : cl.saldo_a_favor)} alerta={cl.deuda > 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Tarjeta className="p-5">
            <h2 className="titulo-display mb-2 text-xl">Contacto</h2>
            <Dato etiqueta="WhatsApp" valor={cl.whatsapp ?? '—'} />
            <Dato etiqueta="Instagram" valor={insta ? <a href={insta} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rosa-600 hover:underline"><Instagram className="size-4" />{cl.instagram}</a> : '—'} />
            <Dato etiqueta="Cumpleaños" valor={cl.cumple_dia ? `${cl.cumple_dia} de ${MESES[cl.cumple_mes! - 1].toLowerCase()}${cl.cumple_anio ? ` (${cl.cumple_anio})` : ''}` : '—'} />
            {cl.proximo_turno && <Dato etiqueta="Próximo turno" valor={capitalizar(fmt(cl.proximo_turno, "EEE d/MM HH:mm"))} />}
          </Tarjeta>
          <Tarjeta className="p-5">
            <h2 className="titulo-display mb-2 text-xl">Observaciones</h2>
            <p className="whitespace-pre-wrap text-[15px] text-tinta-soft">{cl.observaciones || 'Sin observaciones. Podés anotar colores, diseños favoritos, forma y largo.'}</p>
            {favoritos.length > 0 && (
              <>
                <p className="mb-1.5 mt-4 text-sm font-medium text-gris">Lo que más se hace</p>
                <div className="flex flex-wrap gap-1.5">
                  {favoritos.map(([s, n]) => <Badge key={s}>{s} · {n}</Badge>)}
                </div>
              </>
            )}
          </Tarjeta>
          <Tarjeta className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="titulo-display text-xl">Saldo a favor</h2>
              <Button tamano="sm" variante="secundario" icono={<PiggyBank className="size-4" />} onClick={() => a.nuevoCredito('saldo_a_favor', cl.id)}>Agregar</Button>
            </div>
            {saldosCliente.length === 0 ? <p className="text-sm text-gris">No tiene saldo a favor.</p> : (
              <ul className="space-y-1 text-sm">
                {saldosCliente.map((s) => (
                  <li key={s.id} className="flex justify-between"><span>{fmt(s.fecha, 'd/MM/yy')} · {s.tipo === 'gift_card' ? `Gift card ${s.codigo ?? ''}` : 'Saldo'}</span><span>{dinero(s.saldo)} de {dinero(s.monto)}</span></li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <button
            className="inline-flex items-center gap-2 text-sm text-gris hover:text-tinta"
            onClick={async () => {
              const ok = await confirmar({
                titulo: cl.activa ? '¿Archivar esta clienta?' : '¿Volver a activarla?',
                mensaje: cl.activa ? 'No se borra nada: deja de aparecer en la lista y en los avisos. Podés reactivarla cuando quieras.' : undefined,
                confirmar: cl.activa ? 'Archivar' : 'Activar',
              })
              if (ok) archivar.mutate({ id: cl.id, activa: !cl.activa }, { onSuccess: () => toast.success('Listo'), onError: (e) => toast.error(mensajeError(e)) })
            }}
          >
            <Archive className="size-4" /> {cl.activa ? 'Archivar clienta' : 'Reactivar clienta'}
          </button>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {proximos.length > 0 && (
            <Tarjeta className="p-5">
              <h2 className="titulo-display mb-2 text-xl">Próximos turnos</h2>
              <TablaTurnos turnos={proximos} onClick={a.verTurno} />
            </Tarjeta>
          )}
          <Tarjeta className="p-5">
            <h2 className="titulo-display mb-2 text-xl">Historial de turnos</h2>
            {h.isLoading ? <Cargando /> : pasados.length === 0 ? <p className="text-sm text-gris">Sin turnos anteriores.</p> : <TablaTurnos turnos={pasados} onClick={a.verTurno} />}
          </Tarjeta>
          <Tarjeta className="p-5">
            <h2 className="titulo-display mb-2 text-xl">Pagos</h2>
            {!h.data?.pagos.length ? <p className="text-sm text-gris">Sin pagos registrados.</p> : (
              <ul className="divide-y divide-linea text-sm">
                {h.data.pagos.map((p) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <span>{fmt(p.fecha, 'd/MM/yy')} · {ETIQUETA_MEDIO[p.medio]}{p.es_sena ? ' · seña' : ''}{p.concepto ? ` · ${p.concepto}` : ''}</span>
                    <span className="font-medium">{dinero(p.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>

      <ClientaForm abierto={editar} onCerrar={() => setEditar(false)} clienta={cl} />
      {msg && <MensajeWhatsApp abierto onCerrar={() => setMsg(false)} tipo={cl.deuda > 0 ? 'saldo' : 'libre'} telefono={cl.whatsapp} variables={{ nombre: cl.nombre, saldo: dinero(cl.deuda) }} />}
    </div>
  )
}

function Mini({ etiqueta, valor, alerta }: { etiqueta: string; valor: React.ReactNode; alerta?: boolean }) {
  return (
    <div className={`tarjeta p-4 ${alerta ? 'border-rosa-200 bg-rosa-50/50' : ''}`}>
      <p className="text-sm text-gris">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold">{valor}</p>
    </div>
  )
}

function TablaTurnos({ turnos, onClick }: { turnos: import('@/lib/types').TurnoDetalle[]; onClick: (id: string) => void }) {
  return (
    <ul className="divide-y divide-linea">
      {turnos.map((t) => (
        <li key={t.id}>
          <button onClick={() => onClick(t.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left hover:bg-nude-50/60">
            <span className="w-28 shrink-0 text-sm font-medium">{fmt(t.inicio, "d/MM/yy HH:mm")}</span>
            <span className={`min-w-0 flex-1 truncate text-sm ${t.estado === 'cancelado' ? 'line-through opacity-60' : ''}`}>{t.servicios_texto}</span>
            <span className="text-sm">{dinero(t.total)}</span>
            <Badge className={ESTADOS_TURNO[t.estado].clase}>{ESTADOS_TURNO[t.estado].etiqueta}</Badge>
            {t.estado !== 'cancelado' && <Badge className={ESTADOS_PAGO[t.estado_pago].clase}>{ESTADOS_PAGO[t.estado_pago].etiqueta}</Badge>}
          </button>
          {t.nota_estado && <p className="pb-2 text-xs text-gris">{t.nota_estado}</p>}
        </li>
      ))}
    </ul>
  )
}
