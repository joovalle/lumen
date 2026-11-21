<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, BookOpen, Copy, History, Image as ImageIcon } from 'lucide-vue-next'
import { bookByNumber } from '@/core/canon'
import { tidyText } from '@/core/share/verseImage'
import { verseOfTheDay } from '@/core/votd'
import { passageTextFor, type PassageText } from '@/composables/passageText'
import { useLocale } from '@/composables/locale'
import { openShareStudio } from '@/composables/shareStudio'
import { toast } from '@/composables/toast'
import { useSettings } from '@/stores/settings'

const router = useRouter()
const settings = useSettings()
const { t, locale } = useI18n()
const { lang, passage } = useLocale()

const today = new Date()
const votd = verseOfTheDay(today)
const verse = ref<PassageText | null>(null)
const error = ref(false)

watch(
  () => [settings.prefs.bibles[0], lang.value] as const,
  async ([id]) => {
    if (!id) return
    try {
      verse.value = await passageTextFor(id, votd, lang.value)
      error.value = false
    } catch {
      error.value = true
    }
  },
  { immediate: true },
)

const greeting = computed(() => {
  const h = today.getHours()
  return t(h < 12 ? 'today.morning' : h < 19 ? 'today.afternoon' : 'today.evening')
})
const dateLabel = computed(() => {
  const s = new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(today)
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const reference = computed(() => (verse.value ? `${verse.value.label} · ${verse.value.abbreviation}` : ''))

function read(book: number, chapter: number, v?: number) {
  void router.push({ name: 'read', params: { book: bookByNumber(book)!.osis, chapter }, query: v ? { v } : {} })
}
function share() {
  if (verse.value) openShareStudio(verse.value.text, reference.value)
}
async function copy() {
  if (!verse.value) return
  await navigator.clipboard.writeText(`«${tidyText(verse.value.text)}»\n— ${reference.value}`)
  toast(t('selection.copied'), 'success')
}
const last = computed(() => settings.prefs.last)
const recent = computed(() => settings.prefs.history.slice(1, 7))
</script>

<template>
  <div class="page today">
    <header class="hello">
      <p class="eyebrow date">{{ dateLabel }}</p>
      <h1 class="page-title">{{ greeting }}</h1>
    </header>

    <section class="votd">
      <div class="glow" aria-hidden="true" />
      <p class="eyebrow label">{{ $t('today.votd') }}</p>
      <blockquote v-if="verse">
        <p class="text">{{ tidyText(verse.text) }}</p>
        <footer>{{ verse.label }} <span>· {{ verse.abbreviation }}</span></footer>
      </blockquote>
      <p v-else-if="error" class="muted">{{ $t('reader.loadError') }}</p>
      <div v-else class="skeleton" aria-hidden="true"><i /><i /><i /></div>
      <div class="actions">
        <button class="btn btn-primary" :disabled="!verse" @click="share"><ImageIcon /> {{ $t('today.createImage') }}</button>
        <button class="btn" @click="read(votd.book, votd.chapter, votd.verse)"><BookOpen /> {{ $t('today.readChapter') }}</button>
        <button class="btn btn-ghost" :disabled="!verse" @click="copy"><Copy /> {{ $t('common.copy') }}</button>
      </div>
    </section>

    <section class="section">
      <button class="continue card" @click="read(last.book, last.chapter)">
        <span class="icon"><BookOpen /></span>
        <span class="info">
          <small>{{ $t('today.continue') }}</small>
          <strong>{{ passage(last) }}</strong>
        </span>
        <ArrowRight class="arrow" />
      </button>
    </section>

    <section v-if="recent.length" class="section">
      <h2 class="section-title"><History /> {{ $t('today.recent') }}</h2>
      <div class="recent">
        <button v-for="p in recent" :key="`${p.book}-${p.chapter}`" class="chip" @click="read(p.book, p.chapter)">{{ passage(p) }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.today { max-width: 820px; }
.hello { margin-bottom: 26px; }
.date { text-transform: none; letter-spacing: 0.02em; font-size: 13px; margin-bottom: 6px; }
.votd {
  position: relative; overflow: hidden;
  padding: 40px 44px 32px; border-radius: var(--radius-xl);
  background: linear-gradient(160deg, var(--bg-elevated), var(--surface));
  border: 1px solid var(--border); box-shadow: var(--shadow-m);
}
.glow {
  position: absolute; inset: -40% -20% auto auto; width: 70%; height: 120%; pointer-events: none;
  background: radial-gradient(closest-side, var(--accent-soft), transparent); filter: blur(10px);
}
.label { position: relative; color: var(--accent); }
blockquote { position: relative; margin: 18px 0 0; }
.text {
  font-family: var(--font-serif); font-size: clamp(23px, 3.2vw, 31px); line-height: 1.45;
  font-weight: 450; letter-spacing: -0.005em; text-wrap: pretty;
}
.text::before { content: '“'; position: absolute; left: -0.55em; top: -0.12em; color: var(--accent); opacity: 0.45; font-size: 1.6em; }
footer { margin-top: 18px; font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
footer span { color: var(--text-3); font-weight: 600; }
.skeleton { display: grid; gap: 12px; margin-top: 22px; }
.skeleton i { display: block; height: 22px; border-radius: 8px; background: var(--surface-2); animation: pulse 1.4s ease-in-out infinite; }
.skeleton i:nth-child(2) { width: 85%; } .skeleton i:nth-child(3) { width: 55%; }
@keyframes pulse { 50% { opacity: 0.5; } }
.actions { position: relative; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.muted { color: var(--text-3); margin-top: 16px; }
.continue {
  display: flex; align-items: center; gap: 16px; width: 100%; padding: 18px 20px; text-align: left;
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.continue:hover { border-color: var(--accent); box-shadow: var(--shadow-m); }
.continue .icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; background: var(--accent-soft); color: var(--accent); flex: none; }
.continue .icon svg { width: 22px; height: 22px; }
.continue .info { display: grid; gap: 2px; flex: 1; }
.continue small { font-size: 12px; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-3); }
.continue strong { font-family: var(--font-serif); font-size: 20px; font-weight: 600; }
.arrow { width: 20px; height: 20px; color: var(--accent); }
.section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.section-title svg { width: 18px; height: 18px; color: var(--text-3); }
.recent { display: flex; flex-wrap: wrap; gap: 8px; }
.recent .chip { cursor: pointer; height: 34px; padding: 0 14px; }
.recent .chip:hover { border-color: var(--border-strong); color: var(--text); }
@media (max-width: 720px) {
  .votd { padding: 30px 24px 24px; }
  .text::before { left: -0.4em; }
  .actions .btn { flex: 1 1 auto; }
}
</style>
