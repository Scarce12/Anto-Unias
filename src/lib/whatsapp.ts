import { normalizarTelefono } from './telefono'

export type VariablesMensaje = Partial<
  Record<'nombre' | 'fecha' | 'hora' | 'servicio' | 'total' | 'sena' | 'saldo' | 'negocio', string>
>

/** Reemplaza {variable} en la plantilla. Las variables sin dato se quitan prolijamente. */
export function completarPlantilla(plantilla: string, vars: VariablesMensaje): string {
  return plantilla
    .replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string | undefined>)[k] ?? '')
    .replace(/,\s*!/g, '!')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Link que abre WhatsApp con el mensaje escrito. Sin número, abre el selector de chats. */
export function linkWhatsApp(telefono: string | null | undefined, mensaje = ''): string {
  const num = normalizarTelefono(telefono)
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''
  return num ? `https://wa.me/${num}${texto}` : `https://wa.me/${texto}`
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Navegadores viejos / sin permiso
    const area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
