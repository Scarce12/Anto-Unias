import { createContext, use, useCallback, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface Opciones {
  titulo: string
  mensaje?: ReactNode
  confirmar?: string
  cancelar?: string
  peligro?: boolean
}

type Fn = (o: Opciones) => Promise<boolean>
const Ctx = createContext<Fn | null>(null)

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirmar = useCallback<Fn>((o) => {
    setOpciones(o)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])

  const cerrar = (v: boolean) => {
    resolver.current(v)
    setOpciones(null)
  }

  return (
    <Ctx value={confirmar}>
      {children}
      <Modal
        abierto={!!opciones}
        onCerrar={() => cerrar(false)}
        titulo={opciones?.titulo}
        ancho="sm"
        pie={
          <>
            <Button variante="secundario" onClick={() => cerrar(false)}>
              {opciones?.cancelar ?? 'Volver'}
            </Button>
            <Button variante={opciones?.peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)} data-autofocus>
              {opciones?.confirmar ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        {opciones?.mensaje && <div className="text-[15px] text-tinta-soft">{opciones.mensaje}</div>}
      </Modal>
    </Ctx>
  )
}

export function useConfirmar(): Fn {
  const fn = use(Ctx)
  if (!fn) throw new Error('useConfirmar fuera de ConfirmarProvider')
  return fn
}
