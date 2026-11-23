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
  const voices = shallowRef<SpeechSynthesisVoice[]>([])
  const prefs = useLocalStorage('lumen.speech', { rate: 1, voiceURI: '', autoNext: true }, { mergeDefaults: true })
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

  function speakCurrent() {
    if (!synth || !current.value) return
    const my = ++session
    synth.cancel()
    const u = new SpeechSynthesisUtterance(current.value.text)
    u.lang = voice.value?.lang ?? lang.value
    if (voice.value) u.voice = voice.value
    u.rate = prefs.value.rate
    u.onend = () => { if (my === session && state.value === 'playing') advance() }
    u.onerror = (e) => {
      if (my !== session || e.error === 'interrupted' || e.error === 'canceled') return
      state.value = 'paused'
    }
    synth.speak(u)
    // Chrome de escritorio corta las voces en línea tras ~15 s: pausa/reanuda periódicamente
    if (keepAlive) clearInterval(keepAlive)
    if (voice.value && !voice.value.localService) {
      keepAlive = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume() } }, 10_000)
    }
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
    const my = ++session
    synth.cancel()
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
    synth?.cancel()
    state.value = 'paused'
  }
  function resume() {
    if (state.value !== 'paused') return
    state.value = 'playing'
    speakCurrent()
  }
  function toggle() {
    if (state.value === 'playing') pause()
    else if (state.value === 'paused') resume()
  }
  function stop() {
    session++
    synth?.cancel()
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
    if (state.value === 'playing') speakCurrent()
  }

  return {
    supported, state, bibleId, passage, verses, index, current, prefs, lang, voicesForLang, voice,
    start, pause, resume, toggle, stop, step, setRate, setVoice,
  }
})
