import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Cargando } from '@/components/ui/Basicos'
import { supabase } from '@/lib/supabase'

interface Perfil {
  id: string
  nombre: string | null
  rol: 'duena' | 'staff'
}

interface AuthCtx {
  session: Session | null
  cargando: boolean
  salir: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: null, cargando: true, salir: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const salir = async () => {
    await supabase.auth.signOut()
  }

  return <Ctx value={{ session, cargando, salir }}>{children}</Ctx>
}

export function useAuth() {
  return use(Ctx)
}

export function usePerfil() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['perfil', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('perfiles').select('id, nombre, rol').eq('id', session!.user.id).maybeSingle()
      if (error) throw error
      return data as Perfil | null
    },
  })
}

/** Protege las rutas del panel: hace falta sesión y perfil de staff */
export function RequiereSesion({ children }: { children: ReactNode }) {
  const { session, cargando, salir } = useAuth()
  const perfil = usePerfil()
  const loc = useLocation()

  if (cargando || (session && perfil.isLoading)) return <Cargando className="min-h-dvh" />
  if (!session) return <Navigate to="/ingresar" replace state={{ desde: loc.pathname }} />
  if (!perfil.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="titulo-display text-3xl">Sin acceso</h1>
        <p className="max-w-sm text-gris">
          Esta cuenta ({session.user.email}) no tiene permiso para usar el panel. Pedile a la dueña que te agregue.
        </p>
        <button className="text-rosa-600 underline" onClick={salir}>
          Cerrar sesión
        </button>
      </div>
    )
  }
  return <>{children}</>
}
