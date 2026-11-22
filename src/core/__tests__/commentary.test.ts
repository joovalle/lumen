import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { activeNote } from '../commentary'
import { CommentaryModule, openModule, type CommentaryEntry } from '../engine/modules'

const note = (from: number, to: number): CommentaryEntry => ({ scope: 'verse', range: '', html: '', from, to })

describe('nota activa mientras se lee', () => {
  it('elige la nota que cubre el versículo', () => {
    const notes = [note(1, 8), note(9, 13), note(14, 18)]
    expect([1, 8, 9, 16, 18].map((v) => activeNote(notes, v))).toEqual([0, 0, 1, 2, 2])
  })
  it('con notas de sección sin final, usa la última que empieza antes', () => {
    const notes = [note(1, 1), note(9, 9), note(14, 14)]
    expect([1, 5, 9, 12, 20].map((v) => activeNote(notes, v))).toEqual([0, 0, 1, 1, 2])
  })
  it('prefiere la nota más específica cuando se superponen', () => {
    const notes = [note(1, 999), note(16, 16)]
    expect([3, 16, 17].map((v) => activeNote(notes, v))).toEqual([0, 1, 0])
  })
  it('antes de la primera nota no hay activa', () => {
    expect(activeNote([note(5, 8)], 2)).toBe(-1)
  })
})

describe('rangos guardados con 0 o vacíos', () => {
  it('ChapterEnd/VerseEnd en 0 significan «solo ese versículo»', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.run(`CREATE TABLE VerseCommentary (Book INT, ChapterBegin INT, VerseBegin INT, ChapterEnd INT, VerseEnd INT, Comments TEXT)`)
    db.run(`INSERT INTO VerseCommentary VALUES (43,3,1,0,0,'a'),(43,3,9,3,0,'b'),(43,3,14,NULL,NULL,'c'),(43,3,16,3,18,'d'),(43,2,23,3,2,'e')`)
    const m = openModule(db, 'c', 'c') as CommentaryModule
    expect(m.forChapter(43, 3).map((e) => [e.html, e.from, e.to])).toEqual([
      ['e', 1, 2], ['a', 1, 1], ['b', 9, 9], ['c', 14, 14], ['d', 16, 18],
    ])
    expect(m.lookup(43, 3, 1).map((e) => e.html)).toEqual(['e', 'a'])
  })
})
