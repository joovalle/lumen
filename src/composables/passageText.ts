import { engine } from '@/core/engine/client'
import type { Locale } from '@/core/canon'
import { LOCALES } from '@/core/canon'
import { formatVerseList, verseKey, type Passage } from '@/core/reference'
import { bookByNumber } from '@/core/canon'
import { useLibrary } from '@/stores/library'

export interface PassageText {
  /** Texto plano de los versículos (con números si son varios no seguidos). */
  text: string
  /** "Juan 3:16" en el idioma de la versión */
  label: string
  /** "RV1909" */
  abbreviation: string
}

/**
 * Obtiene el texto de uno o varios versículos de un mismo capítulo.
 * La referencia se escribe en el idioma de la versión (BSB → "John 3:16").
 */
export async function passageText(bibleId: string, book: number, chapter: number, verses: number[], uiLocale: Locale): Promise<PassageText> {
  const library = useLibrary()
  await library.ensureOpen(bibleId)
  const sorted = [...new Set(verses)].sort((a, b) => a - b)
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  const parts = await engine().plain(bibleId, sorted.map((v) => ({ start: verseKey(book, chapter, v) })))
  const text = sorted.length === 1 || contiguous ? parts.join(' ') : sorted.map((v, i) => `${v} ${parts[i]}`).join(' ')
  const rec = library.get(bibleId)
  const lang = (LOCALES as string[]).includes(rec?.language ?? '') ? (rec!.language as Locale) : uiLocale
  const name = bookByNumber(book)?.name[lang] ?? ''
  return { text, label: `${name} ${chapter}:${formatVerseList(sorted)}`, abbreviation: rec?.info.abbreviation ?? '' }
}

export async function passageTextFor(bibleId: string, p: Passage, uiLocale: Locale): Promise<PassageText> {
  const end = p.verseEnd ?? p.verse ?? 1
  const verses: number[] = []
  for (let v = p.verse ?? 1; v <= end; v++) verses.push(v)
  return passageText(bibleId, p.book, p.chapter, verses, uiLocale)
}
