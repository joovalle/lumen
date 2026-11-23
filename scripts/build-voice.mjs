/**
 * Prepara la «voz de Lumen»: lectura en voz alta que funciona dentro de la app,
 * sin depender del motor de voz del teléfono.
 *
 *  - Modelo de voz Piper «carlfm» (español, dataset de dominio público),
 *    descargado de las publicaciones oficiales de rhasspy/piper en GitHub.
 *  - Datos del fonemizador (espeak-ng) del paquete @diffusionstudio/piper-wasm.
 *
 * Los archivos grandes se guardan comprimidos (gzip) en public/voice/ y la app
 * los descomprime en el dispositivo. Uso: npm run build:voice
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'voice')
const cache = join(root, 'node_modules', '.cache', 'lumen-sources')
const PIPER = join(root, 'node_modules', '@diffusionstudio', 'piper-wasm', 'build')

const VOICE = {
  id: 'es-carlfm-x-low',
  url: 'https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-es-carlfm-x-low.tar.gz',
  lang: 'es',
  name: 'Carlos (español)',
  license: 'Dominio público (dataset carlfm01/my-speech-datasets) · modelo Piper (MIT)',
}

function untar(tgz) {
  const tar = gunzipSync(tgz)
  const files = {}
  for (let off = 0; off + 512 <= tar.length; ) {
    const name = tar.subarray(off, off + 100).toString().replace(/\0.*$/s, '')
    if (!name) break
    const size = parseInt(tar.subarray(off + 124, off + 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0
    files[name.replace(/^\.\//, '')] = tar.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

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

async function main() {
  await mkdir(out, { recursive: true })
  const files = untar(await cached(VOICE.url, `${VOICE.id}.tar.gz`))
  const onnx = Object.entries(files).find(([n]) => n.endsWith('.onnx'))?.[1]
  const config = Object.entries(files).find(([n]) => n.endsWith('.onnx.json'))?.[1]
  const card = files['MODEL_CARD']
  if (!onnx || !config) throw new Error('El paquete de voz no tiene el modelo esperado')

  const model = gzipSync(onnx, { level: 9 })
  await writeFile(join(out, `${VOICE.id}.onnx.gz`), model)
  await writeFile(join(out, `${VOICE.id}.onnx.json`), config)
  if (card) await writeFile(join(out, `${VOICE.id}.MODEL_CARD.txt`), card)

  const data = gzipSync(await readFile(join(PIPER, 'piper_phonemize.data')), { level: 9 })
  await writeFile(join(out, 'piper_phonemize.data.gz'), data)

  // El módulo del fonemizador es UMD: se publica como ES module para el worker
  const js = await readFile(join(PIPER, 'piper_phonemize.js'), 'utf8')
  await writeFile(join(root, 'src', 'vendor', 'piper_phonemize.mjs'),
    `// Copia de @diffusionstudio/piper-wasm 1.0.0 (MIT) — fonemizador de Piper (espeak-ng)\n// Generado por scripts/build-voice.mjs; no editar a mano.\n${js.replace(/if \(typeof exports === 'object'[\s\S]*$/, '')}\nexport default createPiperPhonemize\n`)

  const manifest = {
    version: 1,
    voice: { ...VOICE, url: undefined, model: `voice/${VOICE.id}.onnx.gz`, config: `voice/${VOICE.id}.onnx.json`, sizes: { model: model.length, data: data.length } },
    data: 'voice/piper_phonemize.data.gz',
  }
  await writeFile(join(out, 'voice.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`  ✓ voz ${VOICE.id}: modelo ${(model.length / 1e6).toFixed(1)} MB, fonemizador ${(data.length / 1e6).toFixed(1)} MB (comprimidos)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
