import clsx from 'clsx'
import { Eye, EyeOff, ImagePlus, Images, Replace, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Cargando, Encabezado, ErrorCarga, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Campos'
import { useConfirmar } from '@/components/ui/Confirmar'
import { Modal } from '@/components/ui/Modal'
import { useServicios } from '@/features/servicios/api'
import { useBorrarCategoriaFoto, useBorrarFoto, useCategoriasFoto, useFotos, useGuardarCategoriaFoto, useGuardarFoto } from '@/features/varios/api'
import { mensajeError } from '@/lib/errores'
import { borrarImagen, subirImagen } from '@/lib/imagenes'
import { urlPublica } from '@/lib/supabase'
import type { Foto } from '@/lib/types'

export function GaleriaAdminPage() {
  const fotos = useFotos()
  const cats = useCategoriasFoto()
  const guardar = useGuardarFoto()
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number } | null>(null)
  const [categoria, setCategoria] = useState('')
  const [editar, setEditar] = useState<Foto | null>(null)
  const [verCats, setVerCats] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const subir = async (files: FileList | null) => {
    if (!files?.length) return
    const lista = [...files]
    setSubiendo({ hechas: 0, total: lista.length })
    let ok = 0
    for (const f of lista) {
      try {
        const path = await subirImagen(f, 'galeria')
        await guardar.mutateAsync({ storage_path: path, categoria_id: categoria || null, visible: true })
        ok++
      } catch (e) {
        toast.error(`${f.name}: ${mensajeError(e)}`)
      }
      setSubiendo((s) => s && { ...s, hechas: s.hechas + 1 })
    }
    setSubiendo(null)
    if (ok) toast.success(ok === 1 ? 'Foto subida' : `${ok} fotos subidas`)
    if (input.current) input.current.value = ''
  }

  const filtradas = fotos.data?.filter((f) => !categoria || f.categoria_id === categoria) ?? []

  return (
    <div>
      <Encabezado
        titulo="Galería"
        subtitulo="Tus trabajos. Las destacadas aparecen en el inicio de la web."
        acciones={
          <>
            <Button variante="secundario" onClick={() => setVerCats(true)}>Categorías</Button>
            <Button icono={<ImagePlus className="size-4" />} cargando={!!subiendo} onClick={() => input.current?.click()}>
              {subiendo ? `Subiendo ${subiendo.hechas}/${subiendo.total}` : 'Subir fotos'}
            </Button>
          </>
        }
      />
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => subir(e.target.files)} />

      {!!cats.data?.length && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: '', nombre: 'Todas' }, ...cats.data].map((c) => (
            <button key={c.id} onClick={() => setCategoria(c.id)} className={clsx('rounded-full px-3.5 py-1.5 text-sm ring-1', categoria === c.id ? 'bg-tinta text-white ring-tinta' : 'bg-white ring-linea')}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}
      {categoria && <p className="mb-3 text-xs text-gris">Las fotos que subas ahora quedan en esta categoría.</p>}

      {fotos.error ? <ErrorCarga error={fotos.error} /> : fotos.isLoading ? <Cargando /> : !filtradas.length ? (
        <Vacio icono={<Images />} titulo="Todavía no hay fotos" texto="Subí fotos reales de tus trabajos desde el celular. Se achican solas para que la web cargue rápido." accion={<Button onClick={() => input.current?.click()}>Subir fotos</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtradas.map((f) => (
            <div key={f.id} className={clsx('group relative overflow-hidden rounded-2xl bg-nude-100', !f.visible && 'opacity-50')}>
              <button onClick={() => setEditar(f)} className="block aspect-square w-full">
                <img src={urlPublica(f.storage_path)!} alt={f.descripcion ?? ''} loading="lazy" className="size-full object-cover transition group-hover:scale-[1.03]" />
              </button>
              <div className="absolute inset-x-0 top-0 flex justify-between p-2">
                <button
                  onClick={() => guardar.mutate({ id: f.id, destacada: !f.destacada })}
                  className={clsx('rounded-full p-1.5 backdrop-blur', f.destacada ? 'bg-rosa-500 text-white' : 'bg-white/80 text-gris')}
                  aria-label={f.destacada ? 'Quitar de destacadas' : 'Destacar'}
                >
                  <Star className={clsx('size-4', f.destacada && 'fill-white')} />
                </button>
                {!f.visible && <span className="rounded-full bg-white/80 p-1.5 text-gris"><EyeOff className="size-4" /></span>}
              </div>
              {f.descripcion && <p className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 px-2.5 pb-2 pt-6 text-xs text-white">{f.descripcion}</p>}
            </div>
          ))}
        </div>
      )}

      <EditarFoto foto={editar} onCerrar={() => setEditar(null)} />
      <CategoriasFoto abierto={verCats} onCerrar={() => setVerCats(false)} />
    </div>
  )
}

function EditarFoto({ foto, onCerrar }: { foto: Foto | null; onCerrar: () => void }) {
  const cats = useCategoriasFoto()
  const servicios = useServicios()
  const guardar = useGuardarFoto()
  const borrar = useBorrarFoto()
  const confirmar = useConfirmar()
  const [f, setF] = useState<Partial<Foto>>({})
  const [reemplazando, setReemplazando] = useState(false)
  const [abiertaId, setAbiertaId] = useState<string | null>(null)
  if (foto && abiertaId !== foto.id) {
    setAbiertaId(foto.id)
    setF({ descripcion: foto.descripcion ?? '', categoria_id: foto.categoria_id ?? '', servicio_id: foto.servicio_id ?? '', destacada: foto.destacada, visible: foto.visible, storage_path: foto.storage_path })
  }
  const cerrar = () => {
    setAbiertaId(null)
    onCerrar()
  }

  const reemplazar = async (file: File | undefined) => {
    if (!file || !foto) return
    setReemplazando(true)
    try {
      const path = await subirImagen(file, 'galeria')
      setF((x) => ({ ...x, storage_path: path }))
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setReemplazando(false)
    }
  }

  return (
    <Modal
      abierto={!!foto}
      onCerrar={cerrar}
      titulo="Foto"
      pie={
        <>
          <Button variante="peligro" className="mr-auto" icono={<Trash2 className="size-4" />} onClick={async () => {
            if (!foto || !(await confirmar({ titulo: '¿Eliminar la foto?', mensaje: 'Se borra de la web y del almacenamiento.', confirmar: 'Eliminar', peligro: true }))) return
            borrar.mutate(foto, { onSuccess: () => { toast.success('Foto eliminada'); cerrar() }, onError: (e) => toast.error(mensajeError(e)) })
          }}>Eliminar</Button>
          <Button variante="secundario" onClick={cerrar}>Cancelar</Button>
          <Button cargando={guardar.isPending} disabled={reemplazando} onClick={async () => {
            if (!foto) return
            try {
              await guardar.mutateAsync({
                id: foto.id,
                descripcion: (f.descripcion as string)?.trim() || null,
                categoria_id: f.categoria_id || null,
                servicio_id: f.servicio_id || null,
                destacada: !!f.destacada,
                visible: !!f.visible,
                storage_path: f.storage_path,
              })
              if (f.storage_path !== foto.storage_path) await borrarImagen(foto.storage_path)
              toast.success('Foto actualizada')
              cerrar()
            } catch (e) {
              toast.error(mensajeError(e))
            }
          }}>Guardar</Button>
        </>
      }
    >
      {foto && (
        <div className="space-y-4">
          <div className="relative">
            <img src={urlPublica(f.storage_path ?? foto.storage_path)!} alt="" className="max-h-72 w-full rounded-2xl object-contain bg-nude-50" />
            <label className="absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm shadow">
              <Replace className="size-4" /> {reemplazando ? 'Subiendo…' : 'Reemplazar'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => reemplazar(e.target.files?.[0])} />
            </label>
          </div>
          <Textarea etiqueta="Descripción" opcional rows={2} value={(f.descripcion as string) ?? ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Ej: Capping con French y deco floral" />
          <div className="grid grid-cols-2 gap-3">
            <Select etiqueta="Categoría" value={f.categoria_id ?? ''} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
              <option value="">Sin categoría</option>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
            <Select etiqueta="Servicio" opcional value={f.servicio_id ?? ''} onChange={(e) => setF({ ...f, servicio_id: e.target.value })}>
              <option value="">—</option>
              {servicios.data?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setF({ ...f, destacada: !f.destacada })} className={clsx('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm ring-1', f.destacada ? 'bg-rosa-500 text-white ring-rosa-500' : 'bg-white ring-linea')}>
              <Star className="size-4" /> Destacada
            </button>
            <button type="button" onClick={() => setF({ ...f, visible: !f.visible })} className={clsx('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm ring-1', f.visible ? 'bg-white ring-linea' : 'bg-stone-200 ring-stone-300')}>
              {f.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />} {f.visible ? 'Visible en la web' : 'Oculta'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function CategoriasFoto({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const cats = useCategoriasFoto()
  const guardar = useGuardarCategoriaFoto()
  const borrar = useBorrarCategoriaFoto()
  const [nueva, setNueva] = useState('')
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Categorías de la galería" subtitulo="Ej: Semipermanente, Capping, Esculpidas, Nail art">
      <ul className="mb-4 divide-y divide-linea">
        {cats.data?.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <input defaultValue={c.nombre} className="flex-1 rounded-lg border border-transparent px-2 py-1.5 hover:border-linea focus:border-rosa-400 focus:outline-none"
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && guardar.mutate({ id: c.id, nombre: e.target.value.trim() })} />
            <button className="rounded-full p-2 text-gris hover:text-red-600" aria-label="Borrar" onClick={() => borrar.mutate(c.id, { onError: (e) => toast.error(mensajeError(e)) })}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) guardar.mutate({ nombre: nueva.trim() }, { onSuccess: () => setNueva(''), onError: (er) => toast.error(mensajeError(er)) }) }}>
        <Input contenedor="flex-1" placeholder="Nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <Button type="submit">Agregar</Button>
      </form>
    </Modal>
  )
}
