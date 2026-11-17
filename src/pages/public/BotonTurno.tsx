import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarHeart, MessageCircle } from 'lucide-react'
import { Instagram } from '@/components/IconoInstagram'
import { linkInstagram } from '@/lib/telefono'
import type { AjustesPublicos } from '@/lib/types'
import { linkWhatsApp } from '@/lib/whatsapp'

/** Canal para pedir turno: la reserva online si está activa; si no, WhatsApp; si no, Instagram. */
export function canalTurno(a: AjustesPublicos | undefined) {
  if (!a || a.reservas_web_activas) return { tipo: 'web' as const, href: '/reservar', etiqueta: 'Pedir turno' }
  if (a.whatsapp) return { tipo: 'externo' as const, href: linkWhatsApp(a.whatsapp, '¡Hola! Quería pedir un turno 💅'), etiqueta: 'Escribime por WhatsApp' }
  const insta = linkInstagram(a.instagram)
  if (insta) return { tipo: 'externo' as const, href: insta, etiqueta: 'Escribime por Instagram' }
  return null
}

export function BotonTurno({ a, className, conIcono, etiqueta }: { a: AjustesPublicos | undefined; className: string; conIcono?: boolean; etiqueta?: ReactNode }) {
  const c = canalTurno(a)
  if (!c) return null
  const icono = !conIcono ? null : c.tipo === 'web' ? <CalendarHeart className="size-5" /> : a?.whatsapp ? <MessageCircle className="size-5" /> : <Instagram className="size-5" />
  const texto = etiqueta ?? c.etiqueta
  if (c.tipo === 'web') return <Link to={c.href} className={className}>{icono}{texto}</Link>
  return <a href={c.href} target="_blank" rel="noreferrer" className={className}>{icono}{texto}</a>
}
