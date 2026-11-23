/**
 * Prepara la «voz de Lumen»: lectura en voz alta que funciona dentro de la app,
 * sin depender del motor de voz del teléfono.
 *
 *  - Modelo de voz Piper «claude» (español latinoamericano, México; Apache-2.0),
 *    tal como lo publica el proyecto k2-fsa/sherpa-onnx en GitHub.
 *  - Datos del fonemizador (espeak-ng) del paquete @diffusionstudio/piper-wasm.
 *
 * Los archivos grandes se guardan comprimidos (gzip) en public/voice/ y la app
 * los descomprime en el dispositivo. Uso: npm run build:voice
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'voice')
const cache = join(root, 'node_modules', '.cache', 'lumen-sources')
const PIPER = join(root, 'node_modules', '@diffusionstudio', 'piper-wasm', 'build')

const VOICE = {
  id: 'es-mx-claude-high',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2',
  lang: 'es',
  name: 'Voz latina (México)',
  license: 'Voz «claude» de HirCoir (Apache-2.0) · modelo Piper (MIT)',
}

/** Extrae el paquete (.tar.bz2) con el tar del sistema; Node no trae bzip2. */
async function untar(archive) {
  const dir = await mkdtemp(join(tmpdir(), 'lumen-voice-'))
  const tmp = join(dir, 'voice.tar.bz2')
  await writeFile(tmp, archive)
  execFileSync('tar', ['-xjf', tmp, '-C', dir, '--exclude=*/espeak-ng-data/*'])
  const files = {}
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) await walk(p)
      else if (p !== tmp) files[e.name] = await readFile(p)
    }
  }
  await walk(dir)
  await rm(dir, { recursive: true, force: true })
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
  // Se quitan las voces anteriores
  for (const f of await readdir(out)) if (/\.(onnx\.gz|onnx\.json|MODEL_CARD\.txt|NOTICE\.txt)$/.test(f)) await rm(join(out, f))
  const files = await untar(await cached(VOICE.url, `${VOICE.id}.tar.bz2`))
  const onnx = Object.entries(files).find(([n]) => n.endsWith('.onnx'))?.[1]
  const config = Object.entries(files).find(([n]) => n.endsWith('.onnx.json'))?.[1]
  const card = files['MODEL_CARD']
  if (!onnx || !config) throw new Error('El paquete de voz no tiene el modelo esperado')

  const model = gzipSync(onnx, { level: 9 })
  await writeFile(join(out, `${VOICE.id}.onnx.gz`), model)
  await writeFile(join(out, `${VOICE.id}.onnx.json`), config)
  if (card) await writeFile(join(out, `${VOICE.id}.MODEL_CARD.txt`), card)
  await writeFile(join(out, `${VOICE.id}.NOTICE.txt`),
    `Voz «claude» (es_MX, calidad alta) — HirCoir, https://huggingface.co/spaces/HirCoir/Piper-TTS-Spanish\n` +
    `Licencia: Apache License 2.0 — https://www.apache.org/licenses/LICENSE-2.0\n` +
    `Modelo exportado por k2-fsa/sherpa-onnx (Apache-2.0); arquitectura Piper (MIT). Lumen lo usa sin modificaciones\n` +
    `(solo se comprime con gzip para la descarga).\n`)

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
