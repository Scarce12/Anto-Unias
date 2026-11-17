import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/app/auth'
import { router } from '@/app/router'
import { ConfirmarProvider } from '@/components/ui/Confirmar'
import { supabaseConfigurado } from '@/lib/supabase'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
})

function FaltaConfigurar() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="titulo-display text-4xl">Falta conectar la base de datos</h1>
      <p className="text-tinta-soft">
        Creá el archivo <code>.env.local</code> (copiando <code>.env.example</code>) con <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> de tu proyecto de Supabase, y volvé a iniciar la app. En Vercel se cargan en
        Settings → Environment Variables. Ver <code>docs/03_INSTALACION_Y_DESPLIEGUE.md</code>.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigurado ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmarProvider>
            <RouterProvider router={router} />
          </ConfirmarProvider>
        </AuthProvider>
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'DM Sans, sans-serif' } }} />
      </QueryClientProvider>
    ) : (
      <FaltaConfigurar />
    )}
  </StrictMode>,
)
