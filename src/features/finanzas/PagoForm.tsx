import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { ClientaPicker } from '@/features/clientas/ClientaPicker'
import { fechaISO, hoyISO, instante } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, MEDIOS_PAGO, parseDinero } from '@/lib/formato'
import type { MedioPago, TurnoDetalle } from '@/lib/types'
import { useCreditos, useRegistrarPago } from './api'

interface Props {
  abierto: boolean
  onCerrar: () => void
  turno?: TurnoDetalle | null
  clientaId?: string | null
}

/** Registrar seña, pago parcial o total de un turno, o un ingreso suelto */
export function PagoForm({ abierto, onCerrar, turno, clientaId }: Props) {
  const registrar = useRegistrarPago()
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [credito, setCredito] = useState('')
  const [esSena, setEsSena] = useState(false)
  const [fecha, setFecha] = useState(hoyISO())
  const [concepto, setConcepto] = useState('')
  const [notas, setNotas] = useState('')
  const [clienta, setClienta] = useState<string | null>(null)
  const [error, setError] = useState('')
  const creditos = useCreditos({ conSaldo: true, clienta_id: turno?.clienta_id ?? clienta ?? undefined })

  useEffect(() => {
    if (!abierto) return
    const sinPagos = turno && Number(turno.pagado) === 0
    const sugerido = turno ? (sinPagos && turno.sena_esperada > 0 ? turno.sena_esperada : turno.saldo) : 0
    setMonto(sugerido ? String(sugerido) : '')
    setEsSena(!!(sinPagos && turno!.sena_esperada > 0 && turno!.estado !== 'finalizado'))
    setMedio('efectivo')
    setCredito('')
    setFecha(turno && new Date(turno.inicio) < new Date() ? fechaISO(turno.inicio) : hoyISO())
    setConcepto('')
    setNotas('')
    setClienta(clientaId ?? null)
    setError('')
  }, [abierto, turno, clientaId])

  const creditoElegido = creditos.data?.find((c) => c.id === credito)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const m = parseDinero(monto)
    if (m <= 0) return setError('Ingresá un importe mayor a 0.')
    if (medio === 'credito' && !credito) return setError('Elegí la gift card o el saldo a usar.')
    if (creditoElegido && m > Number(creditoElegido.saldo)) return setError(`El crédito tiene ${dinero(creditoElegido.saldo)} disponibles.`)
    if (!turno && !concepto.trim()) return setError('Escribí el concepto del ingreso.')
    try {
      await registrar.mutateAsync({
        turno_id: turno?.id ?? null,
        clienta_id: turno?.clienta_id ?? clienta,
        monto: m,
        medio,
        credito_id: medio === 'credito' ? credito : null,
        es_sena: esSena,
        concepto: concepto.trim() || null,
        notas: notas.trim() || null,
        fecha: fecha === hoyISO() ? new Date().toISOString() : instante(fecha, '12:00').toISOString(),
      })
      toast.success(esSena ? 'Seña registrada' : 'Pago registrado')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={turno ? 'Registrar pago' : 'Registrar ingreso'}
      subtitulo={turno ? `${turno.clienta_nombre ?? ''} · Total ${dinero(turno.total)} · Pagado ${dinero(turno.pagado)} · Falta ${dinero(turno.saldo)}` : 'Un ingreso que no corresponde a un turno (venta de producto, etc.).'}
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-pago" cargando={registrar.isPending}>Registrar</Button>
        </>
      }
    >
      <form id="form-pago" onSubmit={enviar} className="space-y-4" noValidate>
        {!turno && (
          <>
            <Input etiqueta="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: venta de aceite de cutículas" />
            <div>
              <p className="mb-1.5 text-sm font-medium text-tinta-soft">Clienta <span className="font-normal text-gris">(opcional)</span></p>
              <ClientaPicker valor={clienta} onChange={setClienta} />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input etiqueta="Importe" inputMode="decimal" prefijo="$" value={monto} onChange={(e) => setMonto(e.target.value)} error={error} />
          <Input etiqueta="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        {turno && turno.saldo > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {turno.sena_esperada > 0 && Number(turno.pagado) === 0 && (
              <button type="button" className="rounded-full bg-nude-100 px-3 py-1" onClick={() => { setMonto(String(turno.sena_esperada)); setEsSena(true) }}>
                Seña {dinero(turno.sena_esperada)}
              </button>
            )}
            <button type="button" className="rounded-full bg-nude-100 px-3 py-1" onClick={() => { setMonto(String(turno.saldo)); setEsSena(false) }}>
              Todo lo que falta ({dinero(turno.saldo)})
            </button>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-sm font-medium text-tinta-soft">Medio de pago</p>
          <div className="flex flex-wrap gap-2">
            {[...MEDIOS_PAGO, ...(turno ? [{ valor: 'credito' as const, etiqueta: 'Gift card / saldo a favor' }] : [])].map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setMedio(m.valor)}
                className={`rounded-full px-4 py-2 text-sm ring-1 transition ${medio === m.valor ? 'bg-tinta text-white ring-tinta' : 'bg-white ring-linea hover:ring-rosa-300'}`}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>
        </div>
        {medio === 'credito' && (
          <Select etiqueta="¿Qué crédito usa?" value={credito} onChange={(e) => setCredito(e.target.value)}>
            <option value="">Elegir…</option>
            {creditos.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tipo === 'gift_card' ? `Gift card ${c.codigo ?? ''} · ${c.beneficiaria_nombre ?? c.comprador_nombre ?? ''}` : `Saldo a favor · ${c.clienta_nombre ?? ''}`} — disponible {dinero(c.saldo)}
              </option>
            ))}
          </Select>
        )}
        {turno && <Checkbox etiqueta="Es la seña" checked={esSena} onChange={(e) => setEsSena(e.target.checked)} />}
        {medio === 'credito' && <p className="text-xs text-gris">El canje no cuenta como ingreso nuevo: la plata entró cuando se vendió la gift card o se dejó el saldo.</p>}
        <Textarea etiqueta="Observaciones" opcional rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </form>
    </Modal>
  )
}
