import { AlertTriangle, UserCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea, Toggle } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { MESES } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { nombreCompleto } from '@/lib/formato'
import { telefonoValido } from '@/lib/telefono'
import type { Clienta, PosibleDuplicada } from '@/lib/types'
import { buscarDuplicadas, useGuardarClienta, type ClientaInput } from './api'

const VACIA: ClientaInput = {
  nombre: '', apellido: '', whatsapp: '', instagram: '', cumple_dia: null, cumple_mes: null, cumple_anio: null,
  es_fija: false, alergias: '', observaciones: '',
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  clienta?: Clienta | null
  /** Valores iniciales (p.ej. al crear desde una reserva web) */
  inicial?: Partial<ClientaInput>
  onGuardada?: (c: Clienta) => void
  /** Si se detecta una coincidencia, permite elegir la existente en lugar de crear */
  onElegirExistente?: (id: string) => void
}

export function ClientaForm({ abierto, onCerrar, clienta, inicial, onGuardada, onElegirExistente }: Props) {
  const [f, setF] = useState<ClientaInput>(VACIA)
  const [errores, setErrores] = useState<Partial<Record<keyof ClientaInput, string>>>({})
  const [dups, setDups] = useState<PosibleDuplicada[]>([])
  const [confirmado, setConfirmado] = useState(false)
  const guardar = useGuardarClienta()

  // Se reinicia solo al abrir (no en cada render del padre)
  useEffect(() => {
    if (!abierto) return
    setF(clienta ? { ...VACIA, ...pick(clienta) } : { ...VACIA, ...inicial })
    setErrores({})
    setDups([])
    setConfirmado(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, clienta?.id])

  // Busca posibles duplicadas mientras escribe (con pausa)
  const clave = `${f.nombre}|${f.apellido}|${f.whatsapp}|${f.instagram}`
  useEffect(() => {
    if (!abierto) return
    const t = setTimeout(async () => {
      if ((f.nombre?.trim().length ?? 0) < 2 && !f.whatsapp && !f.instagram) return setDups([])
      try {
        setDups(await buscarDuplicadas(f, clienta?.id))
        setConfirmado(false)
      } catch {
        /* sin bloquear el formulario */
      }
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, abierto])

  const bloqueantes = useMemo(() => dups.filter((d) => d.bloqueante), [dups])
  const set = <K extends keyof ClientaInput>(k: K, v: ClientaInput[K]) => setF((x) => ({ ...x, [k]: v }))

  const validar = () => {
    const e: typeof errores = {}
    if (!f.nombre.trim()) e.nombre = 'Poné al menos el nombre (o cómo la conocés).'
    if (f.whatsapp && !telefonoValido(f.whatsapp)) e.whatsapp = 'El número no parece válido. Ej: 11 2345-6789'
    if ((f.cumple_dia && !f.cumple_mes) || (!f.cumple_dia && f.cumple_mes)) e.cumple_dia = 'Completá día y mes del cumpleaños.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validar()) return
    if (bloqueantes.length) return
    if (dups.length && !confirmado && !clienta) {
      setConfirmado(true)
      return
    }
    try {
      const c = await guardar.mutateAsync({ id: clienta?.id, ...f, nombre: f.nombre.trim() })
      toast.success(clienta ? 'Datos actualizados' : `${nombreCompleto(c)} quedó registrada`)
      onGuardada?.(c)
      onCerrar()
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={clienta ? 'Editar clienta' : 'Nueva clienta'}
      subtitulo="Solo el nombre es obligatorio. El resto lo podés completar después."
      ancho="lg"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-clienta" cargando={guardar.isPending} disabled={bloqueantes.length > 0}>
            {dups.length && confirmado && !clienta ? 'Es otra persona, guardar' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-clienta" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input etiqueta="Nombre" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} error={errores.nombre} autoComplete="off" placeholder="Ej: Camila" />
        <Input etiqueta="Apellido" opcional value={f.apellido ?? ''} onChange={(e) => set('apellido', e.target.value)} autoComplete="off" />
        <Input
          etiqueta="WhatsApp"
          opcional
          type="tel"
          inputMode="tel"
          value={f.whatsapp ?? ''}
          onChange={(e) => set('whatsapp', e.target.value)}
          error={errores.whatsapp}
          placeholder="11 2345-6789"
          ayuda="Con código de área, sin 0 ni 15 (igual lo corregimos solo)."
        />
        <Input etiqueta="Instagram" opcional value={f.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@usuario" autoCapitalize="none" />

        {dups.length > 0 && (
          <div className={`sm:col-span-2 rounded-2xl border p-4 ${bloqueantes.length ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
            <p className="flex items-center gap-2 text-sm font-medium text-tinta">
              <AlertTriangle className={`size-4 ${bloqueantes.length ? 'text-red-500' : 'text-amber-500'}`} />
              {bloqueantes.length
                ? 'Ese WhatsApp o Instagram ya pertenece a otra clienta.'
                : '¿Es alguna de estas clientas? Revisá antes de crear otra ficha.'}
            </p>
            <ul className="mt-3 space-y-2">
              {dups.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-linea">
                  <div className="min-w-0">
                    <p className="font-medium">{nombreCompleto(d)}</p>
                    <p className="text-xs text-gris">{[d.whatsapp, d.instagram].filter(Boolean).join(' · ') || 'Sin contacto'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={d.bloqueante ? 'bg-red-50 text-red-700 ring-red-200' : undefined}>{d.motivo}</Badge>
                    {onElegirExistente && (
                      <Button tamano="sm" variante="secundario" icono={<UserCheck className="size-4" />} onClick={() => { onElegirExistente(d.id); onCerrar() }}>
                        Es ella
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {!bloqueantes.length && confirmado && (
              <p className="mt-3 text-sm text-amber-800">Si es una persona distinta, tocá “Es otra persona, guardar”.</p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-tinta-soft">
            Cumpleaños <span className="font-normal text-gris">(opcional)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Input aria-label="Día" type="number" inputMode="numeric" min={1} max={31} placeholder="Día" value={f.cumple_dia ?? ''} onChange={(e) => set('cumple_dia', e.target.value ? Number(e.target.value) : null)} error={errores.cumple_dia} />
            <Select aria-label="Mes" value={f.cumple_mes ?? ''} onChange={(e) => set('cumple_mes', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Mes</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
            <Input aria-label="Año" type="number" inputMode="numeric" placeholder="Año (opc.)" value={f.cumple_anio ?? ''} onChange={(e) => set('cumple_anio', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>

        <div className="sm:col-span-2 rounded-2xl bg-nude-50 px-4 py-2">
          <Toggle checked={f.es_fija} onChange={(v) => set('es_fija', v)} etiqueta="Clienta fija" descripcion="Viene seguido. Sirve para avisos y para priorizarla." />
        </div>
        <Textarea contenedor="sm:col-span-2" etiqueta="Alergias o cuidados" opcional rows={2} value={f.alergias ?? ''} onChange={(e) => set('alergias', e.target.value)} placeholder="Lo que la clienta te haya contado" />
        <Textarea contenedor="sm:col-span-2" etiqueta="Observaciones" opcional rows={3} value={f.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} placeholder="Colores que usa, diseños favoritos, forma y largo…" />
      </form>
    </Modal>
  )
}

function pick(c: Clienta): ClientaInput {
  return {
    nombre: c.nombre, apellido: c.apellido ?? '', whatsapp: c.whatsapp ?? '', instagram: c.instagram ?? '',
    cumple_dia: c.cumple_dia, cumple_mes: c.cumple_mes, cumple_anio: c.cumple_anio, es_fija: c.es_fija,
    alergias: c.alergias ?? '', observaciones: c.observaciones ?? '',
  }
}
