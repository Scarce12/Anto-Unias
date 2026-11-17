import { Search, Star, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAcciones } from '@/app/acciones'
import { Avatar, Cargando, Encabezado, ErrorCarga, Segmentado, Vacio } from '@/components/ui/Basicos'
import { Button } from '@/components/ui/Button'
import { useClientas } from '@/features/clientas/api'
import { descargarCSV } from '@/lib/csv'
import { fmt } from '@/lib/fechas'
import { dinero, nombreCompleto } from '@/lib/formato'

type Filtro = 'todas' | 'fijas' | 'frecuentes' | 'deuda' | 'archivadas'

export function ClientasPage() {
  const [params, setParams] = useSearchParams()
  const filtro = (params.get('filtro') as Filtro) || 'todas'
  const [busqueda, setBusqueda] = useState('')
  const a = useAcciones()
  const q = useClientas({
    busqueda,
    soloFijas: filtro === 'fijas',
    inactivas: filtro === 'archivadas',
    orden: filtro === 'frecuentes' ? 'visitas' : 'nombre',
  })
  const lista = filtro === 'deuda' ? q.data?.filter((c) => c.deuda > 0) : filtro === 'frecuentes' ? q.data?.filter((c) => c.visitas > 0) : q.data

  const exportar = () =>
    descargarCSV(
      'clientas',
      ['Nombre', 'Apellido', 'WhatsApp', 'Instagram', 'Fija', 'Visitas', 'Última visita', 'Inasistencias', 'Deuda', 'Cumpleaños'],
      (lista ?? []).map((c) => [
        c.nombre, c.apellido, c.whatsapp, c.instagram, c.es_fija ? 'Sí' : 'No', c.visitas,
        c.ultima_visita ? fmt(c.ultima_visita, 'dd/MM/yyyy') : '', c.inasistencias, c.deuda,
        c.cumple_dia ? `${c.cumple_dia}/${c.cumple_mes}` : '',
      ]),
    )

  return (
    <div>
      <Encabezado
        titulo="Clientas"
        subtitulo={q.data ? `${q.data.length} ${filtro === 'archivadas' ? 'archivadas' : 'en la lista'}` : undefined}
        acciones={
          <>
            <Button variante="secundario" onClick={exportar} disabled={!lista?.length}>Exportar</Button>
            <Button icono={<UserPlus className="size-4" />} onClick={() => a.nuevaClienta()}>Nueva clienta</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, apellido, WhatsApp o Instagram"
            className="w-full rounded-full border border-linea bg-white py-2.5 pl-10 pr-4 focus:border-rosa-400 focus:outline-none focus:ring-4 focus:ring-rosa-100"
            type="search"
          />
        </div>
        <div className="scroll-fino -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmentado
            valor={filtro}
            onChange={(v) => setParams(v === 'todas' ? {} : { filtro: v }, { replace: true })}
            opciones={[
              { valor: 'todas', etiqueta: 'Todas' },
              { valor: 'fijas', etiqueta: 'Fijas' },
              { valor: 'frecuentes', etiqueta: 'Frecuentes' },
              { valor: 'deuda', etiqueta: 'Con deuda' },
              { valor: 'archivadas', etiqueta: 'Archivadas' },
            ]}
          />
        </div>
      </div>

      {q.error ? (
        <ErrorCarga error={q.error} reintentar={() => q.refetch()} />
      ) : q.isLoading ? (
        <Cargando />
      ) : !lista?.length ? (
        <Vacio
          icono={<Users />}
          titulo={busqueda ? 'Sin resultados' : 'Todavía no hay clientas acá'}
          texto={busqueda ? 'Probá con otra parte del nombre o el número.' : 'Registrá tu primera clienta: alcanza con el nombre.'}
          accion={!busqueda && filtro === 'todas' ? <Button onClick={() => a.nuevaClienta()}>Registrar clienta</Button> : undefined}
        />
      ) : (
        <div className="tarjeta divide-y divide-linea">
          {filtro === 'frecuentes' && (
            <p className="px-4 py-3 text-sm text-gris">Ordenadas por cantidad de visitas. Útil para decidir beneficios (los descuentos se aplican solo si los elegís en el turno).</p>
          )}
          {lista.map((c, i) => (
            <Link key={c.id} to={`/admin/clientas/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-nude-50/70">
              {filtro === 'frecuentes' && <span className="w-6 text-center text-sm font-semibold text-gris">{i + 1}</span>}
              <Avatar nombre={nombreCompleto(c)} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{nombreCompleto(c)}</span>
                  {c.es_fija && <Star className="size-3.5 shrink-0 fill-rosa-400 text-rosa-400" />}
                </p>
                <p className="truncate text-sm text-gris">{[c.whatsapp, c.instagram].filter(Boolean).join(' · ') || 'Sin contacto cargado'}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="text-tinta-soft">{c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}</p>
                {c.deuda > 0 ? (
                  <p className="font-medium text-rosa-700">Debe {dinero(c.deuda)}</p>
                ) : c.ultima_visita ? (
                  <p className="text-xs text-gris">Última: {fmt(c.ultima_visita, 'd/MM/yy')}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
