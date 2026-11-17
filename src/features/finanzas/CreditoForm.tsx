import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { ClientaPicker } from '@/features/clientas/ClientaPicker'
import { mensajeError } from '@/lib/errores'
import { MEDIOS_PAGO, parseDinero } from '@/lib/formato'
import type { MedioPago } from '@/lib/types'
import { useCrearCredito } from './api'

function codigoNuevo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'GC-' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => letras[b % letras.length]).join('')
}

/** Vender una gift card o dejar saldo a favor a una clienta (la plata entra hoy) */
export function CreditoForm({ abierto, onCerrar, tipo, clientaId }: { abierto: boolean; onCerrar: () => void; tipo: 'gift_card' | 'saldo_a_favor'; clientaId?: string | null }) {
  const crear = useCrearCredito()
  const [f, setF] = useState({ codigo: '', comprador: '', beneficiaria: '', monto: '', medio: 'efectivo' as MedioPago, vence: '', notas: '' })
  const [clienta, setClienta] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setF({ codigo: tipo === 'gift_card' ? codigoNuevo() : '', comprador: '', beneficiaria: '', monto: '', medio: 'efectivo', vence: '', notas: '' })
    setClienta(clientaId ?? null)
    setError('')
  }, [abierto, tipo, clientaId])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (parseDinero(f.monto) <= 0) return setError('Ingresá el importe.')
    if (tipo === 'saldo_a_favor' && !clienta) return setError('Elegí la clienta.')
    try {
      await crear.mutateAsync({
        tipo,
        codigo: tipo === 'gift_card' ? f.codigo.trim() || null : null,
        clienta_id: clienta,
        comprador_nombre: f.comprador.trim() || null,
        beneficiaria_nombre: f.beneficiaria.trim() || null,
        monto: parseDinero(f.monto),
        medio: f.medio,
        vence: f.vence || null,
        notas: f.notas.trim() || null,
      })
      toast.success(tipo === 'gift_card' ? 'Gift card registrada' : 'Saldo a favor registrado')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={tipo === 'gift_card' ? 'Vender gift card' : 'Saldo a favor'}
      subtitulo={tipo === 'gift_card' ? 'Se cuenta como ingreso hoy. Cuando la usen, el canje no se vuelve a contar.' : 'Plata que la clienta dejó de más o adelantó. Se descuenta en sus próximos turnos.'}
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-credito" cargando={crear.isPending}>Guardar</Button>
        </>
      }
    >
      <form id="form-credito" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        {tipo === 'gift_card' && (
          <>
            <Input etiqueta="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })} />
            <Input etiqueta="Vence" opcional type="date" value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })} />
            <Input etiqueta="Quién la compra" opcional value={f.comprador} onChange={(e) => setF({ ...f, comprador: e.target.value })} />
            <Input etiqueta="Para quién es" opcional value={f.beneficiaria} onChange={(e) => setF({ ...f, beneficiaria: e.target.value })} />
          </>
        )}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-tinta-soft">
            Clienta {tipo === 'gift_card' && <span className="font-normal text-gris">(opcional, si ya está registrada)</span>}
          </p>
          <ClientaPicker valor={clienta} onChange={setClienta} />
        </div>
        <Input etiqueta="Importe" inputMode="decimal" prefijo="$" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} error={error} />
        <Select etiqueta="¿Cómo pagó?" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value as MedioPago })}>
          {MEDIOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </Select>
        <Textarea contenedor="sm:col-span-2" etiqueta="Observaciones" opcional rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
      </form>
    </Modal>
  )
}
