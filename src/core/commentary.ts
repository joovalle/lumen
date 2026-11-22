import type { CommentaryEntry } from './engine/modules'

/**
 * Qué nota del comentario corresponde al versículo que se está leyendo.
 * 1) La nota que lo cubre (si varias, la que empieza más cerca).
 * 2) Si ninguna lo cubre (notas «de sección» sin final, p. ej. Matthew Henry:
 *    una nota en el v. 1, otra en el 9…), la última que empieza antes.
 */
export function activeNote(notes: CommentaryEntry[], verse: number): number {
  let covering = -1
  let before = -1
  notes.forEach((n, i) => {
    const from = n.from ?? 0
    const to = n.to ?? from
    if (from <= verse && verse <= to && (covering < 0 || from >= (notes[covering].from ?? 0))) covering = i
    if (from <= verse && (before < 0 || from >= (notes[before].from ?? 0))) before = i
  })
  return covering >= 0 ? covering : before
}
