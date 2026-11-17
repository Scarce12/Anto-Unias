import { AlertTriangle, CalendarClock, Check, CheckCheck, Pencil, Plus, Trash2, UserX, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MensajesTurno } from '@/components/Mensajes'
import { Badge, Cargando, Dato } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Campos'
import { useConfirmar } from '@/components/ui/Confirmar'
import { Modal } from '@/components/ui/Modal'
import { useBorrarPago } from '@/features/finanzas/api'
import { PagoForm } from '@/features/finanzas/PagoForm'
import { capitalizar, duracionTexto, fmt, horaTexto } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, ESTADOS_PAGO, ESTADOS_TURNO, ETIQUETA_MEDIO } from '@/lib/formato'
import type { EstadoTurno } from '@/lib/types'
import { useBorrarTurno, useCambiarEstado, useMarcarMensaje, useTurno } from './api'

interface Props {
  turnoId: string | null
  onCerrar: () => void
  onEditar: (id: string) => void
}

export function TurnoDetalle({ turnoId, onCerrar, onEditar }: Props) {
  const q = useTurno(turnoId)
  const cambiar = useCambiarEstado()
  const marcar = useMarcarMensaje()
  const borrarPago = useBorrarPago()
  const borrarTurno = useBorrarTurno()
  const confirmar = useConfirmar()
  const [pago, setPago] = useState(false)
  const [notaEstado, setNotaEstado] = useState<{ estado: EstadoTurno; texto: string } | null>(null)

  const t = q.data?.turno

  const cambiarEstado = async (estado: EstadoTurno, nota?: string | null) => {
    if (!t) return
    try {
      await cambiar.mutateAsync({ id: t.id, estado, nota })
      toast.success(`Turno ${ESTADOS_TURNO[estado].etiqueta.toLowerCase()}`)
      setNotaEstado(null)
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  const eliminar = async () => {
    if (!t) return
    const ok = await confirmar({
      titulo: '¿Eliminar este turno?',
      mensaje: q.data?.pagos.length
        ? 'Tiene pagos registrados, así que no se puede eliminar. Cancelalo en su lugar.'
        : 'Se borra definitivamente. Si la clienta canceló, mejor marcalo como “Cancelado” así queda en el historial.',
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok || q.data?.pagos.length) return
    try {
      await borrarTurno.mutateAsync(t.id)
      toast.success('Turno eliminado')
      onCerrar()
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  const activo = t && (t.estado === 'pendiente' || t.estado === 'confirmado')

  return (
    <Modal abierto={!!turnoId} onCerrar={onCerrar} titulo={t ? t.clienta_nombre ?? 'Turno' : 'Turno'} subtitulo={t && capitalizar(fmt(t.inicio, "EEEE d 'de' MMMM"))} ancho="lg">
      {q.isLoading || !t ? (
        <Cargando />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={ESTADOS_TURNO[t.estado].clase}>{ESTADOS_TURNO[t.estado].etiqueta}</Badge>
            <Badge className={ESTADOS_PAGO[t.estado_pago].clase}>{ESTADOS_PAGO[t.estado_pago].etiqueta}</Badge>
            {t.origen === 'web' && <Badge>Pedido desde la web</Badge>}
            {t.clienta_fija && <Badge className="bg-rosa-50 text-rosa-700 ring-rosa-200">Clienta fija</Badge>}
          </div>

          {t.clienta_alergias && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {t.clienta_alergias}
            </p>
          )}

          {!t.clienta_id && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este pedido todavía no está vinculado a una ficha de clienta. Tocá <b>Editar</b> para elegir una existente o registrarla.
            </div>
          )}

          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <Dato etiqueta="Horario" valor={`${horaTexto(t.inicio)} a ${horaTexto(t.fin)}`} />
              <Dato etiqueta="Duración" valor={duracionTexto(Math.round((+new Date(t.fin) - +new Date(t.inicio)) / 60000))} />
              <Dato etiqueta="Servicios" valor={t.servicios_texto || '—'} />
              {(t.contacto_whatsapp || t.contacto_instagram) && <Dato etiqueta="Contacto" valor={[t.contacto_whatsapp, t.contacto_instagram].filter(Boolean).join(' · ')} />}
              {t.clienta_id && (
                <Link to={`/admin/clientas/${t.clienta_id}`} onClick={onCerrar} className="mt-1 inline-block text-sm text-rosa-600 hover:underline">
                  Ver ficha de la clienta →
                </Link>
              )}
            </div>
            <div>
              {t.descuento > 0 && <Dato etiqueta="Subtotal" valor={dinero(t.subtotal)} />}
              {t.descuento > 0 && <Dato etiqueta="Descuento" valor={`−${dinero(t.descuento)}`} />}
              <Dato etiqueta="Total" valor={dinero(t.total)} />
              {t.sena_esperada > 0 && <Dato etiqueta="Seña pedida" valor={`${dinero(t.sena_esperada)}${t.sena_pagada >= t.sena_esperada ? ' ✓' : ''}`} />}
              <Dato etiqueta="Pagado" valor={dinero(t.pagado)} />
              <Dato etiqueta="Falta pagar" valor={<span className={t.saldo > 0 ? 'text-rosa-700' : ''}>{dinero(t.saldo)}</span>} />
            </div>
          </div>

          {t.solicitante_nota && <p className="rounded-xl bg-nude-50 px-3 py-2 text-sm"><b>Nota de la clienta:</b> {t.solicitante_nota}</p>}
          {t.notas && <p className="rounded-xl bg-nude-50 px-3 py-2 text-sm"><b>Notas:</b> {t.notas}</p>}
          {t.nota_estado && <p className="rounded-xl bg-nude-50 px-3 py-2 text-sm"><b>{t.estado === 'no_asistio' ? 'Inasistencia' : 'Motivo'}:</b> {t.nota_estado}</p>}

          {/* Acciones de estado */}
          <div className="flex flex-wrap gap-2">
            {t.estado === 'pendiente' && (
              <Button icono={<Check className="size-4" />} onClick={() => cambiarEstado('confirmado')} cargando={cambiar.isPending} disabled={!t.clienta_id} title={!t.clienta_id ? 'Primero vinculá la clienta' : undefined}>
                Confirmar
              </Button>
            )}
            {activo && (
              <Button variante="oscuro" icono={<CheckCheck className="size-4" />} onClick={() => cambiarEstado('finalizado')} cargando={cambiar.isPending}>
                Finalizado
              </Button>
            )}
            <Button variante="secundario" icono={<Pencil className="size-4" />} onClick={() => onEditar(t.id)}>
              {activo ? 'Editar / reprogramar' : 'Editar'}
            </Button>
            {activo && (
              <>
                <Button variante="secundario" icono={<UserX className="size-4" />} onClick={() => setNotaEstado({ estado: 'no_asistio', texto: '' })}>
                  No asistió
                </Button>
                <Button variante="peligro" icono={<X className="size-4" />} onClick={() => setNotaEstado({ estado: 'cancelado', texto: '' })}>
                  Cancelar turno
                </Button>
              </>
            )}
            {(t.estado === 'cancelado' || t.estado === 'no_asistio') && (
              <Button variante="secundario" icono={<CalendarClock className="size-4" />} onClick={() => cambiarEstado('confirmado')}>
                Reactivar
              </Button>
            )}
          </div>

          {notaEstado && (
            <div className="rounded-2xl border border-linea bg-white p-4">
              <Textarea
                etiqueta={notaEstado.estado === 'cancelado' ? 'Motivo de la cancelación' : 'Observación de la inasistencia'}
                opcional
                rows={2}
                value={notaEstado.texto}
                onChange={(e) => setNotaEstado({ ...notaEstado, texto: e.target.value })}
              />
              {notaEstado.estado === 'no_asistio' && t.sena_pagada > 0 && (
                <p className="mt-2 text-sm text-gris">Había dejado una seña de {dinero(t.sena_pagada)}: queda registrada.</p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button variante="secundario" tamano="sm" onClick={() => setNotaEstado(null)}>Volver</Button>
                <Button variante={notaEstado.estado === 'cancelado' ? 'peligro' : 'oscuro'} tamano="sm" cargando={cambiar.isPending} onClick={() => cambiarEstado(notaEstado.estado, notaEstado.texto.trim() || null)}>
                  {notaEstado.estado === 'cancelado' ? 'Cancelar turno' : 'Registrar inasistencia'}
                </Button>
              </div>
            </div>
          )}

          {/* Pagos */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gris">Pagos</h3>
              <Button tamano="sm" variante="secundario" icono={<Plus className="size-4" />} onClick={() => setPago(true)}>
                {Number(t.pagado) === 0 && t.sena_esperada > 0 ? 'Registrar seña' : 'Registrar pago'}
              </Button>
            </div>
            {q.data!.pagos.length === 0 ? (
              <p className="text-sm text-gris">Todavía no hay pagos.</p>
            ) : (
              <ul className="divide-y divide-linea rounded-2xl border border-linea bg-white">
                {q.data!.pagos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="flex-1">
                      <span className="font-medium">{dinero(p.monto)}</span> · {ETIQUETA_MEDIO[p.medio]}
                      {p.es_sena && <Badge className="ml-2 bg-violet-50 text-violet-800 ring-violet-200">Seña</Badge>}
                      <span className="block text-xs text-gris">{fmt(p.fecha, "d/MM/yyyy HH:mm")}{p.notas ? ` · ${p.notas}` : ''}</span>
                    </span>
                    <button
                      type="button"
                      aria-label="Borrar pago"
                      className="rounded-full p-1.5 text-gris hover:bg-red-50 hover:text-red-600"
                      onClick={async () => {
                        if (await confirmar({ titulo: '¿Borrar este pago?', mensaje: `${dinero(p.monto)} en ${ETIQUETA_MEDIO[p.medio]}. Se descuenta de los ingresos.`, confirmar: 'Borrar', peligro: true })) {
                          borrarPago.mutate(p.id, { onError: (e) => toast.error(mensajeError(e)) })
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* WhatsApp */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gris">Mensajes</h3>
            <MensajesTurno
              turno={t}
              onMarcar={(tipo) => {
                if (tipo === 'confirmacion') marcar.mutate({ id: t.id, campo: 'confirmacion_enviada_en' })
                if (tipo === 'recordatorio') marcar.mutate({ id: t.id, campo: 'recordatorio_enviado_en' })
              }}
            />
            <p className="mt-2 text-xs text-gris">
              {t.confirmacion_enviada_en && `Confirmación enviada ${fmt(t.confirmacion_enviada_en, "d/MM HH:mm")}. `}
              {t.recordatorio_enviado_en && `Recordatorio enviado ${fmt(t.recordatorio_enviado_en, "d/MM HH:mm")}.`}
            </p>
          </section>

          <div className="border-t border-linea pt-3">
            <button type="button" onClick={eliminar} className="text-sm text-gris hover:text-red-600">
              Eliminar turno
            </button>
          </div>
        </div>
      )}
      <PagoForm abierto={pago} onCerrar={() => setPago(false)} turno={t} />
    </Modal>
  )
}
