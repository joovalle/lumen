import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { VERSES, dayNumber, verseOfTheDay } from '../votd'

describe('versículo del día', () => {
  it('tiene suficientes versículos y sin repetir', () => {
    expect(VERSES.length).toBeGreaterThan(200)
    const keys = VERSES.map((v) => `${v.book}.${v.chapter}.${v.verse}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('es estable durante el día y cambia al siguiente', () => {
    const a = verseOfTheDay(new Date(2026, 10, 21, 0, 5))
    expect(verseOfTheDay(new Date(2026, 10, 21, 23, 55))).toEqual(a)
    expect(verseOfTheDay(new Date(2026, 10, 22, 8))).not.toEqual(a)
  })

  it('recorre toda la lista sin repetir en un ciclo', () => {
    const start = dayNumber(new Date(2026, 0, 1))
    const seen = new Set<string>()
    for (let d = 0; d < VERSES.length; d++) {
      const v = verseOfTheDay(new Date((start + d) * 86_400_000 + 12 * 3_600_000))
      seen.add(`${v.book}.${v.chapter}.${v.verse}`)
    }
    expect(seen.size).toBe(VERSES.length)
  })

  it.each(['rv1909', 'bsb', 'blivre'])('todos existen en %s', async (id) => {
    const SQL = await initSqlJs()
    const db = new SQL.Database(gunzipSync(readFileSync(join(__dirname, `../../../public/modules/${id}.bblx.gz`))))
    const stmt = db.prepare('SELECT COUNT(*) FROM Bible WHERE Book=? AND Chapter=? AND Verse=?')
    const missing = VERSES.filter((v) => {
      for (let n = v.verse!; n <= (v.verseEnd ?? v.verse!); n++) {
        stmt.bind([v.book, v.chapter, n]); stmt.step()
        const found = stmt.get()[0] === 1
        stmt.reset()
        if (!found) return true
      }
      return false
    })
    expect(missing).toEqual([])
  })
})
