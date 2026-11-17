import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select, Toggle } from '@/components/ui/Campos'
import { useConfirmar } from '@/components/ui/Confirmar'
import { Modal } from '@/components/ui/Modal'
import { fechaISO, horaTexto, hoyISO, instante, sumarDias } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import type { Bloqueo } from '@/lib/types'
import { useBorrarBloqueo, useGuardarBloqueo } from './api'

interface Props {
  abierto: boolean
  onCerrar: () => void
  bloqueo?: Bloqueo | null
  fecha?: string
  hora?: string
}

const TIPOS: { valor: Bloqueo['tipo']; etiqueta: string }[] = [
  { valor: 'personal', etiqueta: 'Personal (yoga, trámite, sesión de fotos…)' },
  { valor: 'descanso', etiqueta: 'Descanso' },
  { valor: 'vacaciones', etiqueta: 'Vacaciones' },
  { valor: 'feriado', etiqueta: 'Feriado' },
  { valor: 'otro', etiqueta: 'Otro' },
]

/** Bloquear horarios, días completos o vacaciones: no se ofrecen en la web */
export function BloqueoForm({ abierto, onCerrar, bloqueo, fecha, hora }: Props) {
  const guardar = useGuardarBloqueo()
  const borrar = useBorrarBloqueo()
  const confirmar = useConfirmar()
  const [f, setF] = useState({ motivo: '', tipo: 'personal' as Bloqueo['tipo'], todo: false, desde: hoyISO(), hasta: hoyISO(), hIni: '09:00', hFin: '10:00' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setError('')
    if (bloqueo) {
      const finMenos = new Date(new Date(bloqueo.fin).getTime() - 1)
      setF({
        motivo: bloqueo.motivo ?? '',
        tipo: bloqueo.tipo,
        todo: bloqueo.todo_el_dia,
        desde: fechaISO(bloqueo.inicio),
        hasta: fechaISO(bloqueo.todo_el_dia ? finMenos : bloqueo.fin),
        hIni: horaTexto(bloqueo.inicio),
        hFin: horaTexto(bloqueo.fin),
      })
    } else {
      const h = hora ?? '09:00'
      const [hh, mm] = h.split(':').map(Number)
      const fin = `${String(Math.min(hh + 1, 23)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      setF({ motivo: '', tipo: 'personal', todo: !hora, desde: fecha ?? hoyISO(), hasta: fecha ?? hoyISO(), hIni: h, hFin: fin })
    }
  }, [abierto, bloqueo, fecha, hora])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    let inicio: Date, fin: Date
    if (f.todo) {
      if (f.hasta < f.desde) return setError('La fecha “hasta” no puede ser anterior a “desde”.')
      inicio = instante(f.desde, '00:00')
      fin = instante(sumarDias(f.hasta, 1), '00:00')
    } else {
      inicio = instante(f.desde, f.hIni)
      fin = instante(f.desde, f.hFin)
      if (fin <= inicio) return setError('La hora de fin tiene que ser posterior a la de inicio.')
    }
    try {
      await guardar.mutateAsync({
        id: bloqueo?.id,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        motivo: f.motivo.trim() || null,
        tipo: f.tipo,
        todo_el_dia: f.todo,
      })
      toast.success('Horario bloqueado')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={bloqueo ? 'Editar bloqueo' : 'Bloquear agenda'}
      subtitulo="En ese período no se ofrecen turnos en la web."
      pie={
        <>
          {bloqueo && (
            <Button
              variante="peligro"
              className="mr-auto"
              onClick={async () => {
                if (await confirmar({ titulo: '¿Quitar este bloqueo?', confirmar: 'Quitar', peligro: true })) {
                  await borrar.mutateAsync(bloqueo.id).catch((e) => toast.error(mensajeError(e)))
                  onCerrar()
                }
              }}
            >
              Quitar
            </Button>
          )}
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-bloqueo" cargando={guardar.isPending}>Guardar</Button>
        </>
      }
    >
      <form id="form-bloqueo" onSubmit={enviar} className="space-y-4" noValidate>
        <Input etiqueta="Motivo" opcional value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Ej: Yoga, vacaciones, curso" />
        <Select etiqueta="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Bloqueo['tipo'] })}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
          ))}
        </Select>
        <Toggle checked={f.todo} onChange={(v) => setF({ ...f, todo: v })} etiqueta="Días completos" descripcion="Para vacaciones o días sin atender." />
        {f.todo ? (
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" etiqueta="Desde" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value, hasta: f.hasta < e.target.value ? e.target.value : f.hasta })} />
            <Input type="date" etiqueta="Hasta" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input type="date" etiqueta="Día" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} contenedor="col-span-2 sm:col-span-1" />
            <Input type="time" etiqueta="De" value={f.hIni} onChange={(e) => setF({ ...f, hIni: e.target.value })} />
            <Input type="time" etiqueta="A" value={f.hFin} onChange={(e) => setF({ ...f, hFin: e.target.value })} />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
