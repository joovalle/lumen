import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import raw from '../../data/daily-light.json'
import { dateKey, entryFrom, parseSegment, periodFor, runs, segmentLabel } from '../devotional'

const all = Object.values(raw as Record<string, Record<string, { t: string[]; v: string[][] }>>)
  .flatMap((d) => Object.values(d)).flatMap((e) => [...e.t, ...e.v.flat()]).map(parseSegment)

describe('devocional Luz diaria', () => {
  it('tiene mañana y noche para los 366 días', () => {
    const days = Object.entries(raw as Record<string, Record<string, unknown>>)
    expect(days).toHaveLength(366)
    expect(days.every(([, d]) => d.m && d.e)).toBe(true)
    const e = entryFrom(raw as never, new Date(2026, 0, 1), 'm')!
    expect(segmentLabel(e.theme[0], 'es')).toBe('Filipenses 3:13–14')
    expect(e.verses.length).toBeGreaterThanOrEqual(4)
  })

  it('analiza y formatea referencias', () => {
    expect(parseSegment('62.4.9-10,16')).toEqual({ book: 62, chapter: 4, verses: [9, 10, 16] })
    expect(runs([9, 10, 16])).toEqual([[9, 10], [16]])
    expect(segmentLabel(parseSegment('62.4.9-10,16'), 'es')).toBe('1 Juan 4:9–10, 16')
    expect(dateKey(new Date(2026, 1, 3))).toBe('02-03')
    expect(periodFor(new Date(2026, 0, 1, 15, 59))).toBe('m')
    expect(periodFor(new Date(2026, 0, 1, 16, 0))).toBe('e')
  })

  it.each(['rv1909', 'bsb', 'blivre'])('todas las referencias existen en %s', async (id) => {
    const SQL = await initSqlJs()
    const db = new SQL.Database(gunzipSync(readFileSync(join(__dirname, `../../../public/modules/${id}.bblx.gz`))))
    const stmt = db.prepare('SELECT 1 FROM Bible WHERE Book=? AND Chapter=? AND Verse=?')
    const missing: string[] = []
    for (const s of all) for (const v of s.verses) {
      stmt.bind([s.book, s.chapter, v])
      if (!stmt.step()) missing.push(`${s.book}.${s.chapter}.${v}`)
      stmt.reset()
    }
    expect([...new Set(missing)]).toEqual([])
  })
})
