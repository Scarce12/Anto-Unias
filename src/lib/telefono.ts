// Misma lógica que public.normalizar_telefono() en la base.

export function normalizarTelefono(p: string | null | undefined, pais = '54'): string | null {
  if (!p || !p.trim()) return null
  const crudo = p.trim()
  const internacional = crudo.startsWith('+') || crudo.startsWith('00')
  let d = crudo.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)

  if (pais === '54') {
    if (d.startsWith('549') && d.length === 13) return d
    if (d.startsWith('54') && d.length === 12) return '549' + d.slice(2)
    if (internacional && !d.startsWith('54')) return d
    if (d.startsWith('0')) d = d.slice(1)
    if (d.length === 12) {
      for (let a = 2; a <= 4; a++) {
        if (d.slice(a, a + 2) === '15') {
          d = d.slice(0, a) + d.slice(a + 2)
          break
        }
      }
    }
    if (d.length === 10) return '549' + d
    return d
  }

  if (internacional || d.startsWith(pais)) return d
  return pais + d
}

export function normalizarInstagram(p: string | null | undefined): string | null {
  if (!p) return null
  const s = p
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
  return s || null
}

export function telefonoValido(p: string | null | undefined): boolean {
  const n = normalizarTelefono(p)
  return !!n && n.length >= 8 && n.length <= 15
}

/** Solo deja pasar links https (evita links "javascript:" u otros esquemas peligrosos) */
export function urlSegura(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const url = new URL(u.trim())
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function linkInstagram(usuario: string | null | undefined): string | null {
  const u = normalizarInstagram(usuario)
  return u ? `https://instagram.com/${u}` : null
}
