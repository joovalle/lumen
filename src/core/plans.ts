/**
 * Planes de lectura. Un plan se describe con unos pocos parámetros (PlanSpec)
 * y las lecturas de cada día se calculan; así un plan completo cabe en un
 * enlace para compartirlo por WhatsApp, sin servidor.
 */
import { BOOKS, bookByNumber, type Locale } from './canon'

export interface Reading { book: number; chapter: number }

export type PlanSpec =
  | { type: 'canon'; scope: 'all' | 'ot' | 'nt' | 'gospels'; days: number }
  | { type: 'psprov' }
  | { type: 'books'; from: number; to: number; perDay: number }

export interface Preset { key: string; spec: PlanSpec }

export const PRESETS: Preset[] = [
  { key: 'bible365', spec: { type: 'canon', scope: 'all', days: 365 } },
  { key: 'nt90', spec: { type: 'canon', scope: 'nt', days: 90 } },
  { key: 'gospels30', spec: { type: 'canon', scope: 'gospels', days: 30 } },
  { key: 'psprov31', spec: { type: 'psprov' } },
  { key: 'ot270', spec: { type: 'canon', scope: 'ot', days: 270 } },
]

const SCOPES = { all: [1, 66], ot: [1, 39], nt: [40, 66], gospels: [40, 43] } as const

function chapters(from: number, to: number): Reading[] {
  const out: Reading[] = []
  for (let b = from; b <= to; b++) {
    for (let c = 1; c <= bookByNumber(b)!.chapters; c++) out.push({ book: b, chapter: c })
  }
  return out
}

/** Reparte una lista en `days` grupos lo más parejos posible, sin días vacíos. */
function split<T>(items: T[], days: number): T[][] {
  const d = Math.max(1, Math.min(days, items.length))
  return Array.from({ length: d }, (_, i) => items.slice(Math.floor((i * items.length) / d), Math.floor(((i + 1) * items.length) / d)))
}

/** Lecturas de cada día del plan. */
export function buildPlan(spec: PlanSpec): Reading[][] {
  switch (spec.type) {
    case 'canon': {
      const [from, to] = SCOPES[spec.scope]
      return split(chapters(from, to), spec.days)
    }
    case 'psprov': {
      const psalms = split(chapters(19, 19), 31)
      return psalms.map((ps, i) => [...ps, { book: 20, chapter: i + 1 }])
    }
    case 'books': {
      const list = chapters(Math.min(spec.from, spec.to), Math.max(spec.from, spec.to))
      const per = Math.max(1, Math.min(10, Math.round(spec.perDay)))
      return split(list, Math.ceil(list.length / per))
    }
  }
}

/** Identificador estable del contenido del plan. */
export function specKey(spec: PlanSpec): string {
  switch (spec.type) {
    case 'canon': return `canon-${spec.scope}-${spec.days}`
    case 'psprov': return 'psprov'
    case 'books': return `books-${spec.from}-${spec.to}-${spec.perDay}`
  }
}

export function presetFor(spec: PlanSpec): Preset | undefined {
  return PRESETS.find((p) => specKey(p.spec) === specKey(spec))
}

/** "Génesis 1–3, Éxodo 1" */
export function formatReadings(readings: Reading[], locale: Locale, short = false): string {
  const groups: { book: number; from: number; to: number }[] = []
  for (const r of readings) {
    const g = groups[groups.length - 1]
    if (g && g.book === r.book && g.to === r.chapter - 1) g.to = r.chapter
    else groups.push({ book: r.book, from: r.chapter, to: r.chapter })
  }
  return groups
    .map((g) => {
      const b = bookByNumber(g.book)!
      const name = short ? b.abbr[locale] : b.name[locale]
      if (b.chapters === 1) return name
      return g.from === g.to ? `${name} ${g.from}` : `${name} ${g.from}–${g.to}`
    })
    .join(', ')
}

// ——— Fechas locales (AAAA-MM-DD) ———

export function isoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d : null
}

const dayNum = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)

/** Día del plan que toca hoy (0 = primer día; negativo si aún no empieza). */
export function dayIndex(start: string, today = new Date()): number {
  const s = parseIso(start)
  return s ? dayNum(today) - dayNum(s) : 0
}

export function dateOfDay(start: string, day: number): Date {
  const s = parseIso(start) ?? new Date()
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + day)
}

// ——— Enlaces para compartir ———

export interface SharedPlan { spec: PlanSpec; start: string; title: string | null }

export function encodePlan(p: SharedPlan): Record<string, string> {
  const q: Record<string, string> = { s: p.start }
  if (p.title) q.t = p.title.slice(0, 80)
  const s = p.spec
  if (s.type === 'canon') Object.assign(q, { k: 'canon', sc: s.scope, d: String(s.days) })
  else if (s.type === 'psprov') q.k = 'psprov'
  else Object.assign(q, { k: 'books', f: BOOKS[s.from - 1].osis, e: BOOKS[s.to - 1].osis, n: String(s.perDay) })
  return q
}

export function decodePlan(q: Record<string, unknown>): SharedPlan | null {
  const str = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : '')
  const start = parseIso(str('s')) ? str('s') : null
  if (!start) return null
  const title = str('t').trim().slice(0, 80) || null
  let spec: PlanSpec | null = null
  if (str('k') === 'canon') {
    const scope = str('sc')
    const days = Number(str('d'))
    if ((scope === 'all' || scope === 'ot' || scope === 'nt' || scope === 'gospels') && days >= 1 && days <= 1200) {
      spec = { type: 'canon', scope, days }
    }
  } else if (str('k') === 'psprov') {
    spec = { type: 'psprov' }
  } else if (str('k') === 'books') {
    const from = BOOKS.find((b) => b.osis === str('f'))?.n
    const to = BOOKS.find((b) => b.osis === str('e'))?.n
    const perDay = Number(str('n'))
    if (from && to && perDay >= 1 && perDay <= 10) spec = { type: 'books', from, to, perDay }
  }
  return spec ? { spec, start, title } : null
}
