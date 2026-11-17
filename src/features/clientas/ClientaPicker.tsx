import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Search, Star, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Basicos'
import { datos } from '@/lib/consultas'
import { nombreCompleto } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import type { Clienta } from '@/lib/types'
import { useClientas } from './api'
import { ClientaForm } from './ClientaForm'

interface Props {
  valor: string | null
  onChange: (id: string | null, c?: Clienta) => void
  error?: string
  inicialNueva?: { nombre?: string; whatsapp?: string; instagram?: string }
}

/** Buscar una clienta o registrarla ahí mismo sin salir del formulario del turno */
export function ClientaPicker({ valor, onChange, error, inicialNueva }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [nueva, setNueva] = useState(false)
  const lista = useClientas({ busqueda })
  const elegida = useQuery({
    queryKey: ['clienta', valor, 'mini'],
    enabled: !!valor,
    queryFn: async () => datos<Clienta>(await supabase.from('clientas').select('*').eq('id', valor!).single()),
  })

  if (valor && elegida.data) {
    const c = elegida.data
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rosa-200 bg-rosa-50/60 p-3">
        <Avatar nombre={nombreCompleto(c)} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium">
            {nombreCompleto(c)} {c.es_fija && <Star className="size-3.5 fill-rosa-400 text-rosa-400" />}
          </p>
          <p className="truncate text-sm text-gris">{[c.whatsapp, c.instagram].filter(Boolean).join(' · ') || 'Sin contacto'}</p>
          {c.alergias && <p className="mt-0.5 text-xs font-medium text-red-700">⚠ {c.alergias}</p>}
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-full p-2 text-gris hover:bg-white" aria-label="Cambiar clienta">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gris" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, WhatsApp o Instagram"
          className={clsx(
            'w-full rounded-xl border bg-white py-2.5 pl-10 pr-3.5 focus:border-rosa-400 focus:outline-none focus:ring-4 focus:ring-rosa-100',
            error ? 'border-red-300' : 'border-linea',
          )}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="scroll-fino mt-2 max-h-56 overflow-y-auto rounded-2xl border border-linea bg-white">
        <button
          type="button"
          onClick={() => setNueva(true)}
          className="flex w-full items-center gap-3 border-b border-linea px-3 py-2.5 text-left font-medium text-rosa-600 hover:bg-rosa-50"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-rosa-100">
            <UserPlus className="size-4" />
          </span>
          Registrar clienta nueva{busqueda.trim() ? ` “${busqueda.trim()}”` : ''}
        </button>
        {lista.isLoading && <p className="px-3 py-3 text-sm text-gris">Buscando…</p>}
        {lista.data?.slice(0, 40).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id, c)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-nude-50"
          >
            <Avatar nombre={nombreCompleto(c)} className="size-9 text-base" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                {nombreCompleto(c)} {c.es_fija && <Star className="size-3.5 fill-rosa-400 text-rosa-400" />}
              </span>
              <span className="block truncate text-xs text-gris">{[c.whatsapp, c.instagram].filter(Boolean).join(' · ') || 'Sin contacto'}</span>
            </span>
          </button>
        ))}
        {lista.data && lista.data.length === 0 && busqueda && <p className="px-3 py-3 text-sm text-gris">No hay coincidencias.</p>}
      </div>
      <ClientaForm
        abierto={nueva}
        onCerrar={() => setNueva(false)}
        inicial={{ nombre: inicialNueva?.nombre ?? busqueda.trim(), whatsapp: inicialNueva?.whatsapp, instagram: inicialNueva?.instagram }}
        onGuardada={(c) => onChange(c.id, c)}
        onElegirExistente={(id) => onChange(id)}
      />
    </div>
  )
}
