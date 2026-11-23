import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { engine } from '@/core/engine/client'
import { toPlainText } from '@/core/markup'
import { nextChapter, type Passage } from '@/core/reference'
import { i18n } from '@/i18n'
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
  const supported = !!synth
  const state = ref<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  const bibleId = ref<string | null>(null)
  const passage = ref<Passage | null>(null)
  const verses = shallowRef<{ verse: number; text: string }[]>([])
  const index = ref(0)
  /** Último problema al hablar: 'blocked' (el navegador pidió un toque) o 'failed' */
  const error = ref<'blocked' | 'failed' | null>(null)
  /** Código exacto del último error del motor (p. ej. «synthesis-failed») */
  const errorCode = ref<string | null>(null)
  const voices = shallowRef<SpeechSynthesisVoice[]>([])
  const prefs = useLocalStorage('lumen.speech', { rate: 1, voiceURI: '', autoNext: true, level: 0 }, { mergeDefaults: true })
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
  const isApple = typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  function prime() {
    if (!synth || primed || !isApple) return
    primed = true
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      synth.resume()
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
    if (level < 2) u.lang = voice.value?.lang ?? lang.value
    if (level < 1 && voice.value) u.voice = voice.value
    u.rate = prefs.value.rate
    return u
  }

  function speakCurrent(level = prefs.value.level) {
    if (!synth || !current.value) return
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
        error.value = why === 'not-allowed' ? 'blocked' : 'failed'
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
      // El motor puede haber quedado en pausa interna: se reactiva antes de hablar
      synth.resume()
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
    if (voice.value && !voice.value.localService) {
      keepAlive = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume() } }, 10_000)
    }
  }

  /** Prueba directa desde el diagnóstico (dentro del toque, sin cargar nada antes). */
  function test(text: string) {
    if (!synth) return log('✗ este navegador no tiene speechSynthesis')
    if (synth.speaking || synth.pending) cancelNow()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang.value
    u.onstart = () => log('✓ prueba: el teléfono empezó a hablar')
    u.onend = () => log('✓ prueba terminada')
    u.onerror = (e) => log(`✗ prueba: ${e.error}`)
    synth.resume()
    setTimeout(() => { synth.speak(u); log(`→ prueba · ${u.lang}`) }, Math.max(0, 150 - (performance.now() - cancelledAt)))
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
    if (!synth) return
    prime()
    error.value = null
    const my = ++session
    if (synth.speaking || synth.pending) cancelNow()
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
    session++
    cancelNow()
    state.value = 'paused'
  }
  function resume() {
    if (state.value !== 'paused') return
    prime()
    // Tras un fallo, al tocar ▶ se vuelve a intentar desde la configuración completa
    if (error.value === 'failed') prefs.value.level = 0
    error.value = null
    errorCode.value = null
    state.value = 'playing'
    speakCurrent()
  }
  function toggle() {
    if (state.value === 'playing') pause()
    else if (state.value === 'paused') resume()
  }
  function stop() {
    session++
    cancelNow()
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
    if (state.value === 'playing') speakCurrent()
  }
  function setVoice(uri: string) {
    prefs.value.voiceURI = uri
    prefs.value.level = 0
    if (state.value === 'playing') speakCurrent()
  }

  return {
    supported, state, error, errorCode, diag, test, voices, bibleId, passage, verses, index, current, prefs, lang, voicesForLang, voice,
    start, pause, resume, toggle, stop, step, setRate, setVoice,
  }
})
