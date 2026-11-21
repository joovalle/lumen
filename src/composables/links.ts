import { bookByNumber } from '@/core/canon'
import { encodePlan, type SharedPlan } from '@/core/plans'

/** Dirección pública de la app (sirve igual en GitHub Pages, otro hosting o una subcarpeta). */
function base(): string {
  return `${location.origin}${location.pathname}`
}

/** Enlace que abre Lumen en un pasaje: …/#/read/John/3?v=16&to=18 */
export function passageUrl(book: number, chapter: number, verse?: number, to?: number): string {
  const q = new URLSearchParams()
  if (verse) q.set('v', String(verse))
  if (verse && to && to > verse) q.set('to', String(to))
  const qs = q.toString()
  return `${base()}#/read/${bookByNumber(book)!.osis}/${chapter}${qs ? `?${qs}` : ''}`
}

/** Enlace para unirse a un plan de lectura. */
export function planUrl(p: SharedPlan): string {
  return `${base()}#/plans/join?${new URLSearchParams(encodePlan(p)).toString()}`
}
