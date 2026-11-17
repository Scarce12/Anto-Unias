import { createContext, use, useState, type ReactNode } from 'react'
import { ClientaForm } from '@/features/clientas/ClientaForm'
import { CreditoForm } from '@/features/finanzas/CreditoForm'
import { GastoForm } from '@/features/finanzas/GastoForm'
import { PagoForm } from '@/features/finanzas/PagoForm'
import { BloqueoForm } from '@/features/turnos/BloqueoForm'
import { TurnoDetalle } from '@/features/turnos/TurnoDetalle'
import { TurnoForm } from '@/features/turnos/TurnoForm'
import type { Bloqueo, Gasto } from '@/lib/types'

interface Acciones {
  nuevoTurno: (o?: { fecha?: string; hora?: string; clientaId?: string | null }) => void
  editarTurno: (id: string) => void
  verTurno: (id: string) => void
  nuevaClienta: () => void
  nuevoPago: (o?: { clientaId?: string | null }) => void
  nuevoGasto: (g?: Gasto | null) => void
  bloquear: (o?: { fecha?: string; hora?: string; bloqueo?: Bloqueo | null }) => void
  nuevoCredito: (tipo: 'gift_card' | 'saldo_a_favor', clientaId?: string | null) => void
}

const Ctx = createContext<Acciones | null>(null)

/** Formularios globales del panel: se abren desde cualquier pantalla sin perder el lugar */
export function AccionesProvider({ children }: { children: ReactNode }) {
  const [turnoForm, setTurnoForm] = useState<{ id?: string | null; fecha?: string; hora?: string; clientaId?: string | null } | null>(null)
  const [detalle, setDetalle] = useState<string | null>(null)
  const [clienta, setClienta] = useState(false)
  const [pago, setPago] = useState<{ clientaId?: string | null } | null>(null)
  const [gasto, setGasto] = useState<{ g: Gasto | null } | null>(null)
  const [bloqueo, setBloqueo] = useState<{ fecha?: string; hora?: string; bloqueo?: Bloqueo | null } | null>(null)
  const [credito, setCredito] = useState<{ tipo: 'gift_card' | 'saldo_a_favor'; clientaId?: string | null } | null>(null)

  const acciones: Acciones = {
    nuevoTurno: (o) => setTurnoForm({ ...o }),
    editarTurno: (id) => setTurnoForm({ id }),
    verTurno: (id) => setDetalle(id),
    nuevaClienta: () => setClienta(true),
    nuevoPago: (o) => setPago({ ...o }),
    nuevoGasto: (g) => setGasto({ g: g ?? null }),
    bloquear: (o) => setBloqueo({ ...o }),
    nuevoCredito: (tipo, clientaId) => setCredito({ tipo, clientaId }),
  }

  return (
    <Ctx value={acciones}>
      {children}
      <TurnoForm
        abierto={!!turnoForm}
        onCerrar={() => setTurnoForm(null)}
        turnoId={turnoForm?.id}
        fecha={turnoForm?.fecha}
        hora={turnoForm?.hora}
        clientaId={turnoForm?.clientaId}
        onGuardado={(id) => {
          if (!turnoForm?.id) setDetalle(id)
        }}
      />
      <TurnoDetalle
        turnoId={turnoForm ? null : detalle}
        onCerrar={() => setDetalle(null)}
        onEditar={(id) => setTurnoForm({ id })}
      />
      <ClientaForm abierto={clienta} onCerrar={() => setClienta(false)} />
      <PagoForm abierto={!!pago} onCerrar={() => setPago(null)} clientaId={pago?.clientaId} />
      <GastoForm abierto={!!gasto} onCerrar={() => setGasto(null)} gasto={gasto?.g} />
      <BloqueoForm abierto={!!bloqueo} onCerrar={() => setBloqueo(null)} fecha={bloqueo?.fecha} hora={bloqueo?.hora} bloqueo={bloqueo?.bloqueo} />
      <CreditoForm abierto={!!credito} onCerrar={() => setCredito(null)} tipo={credito?.tipo ?? 'gift_card'} clientaId={credito?.clientaId} />
    </Ctx>
  )
}

export function useAcciones() {
  const a = use(Ctx)
  if (!a) throw new Error('useAcciones fuera de AccionesProvider')
  return a
}
