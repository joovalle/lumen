/**
 * Genera el devocional «Luz diaria» (Daily Light on the Daily Path,
 * familia Bagster, 1875 — dominio público) para Lumen.
 *
 * Solo se guardan las REFERENCIAS de cada lectura: la app muestra el texto
 * de la Biblia que cada persona use, en su idioma.
 *
 * Fuentes (solo durante la generación, no se distribuyen):
 *  - Lecturas: paquete npm «daily-light» (data/readings.json, KJV).
 *  - Texto KJV de scrollmapper/bible_databases, para verificar y corregir
 *    las referencias (unas 90 del original vienen vacías o con erratas).
 *
 * Uso: npm run build:devotional
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, 'node_modules', '.cache', 'lumen-sources')
const OUT = join(root, 'src', 'data', 'daily-light.json')
const PKG = 'https://registry.npmjs.org/daily-light/-/daily-light-1.0.0.tgz'
const KJV = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json'

async function cached(url, name) {
  const file = join(cache, name)
  if (existsSync(file)) return readFile(file)
  console.log(`  ↓ ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await mkdir(cache, { recursive: true })
  await writeFile(file, buf)
  return buf
}

/** Extrae un archivo de un .tgz (formato tar simple). */
function untar(tgz, wanted) {
  const tar = gunzipSync(tgz)
  for (let off = 0; off + 512 <= tar.length; ) {
    const name = tar.subarray(off, off + 100).toString().replace(/\0.*$/s, '')
    if (!name) break
    const size = parseInt(tar.subarray(off + 124, off + 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0
    if (name === wanted) return tar.subarray(off + 512, off + 512 + size).toString('utf8')
    off += 512 + Math.ceil(size / 512) * 512
  }
  throw new Error(`No se encontró ${wanted}`)
}

const norm = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

async function main() {
  const readings = JSON.parse(untar(await cached(PKG, 'daily-light-1.0.0.tgz'), 'package/data/readings.json'))
  const kjv = JSON.parse((await cached(KJV, 'formats_json_KJV.json')).toString('utf8'))

  // Índice del texto KJV
  // La fuente usa numerales romanos («I Samuel») y «Revelation of John»: se normalizan
  const NAMES = kjv.books.map((b) => b.name.replace(/^III /, '3 ').replace(/^II /, '2 ').replace(/^I /, '1 ').replace(/ of John$/, ''))
  const text = new Map() // "b.c.v" → texto normalizado
  const order = [] // [b, c, v] en orden canónico
  kjv.books.forEach((book, i) => {
    for (const ch of book.chapters) for (const v of ch.verses) {
      text.set(`${i + 1}.${ch.chapter}.${v.verse}`, norm(v.text))
      order.push([i + 1, ch.chapter, v.verse])
    }
  })
  const lastVerse = (b, c) => { let v = 1; while (text.has(`${b}.${c}.${v + 1}`)) v++; return v }

  // Nombres de libro → número (nombres completos, abreviaturas comunes y erratas del original)
  const ALIAS = { psalm: 'Psalms', phl: 'Philippians', php: 'Philippians', phil: 'Philippians', exo: 'Exodus', rev: 'Revelation', song: 'Song of Solomon', cor: 'Corinthians', pet: 'Peter', thess: 'Thessalonians', tim: 'Timothy', jn: 'John' }
  function bookNumber(raw) {
    let s = raw.trim().replace(/\.$/, '')
    const m = /^([1-3])\s*(.*)$/.exec(s)
    const prefix = m ? `${m[1]} ` : ''
    let rest = (m ? m[2] : s).toLowerCase()
    rest = ALIAS[rest] ?? rest
    const target = (prefix + rest).toLowerCase()
    let i = NAMES.findIndex((n) => n.toLowerCase() === target)
    if (i < 0) i = NAMES.findIndex((n) => n.toLowerCase().startsWith(target))
    return i >= 0 ? i + 1 : null
  }

  /** "1 John 4:9,10,16; John 17:22-24" → [{b,c,vs:[...]}] (o null si no se entiende) */
  function parseRef(ref) {
    const segs = []
    let book = null
    let chapter = null
    for (const part of ref.split(/[,;]\s*/).map((p) => p.trim()).filter(Boolean)) {
      let m = /^((?:[1-3]\s*)?[A-Za-z][A-Za-z ]*?)\s*(\d+)(?::\s*(\d+)(?:\s*-\s*(\d+)(?::(\d+))?)?)?$/.exec(part)
      if (m) {
        const b = bookNumber(m[1])
        if (!b) return null
        book = b
        const single = !text.has(`${b}.2.1`)
        if (!m[3]) {
          // «Jude 24» → capítulo 1, versículo 24; «Psalm 23» → capítulo entero
          if (single) { chapter = 1; segs.push({ b, c: 1, vs: [Number(m[2])] }) }
          else { chapter = Number(m[2]); segs.push({ b, c: chapter, vs: range(1, lastVerse(b, chapter)) }) }
          continue
        }
        chapter = Number(m[2])
        if (m[5]) { // cruza capítulos: 2:25-3:1
          segs.push({ b, c: chapter, vs: range(Number(m[3]), lastVerse(b, chapter)) })
          chapter = Number(m[4])
          segs.push({ b, c: chapter, vs: range(1, Number(m[5])) })
        } else segs.push({ b, c: chapter, vs: range(Number(m[3]), Number(m[4] ?? m[3])) })
        continue
      }
      m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part) // versículos sueltos tras una coma
      if (m && book && chapter) { segs[segs.length - 1].vs.push(...range(Number(m[1]), Number(m[2] ?? m[1]))); continue }
      m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(part)
      if (m && book) { chapter = Number(m[1]); segs.push({ b: book, c: chapter, vs: range(Number(m[2]), Number(m[3] ?? m[2])) }); continue }
      return null
    }
    return segs.length ? segs : null
  }
  const range = (a, b) => Array.from({ length: Math.max(0, b - a) + 1 }, (_, i) => a + i)

  const words = (s) => norm(s).split(' ').filter((w) => w.length > 2)
  /** Proporción de palabras de la cita que aparecen en los versículos indicados. */
  function score(entryText, segs) {
    const pool = new Set(segs.flatMap((s) => s.vs.map((v) => text.get(`${s.b}.${s.c}.${v}`) ?? '')).join(' ').split(' '))
    const w = words(entryText)
    return w.length ? w.filter((x) => pool.has(x)).length / w.length : 0
  }

  /** Busca la cita en la KJV a partir de su texto. */
  function search(entryText) {
    const frags = entryText.split(/\.\.\.|…/).map(norm).filter((f) => f.split(' ').length >= 3)
    if (!frags.length) return null
    const head = frags[0].split(' ').slice(0, 6).join(' ')
    const tail = frags[frags.length - 1].split(' ').slice(-5).join(' ')
    const first3 = head.split(' ').slice(0, 3).join(' ')
    const at = (k) => (order[k] ? text.get(order[k].join('.')) : '')
    // 1) el inicio está entero en un versículo; 2) el inicio cruza al versículo siguiente
    let start = order.findIndex((_, k) => at(k).includes(head))
    if (start < 0) {
      start = order.findIndex((o, k) => at(k).includes(first3) && order[k + 1]?.[1] === o[1] && `${at(k)} ${at(k + 1)}`.includes(head))
    }
    for (let i = start; i >= 0 && i < order.length; i = -1) {
      const [b, c, v] = order[i]
      // Busca el final dentro de los 12 versículos siguientes del mismo capítulo
      for (let j = i; j < Math.min(order.length, i + 12) && order[j][0] === b && order[j][1] === c; j++) {
        const joined = order.slice(i, j + 1).map(([bb, cc, vv]) => text.get(`${bb}.${cc}.${vv}`)).join(' ')
        if (joined.includes(tail)) return [{ b, c, vs: range(v, order[j][2]) }]
      }
      return [{ b, c, vs: [v] }]
    }
    return null
  }

  /** Si la cita junta varios pasajes, busca cada frase por separado. */
  function searchMulti(entryText) {
    const single = search(entryText)
    if (single && score(entryText, single) >= 0.6) return single
    const pieces = entryText.split(/(?<=[.;:?!])\s+(?=[A-Z])|\s*\.\.\.\s*/).filter((p) => words(p).length >= 3)
    if (pieces.length < 2) return single
    const segs = []
    for (const p of pieces) {
      const found = search(p)
      if (found && score(p, found) >= 0.7) {
        for (const f of found) if (!segs.some((x) => x.b === f.b && x.c === f.c && x.vs.join() === f.vs.join())) segs.push(f)
      }
    }
    return segs.length ? segs : single
  }

  const stats = { ok: 0, fixed: 0, dropped: 0 }
  const fixes = []
  function resolve(entry, where) {
    const parsed = entry.reference ? parseRef(entry.reference) : null
    if (parsed && score(entry.text, parsed) >= 0.6) { stats.ok++; return parsed }
    const found = searchMulti(entry.text)
    if (found && score(entry.text, found) >= 0.6) {
      stats.fixed++
      fixes.push(`${where}: «${entry.reference}» → ${found.map((s) => `${NAMES[s.b - 1]} ${s.c}:${s.vs[0]}-${s.vs.at(-1)}`).join('; ')}`)
      return found
    }
    if (parsed && score(entry.text, parsed) >= 0.4) { stats.ok++; return parsed } // cita muy parafraseada
    stats.dropped++
    fixes.push(`${where}: «${entry.reference}» — descartada («${entry.text.slice(0, 60)}…»)`)
    return null
  }

  /** {b,c,vs} → "b.c.13-14,16" */
  function encode(segs) {
    return segs.filter(({ b, c, vs }) => vs.some((v) => text.has(`${b}.${c}.${v}`))).map(({ b, c, vs }) => {
      // Se descartan versículos inexistentes (p. ej. «Gálatas 5:27» en el original)
      const sorted = [...new Set(vs)].filter((v) => text.has(`${b}.${c}.${v}`)).sort((x, y) => x - y)
      const parts = []
      for (let i = 0; i < sorted.length; i++) {
        const start = sorted[i]
        while (sorted[i + 1] === sorted[i] + 1) i++
        parts.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`)
      }
      return `${b}.${c}.${parts.join(',')}`
    })
  }

  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  const out = {}
  for (const r of readings) {
    const [month, day] = r.date.split('-')
    const key = `${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`
    const where = `${key} ${r.period}`
    const theme = resolve(r.themeVerse, `${where} (tema)`)
    const verses = r.verses.map((v, i) => resolve(v, `${where} #${i + 1}`)).filter(Boolean)
    if (!theme) throw new Error(`Sin versículo tema: ${where}`)
    out[key] ??= {}
    out[key][r.period === 'morning' ? 'm' : 'e'] = { t: encode(theme), v: verses.map(encode) }
  }
  const sortedOut = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(sortedOut) + '\n')
  console.log(fixes.join('\n'))
  console.log(`\nDías: ${Object.keys(sortedOut).length} · referencias correctas: ${stats.ok} · corregidas: ${stats.fixed} · descartadas: ${stats.dropped}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
