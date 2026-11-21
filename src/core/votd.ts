/**
 * Versículo del día: una lista curada de pasajes muy conocidos.
 * Todos los usuarios ven el mismo versículo el mismo día, en la versión
 * que estén usando (las referencias son canónicas, no dependen del idioma).
 */
import { bookByOsis } from './canon'
import type { Passage } from './reference'

const REFS = `
Gen.1.1 Gen.1.27 Gen.28.15 Gen.50.20 Exod.14.14 Exod.15.2 Exod.33.14 Num.6.24-26 Deut.6.5 Deut.31.6
Deut.31.8 Josh.1.8 Josh.1.9 Josh.24.15 Ruth.1.16 1Sam.16.7 2Sam.22.31 1Chr.16.11 1Chr.16.34 2Chr.7.14
Neh.8.10 Job.19.25 Ps.1.1-2 Ps.4.8 Ps.16.11 Ps.18.2 Ps.19.1 Ps.19.14 Ps.23.1 Ps.23.4
Ps.27.1 Ps.27.14 Ps.28.7 Ps.30.5 Ps.31.24 Ps.32.8 Ps.34.8 Ps.34.18 Ps.37.4 Ps.37.5
Ps.40.1 Ps.42.11 Ps.46.1 Ps.46.10 Ps.51.10 Ps.55.22 Ps.56.3 Ps.62.1 Ps.73.26 Ps.84.11
Ps.90.12 Ps.91.1 Ps.91.11 Ps.100.4 Ps.103.2 Ps.103.12 Ps.118.24 Ps.119.105 Ps.119.11 Ps.121.1-2
Ps.127.1 Ps.136.1 Ps.139.14 Ps.143.8 Ps.145.18 Ps.147.3 Ps.150.6 Prov.3.5-6 Prov.4.23 Prov.16.3
Prov.16.9 Prov.18.10 Prov.22.6 Eccl.3.1 Eccl.3.11 Isa.9.6 Isa.26.3 Isa.40.8 Isa.40.29 Isa.40.31
Isa.41.10 Isa.43.2 Isa.43.19 Isa.53.5 Isa.54.10 Isa.55.8 Isa.55.11 Isa.58.11 Isa.61.1 Jer.17.7
Jer.29.11 Jer.29.13 Jer.31.3 Jer.33.3 Lam.3.22-23 Ezek.36.26 Hos.6.3 Joel.2.28 Mic.6.8 Mic.7.18
Nah.1.7 Hab.3.17-18 Hab.3.19 Zeph.3.17 Zech.4.6 Mal.3.10 Matt.5.3 Matt.5.8 Matt.5.9 Matt.5.14
Matt.5.16 Matt.6.33 Matt.6.34 Matt.7.7 Matt.7.12 Matt.11.28 Matt.11.29 Matt.16.24 Matt.19.26 Matt.22.37
Matt.28.19 Matt.28.20 Mark.9.23 Mark.10.27 Mark.10.45 Mark.11.24 Mark.16.15 Luke.1.37 Luke.6.31 Luke.6.38
Luke.9.23 Luke.19.10 John.1.1 John.1.12 John.1.14 John.3.16 John.3.17 John.4.24 John.6.35 John.8.12
John.8.32 John.10.10 John.10.11 John.11.25 John.13.34 John.14.1 John.14.6 John.14.27 John.15.5 John.15.13
John.16.33 Acts.1.8 Acts.4.12 Acts.16.31 Acts.20.35 Rom.1.16 Rom.3.23 Rom.5.1 Rom.5.8 Rom.6.23
Rom.8.1 Rom.8.18 Rom.8.28 Rom.8.31 Rom.8.38-39 Rom.10.9 Rom.10.17 Rom.12.1 Rom.12.2 Rom.12.12
Rom.15.13 1Cor.2.9 1Cor.10.13 1Cor.13.4 1Cor.13.13 1Cor.15.58 1Cor.16.14 2Cor.4.16 2Cor.4.18 2Cor.5.7
2Cor.5.17 2Cor.9.7 2Cor.12.9 Gal.2.20 Gal.5.22-23 Gal.6.9 Eph.2.8-9 Eph.2.10 Eph.3.20 Eph.4.32
Eph.6.10 Phil.1.6 Phil.2.3 Phil.3.13-14 Phil.4.4 Phil.4.6 Phil.4.7 Phil.4.8 Phil.4.13 Phil.4.19
Col.3.2 Col.3.15 Col.3.23 1Thess.5.16-18 2Thess.3.3 1Tim.4.12 2Tim.1.7 2Tim.3.16 Titus.3.5 Heb.4.12
Heb.4.16 Heb.10.23 Heb.11.1 Heb.11.6 Heb.12.2 Heb.13.5 Heb.13.8 Jas.1.2-3 Jas.1.5 Jas.1.17
Jas.4.8 1Pet.2.9 1Pet.5.7 2Pet.3.9 1John.1.9 1John.3.1 1John.4.8 1John.4.18 1John.4.19 1John.5.14
Jude.1.24 Rev.3.20 Rev.21.4 Rev.22.13
`

export const VERSES: Passage[] = REFS.trim().split(/\s+/).map((ref) => {
  const [osis, c, v] = ref.split('.')
  const book = bookByOsis(osis)
  if (!book) throw new Error(`Libro desconocido en el versículo del día: ${ref}`)
  const [start, end] = v.split('-').map(Number)
  return { book: book.n, chapter: Number(c), verse: start, verseEnd: end }
})

/** Paso coprimo con la longitud de la lista: recorre todos sin agrupar por libro. */
function stride(n: number): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  let s = 97
  while (gcd(s, n) !== 1) s++
  return s
}
const STRIDE = stride(VERSES.length)

/** Número de día local (no UTC), para que cambie a medianoche en cada país. */
export function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

export function verseOfTheDay(date = new Date()): Passage {
  return VERSES[(dayNumber(date) * STRIDE) % VERSES.length]
}
