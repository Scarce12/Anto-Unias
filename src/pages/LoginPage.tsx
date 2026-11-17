import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Campos'
import { mensajeError } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const { session } = useAuth()
  const loc = useLocation()
  const [modo, setModo] = useState<'ingresar' | 'crear' | 'recuperar'>('ingresar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const hayDuena = useQuery({
    queryKey: ['hay-duena'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('hay_duena')
      if (error) throw error
      return data as boolean
    },
  })

  if (session) return <Navigate to={(loc.state as { desde?: string })?.desde ?? '/admin'} replace />

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.includes('@')) return setError('Escribí un email válido.')
    setCargando(true)
    try {
      if (modo === 'ingresar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
        if (error) throw error
      } else if (modo === 'crear') {
        if (clave.length < 8) throw new Error('La contraseña tiene que tener al menos 8 caracteres.')
        const { data, error } = await supabase.auth.signUp({ email, password: clave, options: { data: { nombre: nombre.trim() || undefined } } })
        if (error) throw error
        if (!data.session) toast.success('Cuenta creada. Revisá tu email para confirmarla y después ingresá.', { duration: 10000 })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/ajustes` })
        if (error) throw error
        toast.success('Te mandamos un email para restablecer la contraseña.')
        setModo('ingresar')
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-rosa-50 via-crema to-nude-100 p-4">
      <div className="w-full max-w-sm animate-subir">
        <Link to="/" className="mb-6 block text-center text-sm text-gris hover:text-tinta">← Ir a la página</Link>
        <div className="tarjeta p-6 sm:p-8">
          <h1 className="titulo-display text-center text-3xl">
            {modo === 'crear' ? 'Crear tu cuenta' : modo === 'recuperar' ? 'Recuperar acceso' : 'Panel de gestión'}
          </h1>
          {modo === 'crear' && (
            <p className="mt-2 text-center text-sm text-gris">
              {hayDuena.data === false
                ? 'Primera vez: esta cuenta va a ser la administradora del negocio.'
                : 'Después de crearla, la dueña tiene que darte acceso desde Ajustes → Cuenta.'}
            </p>
          )}
          <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
            {modo === 'crear' && <Input etiqueta="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />}
            <Input etiqueta="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {modo !== 'recuperar' && (
              <Input etiqueta="Contraseña" type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} value={clave} onChange={(e) => setClave(e.target.value)} />
            )}
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
            <Button type="submit" bloque tamano="lg" cargando={cargando}>
              {modo === 'crear' ? 'Crear cuenta' : modo === 'recuperar' ? 'Enviar email' : 'Ingresar'}
            </Button>
          </form>
          <div className="mt-5 space-y-2 text-center text-sm">
            {modo === 'ingresar' ? (
              <>
                <button className="text-gris hover:text-tinta" onClick={() => setModo('recuperar')}>Olvidé mi contraseña</button>
                {hayDuena.data === false ? (
                  <p><button className="font-medium text-rosa-600 hover:underline" onClick={() => setModo('crear')}>Primera vez: crear la cuenta administradora</button></p>
                ) : (
                  <p><button className="text-gris hover:text-tinta" onClick={() => setModo('crear')}>¿Te sumaron al equipo? Crear cuenta</button></p>
                )}
              </>
            ) : (
              <button className="text-gris hover:text-tinta" onClick={() => setModo('ingresar')}>Volver a ingresar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
