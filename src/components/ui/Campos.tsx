import clsx from 'clsx'
import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

const claseCampo =
  'w-full rounded-xl border border-linea bg-white px-3.5 py-2.5 text-tinta placeholder:text-gris/70 transition focus:border-rosa-400 focus:outline-none focus:ring-4 focus:ring-rosa-100 disabled:bg-nude-50 disabled:text-gris'

interface CampoProps {
  etiqueta?: ReactNode
  error?: string
  ayuda?: ReactNode
  opcional?: boolean
  className?: string
  children: (id: string) => ReactNode
}

export function Campo({ etiqueta, error, ayuda, opcional, className, children }: CampoProps) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {etiqueta && (
        <label htmlFor={id} className="text-sm font-medium text-tinta-soft">
          {etiqueta}
          {opcional && <span className="ml-1 font-normal text-gris">(opcional)</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-gris">{ayuda}</p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta?: ReactNode
  error?: string
  ayuda?: ReactNode
  opcional?: boolean
  prefijo?: ReactNode
  ref?: Ref<HTMLInputElement>
  contenedor?: string
}

export function Input({ etiqueta, error, ayuda, opcional, prefijo, className, contenedor, ref, ...rest }: InputProps) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} opcional={opcional} className={contenedor}>
      {(id) =>
        prefijo ? (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gris">{prefijo}</span>
            <input id={id} ref={ref} aria-invalid={!!error} className={clsx(claseCampo, 'pl-8', error && 'border-red-300', className)} {...rest} />
          </div>
        ) : (
          <input id={id} ref={ref} aria-invalid={!!error} className={clsx(claseCampo, error && 'border-red-300', className)} {...rest} />
        )
      }
    </Campo>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  etiqueta?: ReactNode
  error?: string
  ayuda?: ReactNode
  opcional?: boolean
  ref?: Ref<HTMLTextAreaElement>
  contenedor?: string
}

export function Textarea({ etiqueta, error, ayuda, opcional, className, contenedor, ref, rows = 3, ...rest }: TextareaProps) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} opcional={opcional} className={contenedor}>
      {(id) => (
        <textarea id={id} ref={ref} rows={rows} aria-invalid={!!error} className={clsx(claseCampo, 'resize-y', className)} {...rest} />
      )}
    </Campo>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta?: ReactNode
  error?: string
  ayuda?: ReactNode
  opcional?: boolean
  ref?: Ref<HTMLSelectElement>
  contenedor?: string
}

export function Select({ etiqueta, error, ayuda, opcional, className, contenedor, ref, children, ...rest }: SelectProps) {
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda} opcional={opcional} className={contenedor}>
      {(id) => (
        <select id={id} ref={ref} aria-invalid={!!error} className={clsx(claseCampo, 'appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10', className)}
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a7b7e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
          {...rest}>
          {children}
        </select>
      )}
    </Campo>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  etiqueta: ReactNode
  descripcion?: ReactNode
  disabled?: boolean
}

export function Toggle({ checked, onChange, etiqueta, descripcion, disabled }: ToggleProps) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-[15px] font-medium text-tinta">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-sm text-gris">{descripcion}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-rosa-500' : 'bg-nude-200',
        )}
      >
        <span className={clsx('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  )
}

export function Checkbox({ etiqueta, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2.5 text-[15px] text-tinta', className)}>
      <input type="checkbox" className="size-5 rounded-md border-linea accent-rosa-500" {...rest} />
      {etiqueta}
    </label>
  )
}
