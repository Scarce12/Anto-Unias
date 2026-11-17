import { BUCKET_FOTOS, supabase } from './supabase'

/** Reduce la foto (las del celular pesan mucho) a WebP de hasta `max` px de lado. */
export async function comprimirImagen(file: File, max = 1600, calidad = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('No se pudo leer la imagen. Probá con JPG o PNG.')
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', calidad))
  if (blob) return blob
  const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', calidad))
  if (!jpg) throw new Error('No se pudo procesar la imagen.')
  return jpg
}

/** Sube una imagen comprimida al bucket y devuelve la ruta guardada */
export async function subirImagen(file: File, carpeta: 'galeria' | 'servicios' | 'marca'): Promise<string> {
  const blob = await comprimirImagen(file, carpeta === 'marca' ? 1920 : 1600)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${carpeta}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function borrarImagen(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(BUCKET_FOTOS).remove([path])
}
