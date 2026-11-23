/// <reference lib="webworker" />
/**
 * Síntesis de voz «Piper» dentro del navegador (ONNX Runtime + espeak-ng en WebAssembly).
 * Recibe los archivos ya descargados (no hace peticiones) y devuelve audio PCM.
 */
import * as ort from 'onnxruntime-web/wasm'
import createPiperPhonemize from '@/vendor/piper_phonemize.mjs'

interface Init { type: 'init'; ortWasm: ArrayBuffer; piperWasm: ArrayBuffer; piperData: ArrayBuffer; model: ArrayBuffer; config: string }
interface Speak { type: 'speak'; id: number; text: string; lengthScale: number }

interface VoiceConfig {
  audio: { sample_rate: number }
  espeak: { voice: string }
  inference?: { noise_scale?: number; length_scale?: number; noise_w?: number }
  speaker_id_map?: Record<string, number>
}

let session: ort.InferenceSession | null = null
let config: VoiceConfig | null = null
let piperWasm: ArrayBuffer | null = null
let piperData: ArrayBuffer | null = null

/** Texto → identificadores de fonemas (un módulo nuevo por frase, como en Piper). */
function phonemize(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    let done = false
    createPiperPhonemize({
      wasmBinary: piperWasm,
      getPreloadedPackage: () => piperData!.slice(0),
      locateFile: (u: string) => u,
      print: (line: string) => {
        if (done) return
        try {
          done = true
          resolve(JSON.parse(line).phoneme_ids)
        } catch (e) {
          reject(e)
        }
      },
      printErr: (m: string) => { if (!done && /error/i.test(m)) { done = true; reject(new Error(m)) } },
    }).then((m) => m.callMain(['-l', config!.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']))
      .catch(reject)
  })
}

async function speak(text: string, lengthScale: number) {
  const ids = await phonemize(text)
  const inf = config!.inference ?? {}
  const feeds: Record<string, ort.Tensor> = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
    scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) * lengthScale, inf.noise_w ?? 0.8])),
  }
  if (config!.speaker_id_map && Object.keys(config!.speaker_id_map).length) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]))
  const { output } = await session!.run(feeds)
  return output.data as Float32Array
}

self.onmessage = async (e: MessageEvent<Init | Speak>) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      config = JSON.parse(msg.config)
      piperWasm = msg.piperWasm
      piperData = msg.piperData
      ort.env.wasm.numThreads = 1 // GitHub Pages no permite hilos compartidos (sin COOP/COEP)
      ort.env.wasm.wasmBinary = new Uint8Array(msg.ortWasm)
      session = await ort.InferenceSession.create(new Uint8Array(msg.model), { executionProviders: ['wasm'] })
      self.postMessage({ type: 'ready', sampleRate: config!.audio.sample_rate })
    } else if (msg.type === 'speak') {
      const pcm = await speak(msg.text, msg.lengthScale)
      self.postMessage({ type: 'audio', id: msg.id, pcm, sampleRate: config!.audio.sample_rate }, [pcm.buffer])
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: (msg as Speak).id, message: err instanceof Error ? err.message : String(err) })
  }
}
