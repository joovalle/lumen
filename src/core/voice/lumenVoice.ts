/**
 * «Voz de Lumen»: lectura en voz alta que no depende del motor de voz del teléfono.
 * Los archivos (≈70 MB comprimidos) se descargan una sola vez, se guardan en el
 * dispositivo (Cache Storage) y desde entonces funciona sin internet.
 */
const CACHE = 'lumen-voice-v1'
const ORT_WASM = new URL('../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', import.meta.url).href
const PIPER_WASM = new URL('../../../node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm', import.meta.url).href

interface Manifest {
  version: number
  data: string
  voice: { id: string; lang: string; name: string; license: string; model: string; config: string; sizes: { model: number; data: number } }
}
interface FileSpec { key: 'ort' | 'piperWasm' | 'data' | 'model' | 'config'; url: string; gz: boolean; size: number }

let manifestP: Promise<Manifest> | null = null
/** Descripción de la voz; se guarda junto a ella para que funcione sin internet. */
export function manifest(): Promise<Manifest> {
  return (manifestP ??= (async () => {
    const url = new URL('voice/voice.json', document.baseURI).href
    const cache = 'caches' in window ? await caches.open(CACHE) : null
    try {
      const res = await fetch(url, { cache: 'no-cache' })
      if (!res.ok) throw new Error(String(res.status))
      if (cache && (await cache.match(url))) await cache.put(url, res.clone())
      return await res.json()
    } catch {
      const saved = await cache?.match(url)
      if (saved) return saved.json()
      throw new Error('No se encontró la voz de Lumen')
    }
  })().catch((e) => { manifestP = null; throw e }))
}

async function files(): Promise<FileSpec[]> {
  const m = await manifest()
  const abs = (p: string) => new URL(p, document.baseURI).href
  return [
    { key: 'ort', url: ORT_WASM, gz: false, size: 4_000_000 },
    { key: 'piperWasm', url: PIPER_WASM, gz: false, size: 250_000 },
    { key: 'data', url: abs(m.data), gz: true, size: m.voice.sizes.data },
    { key: 'model', url: abs(m.voice.model), gz: true, size: m.voice.sizes.model },
    { key: 'config', url: abs(m.voice.config), gz: false, size: 6_000 },
  ]
}

/** Tamaño aproximado de la descarga, para mostrarlo antes de instalar. */
export async function downloadSize(): Promise<number> {
  return (await files()).reduce((n, f) => n + f.size, 0)
}

export async function isInstalled(): Promise<boolean> {
  if (!('caches' in window)) return false
  try {
    const cache = await caches.open(CACHE)
    const list = await files()
    for (const f of list) if (!(await cache.match(f.url))) return false
    return true
  } catch {
    return false
  }
}

/** Descarga y guarda la voz, informando el progreso (0–1). */
export async function install(onProgress: (p: number) => void): Promise<void> {
  const cache = await caches.open(CACHE)
  const list = await files()
  const total = list.reduce((n, f) => n + f.size, 0)
  let done = 0
  for (const f of list) {
    if (await cache.match(f.url)) { done += f.size; onProgress(done / total); continue }
    const res = await fetch(f.url)
    if (!res.ok || !res.body) throw new Error(`No se pudo descargar la voz (${res.status})`)
    const reader = res.body.getReader()
    const bufs: Uint8Array[] = []
    let got = 0
    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      bufs.push(value)
      got += value.length
      onProgress(Math.min(0.99, (done + Math.min(got, f.size)) / total))
    }
    await cache.put(f.url, new Response(new Blob(bufs as BlobPart[])))
    done += f.size
  }
  // La descripción de la voz también queda guardada (para usarla sin internet)
  const murl = new URL('voice/voice.json', document.baseURI).href
  const mres = await fetch(murl, { cache: 'no-cache' }).catch(() => null)
  if (mres?.ok) await cache.put(murl, mres)
  // Se borran los archivos de voces anteriores
  const keep = new Set([...list.map((f) => f.url), murl])
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req)
  try { await navigator.storage?.persist?.() } catch { /* opcional */ }
  onProgress(1)
}

export async function remove(): Promise<void> {
  await caches.delete(CACHE)
  worker?.terminate()
  worker = null
  ready = null
}

// ——— Síntesis ———

let worker: Worker | null = null
let ready: Promise<number> | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: { pcm: Float32Array; sampleRate: number }) => void; reject: (e: Error) => void }>()

async function read(cache: Cache, f: FileSpec): Promise<ArrayBuffer> {
  const res = await cache.match(f.url)
  if (!res) throw new Error('La voz de Lumen no está instalada')
  if (!f.gz) return res.arrayBuffer()
  const blob = await res.blob()
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
  if (head[0] !== 0x1f || head[1] !== 0x8b) return blob.arrayBuffer() // el servidor ya lo descomprimió
  return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

/** Prepara el motor (unos segundos la primera vez en cada sesión). */
export function load(): Promise<number> {
  return (ready ??= (async () => {
    const cache = await caches.open(CACHE)
    const list = await files()
    const get = (k: FileSpec['key']) => read(cache, list.find((f) => f.key === k)!)
    const [ortWasm, piperWasm, piperData, model, config] = await Promise.all([get('ort'), get('piperWasm'), get('data'), get('model'), get('config')])
    worker = new Worker(new URL('./piper.worker.ts', import.meta.url), { type: 'module', name: 'lumen-voice' })
    return new Promise<number>((resolve, reject) => {
      worker!.onmessage = (e) => {
        const m = e.data
        if (m.type === 'ready') resolve(m.sampleRate)
        else if (m.type === 'audio') { pending.get(m.id)?.resolve({ pcm: m.pcm, sampleRate: m.sampleRate }); pending.delete(m.id) }
        else if (m.type === 'error') {
          if (m.id && pending.has(m.id)) { pending.get(m.id)!.reject(new Error(m.message)); pending.delete(m.id) }
          else reject(new Error(m.message))
        }
      }
      worker!.postMessage({ type: 'init', ortWasm, piperWasm, piperData, model, config: new TextDecoder().decode(config) }, [ortWasm, piperWasm, piperData, model])
    })
  })().catch((e) => { ready = null; throw e }))
}

/**
 * Divide un versículo en frases cortas: la primera suena antes y, mientras se
 * escucha, se preparan las siguientes (evita silencios en teléfonos lentos).
 */
export function chunks(text: string, firstMax = 70, max = 140): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.;:!?,]+(?:[.;:!?,]+[»"”’)]*|$)\s*/g) ?? []
  const out: string[] = []
  let cur = ''
  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue
    const limit = out.length ? max : firstMax
    if (cur && (cur + ' ' + part).length > limit) { out.push(cur); cur = part }
    else cur = cur ? cur + ' ' + part : part
  }
  if (cur) out.push(cur)
  // Un trozo muy corto al final se une al anterior (suena más natural)
  if (out.length > 1 && out[out.length - 1].length < 18) out[out.length - 2] += ' ' + out.pop()
  return out.length ? out : [text]
}

/** Sintetiza un texto. rate 1 = normal; 1.25 = más rápido. */
export async function synthesize(text: string, rate = 1): Promise<{ pcm: Float32Array; sampleRate: number }> {
  await load()
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage({ type: 'speak', id, text, lengthScale: 1 / rate })
  })
}

/** PCM → WAV (16 bits) para reproducir con <audio>. */
export function toWav(pcm: Float32Array, sampleRate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true)
  return new Blob([view.buffer], { type: 'audio/wav' })
}
