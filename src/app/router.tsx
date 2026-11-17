import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Link } from 'react-router-dom'
import { Cargando, Vacio } from '@/components/ui/Basicos'
import { HomePage } from '@/pages/public/HomePage'
import { PublicLayout } from '@/pages/public/PublicLayout'
import { RequiereSesion } from './auth'

// El panel se carga aparte: la web pública queda liviana para las clientas
const AdminLayout = lazy(() => import('./AdminLayout').then((m) => ({ default: m.AdminLayout })))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AgendaPage = lazy(() => import('@/pages/admin/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const ClientasPage = lazy(() => import('@/pages/admin/ClientasPage').then((m) => ({ default: m.ClientasPage })))
const ClientaDetallePage = lazy(() => import('@/pages/admin/ClientaDetallePage').then((m) => ({ default: m.ClientaDetallePage })))
const ServiciosPage = lazy(() => import('@/pages/admin/ServiciosPage').then((m) => ({ default: m.ServiciosPage })))
const FinanzasPage = lazy(() => import('@/pages/admin/FinanzasPage').then((m) => ({ default: m.FinanzasPage })))
const GaleriaAdminPage = lazy(() => import('@/pages/admin/GaleriaAdminPage').then((m) => ({ default: m.GaleriaAdminPage })))
const PromocionesPage = lazy(() => import('@/pages/admin/PromocionesPage').then((m) => ({ default: m.PromocionesPage })))
const CumpleanosPage = lazy(() => import('@/pages/admin/CumpleanosPage').then((m) => ({ default: m.CumpleanosPage })))
const AvisosPage = lazy(() => import('@/pages/admin/AvisosPage').then((m) => ({ default: m.AvisosPage })))
const AvisoDetallePage = lazy(() => import('@/pages/admin/AvisosPage').then((m) => ({ default: m.AvisoDetallePage })))
const MiCalendarioPage = lazy(() => import('@/pages/admin/MiCalendarioPage').then((m) => ({ default: m.MiCalendarioPage })))
const AjustesPage = lazy(() => import('@/pages/admin/AjustesPage').then((m) => ({ default: m.AjustesPage })))
const ServiciosPublicPage = lazy(() => import('@/pages/public/ServiciosPublicPage').then((m) => ({ default: m.ServiciosPublicPage })))
const GaleriaPublicPage = lazy(() => import('@/pages/public/GaleriaPublicPage').then((m) => ({ default: m.GaleriaPublicPage })))
const ReservarPage = lazy(() => import('@/pages/public/ReservarPage').then((m) => ({ default: m.ReservarPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))

const s = (el: ReactNode) => <Suspense fallback={<Cargando className="min-h-[50vh]" />}>{el}</Suspense>

function NoEncontrada() {
  return <Vacio className="min-h-[60vh] justify-center" titulo="Página no encontrada" accion={<Link to="/" className="text-rosa-600 underline">Volver al inicio</Link>} />
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/servicios', element: s(<ServiciosPublicPage />) },
      { path: '/trabajos', element: s(<GaleriaPublicPage />) },
      { path: '/reservar', element: s(<ReservarPage />) },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
  { path: '/ingresar', element: s(<LoginPage />) },
  {
    path: '/admin',
    element: <RequiereSesion>{s(<AdminLayout />)}</RequiereSesion>,
    children: [
      { index: true, element: s(<DashboardPage />) },
      { path: 'agenda', element: s(<AgendaPage />) },
      { path: 'clientas', element: s(<ClientasPage />) },
      { path: 'clientas/:id', element: s(<ClientaDetallePage />) },
      { path: 'servicios', element: s(<ServiciosPage />) },
      { path: 'finanzas', element: s(<FinanzasPage />) },
      { path: 'galeria', element: s(<GaleriaAdminPage />) },
      { path: 'promociones', element: s(<PromocionesPage />) },
      { path: 'cumpleanos', element: s(<CumpleanosPage />) },
      { path: 'avisos', element: s(<AvisosPage />) },
      { path: 'avisos/:id', element: s(<AvisoDetallePage />) },
      { path: 'mi-calendario', element: s(<MiCalendarioPage />) },
      { path: 'ajustes', element: s(<AjustesPage />) },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
])
