import clsx from 'clsx'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { mensajeError } from '@/lib/errores'
import { Button } from './Button'

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className ?? 'bg-nude-100 text-tinta-soft ring-nude-200')}>
      {children}
    </span>
  )
}

export function Cargando({ texto = 'Cargando…', className }: { texto?: string; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-12 text-gris', className)} role="status">
      <Loader2 className="size-5 animate-spin text-rosa-400" />
      <span className="text-sm">{texto}</span>
    </div>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-nude-100', className)} />
}

export function Vacio({ icono, titulo, texto, accion, className }: { icono?: ReactNode; titulo: string; texto?: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icono && <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-rosa-50 text-rosa-500 [&>svg]:size-6">{icono}</div>}
      <h3 className="titulo-display text-xl">{titulo}</h3>
      {texto && <p className="mt-1.5 max-w-sm text-sm text-gris">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}

export function ErrorCarga({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-5 py-8 text-center">
      <AlertCircle className="size-6 text-red-500" />
      <p className="text-sm text-red-800">{mensajeError(error)}</p>
      {reintentar && (
        <Button variante="secundario" tamano="sm" onClick={reintentar}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function Encabezado({ titulo, subtitulo, acciones }: { titulo: ReactNode; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="titulo-display text-3xl leading-tight sm:text-4xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-gris">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  className,
}: {
  opciones: { valor: T; etiqueta: ReactNode }[]
  valor: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={clsx('inline-flex rounded-full bg-nude-100 p-1', className)} role="tablist">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={clsx(
            'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
            valor === o.valor ? 'bg-white text-tinta shadow-sm' : 'text-gris hover:text-tinta',
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

export function Tarjeta({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('tarjeta', className)} {...rest}>
      {children}
    </div>
  )
}

export function Dato({ etiqueta, valor, className }: { etiqueta: ReactNode; valor: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-3 py-1.5', className)}>
      <span className="text-sm text-gris">{etiqueta}</span>
      <span className="text-right text-[15px] font-medium text-tinta">{valor}</span>
    </div>
  )
}

export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  const ini = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <span className={clsx('inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-rosa-100 font-display text-lg font-semibold text-rosa-700', className)}>
      {ini || '?'}
    </span>
  )
}
