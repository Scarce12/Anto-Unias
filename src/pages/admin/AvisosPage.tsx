import clsx from 'clsx'
import { ArrowLeft, Check, Megaphone, MessageCircle, Plus, Star, Trash2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Cargando, Encabezado, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Textarea } from '@/components/ui/Campos'
import { useConfirmar } from '@/components/ui/Confirmar'
import { Modal } from '@/components/ui/Modal'
import { useClientas } from '@/features/clientas/api'
import { useAviso, useAvisoAgregarClientas, useAvisos, useBorrarAviso, useGuardarAviso, useMarcarAvisada, useQuitarDeAviso } from '@/features/varios/api'
import { fmt } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { nombreCompleto } from '@/lib/formato'
import { completarPlantilla, copiarTexto, linkWhatsApp } from '@/lib/whatsapp'

/** La “Lista de Pochitas”: avisar a todas las clientas (ej. turnos de diciembre) y tildar a quién ya se avisó */
export function AvisosPage() {
  const q = useAvisos()
  const guardar = useGuardarAviso()
  const navegar = useNavigate()
  const [nuevo, setNuevo] = useState(false)
  const [f, setF] = useState({ titulo: '', mensaje: '¡Hola, {nombre}! 💅 Ya estoy armando la agenda de diciembre. ¿Querés que te reserve un turno?' })

  return (
    <div>
      <Encabezado
        titulo="Avisos a clientas"
        subtitulo="Como tu lista de clientas: a quién avisaste y a quién no, para que ninguna se quede sin turno."
        acciones={<Button icono={<Plus className="size-4" />} onClick={() => setNuevo(true)}>Nuevo aviso</Button>}
      />
      {q.isLoading ? <Cargando /> : !q.data?.length ? (
        <Vacio icono={<Megaphone />} titulo="Sin avisos" texto="Creá un aviso (ej: “Turnos de diciembre”), sumá a tus clientas fijas o a todas, y mandale el mensaje a cada una por WhatsApp." accion={<Button onClick={() => setNuevo(true)}>Crear aviso</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((a) => {
            const total = a.aviso_clientas.length
            const hechas = a.aviso_clientas.filter((x) => x.avisada).length
            return (
              <Link key={a.id} to={`/admin/avisos/${a.id}`} className={clsx('tarjeta block p-4 hover:border-rosa-200', a.archivado && 'opacity-60')}>
                <p className="font-semibold">{a.titulo}</p>
                <p className="text-sm text-gris">Creado {fmt(a.creado_en, "d/MM/yy")}{a.archivado ? ' · archivado' : ''}</p>
                <div className="mt-3 h-2 rounded-full bg-nude-100"><div className="h-full rounded-full bg-rosa-400" style={{ width: total ? `${(hechas / total) * 100}%` : 0 }} /></div>
                <p className="mt-1.5 text-sm">{hechas} de {total} avisadas</p>
              </Link>
            )
          })}
        </div>
      )}
      <Modal abierto={nuevo} onCerrar={() => setNuevo(false)} titulo="Nuevo aviso"
        pie={<>
          <Button variante="secundario" onClick={() => setNuevo(false)}>Cancelar</Button>
          <Button cargando={guardar.isPending} disabled={!f.titulo.trim()} onClick={async () => {
            try {
              const id = await guardar.mutateAsync({ titulo: f.titulo.trim(), mensaje: f.mensaje })
              setNuevo(false)
              navegar(`/admin/avisos/${id}`)
            } catch (e) {
              toast.error(mensajeError(e))
            }
          }}>Crear</Button>
        </>}>
        <div className="space-y-4">
          <Input etiqueta="Título" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej: Turnos de diciembre" />
          <Textarea etiqueta="Mensaje" rows={4} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} ayuda="{nombre} se reemplaza por el nombre de cada clienta." />
        </div>
      </Modal>
    </div>
  )
}

export function AvisoDetallePage() {
  const { id } = useParams()
  const q = useAviso(id)
  const guardar = useGuardarAviso()
  const agregar = useAvisoAgregarClientas()
  const marcar = useMarcarAvisada()
  const quitar = useQuitarDeAviso()
  const borrar = useBorrarAviso()
  const confirmar = useConfirmar()
  const navegar = useNavigate()
  const [elegir, setElegir] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (q.isLoading || !q.data) return <Cargando />
  const { aviso, filas } = q.data
  const texto = mensaje ?? aviso.mensaje
  const hechas = filas.filter((f) => f.avisada).length

  const sumar = async (soloFijas: boolean) => {
    try {
      const n = await agregar.mutateAsync({ aviso: aviso.id, soloFijas })
      toast.success(n ? `Se sumaron ${n} clientas` : 'Ya estaban todas')
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/avisos" className="inline-flex items-center gap-1 text-sm text-gris hover:text-tinta"><ArrowLeft className="size-4" /> Avisos</Link>
      <Encabezado
        titulo={aviso.titulo}
        subtitulo={`${hechas} de ${filas.length} avisadas`}
        acciones={<>
          <Button variante="secundario" onClick={() => guardar.mutate({ id: aviso.id, archivado: !aviso.archivado })}>{aviso.archivado ? 'Desarchivar' : 'Archivar'}</Button>
          <Button variante="peligro" icono={<Trash2 className="size-4" />} onClick={async () => {
            if (await confirmar({ titulo: '¿Eliminar este aviso?', confirmar: 'Eliminar', peligro: true })) borrar.mutate(aviso.id, { onSuccess: () => navegar('/admin/avisos') })
          }}>Eliminar</Button>
        </>}
      />

      <div className="tarjeta p-4">
        <Textarea etiqueta="Mensaje" rows={3} value={texto} onChange={(e) => setMensaje(e.target.value)} ayuda="{nombre} se reemplaza por el nombre de cada clienta." />
        {mensaje !== null && mensaje !== aviso.mensaje && (
          <div className="mt-2 flex justify-end"><Button tamano="sm" onClick={() => guardar.mutate({ id: aviso.id, mensaje }, { onSuccess: () => { setMensaje(null); toast.success('Mensaje guardado') } })}>Guardar mensaje</Button></div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variante="secundario" tamano="sm" icono={<Star className="size-4" />} onClick={() => sumar(true)} cargando={agregar.isPending}>Sumar clientas fijas</Button>
        <Button variante="secundario" tamano="sm" onClick={() => sumar(false)} cargando={agregar.isPending}>Sumar todas</Button>
        <Button variante="secundario" tamano="sm" icono={<UserPlus className="size-4" />} onClick={() => setElegir(true)}>Elegir clientas</Button>
      </div>

      {filas.length === 0 ? <Vacio titulo="Lista vacía" texto="Sumá clientas con los botones de arriba." /> : (
        <div className="tarjeta divide-y divide-linea">
          {filas.map((f, i) => {
            const c = f.clientas!
            const msg = completarPlantilla(texto, { nombre: c.nombre })
            return (
              <div key={f.clienta_id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-6 text-right text-sm text-gris">{i + 1}</span>
                <button
                  onClick={() => marcar.mutate({ aviso: aviso.id, clienta: f.clienta_id, avisada: !f.avisada })}
                  className={clsx('inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-1 transition', f.avisada ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-white text-transparent ring-linea hover:ring-emerald-400')}
                  aria-label={f.avisada ? 'Marcar como no avisada' : 'Marcar como avisada'}
                >
                  <Check className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">{nombreCompleto(c)} {c.es_fija && <Badge className="bg-rosa-50 text-rosa-700 ring-rosa-200">Fija</Badge>}</p>
                  <p className="truncate text-xs text-gris">{c.whatsapp ?? c.instagram ?? 'Sin contacto'}{f.avisada_en ? ` · avisada ${fmt(f.avisada_en, 'd/MM HH:mm')}` : ''}</p>
                </div>
                {c.whatsapp ? (
                  <a href={linkWhatsApp(c.whatsapp, msg)} target="_blank" rel="noreferrer" onClick={() => !f.avisada && marcar.mutate({ aviso: aviso.id, clienta: f.clienta_id, avisada: true })}
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white">
                    <MessageCircle className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                ) : (
                  <button onClick={async () => { if (await copiarTexto(msg)) toast.success('Mensaje copiado') }} className="rounded-full border border-linea px-3 py-1.5 text-sm">Copiar</button>
                )}
                <button onClick={() => quitar.mutate({ aviso: aviso.id, clienta: f.clienta_id })} className="rounded-full p-1.5 text-gris hover:text-red-600" aria-label="Quitar de la lista"><X className="size-4" /></button>
              </div>
            )
          })}
        </div>
      )}
      <ElegirClientas abierto={elegir} onCerrar={() => setElegir(false)} yaEstan={filas.map((f) => f.clienta_id)} onElegir={(ids) => agregar.mutate({ aviso: aviso.id, ids }, { onSuccess: () => setElegir(false) })} />
    </div>
  )
}

function ElegirClientas({ abierto, onCerrar, yaEstan, onElegir }: { abierto: boolean; onCerrar: () => void; yaEstan: string[]; onElegir: (ids: string[]) => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const q = useClientas({ busqueda })
  const lista = q.data?.filter((c) => !yaEstan.includes(c.id)) ?? []
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Elegir clientas"
      pie={<><Button variante="secundario" onClick={onCerrar}>Cancelar</Button><Button disabled={!sel.length} onClick={() => { onElegir(sel); setSel([]) }}>Sumar {sel.length}</Button></>}>
      <Input placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {lista.map((c) => (
          <Checkbox key={c.id} className="flex" etiqueta={nombreCompleto(c)} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />
        ))}
        {!lista.length && <p className="text-sm text-gris">No hay más clientas para sumar.</p>}
      </div>
    </Modal>
  )
}
