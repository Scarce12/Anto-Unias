import { Copy, MessageCircle, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAjustes } from '@/features/ajustes/api'
import { capitalizar, fmt, horaTexto } from '@/lib/fechas'
import { dinero } from '@/lib/formato'
import type { Ajustes, TurnoDetalle } from '@/lib/types'
import { completarPlantilla, copiarTexto, linkWhatsApp, type VariablesMensaje } from '@/lib/whatsapp'
import { Button } from './ui/Button'
import { Textarea } from './ui/Campos'
import { Modal } from './ui/Modal'

export type TipoMensaje = 'confirmacion' | 'recordatorio' | 'sena' | 'cambio' | 'saldo' | 'cumpleanos' | 'libre'

export const TITULOS_MENSAJE: Record<TipoMensaje, string> = {
  confirmacion: 'Confirmación de turno',
  recordatorio: 'Recordatorio',
  sena: 'Seña pendiente',
  cambio: 'Cambio o cancelación',
  saldo: 'Saldo pendiente',
  cumpleanos: 'Saludo de cumpleaños',
  libre: 'Mensaje',
}

export function plantillaDe(a: Ajustes | undefined, tipo: TipoMensaje): string {
  if (!a) return ''
  switch (tipo) {
    case 'confirmacion': return a.plantilla_confirmacion
    case 'recordatorio': return a.plantilla_recordatorio
    case 'sena': return a.plantilla_sena
    case 'cambio': return a.plantilla_cambio
    case 'saldo': return a.plantilla_saldo
    case 'cumpleanos': return a.plantilla_cumpleanos
    default: return '¡Hola, {nombre}! '
  }
}

export function variablesTurno(t: TurnoDetalle, a?: Ajustes): VariablesMensaje {
  return {
    nombre: t.clienta_nombre_pila ?? t.clienta_nombre?.split(' ')[0] ?? '',
    fecha: capitalizar(fmt(t.inicio, "EEEE d 'de' MMMM")),
    hora: horaTexto(t.inicio),
    servicio: t.servicios_texto,
    total: dinero(t.total),
    sena: dinero(t.sena_esperada),
    saldo: dinero(t.saldo),
    negocio: a?.nombre_negocio ?? '',
  }
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  tipo: TipoMensaje
  telefono: string | null | undefined
  variables: VariablesMensaje
  onEnviado?: () => void
}

/** Abre WhatsApp con el mensaje prearmado (editable). Si no hay número, permite copiarlo. */
export function MensajeWhatsApp({ abierto, onCerrar, tipo, telefono, variables, onEnviado }: Props) {
  const { data: ajustes } = useAjustes()
  const [texto, setTexto] = useState<string | null>(null)
  const valor = texto ?? completarPlantilla(plantillaDe(ajustes, tipo), variables)

  const cerrar = () => {
    setTexto(null)
    onCerrar()
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={TITULOS_MENSAJE[tipo]}
      subtitulo={telefono ? `Se abre WhatsApp con este texto. Podés editarlo antes.` : 'Esta clienta no tiene WhatsApp cargado: copiá el mensaje y mandalo por Instagram u otro medio.'}
      pie={
        <>
          <Button
            variante="secundario"
            icono={<Copy className="size-4" />}
            onClick={async () => {
              if (await copiarTexto(valor)) toast.success('Mensaje copiado')
              onEnviado?.()
            }}
          >
            Copiar
          </Button>
          {telefono && (
            <a
              href={linkWhatsApp(telefono, valor)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onEnviado?.()
                cerrar()
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 font-medium text-white hover:brightness-95"
            >
              <Send className="size-4" /> Abrir WhatsApp
            </a>
          )}
        </>
      }
    >
      <Textarea rows={5} value={valor} onChange={(e) => setTexto(e.target.value)} etiqueta="Mensaje" />
    </Modal>
  )
}

/** Botones de mensajes para un turno */
export function MensajesTurno({ turno, onMarcar }: { turno: TurnoDetalle; onMarcar?: (tipo: TipoMensaje) => void }) {
  const { data: ajustes } = useAjustes()
  const [tipo, setTipo] = useState<TipoMensaje | null>(null)
  const opciones: TipoMensaje[] = ['confirmacion', 'recordatorio', 'sena', 'cambio', 'saldo']
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setTipo(o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white px-3 py-1.5 text-sm text-tinta-soft hover:border-[#25D366] hover:text-[#128C7E]"
          >
            <MessageCircle className="size-4" />
            {TITULOS_MENSAJE[o]}
          </button>
        ))}
      </div>
      {tipo && (
        <MensajeWhatsApp
          abierto
          onCerrar={() => setTipo(null)}
          tipo={tipo}
          telefono={turno.contacto_whatsapp}
          variables={variablesTurno(turno, ajustes)}
          onEnviado={() => onMarcar?.(tipo)}
        />
      )}
    </>
  )
}
