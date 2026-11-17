import clsx from 'clsx'
import { EyeOff, ImagePlus, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Cargando, Encabezado, ErrorCarga, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea, Toggle } from '@/components/ui/Campos'
import { useConfirmar } from '@/components/ui/Confirmar'
import { Modal } from '@/components/ui/Modal'
import {
  SUGERENCIAS_SERVICIOS, useBorrarCategoriaServicio, useBorrarServicio, useCargarSugerencias, useCategoriasServicio,
  useGuardarCategoriaServicio, useGuardarServicio, useServicios,
} from '@/features/servicios/api'
import { duracionTexto } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, parseDinero } from '@/lib/formato'
import { borrarImagen, subirImagen } from '@/lib/imagenes'
import { urlPublica } from '@/lib/supabase'
import type { Servicio } from '@/lib/types'

export function ServiciosPage() {
  const servicios = useServicios()
  const cats = useCategoriasServicio()
  const guardar = useGuardarServicio()
  const [editar, setEditar] = useState<Servicio | 'nuevo' | null>(null)
  const [sugerir, setSugerir] = useState(false)
  const [categorias, setCategorias] = useState(false)

  if (servicios.error) return <ErrorCarga error={servicios.error} reintentar={() => servicios.refetch()} />
  if (servicios.isLoading) return <Cargando />
  const lista = servicios.data!
  const grupos = [
    ...(cats.data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, items: lista.filter((s) => s.categoria_id === c.id) })),
    { id: 'sin', nombre: 'Sin categoría', items: lista.filter((s) => !s.categoria_id || !cats.data?.some((c) => c.id === s.categoria_id)) },
  ].filter((g) => g.items.length)

  return (
    <div>
      <Encabezado
        titulo="Servicios y precios"
        subtitulo="Lo que cambies acá se ve en la web al instante. Los turnos ya agendados conservan su precio."
        acciones={
          <>
            <Button variante="secundario" onClick={() => setCategorias(true)}>Categorías</Button>
            <Button icono={<Plus className="size-4" />} onClick={() => setEditar('nuevo')}>Nuevo servicio</Button>
          </>
        }
      />

      {lista.length === 0 ? (
        <Vacio
          icono={<Sparkles />}
          titulo="Cargá tus servicios"
          texto="Podés crearlos uno por uno o partir de los nombres que usás en tu agenda (semi, capping, esculpidas, deco…) y completar precio y duración."
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setSugerir(true)}>Usar nombres sugeridos</Button>
              <Button variante="secundario" onClick={() => setEditar('nuevo')}>Crear desde cero</Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {lista.some((s) => !s.activo && Number(s.precio) === 0) && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Hay servicios sin precio e inactivos. Completá precio y duración y activalos para que aparezcan en la web.
            </p>
          )}
          {grupos.map((g) => (
            <section key={g.id}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gris">{g.nombre}</h2>
              <div className="tarjeta divide-y divide-linea">
                {g.items.map((s) => (
                  <div key={s.id} className={clsx('flex items-center gap-3 px-4 py-3', !s.activo && 'opacity-60')}>
                    {s.foto_path ? (
                      <img src={urlPublica(s.foto_path)!} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-nude-100 text-nude-300"><Sparkles className="size-5" /></span>
                    )}
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditar(s)}>
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {s.nombre}
                        {s.es_adicional && <Badge>Adicional</Badge>}
                        {!s.visible_web && s.activo && <Badge className="bg-stone-100 text-stone-600 ring-stone-200"><EyeOff className="size-3" /> Oculto en la web</Badge>}
                      </p>
                      <p className="text-sm text-gris">{dinero(s.precio)} · {duracionTexto(s.duracion_min)}</p>
                    </button>
                    <Toggle
                      etiqueta={<span className="sr-only">Activo</span>}
                      checked={s.activo}
                      onChange={(v) => guardar.mutate({ id: s.id, activo: v }, { onError: (e) => toast.error(mensajeError(e)) })}
                    />
                    <button className="rounded-full p-2 text-gris hover:bg-nude-100" onClick={() => setEditar(s)} aria-label="Editar">
                      <Pencil className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <button onClick={() => setSugerir(true)} className="text-sm text-rosa-600 hover:underline">Agregar nombres sugeridos</button>
        </div>
      )}

      <ServicioForm servicio={editar === 'nuevo' ? null : editar} abierto={!!editar} onCerrar={() => setEditar(null)} />
      <Sugerencias abierto={sugerir} onCerrar={() => setSugerir(false)} existentes={lista.map((s) => s.nombre.toLowerCase())} />
      <Categorias abierto={categorias} onCerrar={() => setCategorias(false)} />
    </div>
  )
}

function ServicioForm({ servicio, abierto, onCerrar }: { servicio: Servicio | null; abierto: boolean; onCerrar: () => void }) {
  const cats = useCategoriasServicio()
  const guardar = useGuardarServicio()
  const borrar = useBorrarServicio()
  const confirmar = useConfirmar()
  const [f, setF] = useState({ nombre: '', descripcion: '', precio: '', duracion: '60', categoria_id: '', es_adicional: false, activo: true, visible_web: true, foto_path: null as string | null })
  const [subiendo, setSubiendo] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!abierto) return
    setErrores({})
    setF(
      servicio
        ? { nombre: servicio.nombre, descripcion: servicio.descripcion ?? '', precio: String(servicio.precio), duracion: String(servicio.duracion_min), categoria_id: servicio.categoria_id ?? '', es_adicional: servicio.es_adicional, activo: servicio.activo, visible_web: servicio.visible_web, foto_path: servicio.foto_path }
        : { nombre: '', descripcion: '', precio: '', duracion: '60', categoria_id: '', es_adicional: false, activo: true, visible_web: true, foto_path: null },
    )
  }, [abierto, servicio])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const er: Record<string, string> = {}
    if (!f.nombre.trim()) er.nombre = 'Poné un nombre.'
    const dur = Number(f.duracion)
    if (!dur || dur < 5 || dur > 600) er.duracion = 'Entre 5 y 600 minutos.'
    if (f.activo && parseDinero(f.precio) <= 0) er.precio = 'Para activarlo necesita precio (o desactivalo por ahora).'
    setErrores(er)
    if (Object.keys(er).length) return
    try {
      await guardar.mutateAsync({
        id: servicio?.id,
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || null,
        precio: parseDinero(f.precio),
        duracion_min: dur,
        categoria_id: f.categoria_id || null,
        es_adicional: f.es_adicional,
        activo: f.activo,
        visible_web: f.visible_web,
        foto_path: f.foto_path,
      })
      if (servicio?.foto_path && servicio.foto_path !== f.foto_path) await borrarImagen(servicio.foto_path)
      toast.success('Servicio guardado')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  const subir = async (file: File | undefined) => {
    if (!file) return
    setSubiendo(true)
    try {
      const path = await subirImagen(file, 'servicios')
      setF((x) => ({ ...x, foto_path: path }))
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'}
      ancho="lg"
      pie={
        <>
          {servicio && (
            <Button
              variante="peligro"
              className="mr-auto"
              icono={<Trash2 className="size-4" />}
              onClick={async () => {
                const ok = await confirmar({ titulo: `¿Eliminar “${servicio.nombre}”?`, mensaje: 'Si ya se usó en turnos, conviene desactivarlo: los turnos viejos guardan su nombre y precio igual.', confirmar: 'Eliminar', peligro: true })
                if (!ok) return
                try {
                  await borrar.mutateAsync(servicio.id)
                  await borrarImagen(servicio.foto_path)
                  toast.success('Servicio eliminado')
                  onCerrar()
                } catch (e) {
                  toast.error(mensajeError(e))
                }
              }}
            >
              Eliminar
            </Button>
          )}
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-servicio" cargando={guardar.isPending} disabled={subiendo}>Guardar</Button>
        </>
      }
    >
      <form id="form-servicio" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input contenedor="sm:col-span-2" etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} error={errores.nombre} placeholder="Ej: Capping + deco" />
        <Input etiqueta="Precio" inputMode="decimal" prefijo="$" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} error={errores.precio} />
        <Input etiqueta="Duración (minutos)" type="number" inputMode="numeric" value={f.duracion} onChange={(e) => setF({ ...f, duracion: e.target.value })} error={errores.duracion} ayuda={Number(f.duracion) ? duracionTexto(Number(f.duracion)) : undefined} />
        <Select etiqueta="Categoría" value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
          <option value="">Sin categoría</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <div className="flex items-end pb-2">
          <Checkbox etiqueta="Es un adicional (se suma a otro servicio)" checked={f.es_adicional} onChange={(e) => setF({ ...f, es_adicional: e.target.checked })} />
        </div>
        <Textarea contenedor="sm:col-span-2" etiqueta="Descripción" opcional rows={3} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Qué incluye, cuánto dura en las uñas, cuidados…" />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-tinta-soft">Foto ilustrativa <span className="font-normal text-gris">(opcional)</span></p>
          <div className="flex items-center gap-3">
            {f.foto_path ? <img src={urlPublica(f.foto_path)!} alt="" className="size-20 rounded-xl object-cover" /> : <span className="flex size-20 items-center justify-center rounded-xl bg-nude-100 text-gris"><ImagePlus className="size-6" /></span>}
            <label className="cursor-pointer rounded-full border border-linea bg-white px-4 py-2 text-sm hover:border-rosa-300">
              {subiendo ? 'Subiendo…' : f.foto_path ? 'Cambiar' : 'Elegir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
            </label>
            {f.foto_path && <button type="button" className="text-sm text-gris hover:text-red-600" onClick={() => setF({ ...f, foto_path: null })}>Quitar</button>}
          </div>
        </div>
        <div className="space-y-2 rounded-2xl bg-nude-50 px-4 py-3 sm:col-span-2">
          <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} etiqueta="Activo" descripcion="Si está inactivo no se puede reservar ni elegir en turnos nuevos." />
          <Toggle checked={f.visible_web} onChange={(v) => setF({ ...f, visible_web: v })} etiqueta="Mostrar en la web" descripcion="Desactivalo para servicios que solo agendás vos." />
        </div>
      </form>
    </Modal>
  )
}

function Sugerencias({ abierto, onCerrar, existentes }: { abierto: boolean; onCerrar: () => void; existentes: string[] }) {
  const cargar = useCargarSugerencias()
  const disponibles = SUGERENCIAS_SERVICIOS.filter((s) => !existentes.includes(s.nombre.toLowerCase()))
  const [sel, setSel] = useState<string[]>([])
  useEffect(() => {
    if (abierto) setSel(disponibles.map((d) => d.nombre))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nombres sugeridos"
      subtitulo="Salen de cómo anotás los procedimientos en tu agenda. Se crean sin precio e inactivos: después completás precio y duración de cada uno."
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button
            cargando={cargar.isPending}
            disabled={!sel.length}
            onClick={async () => {
              try {
                await cargar.mutateAsync(disponibles.filter((d) => sel.includes(d.nombre)))
                toast.success('Servicios agregados. Completá los precios.')
                onCerrar()
              } catch (e) {
                toast.error(mensajeError(e))
              }
            }}
          >
            Agregar {sel.length}
          </Button>
        </>
      }
    >
      {disponibles.length === 0 ? <p className="text-gris">Ya están todos cargados.</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {disponibles.map((d) => (
            <Checkbox
              key={d.nombre}
              etiqueta={<span>{d.nombre} {d.es_adicional && <span className="text-xs text-gris">(adicional)</span>}</span>}
              checked={sel.includes(d.nombre)}
              onChange={(e) => setSel(e.target.checked ? [...sel, d.nombre] : sel.filter((x) => x !== d.nombre))}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}

function Categorias({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const cats = useCategoriasServicio()
  const guardar = useGuardarCategoriaServicio()
  const borrar = useBorrarCategoriaServicio()
  const [nueva, setNueva] = useState('')
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Categorías de servicios">
      <ul className="mb-4 divide-y divide-linea">
        {cats.data?.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <input
              defaultValue={c.nombre}
              className="flex-1 rounded-lg border border-transparent px-2 py-1.5 hover:border-linea focus:border-rosa-400 focus:outline-none"
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && guardar.mutate({ id: c.id, nombre: e.target.value.trim(), orden: i }, { onError: (er) => toast.error(mensajeError(er)) })}
            />
            <button className="rounded-full p-2 text-gris hover:text-red-600" aria-label="Borrar categoría" onClick={() => borrar.mutate(c.id, { onError: (er) => toast.error(mensajeError(er)) })}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nueva.trim()) return
          guardar.mutate({ nombre: nueva.trim(), orden: cats.data?.length ?? 0 }, { onSuccess: () => setNueva(''), onError: (er) => toast.error(mensajeError(er)) })
        }}
      >
        <Input contenedor="flex-1" placeholder="Nueva categoría (ej: Capping)" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <Button type="submit">Agregar</Button>
      </form>
      <p className="mt-2 text-xs text-gris">Al borrar una categoría, sus servicios quedan “sin categoría”.</p>
    </Modal>
  )
}
