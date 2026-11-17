import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'oscuro'
type Tamano = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap'

const variantes: Record<Variante, string> = {
  primario: 'bg-rosa-500 text-white hover:bg-rosa-600 shadow-sm',
  secundario: 'bg-white text-tinta border border-linea hover:border-rosa-300 hover:bg-rosa-50',
  fantasma: 'text-tinta-soft hover:bg-nude-100',
  peligro: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  oscuro: 'bg-tinta text-white hover:bg-tinta-soft',
}

const tamanos: Record<Tamano, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-base',
}

export function claseBoton(variante: Variante = 'primario', tamano: Tamano = 'md', extra?: string) {
  return clsx(base, variantes[variante], tamanos[tamano], extra)
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  cargando?: boolean
  icono?: ReactNode
  bloque?: boolean
}

export function Button({ variante = 'primario', tamano = 'md', cargando, icono, bloque, className, children, disabled, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={claseBoton(variante, tamano, clsx(bloque && 'w-full', className))}
      disabled={disabled || cargando}
      {...rest}
    >
      {cargando ? <Loader2 className="size-4 animate-spin" /> : icono}
      {children}
    </button>
  )
}

interface LinkBotonProps extends LinkProps {
  variante?: Variante
  tamano?: Tamano
  icono?: ReactNode
}

export function LinkBoton({ variante = 'primario', tamano = 'md', icono, className, children, ...rest }: LinkBotonProps) {
  return (
    <Link className={claseBoton(variante, tamano, className as string)} {...rest}>
      {icono}
      {children}
    </Link>
  )
}

export function IconButton({
  etiqueta,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string }) {
  return (
    <button
      type={type}
      aria-label={etiqueta}
      title={etiqueta}
      className={clsx(
        'inline-flex size-10 items-center justify-center rounded-full text-tinta-soft transition hover:bg-nude-100 active:scale-95 disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
