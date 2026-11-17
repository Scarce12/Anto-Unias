import clsx from 'clsx'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Cargando, Encabezado, Segmentado } from '@/components/ui/Basicos'
import { useAlternarMarca, useCalendario } from '@/features/varios/api'
import { hoyISO, MESES } from '@/lib/fechas'
import { mensajeError } from '@/lib/errores'
import type { MarcaCalendario } from '@/lib/types'

const MARCAS: { valor: MarcaCalendario['marca']; etiqueta: string; clase: string }[] = [
  { valor: 'periodo', etiqueta: 'Período', clase: 'bg-rosa-500' },
  { valor: 'sintoma', etiqueta: 'Síntoma', clase: 'bg-violet-400' },
  { valor: 'nota', etiqueta: 'Nota', clase: 'bg-nude-300' },
]

/** Calendario personal privado (cada usuaria ve solo el suyo) */
export function MiCalendarioPage() {
  const [anio, setAnio] = useState(Number(hoyISO().slice(0, 4)))
  const [marca, setMarca] = useState<MarcaCalendario['marca']>('periodo')
  const q = useCalendario(anio)
  const alternar = useAlternarMarca()
  const hoy = hoyISO()
  const marcas = new Map<string, Set<string>>()
  q.data?.forEach((m) => {
    const s = marcas.get(m.fecha) ?? new Set()
    s.add(m.marca)
    marcas.set(m.fecha, s)
  })

  const tocar = (fecha: string) => {
    const activa = !marcas.get(fecha)?.has(marca)
    alternar.mutate({ fecha, marca, activa }, { onError: (e) => toast.error(mensajeError(e)) })
  }

  return (
    <div>
      <Encabezado
        titulo="Mi calendario"
        subtitulo={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Privado: solo lo ves vos con tu cuenta.</span>}
        acciones={
          <div className="flex items-center gap-1">
            <button className="rounded-full px-3 py-1.5 hover:bg-nude-100" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">‹</button>
            <span className="font-semibold">{anio}</span>
            <button className="rounded-full px-3 py-1.5 hover:bg-nude-100" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">›</button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gris">Al tocar un día marco:</span>
        <Segmentado valor={marca} onChange={setMarca} opciones={MARCAS.map((m) => ({ valor: m.valor, etiqueta: <span className="flex items-center gap-1.5"><span className={clsx('size-2.5 rounded-full', m.clase)} />{m.etiqueta}</span> }))} />
      </div>
      {q.isLoading ? <Cargando /> : (
        <div className="tarjeta overflow-x-auto p-4">
          <table className="mx-auto border-separate border-spacing-1">
            <thead>
              <tr>
                <th />
                {MESES.map((m) => <th key={m} className="w-7 text-center text-[11px] font-medium text-gris">{m.slice(0, 3)}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 31 }, (_, d) => (
                <tr key={d}>
                  <td className="pr-1 text-right text-[11px] text-gris">{d + 1}</td>
                  {MESES.map((_, mi) => {
                    const existe = d + 1 <= new Date(anio, mi + 1, 0).getDate()
                    const fecha = `${anio}-${String(mi + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`
                    const s = marcas.get(fecha)
                    return (
                      <td key={mi}>
                        {existe && (
                          <button
                            onClick={() => tocar(fecha)}
                            aria-label={`${d + 1} de ${MESES[mi]}`}
                            className={clsx('relative flex size-6 items-center justify-center rounded-full ring-1 ring-linea transition hover:ring-rosa-300', fecha === hoy && 'ring-2 ring-tinta', s?.has('periodo') ? 'bg-rosa-500' : 'bg-white')}
                          >
                            {s?.has('sintoma') && <span className="size-2 rounded-full bg-violet-400" />}
                            {s?.has('nota') && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-nude-300 ring-1 ring-white" />}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
