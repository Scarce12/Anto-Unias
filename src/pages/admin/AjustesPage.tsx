import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { usePerfil } from '@/app/auth'
import { datos } from '@/lib/consultas'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Cargando, Encabezado, Segmentado, Tarjeta } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea, Toggle } from '@/components/ui/Campos'
import { TITULOS_MENSAJE } from '@/components/Mensajes'
import { useAjustes, useGuardarAjustes, useGuardarHorarios, useHorarios } from '@/features/ajustes/api'
import { useBorrarCategoriaGasto, useCategoriasGasto, useGuardarCategoriaGasto } from '@/features/finanzas/api'
import { DIAS_SEMANA } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import { parseDinero } from '@/lib/formato'
import { borrarImagen, subirImagen } from '@/lib/imagenes'
import { supabase, urlPublica } from '@/lib/supabase'
import { telefonoValido } from '@/lib/telefono'
import type { Ajustes } from '@/lib/types'

type Seccion = 'negocio' | 'horarios' | 'reservas' | 'finanzas' | 'mensajes' | 'cuenta'

export function AjustesPage() {
  const [seccion, setSeccion] = useState<Seccion>('negocio')
  const q = useAjustes()
  if (q.isLoading || !q.data) return <Cargando />
  return (
    <div>
      <Encabezado titulo="Ajustes" subtitulo="Todo lo que se muestra en la web y cómo funciona la agenda." />
      <div className="scroll-fino -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmentado valor={seccion} onChange={setSeccion} opciones={[
          { valor: 'negocio', etiqueta: 'Mi negocio' },
          { valor: 'horarios', etiqueta: 'Horarios' },
          { valor: 'reservas', etiqueta: 'Reservas y seña' },
          { valor: 'finanzas', etiqueta: 'Finanzas' },
          { valor: 'mensajes', etiqueta: 'Mensajes' },
          { valor: 'cuenta', etiqueta: 'Cuenta' },
        ]} />
      </div>
      {seccion === 'negocio' && <Negocio a={q.data} />}
      {seccion === 'horarios' && <Horarios a={q.data} />}
      {seccion === 'reservas' && <Reservas a={q.data} />}
      {seccion === 'finanzas' && <FinanzasAjustes a={q.data} />}
      {seccion === 'mensajes' && <Mensajes a={q.data} />}
      {seccion === 'cuenta' && <Cuenta />}
    </div>
  )
}

function useFormAjustes(a: Ajustes) {
  const [f, setF] = useState<Ajustes>(a)
  const guardar = useGuardarAjustes()
  useEffect(() => setF(a), [a])
  const set = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) => setF((x) => ({ ...x, [k]: v }))
  const enviar = async (campos: (keyof Ajustes)[], validar?: () => string | null) => {
    const err = validar?.()
    if (err) return toast.error(err)
    const cambios = Object.fromEntries(campos.map((k) => [k, typeof f[k] === 'string' && (f[k] as string).trim() === '' ? null : f[k]]))
    try {
      await guardar.mutateAsync(cambios)
      toast.success('Cambios guardados')
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }
  return { f, set, enviar, guardando: guardar.isPending }
}

function Pie({ onClick, cargando }: { onClick: () => void; cargando: boolean }) {
  return <div className="flex justify-end pt-2"><Button onClick={onClick} cargando={cargando}>Guardar cambios</Button></div>
}

// ---------------------------------------------------------------- Negocio
function Negocio({ a }: { a: Ajustes }) {
  const { f, set, enviar, guardando } = useFormAjustes(a)
  const campos: (keyof Ajustes)[] = ['nombre_negocio', 'eslogan', 'presentacion', 'nombre_manicurista', 'whatsapp', 'instagram', 'direccion', 'zona', 'maps_url', 'horarios_texto', 'logo_path', 'portada_path', 'foto_perfil_path']
  return (
    <div className="space-y-5">
      <Tarjeta className="grid gap-4 p-5 sm:grid-cols-2">
        <Input etiqueta="Nombre del emprendimiento" value={f.nombre_negocio ?? ''} onChange={(e) => set('nombre_negocio', e.target.value)} />
        <Input etiqueta="Tu nombre" opcional value={f.nombre_manicurista ?? ''} onChange={(e) => set('nombre_manicurista', e.target.value)} />
        <Input contenedor="sm:col-span-2" etiqueta="Frase corta" opcional value={f.eslogan ?? ''} onChange={(e) => set('eslogan', e.target.value)} placeholder="Ej: Uñas prolijas que duran" />
        <Textarea contenedor="sm:col-span-2" etiqueta="Presentación" opcional rows={4} value={f.presentacion ?? ''} onChange={(e) => set('presentacion', e.target.value)} placeholder="Contá quién sos, cómo trabajás, qué productos usás…" />
      </Tarjeta>
      <Tarjeta className="grid gap-4 p-5 sm:grid-cols-3">
        <Imagen etiqueta="Logo" path={f.logo_path} onChange={(p) => set('logo_path', p)} />
        <Imagen etiqueta="Foto principal (portada)" path={f.portada_path} onChange={(p) => set('portada_path', p)} />
        <Imagen etiqueta="Tu foto" path={f.foto_perfil_path} onChange={(p) => set('foto_perfil_path', p)} />
      </Tarjeta>
      <Tarjeta className="grid gap-4 p-5 sm:grid-cols-2">
        <Input etiqueta="WhatsApp del negocio" type="tel" value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="11 2345-6789" />
        <Input etiqueta="Instagram" value={f.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@tuemprendimiento" />
        <Input etiqueta="Dirección" opcional value={f.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} ayuda="Si atendés en tu casa, podés poner solo la zona." />
        <Input etiqueta="Zona / barrio" opcional value={f.zona ?? ''} onChange={(e) => set('zona', e.target.value)} />
        <Input contenedor="sm:col-span-2" etiqueta="Link de Google Maps" opcional value={f.maps_url ?? ''} onChange={(e) => set('maps_url', e.target.value)} />
        <Textarea contenedor="sm:col-span-2" etiqueta="Texto de horarios para la web" opcional rows={2} value={f.horarios_texto ?? ''} onChange={(e) => set('horarios_texto', e.target.value)} ayuda="Si lo dejás vacío, se arma solo con tus horarios de atención." />
      </Tarjeta>
      <Pie cargando={guardando} onClick={() => enviar(campos, () => (f.whatsapp && !telefonoValido(f.whatsapp) ? 'El WhatsApp no parece válido.' : null))} />
    </div>
  )
}

function Imagen({ etiqueta, path, onChange }: { etiqueta: string; path: string | null; onChange: (p: string | null) => void }) {
  const [subiendo, setSubiendo] = useState(false)
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-tinta-soft">{etiqueta}</p>
      <label className="relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-nude-300 bg-nude-50 text-gris hover:border-rosa-300">
        {path ? <img src={urlPublica(path)!} alt="" className="size-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-sm"><ImagePlus className="size-6" />{subiendo ? 'Subiendo…' : 'Elegir imagen'}</span>}
        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setSubiendo(true)
          try {
            const nuevo = await subirImagen(file, 'marca')
            const viejo = path
            onChange(nuevo)
            if (viejo) borrarImagen(viejo)
            toast.info('Imagen lista. Tocá “Guardar cambios”.')
          } catch (err) {
            toast.error(mensajeError(err))
          } finally {
            setSubiendo(false)
          }
        }} />
      </label>
      {path && <button className="mt-1 text-xs text-gris hover:text-red-600" onClick={() => onChange(null)}>Quitar</button>}
    </div>
  )
}

// ---------------------------------------------------------------- Horarios
function Horarios({ a }: { a: Ajustes }) {
  const h = useHorarios()
  const guardarH = useGuardarHorarios()
  const { f, set, enviar, guardando } = useFormAjustes(a)
  const [franjas, setFranjas] = useState<{ dia_semana: number; hora_inicio: string; hora_fin: string }[]>([])
  useEffect(() => {
    if (h.data) setFranjas(h.data.map((x) => ({ dia_semana: x.dia_semana, hora_inicio: x.hora_inicio.slice(0, 5), hora_fin: x.hora_fin.slice(0, 5) })))
  }, [h.data])
  if (h.isLoading) return <Cargando />
  const orden = [1, 2, 3, 4, 5, 6, 0]

  const guardarFranjas = async () => {
    for (const fr of franjas) if (fr.hora_fin <= fr.hora_inicio) return toast.error(`${DIAS_SEMANA[fr.dia_semana]}: la hora de fin tiene que ser posterior a la de inicio.`)
    try {
      await guardarH.mutateAsync(franjas)
      toast.success('Horarios guardados')
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  return (
    <div className="space-y-5">
      <Tarjeta className="p-5">
        <h2 className="titulo-display mb-1 text-xl">Horario de atención</h2>
        <p className="mb-4 text-sm text-gris">Define qué horarios se ofrecen en la web. Para un descanso (ej. almuerzo) agregá dos franjas el mismo día.</p>
        <div className="divide-y divide-linea">
          {orden.map((d) => {
            const delDia = franjas.map((x, i) => ({ ...x, i })).filter((x) => x.dia_semana === d)
            return (
              <div key={d} className="flex flex-wrap items-start gap-3 py-3">
                <span className="w-24 pt-2 font-medium">{DIAS_SEMANA[d]}</span>
                <div className="flex-1 space-y-2">
                  {delDia.length === 0 && <p className="pt-2 text-sm text-gris">No atiendo</p>}
                  {delDia.map((x) => (
                    <div key={x.i} className="flex items-center gap-2">
                      <input type="time" value={x.hora_inicio} onChange={(e) => setFranjas(franjas.map((y, j) => (j === x.i ? { ...y, hora_inicio: e.target.value } : y)))} className="rounded-lg border border-linea px-2 py-1.5" aria-label="Desde" />
                      <span className="text-gris">a</span>
                      <input type="time" value={x.hora_fin} onChange={(e) => setFranjas(franjas.map((y, j) => (j === x.i ? { ...y, hora_fin: e.target.value } : y)))} className="rounded-lg border border-linea px-2 py-1.5" aria-label="Hasta" />
                      <button onClick={() => setFranjas(franjas.filter((_, j) => j !== x.i))} className="rounded-full p-1.5 text-gris hover:text-red-600" aria-label="Quitar franja"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFranjas([...franjas, { dia_semana: d, hora_inicio: delDia.length ? delDia[delDia.length - 1].hora_fin : '09:00', hora_fin: '18:00' }])} className="inline-flex items-center gap-1 pt-2 text-sm text-rosa-600">
                  <Plus className="size-4" /> Franja
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end pt-3"><Button onClick={guardarFranjas} cargando={guardarH.isPending}>Guardar horarios</Button></div>
      </Tarjeta>
      <Tarjeta className="grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="titulo-display text-xl sm:col-span-3">Grilla de la agenda</h2>
        <Input type="time" etiqueta="La agenda arranca" value={f.agenda_hora_inicio.slice(0, 5)} onChange={(e) => set('agenda_hora_inicio', e.target.value)} />
        <Input type="time" etiqueta="La agenda termina" value={f.agenda_hora_fin.slice(0, 5)} onChange={(e) => set('agenda_hora_fin', e.target.value)} />
        <Select etiqueta="Turnos cada" value={f.intervalo_turnos_min} onChange={(e) => set('intervalo_turnos_min', Number(e.target.value))}>
          {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
        </Select>
        <div className="sm:col-span-3"><Pie cargando={guardando} onClick={() => enviar(['agenda_hora_inicio', 'agenda_hora_fin', 'intervalo_turnos_min'], () => (f.agenda_hora_fin <= f.agenda_hora_inicio ? 'La hora de fin tiene que ser posterior.' : null))} /></div>
      </Tarjeta>
    </div>
  )
}

// ---------------------------------------------------------------- Reservas y seña
function Reservas({ a }: { a: Ajustes }) {
  const { f, set, enviar, guardando } = useFormAjustes(a)
  return (
    <div className="space-y-5">
      <Tarjeta className="space-y-3 p-5">
        <h2 className="titulo-display text-xl">Reservas desde la web</h2>
        <Toggle checked={f.reservas_web_activas} onChange={(v) => set('reservas_web_activas', v)} etiqueta="Recibir pedidos de turno online" descripcion="Si lo apagás, la web muestra solo el botón de WhatsApp." />
        <Toggle checked={f.confirmacion_automatica} onChange={(v) => set('confirmacion_automatica', v)} etiqueta="Confirmar automáticamente" descripcion="Si está apagado, cada pedido queda “pendiente” hasta que lo confirmes vos (recomendado)." />
        <div className="grid gap-4 pt-2 sm:grid-cols-3">
          <Input type="number" inputMode="numeric" etiqueta="Anticipación mínima (horas)" value={f.anticipacion_min_horas} onChange={(e) => set('anticipacion_min_horas', Number(e.target.value))} />
          <Input type="number" inputMode="numeric" etiqueta="Se puede reservar hasta (días)" value={f.ventana_reserva_dias} onChange={(e) => set('ventana_reserva_dias', Number(e.target.value))} />
          <Input type="number" inputMode="numeric" etiqueta="Pedidos pendientes por persona" value={f.max_pendientes_por_contacto} onChange={(e) => set('max_pendientes_por_contacto', Number(e.target.value))} ayuda="Evita reservas en masa." />
        </div>
      </Tarjeta>
      <Tarjeta className="space-y-3 p-5">
        <h2 className="titulo-display text-xl">Seña</h2>
        <Toggle checked={f.sena_requerida} onChange={(v) => set('sena_requerida', v)} etiqueta="Pedir seña para confirmar" descripcion="Se sugiere en cada turno y se avisa en la web. El pago se registra a mano cuando llega." />
        {f.sena_requerida && (
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <Select etiqueta="Tipo de seña" value={f.sena_tipo} onChange={(e) => set('sena_tipo', e.target.value as Ajustes['sena_tipo'])}>
              <option value="monto">Monto fijo</option>
              <option value="porcentaje">Porcentaje del total</option>
            </Select>
            <Input etiqueta={f.sena_tipo === 'monto' ? 'Monto' : 'Porcentaje'} inputMode="decimal" prefijo={f.sena_tipo === 'monto' ? '$' : '%'} value={String(f.sena_valor ?? '')} onChange={(e) => set('sena_valor', parseDinero(e.target.value))} />
            <Textarea contenedor="sm:col-span-2" etiqueta="Datos para transferir la seña" rows={2} value={f.datos_transferencia ?? ''} onChange={(e) => set('datos_transferencia', e.target.value)} placeholder="Alias / CBU / titular" />
          </div>
        )}
        <Textarea etiqueta="Política de cancelación" opcional rows={2} value={f.politica_cancelacion ?? ''} onChange={(e) => set('politica_cancelacion', e.target.value)} placeholder="Ej: Avisá con 24 h de anticipación. La seña no se devuelve si no venís." />
      </Tarjeta>
      <Pie cargando={guardando} onClick={() => enviar(['reservas_web_activas', 'confirmacion_automatica', 'anticipacion_min_horas', 'ventana_reserva_dias', 'max_pendientes_por_contacto', 'sena_requerida', 'sena_tipo', 'sena_valor', 'datos_transferencia', 'politica_cancelacion'],
        () => (f.sena_tipo === 'porcentaje' && f.sena_valor > 100 ? 'El porcentaje de seña no puede superar 100.' : null))} />
    </div>
  )
}

// ---------------------------------------------------------------- Finanzas
function FinanzasAjustes({ a }: { a: Ajustes }) {
  const { f, set, enviar, guardando } = useFormAjustes(a)
  const cats = useCategoriasGasto()
  const guardarCat = useGuardarCategoriaGasto()
  const borrarCat = useBorrarCategoriaGasto()
  const [nueva, setNueva] = useState('')
  const suma = Number(f.reparto_sueldo_pct) + Number(f.reparto_ganancia_pct) + Number(f.reparto_insumos_pct)
  return (
    <div className="space-y-5">
      <Tarjeta className="p-5">
        <h2 className="titulo-display text-xl">Reparto de ingresos</h2>
        <p className="mb-4 text-sm text-gris">Como en tu agenda: del total, una parte es tu sueldo y el resto se divide entre ganancia e insumos.</p>
        <div className="grid grid-cols-3 gap-3">
          <Input etiqueta="Sueldo %" inputMode="decimal" value={f.reparto_sueldo_pct} onChange={(e) => set('reparto_sueldo_pct', Number(e.target.value.replace(',', '.')) || 0)} />
          <Input etiqueta="Ganancia %" inputMode="decimal" value={f.reparto_ganancia_pct} onChange={(e) => set('reparto_ganancia_pct', Number(e.target.value.replace(',', '.')) || 0)} />
          <Input etiqueta="Insumos %" inputMode="decimal" value={f.reparto_insumos_pct} onChange={(e) => set('reparto_insumos_pct', Number(e.target.value.replace(',', '.')) || 0)} />
        </div>
        <p className={`mt-2 text-sm ${suma === 100 ? 'text-gris' : 'text-red-600'}`}>Suma: {suma}% {suma !== 100 && '(tiene que dar 100%)'}</p>
        <Pie cargando={guardando} onClick={() => enviar(['reparto_sueldo_pct', 'reparto_ganancia_pct', 'reparto_insumos_pct'], () => (suma !== 100 ? 'Los porcentajes tienen que sumar 100%.' : null))} />
      </Tarjeta>
      <Tarjeta className="p-5">
        <h2 className="titulo-display mb-1 text-xl">Categorías de gastos</h2>
        <p className="mb-3 text-sm text-gris">Las marcadas como “insumo” se comparan con el % de insumos del reparto.</p>
        <ul className="divide-y divide-linea">
          {cats.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <input defaultValue={c.nombre} className="flex-1 rounded-lg border border-transparent px-2 py-1.5 hover:border-linea focus:border-rosa-400 focus:outline-none" onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && guardarCat.mutate({ id: c.id, nombre: e.target.value.trim() })} />
              <Checkbox etiqueta="Insumo" checked={c.es_insumo} onChange={(e) => guardarCat.mutate({ id: c.id, nombre: c.nombre, es_insumo: e.target.checked })} />
              <button className="rounded-full p-1.5 text-gris hover:text-red-600" aria-label="Borrar" onClick={() => borrarCat.mutate(c.id, { onError: (er) => toast.error(mensajeError(er)) })}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) guardarCat.mutate({ nombre: nueva.trim(), orden: cats.data?.length ?? 0 }, { onSuccess: () => setNueva(''), onError: (er) => toast.error(mensajeError(er)) }) }}>
          <Input contenedor="flex-1" placeholder="Nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <Button type="submit">Agregar</Button>
        </form>
      </Tarjeta>
    </div>
  )
}

// ---------------------------------------------------------------- Mensajes
function Mensajes({ a }: { a: Ajustes }) {
  const { f, set, enviar, guardando } = useFormAjustes(a)
  const campos = [
    ['plantilla_confirmacion', 'confirmacion'], ['plantilla_recordatorio', 'recordatorio'], ['plantilla_sena', 'sena'],
    ['plantilla_cambio', 'cambio'], ['plantilla_saldo', 'saldo'], ['plantilla_cumpleanos', 'cumpleanos'],
  ] as const
  return (
    <div className="space-y-5">
      <Tarjeta className="space-y-4 p-5">
        <p className="text-sm text-gris">
          Variables disponibles: <code>{'{nombre}'}</code> <code>{'{fecha}'}</code> <code>{'{hora}'}</code> <code>{'{servicio}'}</code> <code>{'{total}'}</code> <code>{'{sena}'}</code> <code>{'{saldo}'}</code> <code>{'{negocio}'}</code>.
          Los mensajes se abren en WhatsApp para que los mandes vos (no hay envíos automáticos).
        </p>
        {campos.map(([k, t]) => (
          <Textarea key={k} etiqueta={TITULOS_MENSAJE[t]} rows={2} value={f[k]} onChange={(e) => set(k, e.target.value)} />
        ))}
      </Tarjeta>
      <Pie cargando={guardando} onClick={() => enviar(campos.map(([k]) => k), () => (campos.some(([k]) => !f[k].trim()) ? 'Ninguna plantilla puede quedar vacía.' : null))} />
    </div>
  )
}

// ---------------------------------------------------------------- Cuenta
function Equipo() {
  const perfil = usePerfil()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const equipo = useQuery({
    queryKey: ['equipo'],
    queryFn: async () => datos<{ id: string; nombre: string | null; rol: 'duena' | 'staff'; email: string }[]>(await supabase.rpc('listar_equipo')),
  })
  const agregar = useMutation({
    mutationFn: async () => datos(await supabase.rpc('agregar_staff', { p_email: email })),
    onSuccess: () => {
      setEmail('')
      toast.success('Acceso otorgado')
      qc.invalidateQueries({ queryKey: ['equipo'] })
    },
    onError: (e) => toast.error(mensajeError(e)),
  })
  const quitar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('perfiles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipo'] }),
    onError: (e) => toast.error(mensajeError(e)),
  })
  const esDuena = perfil.data?.rol === 'duena'
  return (
    <Tarjeta className="max-w-lg space-y-3 p-5">
      <h2 className="titulo-display text-xl">Equipo</h2>
      <p className="text-sm text-gris">Personas con acceso al panel. Para sumar a alguien: que cree su cuenta en la pantalla de ingreso y después la agregás acá con su email.</p>
      <ul className="divide-y divide-linea">
        {equipo.data?.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span><b>{m.nombre ?? m.email}</b> <span className="text-gris">· {m.email} · {m.rol === 'duena' ? 'dueña' : 'colaboradora'}</span></span>
            {esDuena && m.rol !== 'duena' && <button className="text-gris hover:text-red-600" onClick={() => quitar.mutate(m.id)}>Quitar</button>}
          </li>
        ))}
      </ul>
      {esDuena && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) agregar.mutate() }}>
          <Input contenedor="flex-1" type="email" placeholder="email@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" cargando={agregar.isPending}>Dar acceso</Button>
        </form>
      )}
    </Tarjeta>
  )
}

function Cuenta() {
  return (
    <div className="space-y-5">
      <CambiarClave />
      <Equipo />
    </div>
  )
}

function CambiarClave() {
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [cargando, setCargando] = useState(false)
  return (
    <Tarjeta className="max-w-lg space-y-4 p-5">
      <h2 className="titulo-display text-xl">Cambiar contraseña</h2>
      <Input type="password" etiqueta="Nueva contraseña" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} ayuda="Mínimo 8 caracteres." />
      <Input type="password" etiqueta="Repetir" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      <div className="flex justify-end">
        <Button cargando={cargando} onClick={async () => {
          if (clave.length < 8) return toast.error('La contraseña tiene que tener al menos 8 caracteres.')
          if (clave !== repetir) return toast.error('Las contraseñas no coinciden.')
          setCargando(true)
          const { error } = await supabase.auth.updateUser({ password: clave })
          setCargando(false)
          if (error) return toast.error(mensajeError(error))
          setClave('')
          setRepetir('')
          toast.success('Contraseña actualizada')
        }}>Actualizar</Button>
      </div>
    </Tarjeta>
  )
}
