import clsx from 'clsx'
import { AlertTriangle, Bell, Cake, CalendarCheck, CalendarPlus, Clock, CreditCard, MessageCircle, Receipt, Sparkles, UserPlus, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAcciones } from '@/app/acciones'
import { usePerfil } from '@/app/auth'
import { MensajeWhatsApp } from '@/components/Mensajes'
import { Badge, ErrorCarga, Esqueleto, Tarjeta } from '@/components/ui/Basicos'
import { useDashboard } from '@/features/finanzas/api'
import { useTurnosPendientes, useTurnosRango, useTurnosSinCerrar } from '@/features/turnos/api'
import { capitalizar, fechaISO, fmt, horaTexto, hoyISO, sumarDias } from '@/lib/fechas'
import { dinero, ESTADOS_PAGO, ESTADOS_TURNO } from '@/lib/formato'
import type { TurnoDetalle } from '@/lib/types'

export function DashboardPage() {
  const perfil = usePerfil()
  const dash = useDashboard()
  const a = useAcciones()
  const hoy = hoyISO()
  const proximos = useTurnosRango(hoy, sumarDias(hoy, 1), false)
  const pendientes = useTurnosPendientes()
  const sinCerrar = useTurnosSinCerrar()
  const [cumple, setCumple] = useState<{ nombre: string; whatsapp: string | null } | null>(null)

  const d = dash.data
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const deHoy = proximos.data?.filter((t) => fechaISO(t.inicio) === hoy) ?? []
  const deManana = proximos.data?.filter((t) => fechaISO(t.inicio) !== hoy && t.estado !== 'finalizado') ?? []

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gris">{capitalizar(fmt(new Date(), "EEEE d 'de' MMMM"))}</p>
        <h1 className="titulo-display text-3xl sm:text-4xl">
          {saludo}{perfil.data?.nombre ? `, ${perfil.data.nombre}` : ''} 💅
        </h1>
      </div>

      {dash.error && <ErrorCarga error={dash.error} reintentar={() => dash.refetch()} />}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icono={<CalendarCheck />} etiqueta="Turnos hoy" valor={d?.turnos_hoy} to="/admin/agenda" />
        <Indicador icono={<Clock />} etiqueta="Por confirmar" valor={d?.pendientes} destacar={!!d?.pendientes} to="/admin/agenda?vista=pendientes" />
        <Indicador icono={<Wallet />} etiqueta="Ingresos hoy" valor={d ? dinero(d.ingresos_hoy) : undefined} to="/admin/finanzas" />
        <Indicador icono={<Wallet />} etiqueta="Ingresos del mes" valor={d ? dinero(d.ingresos_mes) : undefined} sub={d && `Gastos ${dinero(d.gastos_mes)}`} to="/admin/finanzas" />
      </div>

      {/* Accesos rápidos */}
      <div className="scroll-fino -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Acceso icono={<CalendarPlus />} texto="Nuevo turno" onClick={() => a.nuevoTurno()} />
        <Acceso icono={<UserPlus />} texto="Nueva clienta" onClick={() => a.nuevaClienta()} />
        <Acceso icono={<CreditCard />} texto="Registrar ingreso" onClick={() => a.nuevoPago()} />
        <Acceso icono={<Receipt />} texto="Registrar gasto" onClick={() => a.nuevoGasto()} />
        <Acceso icono={<Sparkles />} texto="Servicios" to="/admin/servicios" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Agenda de hoy */}
        <Tarjeta className="p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titulo-display text-2xl">Hoy</h2>
            <Link to="/admin/agenda" className="text-sm text-rosa-600 hover:underline">Ver agenda</Link>
          </div>
          {proximos.isLoading ? (
            <Esqueleto className="h-24" />
          ) : deHoy.length === 0 ? (
            <p className="py-6 text-center text-sm text-gris">No hay turnos para hoy.</p>
          ) : (
            <ListaTurnos turnos={deHoy} onClick={a.verTurno} />
          )}
          {deManana.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-gris">Mañana</h3>
              <ListaTurnos turnos={deManana} onClick={a.verTurno} />
            </>
          )}
        </Tarjeta>

        {/* Alertas */}
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta className="p-5">
            <h2 className="titulo-display mb-3 flex items-center gap-2 text-2xl">
              <Bell className="size-5 text-rosa-500" /> Para atender
            </h2>
            <ul className="space-y-2 text-[15px]">
              {!!pendientes.data?.length && (
                <Alerta color="amber" onClick={() => a.verTurno(pendientes.data![0].id)}>
                  {pendientes.data.length === 1 ? '1 pedido de turno por confirmar' : `${pendientes.data.length} pedidos de turno por confirmar`}
                </Alerta>
              )}
              {!!d?.sin_recordatorio_manana && (
                <Alerta color="rosa" to="/admin/agenda?dia=manana">
                  {d.sin_recordatorio_manana === 1 ? '1 turno de mañana' : `${d.sin_recordatorio_manana} turnos de mañana`} sin recordatorio enviado
                </Alerta>
              )}
              {!!d?.sin_sena && <Alerta color="violet" to="/admin/agenda?vista=lista&filtro=sin_sena">{d.sin_sena} turno(s) sin la seña pedida</Alerta>}
              {!!sinCerrar.data?.length && (
                <Alerta color="stone" onClick={() => a.verTurno(sinCerrar.data![0].id)}>
                  {sinCerrar.data.length} turno(s) pasados sin cerrar (¿finalizado o no asistió?)
                </Alerta>
              )}
              {!!d?.con_deuda && <Alerta color="red" to="/admin/clientas?filtro=deuda">{d.con_deuda} clienta(s) con saldo pendiente</Alerta>}
              {d && !d.pendientes && !d.sin_recordatorio_manana && !d.sin_sena && !sinCerrar.data?.length && !d.con_deuda && (
                <li className="py-2 text-sm text-gris">Todo al día ✨</li>
              )}
            </ul>
          </Tarjeta>

          {!!d?.cumpleanos.length && (
            <Tarjeta className="p-5">
              <h2 className="titulo-display mb-3 flex items-center gap-2 text-2xl">
                <Cake className="size-5 text-rosa-500" /> Cumpleaños
              </h2>
              <ul className="space-y-2">
                {d.cumpleanos.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{c.nombre}</span>
                      <span className="ml-2 text-sm text-gris">{c.en_dias === 0 ? '¡hoy!' : c.en_dias === 1 ? 'mañana' : `en ${c.en_dias} días`}</span>
                    </span>
                    {c.clienta_id && (
                      <button onClick={() => setCumple({ nombre: c.nombre.split(' ')[0], whatsapp: c.whatsapp })} className="rounded-full p-2 text-[#128C7E] hover:bg-green-50" aria-label="Saludar por WhatsApp">
                        <MessageCircle className="size-5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}

          <Tarjeta className="p-5">
            <h2 className="titulo-display mb-3 flex items-center gap-2 text-2xl">
              <Users className="size-5 text-rosa-500" /> Clientas
            </h2>
            <p className="text-[15px]">
              <b>{d?.clientas ?? '–'}</b> registradas · <b>{d?.clientas_fijas ?? '–'}</b> fijas
            </p>
            {!!d?.top_servicios.length && (
              <>
                <p className="mb-1.5 mt-4 text-sm font-medium text-gris">Más pedidos (últimos 90 días)</p>
                <ul className="space-y-1">
                  {d.top_servicios.map((s) => (
                    <li key={s.nombre} className="flex justify-between text-sm">
                      <span>{s.nombre}</span>
                      <span className="text-gris">{s.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Tarjeta>
        </div>
      </div>
      {cumple && (
        <MensajeWhatsApp abierto onCerrar={() => setCumple(null)} tipo="cumpleanos" telefono={cumple.whatsapp} variables={{ nombre: cumple.nombre }} />
      )}
    </div>
  )
}

function Indicador({ icono, etiqueta, valor, sub, destacar, to }: { icono: React.ReactNode; etiqueta: string; valor: React.ReactNode; sub?: React.ReactNode; destacar?: boolean; to: string }) {
  return (
    <Link to={to} className={clsx('tarjeta block p-4 transition hover:border-rosa-200', destacar && 'border-amber-200 bg-amber-50/50')}>
      <div className="flex items-center gap-2 text-sm text-gris [&>svg]:size-4">
        {icono}
        {etiqueta}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{valor ?? <Esqueleto className="h-7 w-16" />}</div>
      {sub && <p className="mt-0.5 text-xs text-gris">{sub}</p>}
    </Link>
  )
}

function Acceso({ icono, texto, onClick, to }: { icono: React.ReactNode; texto: string; onClick?: () => void; to?: string }) {
  const clase = 'inline-flex shrink-0 items-center gap-2 rounded-full border border-linea bg-white px-4 py-2.5 text-sm font-medium hover:border-rosa-300 [&>svg]:size-4 [&>svg]:text-rosa-500'
  return to ? (
    <Link to={to} className={clase}>{icono}{texto}</Link>
  ) : (
    <button onClick={onClick} className={clase}>{icono}{texto}</button>
  )
}

const coloresAlerta = {
  amber: 'bg-amber-50 text-amber-900',
  rosa: 'bg-rosa-50 text-rosa-800',
  violet: 'bg-violet-50 text-violet-900',
  stone: 'bg-stone-100 text-stone-700',
  red: 'bg-red-50 text-red-800',
}

function Alerta({ children, color, to, onClick }: { children: React.ReactNode; color: keyof typeof coloresAlerta; to?: string; onClick?: () => void }) {
  const clase = clsx('flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium', coloresAlerta[color])
  return (
    <li>
      {to ? (
        <Link to={to} className={clase}><AlertTriangle className="size-4 shrink-0" />{children}</Link>
      ) : (
        <button onClick={onClick} className={clase}><AlertTriangle className="size-4 shrink-0" />{children}</button>
      )}
    </li>
  )
}

export function ListaTurnos({ turnos, onClick }: { turnos: TurnoDetalle[]; onClick: (id: string) => void }) {
  return (
    <ul className="divide-y divide-linea">
      {turnos.map((t) => (
        <li key={t.id}>
          <button onClick={() => onClick(t.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-nude-50/60">
            <span className="w-14 shrink-0 text-center">
              <span className="block font-semibold">{horaTexto(t.inicio)}</span>
              <span className="block text-xs text-gris">{horaTexto(t.fin)}</span>
            </span>
            <span className={clsx('h-10 w-1 shrink-0 rounded-full', ESTADOS_TURNO[t.estado].punto)} />
            <span className="min-w-0 flex-1">
              <span className={clsx('block truncate font-medium', t.estado === 'cancelado' && 'line-through opacity-60')}>{t.clienta_nombre}</span>
              <span className="block truncate text-sm text-gris">{t.servicios_texto}</span>
            </span>
            <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
              <Badge className={ESTADOS_TURNO[t.estado].clase}>{ESTADOS_TURNO[t.estado].etiqueta}</Badge>
              <Badge className={ESTADOS_PAGO[t.estado_pago].clase}>{ESTADOS_PAGO[t.estado_pago].etiqueta}</Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
