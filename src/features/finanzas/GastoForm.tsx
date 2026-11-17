import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { hoyISO } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { MEDIOS_PAGO, parseDinero } from '@/lib/formato'
import type { Gasto, MedioPago } from '@/lib/types'
import { useCategoriasGasto, useGuardarGasto } from './api'

export function GastoForm({ abierto, onCerrar, gasto }: { abierto: boolean; onCerrar: () => void; gasto?: Gasto | null }) {
  const cats = useCategoriasGasto()
  const guardar = useGuardarGasto()
  const [f, setF] = useState({ descripcion: '', categoria_id: '', monto: '', fecha: hoyISO(), medio: 'efectivo' as MedioPago, notas: '' })
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!abierto) return
    setErrores({})
    setF(
      gasto
        ? { descripcion: gasto.descripcion, categoria_id: gasto.categoria_id ?? '', monto: String(gasto.monto), fecha: gasto.fecha, medio: gasto.medio, notas: gasto.notas ?? '' }
        : { descripcion: '', categoria_id: '', monto: '', fecha: hoyISO(), medio: 'efectivo', notas: '' },
    )
  }, [abierto, gasto])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const er: Record<string, string> = {}
    if (!f.descripcion.trim()) er.descripcion = 'Escribí qué compraste o pagaste.'
    if (parseDinero(f.monto) <= 0) er.monto = 'Ingresá el importe.'
    setErrores(er)
    if (Object.keys(er).length) return
    try {
      await guardar.mutateAsync({
        id: gasto?.id,
        descripcion: f.descripcion.trim(),
        categoria_id: f.categoria_id || null,
        monto: parseDinero(f.monto),
        fecha: f.fecha,
        medio: f.medio,
        notas: f.notas.trim() || null,
      })
      toast.success('Gasto guardado')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={gasto ? 'Editar gasto' : 'Registrar gasto'}
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-gasto" cargando={guardar.isPending}>Guardar</Button>
        </>
      }
    >
      <form id="form-gasto" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input contenedor="sm:col-span-2" etiqueta="Descripción" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} error={errores.descripcion} placeholder="Ej: 6 esmaltes semi, limas" />
        <Input etiqueta="Importe" inputMode="decimal" prefijo="$" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} error={errores.monto} />
        <Input etiqueta="Fecha" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        <Select etiqueta="Categoría" value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
          <option value="">Sin categoría</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}{c.es_insumo ? ' (insumo)' : ''}</option>
          ))}
        </Select>
        <Select etiqueta="Medio de pago" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value as MedioPago })}>
          {MEDIOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </Select>
        <Textarea contenedor="sm:col-span-2" etiqueta="Observaciones" opcional rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
      </form>
    </Modal>
  )
}
