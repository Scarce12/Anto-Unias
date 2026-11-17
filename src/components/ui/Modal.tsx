import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  abierto: boolean
  onCerrar: () => void
  titulo?: ReactNode
  subtitulo?: ReactNode
  children: ReactNode
  pie?: ReactNode
  ancho?: 'sm' | 'md' | 'lg' | 'xl'
}

const anchos = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

// Pila de modales abiertos: Escape cierra solo el de arriba
const pila: symbol[] = []

/** En celulares se abre como hoja desde abajo; en escritorio, centrado. */
export function Modal({ abierto, onCerrar, titulo, subtitulo, children, pie, ancho = 'md' }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const onCerrarRef = useRef(onCerrar)
  onCerrarRef.current = onCerrar

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const yo = Symbol('modal')
    pila.push(yo)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pila[pila.length - 1] === yo) onCerrarRef.current()
    }
    window.addEventListener('keydown', onKey)
    // foco inicial en el primer campo
    requestAnimationFrame(() => {
      const el = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,[data-autofocus]')
      if (el && window.matchMedia('(pointer: fine)').matches) el.focus()
      else panel.current?.focus()
    })
    return () => {
      pila.splice(pila.indexOf(yo), 1)
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      previo?.focus?.()
    }
  }, [abierto])

  if (!abierto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      // Los portales propagan eventos por el árbol de React: un formulario dentro de este modal
      // no debe disparar el submit de un formulario del modal "padre".
      onSubmit={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 animate-aparecer bg-tinta/40 backdrop-blur-[2px]" onClick={onCerrar} />
      <div
        ref={panel}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[92dvh] w-full animate-subir flex-col rounded-t-3xl bg-crema shadow-flotante outline-none sm:rounded-3xl',
          anchos[ancho],
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-nude-200 sm:hidden" />
        {(titulo || subtitulo) && (
          <div className="flex items-start gap-3 px-5 pb-2 pt-3 sm:px-6 sm:pt-5">
            <div className="min-w-0 flex-1">
              {titulo && <h2 className="titulo-display text-2xl leading-tight">{titulo}</h2>}
              {subtitulo && <p className="mt-0.5 text-sm text-gris">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gris hover:bg-nude-100"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="scroll-fino flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>
        {pie && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-linea px-5 py-3.5 sm:px-6">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
