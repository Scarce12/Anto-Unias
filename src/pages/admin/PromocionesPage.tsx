import clsx from 'clsx'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Cargando, Encabezado, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea, Toggle } from '@/components/ui/Campos'
import { useConfirmar } from '@/components/ui/Confirmar'
import { Modal } from '@/components/ui/Modal'
import { useServicios } from '@/features/servicios/api'
import { useBorrarPromocion, useGuardarPromocion, usePromociones } from '@/features/varios/api'
import { fmtDia, hoyISO, sumarDias } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { dinero, parseDinero } from '@/lib/formato'
import type { Promocion } from '@/lib/types'

export function PromocionesPage() {
  const q = usePromociones()
  const [editar, setEditar] = useState<Promocion | 'nueva' | null>(null)
  const hoy = hoyISO()
  return (
    <div>
      <Encabezado
        titulo="Promociones"
        subtitulo="Nunca se aplican solas: las elegís vos al agendar o editar un turno."
        acciones={<Button icono={<Plus className="size-4" />} onClick={() => setEditar('nueva')}>Nueva promoción</Button>}
      />
      {q.isLoading ? <Cargando /> : !q.data?.length ? (
        <Vacio icono={<Tag />} titulo="Sin promociones" texto="Descuentos por porcentaje, monto fijo, combos de servicios, promos de temporada o beneficios para clientas frecuentes." accion={<Button onClick={() => setEditar('nueva')}>Crear promoción</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((p) => {
            const vigente = p.activa && p.fecha_inicio <= hoy && p.fecha_fin >= hoy
            return (
              <button key={p.id} onClick={() => setEditar(p)} className={clsx('tarjeta p-4 text-left transition hover:border-rosa-200', !vigente && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{p.nombre}</p>
                  <span className="titulo-display text-2xl text-rosa-600">{p.tipo === 'porcentaje' ? `−${p.valor}%` : `−${dinero(p.valor)}`}</span>
                </div>
                <p className="mt-1 text-sm text-gris">{fmtDia(p.fecha_inicio, 'd/MM/yy')} al {fmtDia(p.fecha_fin, 'd/MM/yy')}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className={vigente ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : undefined}>{vigente ? 'Vigente' : p.activa ? 'Fuera de fecha' : 'Pausada'}</Badge>
                  {p.tipo === 'combo' && <Badge>Combo</Badge>}
                  {p.min_visitas && <Badge>Desde {p.min_visitas} visitas</Badge>}
                  {p.visible_web && <Badge>En la web</Badge>}
                </div>
              </button>
            )
          })}
        </div>
      )}
      <PromoForm promo={editar === 'nueva' ? null : editar} abierto={!!editar} onCerrar={() => setEditar(null)} />
    </div>
  )
}

function PromoForm({ promo, abierto, onCerrar }: { promo: Promocion | null; abierto: boolean; onCerrar: () => void }) {
  const servicios = useServicios()
  const guardar = useGuardarPromocion()
  const borrar = useBorrarPromocion()
  const confirmar = useConfirmar()
  const [f, setF] = useState({ nombre: '', descripcion: '', tipo: 'porcentaje' as Promocion['tipo'], valor: '', desde: hoyISO(), hasta: sumarDias(hoyISO(), 30), min_visitas: '', activa: true, visible_web: false, servicios: [] as string[] })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setError('')
    setF(promo ? {
      nombre: promo.nombre, descripcion: promo.descripcion ?? '', tipo: promo.tipo, valor: String(promo.valor), desde: promo.fecha_inicio, hasta: promo.fecha_fin,
      min_visitas: promo.min_visitas ? String(promo.min_visitas) : '', activa: promo.activa, visible_web: promo.visible_web,
      servicios: promo.promocion_servicios?.map((s) => s.servicio_id) ?? [],
    } : { nombre: '', descripcion: '', tipo: 'porcentaje', valor: '', desde: hoyISO(), hasta: sumarDias(hoyISO(), 30), min_visitas: '', activa: true, visible_web: false, servicios: [] })
  }, [abierto, promo])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseDinero(f.valor)
    if (!f.nombre.trim()) return setError('Poné un nombre.')
    if (valor <= 0) return setError('Indicá el valor del descuento.')
    if (f.tipo === 'porcentaje' && valor > 100) return setError('El porcentaje no puede superar 100.')
    if (f.hasta < f.desde) return setError('La fecha de fin es anterior a la de inicio.')
    if (f.tipo === 'combo' && f.servicios.length < 2) return setError('Un combo necesita al menos 2 servicios.')
    try {
      await guardar.mutateAsync({
        id: promo?.id, nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, tipo: f.tipo, valor,
        fecha_inicio: f.desde, fecha_fin: f.hasta, min_visitas: f.min_visitas ? Number(f.min_visitas) : null,
        activa: f.activa, visible_web: f.visible_web, servicios: f.servicios,
      })
      toast.success('Promoción guardada')
      onCerrar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={promo ? 'Editar promoción' : 'Nueva promoción'} ancho="lg"
      pie={<>
        {promo && <Button variante="peligro" className="mr-auto" icono={<Trash2 className="size-4" />} onClick={async () => {
          if (await confirmar({ titulo: '¿Eliminar la promoción?', mensaje: 'Los turnos donde ya se aplicó mantienen su descuento.', confirmar: 'Eliminar', peligro: true }))
            borrar.mutate(promo.id, { onSuccess: onCerrar, onError: (e) => toast.error(mensajeError(e)) })
        }}>Eliminar</Button>}
        <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" form="form-promo" cargando={guardar.isPending}>Guardar</Button>
      </>}>
      <form id="form-promo" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input contenedor="sm:col-span-2" etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Semana de la madre" />
        <Select etiqueta="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Promocion['tipo'] })}>
          <option value="porcentaje">Porcentaje de descuento</option>
          <option value="monto_fijo">Monto fijo de descuento</option>
          <option value="combo">Combo de servicios (monto fijo)</option>
        </Select>
        <Input etiqueta={f.tipo === 'porcentaje' ? 'Porcentaje' : 'Descuento en $'} inputMode="decimal" prefijo={f.tipo === 'porcentaje' ? '%' : '$'} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        <Input type="date" etiqueta="Desde" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <Input type="date" etiqueta="Hasta" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <Input etiqueta="Para clientas con al menos… visitas" opcional type="number" inputMode="numeric" value={f.min_visitas} onChange={(e) => setF({ ...f, min_visitas: e.target.value })} ayuda="Beneficio por fidelidad. Te avisa al aplicarla, no la aplica sola." />
        <Textarea contenedor="sm:col-span-2" etiqueta="Descripción" opcional rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-tinta-soft">Servicios incluidos <span className="font-normal text-gris">{f.tipo === 'combo' ? '(todos deben estar en el turno)' : '(vacío = todos)'}</span></p>
          <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-linea bg-white p-3 sm:grid-cols-2">
            {servicios.data?.map((s) => (
              <Checkbox key={s.id} etiqueta={s.nombre} checked={f.servicios.includes(s.id)} onChange={(e) => setF({ ...f, servicios: e.target.checked ? [...f.servicios, s.id] : f.servicios.filter((x) => x !== s.id) })} />
            ))}
          </div>
        </div>
        <div className="space-y-1 rounded-2xl bg-nude-50 px-4 py-2 sm:col-span-2">
          <Toggle checked={f.activa} onChange={(v) => setF({ ...f, activa: v })} etiqueta="Activa" />
          <Toggle checked={f.visible_web} onChange={(v) => setF({ ...f, visible_web: v })} etiqueta="Mostrar en la web" descripcion="Aparece como aviso en la página pública mientras esté vigente." />
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  )
}
