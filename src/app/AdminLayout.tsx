import clsx from 'clsx'
import {
  Ban, Cake, CalendarDays, CalendarHeart, CalendarPlus, CreditCard, Gift, Globe, Images, LayoutGrid, LogOut, Megaphone,
  Plus, Receipt, Settings, Sparkles, Tag, UserPlus, Users, Wallet, X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAjustes } from '@/features/ajustes/api'
import { useTurnosPendientes } from '@/features/turnos/api'
import { AccionesProvider, useAcciones } from './acciones'
import { useAuth } from './auth'

const PRINCIPALES = [
  { to: '/admin', etiqueta: 'Inicio', icono: LayoutGrid, fin: true },
  { to: '/admin/agenda', etiqueta: 'Agenda', icono: CalendarDays },
  { to: '/admin/clientas', etiqueta: 'Clientas', icono: Users },
  { to: '/admin/finanzas', etiqueta: 'Finanzas', icono: Wallet },
]

const SECUNDARIAS = [
  { to: '/admin/servicios', etiqueta: 'Servicios y precios', icono: Sparkles },
  { to: '/admin/galeria', etiqueta: 'Galería', icono: Images },
  { to: '/admin/promociones', etiqueta: 'Promociones', icono: Tag },
  { to: '/admin/cumpleanos', etiqueta: 'Cumpleaños', icono: Cake },
  { to: '/admin/avisos', etiqueta: 'Avisos a clientas', icono: Megaphone },
  { to: '/admin/mi-calendario', etiqueta: 'Mi calendario', icono: CalendarHeart },
  { to: '/admin/ajustes', etiqueta: 'Ajustes', icono: Settings },
]

export function AdminLayout() {
  return (
    <AccionesProvider>
      <Estructura />
    </AccionesProvider>
  )
}

function Estructura() {
  const { salir } = useAuth()
  const { data: ajustes } = useAjustes()
  const pendientes = useTurnosPendientes()
  const [mas, setMas] = useState(false)
  const [rapido, setRapido] = useState(false)
  const loc = useLocation()
  const nPend = pendientes.data?.length ?? 0

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-linea bg-white/70 px-4 py-6 backdrop-blur lg:flex">
        <div className="mb-6 px-2">
          <p className="titulo-display text-2xl leading-none">{ajustes?.nombre_negocio || 'Mi agenda'}</p>
          <p className="mt-1 text-xs text-gris">Panel de gestión</p>
        </div>
        <BotonRapido onClick={() => setRapido(true)} />
        <nav className="scroll-fino mt-5 flex-1 space-y-0.5 overflow-y-auto">
          {PRINCIPALES.map((i) => (
            <ItemNav key={i.to} {...i} badge={i.to === '/admin/agenda' ? nPend : 0} />
          ))}
          <div className="my-3 border-t border-linea" />
          {SECUNDARIAS.map((i) => (
            <ItemNav key={i.to} {...i} />
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-linea pt-3">
          <a href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gris hover:bg-nude-100">
            <Globe className="size-4" /> Ver página pública
          </a>
          <button onClick={salir} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gris hover:bg-nude-100">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
        <div key={loc.pathname} className="mx-auto max-w-6xl animate-aparecer">
          <Outlet />
        </div>
      </main>

      {/* Barra inferior (celular) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
          {PRINCIPALES.slice(0, 2).map((i) => (
            <ItemInferior key={i.to} {...i} badge={i.to === '/admin/agenda' ? nPend : 0} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => setRapido(true)}
              aria-label="Acciones rápidas"
              className="-mt-6 mb-1 inline-flex size-14 items-center justify-center rounded-full bg-rosa-500 text-white shadow-flotante active:scale-95"
            >
              <Plus className="size-7" />
            </button>
          </div>
          <ItemInferior {...PRINCIPALES[2]} />
          <button onClick={() => setMas(true)} className="flex flex-col items-center gap-0.5 py-1.5 text-[11px] text-gris">
            <LayoutGrid className="size-6" />
            Más
          </button>
        </div>
      </nav>

      {mas && <MenuMas onCerrar={() => setMas(false)} salir={salir} />}
      {rapido && <MenuRapido onCerrar={() => setRapido(false)} />}
    </div>
  )
}

function ItemNav({ to, etiqueta, icono: Icono, fin, badge }: { to: string; etiqueta: string; icono: typeof Users; fin?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={fin}
      className={({ isActive }) =>
        clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition', isActive ? 'bg-rosa-50 font-medium text-rosa-700' : 'text-tinta-soft hover:bg-nude-100')
      }
    >
      <Icono className="size-[18px]" />
      <span className="flex-1">{etiqueta}</span>
      {!!badge && <span className="rounded-full bg-amber-400 px-2 text-xs font-semibold text-white">{badge}</span>}
    </NavLink>
  )
}

function ItemInferior({ to, etiqueta, icono: Icono, fin, badge }: { to: string; etiqueta: string; icono: typeof Users; fin?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={fin} className={({ isActive }) => clsx('relative flex flex-col items-center gap-0.5 py-1.5 text-[11px]', isActive ? 'font-medium text-rosa-600' : 'text-gris')}>
      <Icono className="size-6" />
      {etiqueta}
      {!!badge && <span className="absolute right-3 top-0.5 min-w-4 rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-white">{badge}</span>}
    </NavLink>
  )
}

function BotonRapido({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-full bg-rosa-500 py-3 font-medium text-white shadow-sm hover:bg-rosa-600">
      <Plus className="size-5" /> Nuevo
    </button>
  )
}

function Hoja({ onCerrar, titulo, children }: { onCerrar: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-aparecer bg-tinta/40" onClick={onCerrar} />
      <div className="safe-bottom relative w-full max-w-md animate-subir rounded-t-3xl bg-crema p-5 shadow-flotante sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="titulo-display text-2xl">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-full p-2 text-gris hover:bg-nude-100" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function MenuRapido({ onCerrar }: { onCerrar: () => void }) {
  const a = useAcciones()
  const items = [
    { etiqueta: 'Turno', icono: CalendarPlus, fn: () => a.nuevoTurno() },
    { etiqueta: 'Clienta', icono: UserPlus, fn: () => a.nuevaClienta() },
    { etiqueta: 'Ingreso', icono: CreditCard, fn: () => a.nuevoPago() },
    { etiqueta: 'Gasto', icono: Receipt, fn: () => a.nuevoGasto() },
    { etiqueta: 'Bloquear horario', icono: Ban, fn: () => a.bloquear() },
    { etiqueta: 'Gift card', icono: Gift, fn: () => a.nuevoCredito('gift_card') },
  ]
  return (
    <Hoja onCerrar={onCerrar} titulo="Registrar…">
      <div className="grid grid-cols-3 gap-3">
        {items.map((i) => (
          <button
            key={i.etiqueta}
            onClick={() => {
              onCerrar()
              i.fn()
            }}
            className="flex flex-col items-center gap-2 rounded-2xl border border-linea bg-white px-2 py-4 text-sm font-medium text-tinta hover:border-rosa-300 active:scale-[0.98]"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-rosa-50 text-rosa-600">
              <i.icono className="size-5" />
            </span>
            {i.etiqueta}
          </button>
        ))}
      </div>
    </Hoja>
  )
}

function MenuMas({ onCerrar, salir }: { onCerrar: () => void; salir: () => Promise<void> }) {
  return (
    <Hoja onCerrar={onCerrar} titulo="Más opciones">
      <div className="grid grid-cols-3 gap-3">
        {[PRINCIPALES[3], ...SECUNDARIAS].map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            onClick={onCerrar}
            className="flex flex-col items-center gap-2 rounded-2xl border border-linea bg-white px-2 py-4 text-center text-[13px] font-medium text-tinta hover:border-rosa-300"
          >
            <i.icono className="size-5 text-rosa-500" />
            {i.etiqueta}
          </NavLink>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <a href="/" target="_blank" className="flex items-center gap-2 text-gris">
          <Globe className="size-4" /> Ver página pública
        </a>
        <button onClick={salir} className="flex items-center gap-2 text-gris">
          <LogOut className="size-4" /> Salir
        </button>
      </div>
    </Hoja>
  )
}
