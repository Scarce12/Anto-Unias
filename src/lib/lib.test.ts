import { describe, expect, it } from 'vitest'
import { instante, fechaISO, horaTexto, sumarDias, inicioSemana, duracionTexto } from './fechas'
import { dinero, parseDinero } from './formato'
import { normalizarInstagram, normalizarTelefono, telefonoValido } from './telefono'
import { completarPlantilla, linkWhatsApp } from './whatsapp'

describe('teléfonos (misma lógica que la base)', () => {
  it.each([
    ['11 1234-5678', '5491112345678'],
    ['011 15 1234-5678', '5491112345678'],
    ['+54 9 11 1234 5678', '5491112345678'],
    ['54 11 1234 5678', '5491112345678'],
    ['0351 15 555 1234', '5493515551234'],
    ['+34 600 123 456', '34600123456'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado)
  })
  it('vacío es null', () => {
    expect(normalizarTelefono('  ')).toBeNull()
    expect(normalizarTelefono(null)).toBeNull()
  })
  it('valida largo', () => {
    expect(telefonoValido('11 1234-5678')).toBe(true)
    expect(telefonoValido('123')).toBe(false)
  })
})

describe('instagram', () => {
  it('normaliza @, mayúsculas y URLs', () => {
    expect(normalizarInstagram('@Camila123')).toBe('camila123')
    expect(normalizarInstagram('https://www.instagram.com/flor.nails/')).toBe('flor.nails')
    expect(normalizarInstagram('')).toBeNull()
  })
})

describe('dinero', () => {
  it('interpreta formato argentino', () => {
    expect(parseDinero('15.000')).toBe(15000)
    expect(parseDinero('$ 13.700')).toBe(13700)
    expect(parseDinero('1500,50')).toBe(1500.5)
    expect(parseDinero('')).toBe(0)
  })
  it('formatea pesos', () => {
    expect(dinero(15000).replace(/\s/g, ' ')).toMatch(/\$ ?15\.000/)
  })
})

describe('WhatsApp', () => {
  it('completa plantillas', () => {
    expect(completarPlantilla('¡Hola, {nombre}! Tu turno es a las {hora}.', { nombre: 'Sofi', hora: '10:00' })).toBe('¡Hola, Sofi! Tu turno es a las 10:00.')
  })
  it('sin nombre no deja coma suelta', () => {
    expect(completarPlantilla('¡Hola, {nombre}! Hola', {})).toBe('¡Hola! Hola')
  })
  it('arma el link con número normalizado y texto codificado', () => {
    expect(linkWhatsApp('011 15 1234-5678', 'Hola 💅')).toBe('https://wa.me/5491112345678?text=Hola%20%F0%9F%92%85')
  })
})

describe('fechas en la zona del negocio (Argentina, UTC-3)', () => {
  it('construye instantes con la hora local del negocio', () => {
    expect(instante('2026-11-24', '10:00').toISOString()).toBe('2026-11-24T13:00:00.000Z')
  })
  it('muestra la hora local sin importar la zona del navegador', () => {
    expect(horaTexto('2026-11-24T13:00:00.000Z')).toBe('10:00')
    expect(fechaISO('2026-11-25T02:30:00.000Z')).toBe('2026-11-24')
  })
  it('suma días y calcula el lunes', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(inicioSemana('2026-11-17')).toBe('2026-11-16')
  })
  it('duración legible', () => {
    expect(duracionTexto(75)).toBe('1 h 15 min')
    expect(duracionTexto(45)).toBe('45 min')
  })
})
