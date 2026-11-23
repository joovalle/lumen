import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { engine } from '@/core/engine/client'
import { toPlainText } from '@/core/markup'
import { nextChapter, type Passage } from '@/core/reference'
import { i18n } from '@/i18n'
import * as lumenVoice from '@/core/voice/lumenVoice'
import { useLibrary } from './library'

/**
 * Lectura en voz alta con la voz del propio dispositivo (Web Speech API):
 * gratis, sin internet en la mayoría de los teléfonos y en el idioma de la versión.
 * Se lee versículo por versículo para resaltar el que suena, pausar y retomar
 * con precisión (y evitar cortes de algunos navegadores con textos largos).
 */
export const RATES = [0.75, 1, 1.25, 1.5]
const LANG_TAGS: Record<string, string> = { es: 'es', en: 'en', pt: 'pt' }

export const useSpeech = defineStore('speech', () => {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  /** Se puede escuchar si hay voz del sistema o si el navegador puede usar la voz de Lumen. */
  const supported = !!synth || typeof WebAssembly !== 'undefined'
  const state = ref<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  const bibleId = ref<string | null>(null)
  const passage = ref<Passage | null>(null)
  const verses = shallowRef<{ verse: number; text: string }[]>([])
  const index = ref(0)
  /** Último problema al hablar: 'blocked' (el navegador pidió un toque) o 'failed' */
  const error = ref<'blocked' | 'failed' | 'engine' | null>(null)
  /** Código exacto del último error del motor (p. ej. «synthesis-failed») */
  const errorCode = ref<string | null>(null)
  const voices = shallowRef<SpeechSynthesisVoice[]>([])
  const prefs = useLocalStorage('lumen.speech', { rate: 1, voiceURI: '', autoNext: true, level: 0, engine: 'system' as 'system' | 'lumen' }, { mergeDefaults: true })

  // ——— Voz de Lumen (no depende del teléfono) ———
  const lumenState = ref<'unknown' | 'absent' | 'installing' | 'installed'>('unknown')
  const lumenProgress = ref(0)
  const lumenSize = ref(0)
  const lumenError = ref<string | null>(null)
  async function checkLumen() {
    if (lumenState.value === 'installing') return
    lumenState.value = (await lumenVoice.isInstalled()) ? 'installed' : 'absent'
    if (!lumenSize.value) lumenSize.value = await lumenVoice.downloadSize().catch(() => 0)
  }
  async function installLumen() {
    lumenState.value = 'installing'
    lumenError.value = null
    lumenProgress.value = 0
    try {
      await lumenVoice.install((p) => (lumenProgress.value = p))
      lumenState.value = 'installed'
      prefs.value.engine = 'lumen'
    } catch (e) {
      lumenState.value = 'absent'
      lumenError.value = e instanceof Error ? e.message : String(e)
    }
  }
  async function removeLumen() {
    stop()
    await lumenVoice.remove()
    prefs.value.engine = 'system'
    lumenState.value = 'absent'
  }
  let session = 0
  let keepAlive: ReturnType<typeof setInterval> | null = null

  function loadVoices() {
    voices.value = synth?.getVoices() ?? []
  }
  if (synth) {
    loadVoices()
    synth.addEventListener?.('voiceschanged', loadVoices)
  }

  const current = computed(() => verses.value[index.value] ?? null)

  /** Idioma de la versión que se escucha (o el de la interfaz si no se sabe). */
  const lang = computed(() => {
    const rec = bibleId.value ? useLibrary().get(bibleId.value) : undefined
    return LANG_TAGS[rec?.language ?? ''] ?? (i18n.global.locale.value as string)
  })
  const voicesForLang = computed(() => voices.value.filter((v) => v.lang.toLowerCase().startsWith(lang.value)))
  /** Se usa la voz de Lumen si está elegida, instalada y la versión es en español. */
  const usingLumen = computed(() => prefs.value.engine === 'lumen' && lumenState.value === 'installed' && lang.value === 'es')

  const voice = computed(() =>
    voicesForLang.value.find((v) => v.voiceURI === prefs.value.voiceURI)
    ?? voicesForLang.value.find((v) => v.localService && v.default)
    ?? voicesForLang.value.find((v) => v.localService)
    ?? voicesForLang.value[0]
    ?? null,
  )

  let primed = false
  /** Momento de la última cancelación: Android descarta lo que se pide justo después */
  let cancelledAt = -Infinity
  function cancelNow() {
    synth?.cancel()
    cancelledAt = performance.now()
  }
  /**
   * iPhone/iPad solo permiten hablar si la primera lectura empieza dentro del toque:
   * se «despierta» el motor con una frase vacía en el mismo gesto.
   */
  /** Solo iPhone/iPad necesitan «despertar» el motor dentro del toque (en Android puede trabarlo). */
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  const isApple = typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  function prime() {
    if (!synth || primed || !isApple) return
    primed = true
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      if (synth.paused) synth.resume()
      synth.speak(u)
    } catch { /* sin efecto */ }
  }

  /** Registro de lo que responde el motor de voz (para el diagnóstico). */
  const diag = ref<string[]>([])
  function log(msg: string) {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    diag.value = [...diag.value.slice(-24), `${t} ${msg}`]
  }

  /**
   * Niveles de compatibilidad: 0 = voz elegida + idioma; 1 = solo idioma;
   * 2 = voz predeterminada del teléfono. Si un nivel falla, se baja al siguiente
   * y se recuerda el que funcionó en ese dispositivo.
   */
  function utterance(text: string, level: number) {
    const u = new SpeechSynthesisUtterance(text)
    // Android nombra los idiomas «es_US»; el estándar es «es-US»
    if (level < 2) u.lang = (voice.value?.lang ?? lang.value).replace('_', '-')
    if (level < 1 && voice.value) u.voice = voice.value
    u.rate = prefs.value.rate
    return u
  }

  let audio: HTMLAudioElement | null = null
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
  /** iPhone: el elemento de audio debe «estrenarse» dentro del toque. */
  function unlockAudio() {
    audio ??= new Audio()
    if (!audio.src || audio.src === SILENT) {
      audio.src = SILENT
      audio.play().catch(() => undefined)
    }
  }
  const prepared = new Map<number, Promise<string>>()
  function clearPrepared() {
    for (const p of prepared.values()) void p.then((u) => URL.revokeObjectURL(u)).catch(() => undefined)
    prepared.clear()
  }
  function prepare(i: number): Promise<string> | undefined {
    const v = verses.value[i]
    if (!v) return undefined
    let p = prepared.get(i)
    if (!p) {
      p = lumenVoice.synthesize(v.text, prefs.value.rate).then(({ pcm, sampleRate }) => URL.createObjectURL(lumenVoice.toWav(pcm, sampleRate)))
      prepared.set(i, p)
    }
    return p
  }

  async function speakLumen() {
    const my = ++session
    const i = index.value
    audio ??= new Audio()
    try {
      const url = await prepare(i)
      if (!url || my !== session || state.value !== 'playing') return
      audio.src = url
      audio.onended = () => { if (my === session && state.value === 'playing') void advance() }
      await audio.play()
      log(`▶ voz de Lumen v.${current.value?.verse}`)
      void prepare(i + 1) // el siguiente versículo se prepara mientras suena este
      // Se liberan los audios ya escuchados
      for (const k of [...prepared.keys()]) if (k < i - 1) { void prepared.get(k)!.then((u) => URL.revokeObjectURL(u)); prepared.delete(k) }
    } catch (e) {
      if (my !== session) return
      const name = (e as Error).name
      log(`✗ voz de Lumen: ${(e as Error).message}`)
      state.value = 'paused'
      error.value = name === 'NotAllowedError' ? 'blocked' : 'failed'
      errorCode.value = name === 'NotAllowedError' ? null : 'lumen'
    }
  }

  function speakCurrent(level = prefs.value.level) {
    if (usingLumen.value) { void speakLumen(); return }
    if (!current.value) return
    if (!synth) {
      // Sin voz del sistema: se ofrece la voz de Lumen
      state.value = 'paused'
      error.value = 'engine'
      errorCode.value = 'sin speechSynthesis'
      return
    }
    const my = ++session
    // Android descarta lo que se pide justo después de cancel(): se espera un instante
    if (synth.speaking || synth.pending) cancelNow()
    const wait = Math.max(0, 150 - (performance.now() - cancelledAt))
    const fallback = (why: string) => {
      if (my !== session) return
      log(`✗ ${why} (nivel ${level})`)
      if (level < 2) {
        prefs.value.level = level + 1
        speakCurrent(level + 1)
      } else {
        state.value = 'paused'
        // «synthesis-failed» en todos los niveles = el motor de voz del sistema rechaza hablar
        error.value = why === 'not-allowed' ? 'blocked' : why === 'synthesis-failed' ? 'engine' : 'failed'
        errorCode.value = why
      }
    }
    const go = () => {
      if (my !== session || !current.value) return
      const u = utterance(current.value.text, level)
      let started = false
      u.onstart = () => { started = true; error.value = null; if (prefs.value.level !== level) prefs.value.level = level; log(`▶ inicio v.${current.value?.verse} (nivel ${level})`) }
      u.onend = () => { if (my === session && state.value === 'playing') void advance() }
      u.onerror = (e) => {
        if (my !== session || e.error === 'interrupted' || e.error === 'canceled') return
        fallback(e.error || 'error')
      }
      // Solo se reanuda si el motor está realmente en pausa: en Chrome para Android,
      // resume() sin pausa previa puede hacer fallar la síntesis («synthesis-failed»)
      if (synth.paused) synth.resume()
      synth.speak(u)
      log(`→ hablar v.${current.value.verse} · ${u.lang || 'idioma del teléfono'}${u.voice ? ` · ${u.voice.name}` : ''}`)
      // Si no empieza a hablar en unos segundos, se prueba con una configuración más simple
      setTimeout(() => {
        if (my !== session || started || state.value !== 'playing') return
        if (synth.speaking) { started = true; return }
        fallback('sin respuesta')
      }, 3000)
    }
    if (wait > 0) setTimeout(go, wait)
    else go()
    // Chrome de escritorio corta las voces en línea tras ~15 s: pausa/reanuda periódicamente
    if (keepAlive) clearInterval(keepAlive)
    if (voice.value && !voice.value.localService && !isAndroid) {
      keepAlive = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume() } }, 10_000)
    }
  }

  /** Prueba directa desde el diagnóstico (dentro del toque, sin cargar nada antes). */
  function test(text: string, minimal = false) {
    if (!synth) return log('✗ este navegador no tiene speechSynthesis')
    const name = minimal ? 'prueba mínima' : 'prueba'
    const u = new SpeechSynthesisUtterance(text)
    if (!minimal) u.lang = lang.value
    u.onstart = () => log(`✓ ${name}: el teléfono empezó a hablar`)
    u.onend = () => log(`✓ ${name} terminada`)
    u.onerror = (e) => log(`✗ ${name}: ${e.error}`)
    if (minimal) {
      // Lo mínimo posible: ni cancelar, ni reanudar, ni idioma, dentro del mismo toque
      synth.speak(u)
      log(`→ ${name} · speaking=${synth.speaking} pending=${synth.pending} paused=${synth.paused}`)
      return
    }
    if (synth.speaking || synth.pending) cancelNow()
    setTimeout(() => { synth.speak(u); log(`→ ${name} · ${u.lang}`) }, Math.max(0, 150 - (performance.now() - cancelledAt)))
  }

  async function advance() {
    if (index.value < verses.value.length - 1) {
      index.value++
      speakCurrent()
      return
    }
    const next = passage.value && prefs.value.autoNext ? nextChapter(passage.value) : undefined
    if (next && bibleId.value) await start(bibleId.value, next.book, next.chapter, 1)
    else stop()
  }

  /** Empieza a leer un capítulo desde un versículo. */
  async function start(id: string, book: number, chapter: number, fromVerse = 1) {
    if (!synth && prefs.value.engine !== 'lumen') return
    prime()
    if (prefs.value.engine === 'lumen') unlockAudio()
    if (lumenState.value === 'unknown') await checkLumen()
    clearPrepared()
    error.value = null
    const my = ++session
    if (synth && (synth.speaking || synth.pending)) cancelNow()
    state.value = 'loading'
    const library = useLibrary()
    await library.ensureOpen(id)
    const rows = await engine().chapter(id, book, chapter)
    if (my !== session) return
    bibleId.value = id
    passage.value = { book, chapter }
    verses.value = rows.map((r) => ({ verse: r.verse, text: toPlainText(r.html) })).filter((v) => v.text)
    index.value = Math.max(0, verses.value.findIndex((v) => v.verse >= fromVerse))
    state.value = 'playing'
    speakCurrent()
  }

  // Pausa = cancelar y recordar el versículo (pause() no es fiable en Android)
  function pause() {
    if (state.value !== 'playing') return
    if (usingLumen.value && audio && !audio.paused) {
      audio.pause()
      state.value = 'paused'
      return
    }
    session++
    cancelNow()
    state.value = 'paused'
  }
  function resume() {
    if (state.value !== 'paused') return
    prime()
    // Tras un fallo, al tocar ▶ se vuelve a intentar desde la configuración completa
    if (error.value === 'failed' || error.value === 'engine') prefs.value.level = 0
    const wasError = !!error.value
    error.value = null
    errorCode.value = null
    state.value = 'playing'
    // Voz de Lumen en pausa: se retoma el mismo audio
    if (usingLumen.value && audio && audio.src && audio.src !== SILENT && audio.paused && !wasError) {
      audio.play().catch(() => speakCurrent())
      return
    }
    speakCurrent()
  }
  function toggle() {
    if (state.value === 'playing') pause()
    else if (state.value === 'paused') resume()
  }
  function stop() {
    session++
    cancelNow()
    audio?.pause()
    clearPrepared()
    if (keepAlive) clearInterval(keepAlive)
    state.value = 'idle'
    passage.value = null
    verses.value = []
  }
  function step(d: number) {
    const i = index.value + d
    if (i < 0 || i >= verses.value.length) return
    index.value = i
    if (state.value === 'playing') speakCurrent()
  }
  function setRate(rate: number) {
    prefs.value.rate = rate
    clearPrepared()
    if (state.value === 'playing') speakCurrent()
  }
  function setVoice(uri: string) {
    prefs.value.voiceURI = uri
    prefs.value.level = 0
    if (state.value === 'playing') speakCurrent()
  }

  return {
    usingLumen, lumenState, lumenProgress, lumenSize, lumenError, checkLumen, installLumen, removeLumen,
    supported, state, error, errorCode, diag, test, voices, bibleId, passage, verses, index, current, prefs, lang, voicesForLang, voice,
    start, pause, resume, toggle, stop, step, setRate, setVoice,
  }
})
