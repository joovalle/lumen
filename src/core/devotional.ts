/**
 * Devocional «Luz diaria» (Daily Light on the Daily Path, familia Bagster, 1875).
 * Cada lectura es una selección de versículos alrededor de un versículo tema.
 * Solo guardamos referencias; el texto sale de la Biblia que use cada persona.
 */
import { bookByNumber, type Locale } from './canon'

export type Period = 'm' | 'e'

/** "43.17.22-24,26" */
export interface Segment { book: number; chapter: number; verses: number[] }
export interface DevotionalEntry { theme: Segment[]; verses: Segment[][] }
type Raw = Record<string, Partial<Record<Period, { t: string[]; v: string[][] }>>>

export function parseSegment(s: string): Segment {
  const [b, c, spec] = s.split('.')
  const verses: number[] = []
  for (const part of spec.split(',')) {
    const [a, z] = part.split('-').map(Number)
    for (let v = a; v <= (z || a); v++) verses.push(v)
  }
  return { book: Number(b), chapter: Number(c), verses }
}

/** Grupos de versículos seguidos: [9,10,16] → [[9,10],[16]] */
export function runs(verses: number[]): number[][] {
  const out: number[][] = []
  for (const v of verses) {
    const last = out[out.length - 1]
    if (last && last[last.length - 1] === v - 1) last.push(v)
    else out.push([v])
  }
  return out
}

/** "1 Juan 4:9–10, 16" */
export function segmentLabel(seg: Segment, locale: Locale): string {
  const book = bookByNumber(seg.book)!
  const vs = runs(seg.verses).map((r) => (r.length === 1 ? `${r[0]}` : `${r[0]}–${r[r.length - 1]}`)).join(', ')
  return `${book.name[locale]} ${seg.chapter}:${vs}`
}

export const dateKey = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Mañana hasta las 15:59; desde las 16:00, la lectura de la noche. */
export const periodFor = (d: Date): Period => (d.getHours() < 16 ? 'm' : 'e')

let data: Promise<Raw> | null = null
/** Los datos (≈90 KB) se cargan solo cuando se necesitan. */
export function loadDevotional(): Promise<Raw> {
  return (data ??= import('@/data/daily-light.json').then((m) => m.default as Raw))
}

export function entryFrom(raw: Raw, date: Date, period: Period): DevotionalEntry | null {
  const day = raw[dateKey(date)] ?? (date.getMonth() === 1 && date.getDate() === 29 ? raw['02-28'] : undefined)
  const e = day?.[period]
  return e ? { theme: e.t.map(parseSegment), verses: e.v.map((v) => v.map(parseSegment)) } : null
}
