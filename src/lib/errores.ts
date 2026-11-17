// Traduce errores técnicos a mensajes que se entienden.

interface ErrorLike {
  message?: string
  code?: string
  details?: string
}

export function mensajeError(e: unknown): string {
  const err = (e ?? {}) as ErrorLike
  const msg = err.message ?? String(e)
  const code = err.code

  if (code === 'P0001' && msg) return msg // mensajes propios de la base, ya en castellano
  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (/whatsapp/i.test(msg)) return 'Ya hay una clienta con ese WhatsApp.'
    if (/instagram/i.test(msg)) return 'Ya hay una clienta con ese Instagram.'
    if (/codigo/i.test(msg)) return 'Ese código ya está usado.'
    return 'Ese dato ya existe.'
  }
  if (code === '23P01' || /exclusion constraint/i.test(msg)) {
    if (/franjas/i.test(msg)) return 'Esa franja se superpone con otra del mismo día.'
    return 'Ese horario se superpone con otro turno.'
  }
  if (code === '23503' || /foreign key/i.test(msg)) {
    return 'No se puede borrar porque tiene información asociada (turnos o pagos). Podés desactivarlo en su lugar.'
  }
  if (code === '23514' || /check constraint/i.test(msg)) {
    if (/reparto/i.test(msg)) return 'Los porcentajes del reparto tienen que sumar 100%.'
    return 'Revisá los datos: hay un valor que no es válido.'
  }
  if (code === '42501' || /row-level security|permission denied|No autorizado/i.test(msg)) {
    return 'No tenés permiso para hacer esto. Volvé a iniciar sesión.'
  }
  if (/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.'
  if (/Email not confirmed/i.test(msg)) return 'Tenés que confirmar tu email antes de entrar (revisá tu casilla).'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'No hay conexión. Revisá internet e intentá de nuevo.'
  if (/Payload too large|exceeded the maximum allowed size/i.test(msg)) return 'La imagen es demasiado pesada.'
  return msg || 'Ocurrió un error inesperado.'
}
