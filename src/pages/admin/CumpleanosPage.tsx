import clsx from 'clsx'
import { Cake, Flower2, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MensajeWhatsApp } from '@/components/Mensajes'
import { Cargando, Encabezado } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Campos'
import { Modal } from '@/components/ui/Modal'
import { useBorrarCumpleExtra, useCumpleanos, useGuardarCumpleExtra } from '@/features/varios/api'
import { hoyISO, MESES } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { nombreCompleto } from '@/lib/formato'
import type { CumpleExtra } from '@/lib/types'

interface Entrada {
  clave: string
  nombre: string
  dia: number
  mes: number
  tipo: 'clienta' | 'personal' | 'fecha_especial'
  clientaId?: string
  whatsapp?: string | null
  extra?: CumpleExtra
}

/** La hoja de “Cumpleaños” de la agenda: 12 recuadros, uno por mes */
export function CumpleanosPage() {
  const q = useCumpleanos()
  const [editar, setEditar] = useState<CumpleExtra | 'nuevo' | null>(null)
  const [saludo, setSaludo] = useState<Entrada | null>(null)
  const hoy = hoyISO()
  const mesActual = Number(hoy.slice(5, 7))
  const diaActual = Number(hoy.slice(8, 10))

  if (q.isLoading) return <Cargando />
  const entradas: Entrada[] = [
    ...(q.data?.clientas ?? []).map((c) => ({ clave: c.id, nombre: nombreCompleto(c), dia: c.cumple_dia, mes: c.cumple_mes, tipo: 'clienta' as const, clientaId: c.id, whatsapp: c.whatsapp })),
    ...(q.data?.extras ?? []).map((e) => ({ clave: e.id, nombre: e.nombre, dia: e.dia, mes: e.mes, tipo: e.tipo, extra: e })),
  ]

  return (
    <div>
      <Encabezado
        titulo="Cumpleaños"
        subtitulo="Los de tus clientas (se cargan en su ficha) y los tuyos: familia, amigas y fechas especiales."
        acciones={<Button icono={<Plus className="size-4" />} onClick={() => setEditar('nuevo')}>Agregar</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MESES.map((m, i) => {
          const delMes = entradas.filter((e) => e.mes === i + 1).sort((a, b) => a.dia - b.dia)
          return (
            <section key={m} className={clsx('tarjeta p-4', i + 1 === mesActual && 'ring-2 ring-rosa-200')}>
              <h2 className="mb-2 flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-rosa-100 text-sm font-semibold text-rosa-700">{i + 1}</span>
                <span className="titulo-display text-xl">{m}</span>
              </h2>
              {delMes.length === 0 ? <p className="text-sm text-gris/70">—</p> : (
                <ul className="space-y-1">
                  {delMes.map((e) => {
                    const esHoy = e.mes === mesActual && e.dia === diaActual
                    return (
                      <li key={e.clave} className={clsx('flex items-center gap-2 text-[15px]', esHoy && 'font-semibold text-rosa-700')}>
                        <span className="w-6 text-right text-sm text-gris">{e.dia}</span>
                        {e.tipo === 'fecha_especial' ? <Flower2 className="size-3.5 text-rosa-400" /> : e.tipo === 'clienta' ? <span className="size-1.5 rounded-full bg-rosa-400" /> : <span className="size-1.5 rounded-full bg-nude-300" />}
                        {e.clientaId ? (
                          <Link to={`/admin/clientas/${e.clientaId}`} className="flex-1 truncate hover:underline">{e.nombre}</Link>
                        ) : (
                          <button onClick={() => setEditar(e.extra!)} className="flex-1 truncate text-left hover:underline">{e.nombre}</button>
                        )}
                        {esHoy && <Cake className="size-4" />}
                        {e.tipo === 'clienta' && (
                          <button onClick={() => setSaludo(e)} className="rounded-full p-1 text-gris hover:text-[#128C7E]" aria-label={`Saludar a ${e.nombre}`}>
                            <MessageCircle className="size-4" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <p className="mt-4 flex flex-wrap gap-4 text-xs text-gris">
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-rosa-400" /> Clienta</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-nude-300" /> Personal</span>
        <span className="flex items-center gap-1.5"><Flower2 className="size-3.5 text-rosa-400" /> Fecha especial</span>
      </p>

      <CumpleForm item={editar === 'nuevo' ? null : editar} abierto={!!editar} onCerrar={() => setEditar(null)} />
      {saludo && <MensajeWhatsApp abierto onCerrar={() => setSaludo(null)} tipo="cumpleanos" telefono={saludo.whatsapp} variables={{ nombre: saludo.nombre.split(' ')[0] }} />}
    </div>
  )
}

function CumpleForm({ item, abierto, onCerrar }: { item: CumpleExtra | null; abierto: boolean; onCerrar: () => void }) {
  const guardar = useGuardarCumpleExtra()
  const borrar = useBorrarCumpleExtra()
  const [f, setF] = useState({ nombre: '', dia: '', mes: '', anio: '', tipo: 'personal' as CumpleExtra['tipo'], notas: '' })
  const [error, setError] = useState('')
  useEffect(() => {
    if (!abierto) return
    setError('')
    setF(item ? { nombre: item.nombre, dia: String(item.dia), mes: String(item.mes), anio: item.anio ? String(item.anio) : '', tipo: item.tipo, notas: item.notas ?? '' } : { nombre: '', dia: '', mes: '', anio: '', tipo: 'personal', notas: '' })
  }, [abierto, item])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const dia = Number(f.dia)
    const mes = Number(f.mes)
    if (!f.nombre.trim()) return setError('Escribí el nombre.')
    if (!dia || !mes || dia > new Date(2024, mes, 0).getDate()) return setError('Revisá el día y el mes.')
    try {
      await guardar.mutateAsync({ id: item?.id, nombre: f.nombre.trim(), dia, mes, anio: f.anio ? Number(f.anio) : null, tipo: f.tipo, notas: f.notas.trim() || null })
      toast.success('Guardado')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={item ? 'Editar' : 'Agregar cumpleaños o fecha'}
      subtitulo="Para clientas, cargá el cumple en su ficha así queda vinculado."
      pie={<>
        {item && <Button variante="peligro" className="mr-auto" icono={<Trash2 className="size-4" />} onClick={() => borrar.mutate(item.id, { onSuccess: onCerrar })}>Borrar</Button>}
        <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" form="form-cumple" cargando={guardar.isPending}>Guardar</Button>
      </>}>
      <form id="form-cumple" onSubmit={enviar} className="grid grid-cols-3 gap-3" noValidate>
        <Input contenedor="col-span-3" etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Mamá, Tía Ali, Día de la manicura" />
        <Input etiqueta="Día" type="number" inputMode="numeric" min={1} max={31} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} />
        <Select etiqueta="Mes" value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })}>
          <option value="">—</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
        <Input etiqueta="Año" opcional type="number" inputMode="numeric" value={f.anio} onChange={(e) => setF({ ...f, anio: e.target.value })} />
        <Select contenedor="col-span-3" etiqueta="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as CumpleExtra['tipo'] })}>
          <option value="personal">Cumpleaños (familia, amigas…)</option>
          <option value="fecha_especial">Fecha especial (ej: Día de la manicura)</option>
        </Select>
        <Textarea contenedor="col-span-3" etiqueta="Notas" opcional rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
        {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
