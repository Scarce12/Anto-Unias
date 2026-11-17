import clsx from 'clsx'
import { MapPin, Menu, MessageCircle, X } from 'lucide-react'
import { Instagram } from '@/components/IconoInstagram'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAjustesPublicos } from '@/features/ajustes/api'
import { urlPublica } from '@/lib/supabase'
import { linkInstagram, urlSegura } from '@/lib/telefono'
import { linkWhatsApp } from '@/lib/whatsapp'

const LINKS = [
  { to: '/', etiqueta: 'Inicio', fin: true },
  { to: '/servicios', etiqueta: 'Servicios' },
  { to: '/trabajos', etiqueta: 'Trabajos' },
]

export function PublicLayout() {
  const { data: a } = useAjustesPublicos()
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    setMenu(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])
  useEffect(() => {
    document.title = a?.nombre_negocio ? `${a.nombre_negocio} · Uñas` : 'Uñas · Turnos online'
  }, [a?.nombre_negocio])

  const nombre = a?.nombre_negocio || 'Nail studio'
  const insta = linkInstagram(a?.instagram)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-linea/70 bg-crema/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            {a?.logo_path && <img src={urlPublica(a.logo_path)!} alt="" className="size-9 rounded-full object-cover" />}
            <span className="titulo-display text-2xl leading-none">{nombre}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.fin} className={({ isActive }) => clsx('rounded-full px-4 py-2 text-[15px] transition', isActive ? 'text-rosa-600' : 'text-tinta-soft hover:text-tinta')}>
                {l.etiqueta}
              </NavLink>
            ))}
            <Link to="/reservar" className="ml-2 rounded-full bg-tinta px-5 py-2.5 text-[15px] font-medium text-white hover:bg-tinta-soft">Pedir turno</Link>
          </nav>
          <button className="rounded-full p-2 md:hidden" onClick={() => setMenu(!menu)} aria-label="Menú" aria-expanded={menu}>
            {menu ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
        {menu && (
          <nav className="animate-aparecer border-t border-linea bg-crema px-4 pb-4 md:hidden">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.fin} className="block border-b border-linea/60 py-3.5 text-lg">{l.etiqueta}</NavLink>
            ))}
            <Link to="/reservar" className="mt-4 block rounded-full bg-tinta py-3 text-center font-medium text-white">Pedir turno</Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-linea bg-nude-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="titulo-display text-2xl">{nombre}</p>
            {a?.eslogan && <p className="mt-1 text-sm text-gris">{a.eslogan}</p>}
          </div>
          <div className="space-y-2 text-sm">
            {(a?.direccion || a?.zona) && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-rosa-500" />
                {urlSegura(a.maps_url) ? <a href={urlSegura(a.maps_url)!} target="_blank" rel="noreferrer" className="hover:underline">{[a.direccion, a.zona].filter(Boolean).join(', ')}</a> : [a.direccion, a.zona].filter(Boolean).join(', ')}
              </p>
            )}
            {a?.whatsapp && <a href={linkWhatsApp(a.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><MessageCircle className="size-4 text-rosa-500" /> {a.whatsapp}</a>}
            {insta && <a href={insta} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><Instagram className="size-4 text-rosa-500" /> {a?.instagram}</a>}
          </div>
          <div className="text-sm text-gris sm:text-right">
            <Link to="/ingresar" className="hover:text-tinta">Acceso administración</Link>
          </div>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp en celulares */}
      {a?.whatsapp && !loc.pathname.startsWith('/reservar') && (
        <a href={linkWhatsApp(a.whatsapp, '¡Hola! Quería consultar por un turno 💅')} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"
          className="fixed bottom-5 right-5 z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-flotante md:hidden">
          <MessageCircle className="size-7" />
        </a>
      )}
    </div>
  )
}
