import { describe, expect, it } from 'vitest'
import { PRESETS, buildPlan, dateOfDay, dayIndex, decodePlan, encodePlan, formatReadings, isoDate, specKey } from '../plans'

const total = (days: { book: number; chapter: number }[][]) => days.reduce((n, d) => n + d.length, 0)

describe('planes de lectura', () => {
  it('la Biblia en un año cubre los 1189 capítulos en 365 días, sin repetir', () => {
    const days = buildPlan({ type: 'canon', scope: 'all', days: 365 })
    expect(days).toHaveLength(365)
    expect(total(days)).toBe(1189)
    expect(new Set(days.flat().map((r) => `${r.book}.${r.chapter}`)).size).toBe(1189)
    expect(days.every((d) => d.length >= 3 && d.length <= 4)).toBe(true)
    expect(days[0][0]).toEqual({ book: 1, chapter: 1 })
    expect(days[364].at(-1)).toEqual({ book: 66, chapter: 22 })
  })

  it('Nuevo Testamento en 90 días y Evangelios en 30', () => {
    expect(total(buildPlan({ type: 'canon', scope: 'nt', days: 90 }))).toBe(260)
    expect(total(buildPlan({ type: 'canon', scope: 'gospels', days: 30 }))).toBe(89)
  })

  it('Salmos y Proverbios: 31 días, un proverbio por día', () => {
    const days = buildPlan({ type: 'psprov' })
    expect(days).toHaveLength(31)
    expect(days.map((d) => d.at(-1))).toEqual(Array.from({ length: 31 }, (_, i) => ({ book: 20, chapter: i + 1 })))
    expect(days.flat().filter((r) => r.book === 19)).toHaveLength(150)
  })

  it('plan de libros para un grupo: Romanos, un capítulo por día', () => {
    const days = buildPlan({ type: 'books', from: 45, to: 45, perDay: 1 })
    expect(days).toHaveLength(16)
    expect(days[15]).toEqual([{ book: 45, chapter: 16 }])
  })

  it('los presets tienen claves únicas', () => {
    expect(new Set(PRESETS.map((p) => specKey(p.spec))).size).toBe(PRESETS.length)
  })

  it('formatea las lecturas agrupando capítulos', () => {
    expect(formatReadings([{ book: 1, chapter: 1 }, { book: 1, chapter: 2 }, { book: 1, chapter: 3 }], 'es')).toBe('Génesis 1–3')
    expect(formatReadings([{ book: 1, chapter: 50 }, { book: 2, chapter: 1 }], 'pt')).toBe('Gênesis 50, Êxodo 1')
    expect(formatReadings([{ book: 65, chapter: 1 }], 'en')).toBe('Jude')
  })

  it('calcula el día del plan con fechas locales', () => {
    expect(dayIndex('2026-12-01', new Date(2026, 11, 1, 23))).toBe(0)
    expect(dayIndex('2026-12-01', new Date(2026, 11, 15, 1))).toBe(14)
    expect(dayIndex('2026-12-01', new Date(2026, 10, 30))).toBe(-1)
    expect(isoDate(dateOfDay('2026-12-30', 3))).toBe('2027-01-02')
  })

  it('codifica y decodifica planes en enlaces', () => {
    for (const spec of [...PRESETS.map((p) => p.spec), { type: 'books' as const, from: 40, to: 43, perDay: 2 }]) {
      const shared = { spec, start: '2026-12-01', title: 'Grupo de jóvenes' }
      expect(decodePlan(encodePlan(shared))).toEqual(shared)
    }
  })

  it('rechaza enlaces manipulados', () => {
    expect(decodePlan({ k: 'canon', sc: 'all', d: '0', s: '2026-12-01' })).toBeNull()
    expect(decodePlan({ k: 'books', f: 'Xyz', e: 'Rom', n: '1', s: '2026-12-01' })).toBeNull()
    expect(decodePlan({ k: 'books', f: 'Rom', e: 'Rom', n: '99', s: '2026-12-01' })).toBeNull()
    expect(decodePlan({ k: 'psprov', s: '2026-13-45' })).toBeNull()
    expect(decodePlan({ k: 'hack', s: '2026-12-01' })).toBeNull()
  })
})
