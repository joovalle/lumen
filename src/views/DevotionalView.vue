<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Copy, Image as ImageIcon, Moon, Sun } from 'lucide-vue-next'
import { bookByNumber } from '@/core/canon'
import { periodFor, type Period, type Segment } from '@/core/devotional'
import { isoDate, parseIso } from '@/core/plans'
import { tidyText } from '@/core/share/verseImage'
import { useDevotional } from '@/composables/devotional'
import { passageUrl } from '@/composables/links'
import { openShareStudio } from '@/composables/shareStudio'
import { toast } from '@/composables/toast'
import { useLibrary } from '@/stores/library'
import { useSettings } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const library = useLibrary()
const settings = useSettings()
const { t, locale } = useI18n()

const date = computed(() => parseIso(String(route.query.d ?? '')) ?? new Date())
const period = computed<Period>(() => (route.query.p === 'm' || route.query.p === 'e' ? route.query.p : periodFor(new Date())))
const { theme, verses, loading } = useDevotional(date, period)

const isToday = computed(() => isoDate(date.value) === isoDate())
const dateLabel = computed(() => {
  const s = new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(date.value)
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const abbr = computed(() => library.get(settings.prefs.bibles[0])?.info.abbreviation ?? '')

function go(days: number, p = period.value) {
  const d = new Date(date.value.getFullYear(), date.value.getMonth(), date.value.getDate() + days)
  void router.replace({ query: { d: isoDate(d), p } })
}
function open(segs: Segment[]) {
  const s = segs[0]
  void router.push({ name: 'read', params: { book: bookByNumber(s.book)!.osis, chapter: s.chapter }, query: { v: s.verses[0], to: s.verses[s.verses.length - 1] } })
}
function shareTheme() {
  if (theme.value) openShareStudio(theme.value.text, `${theme.value.label} · ${abbr.value}`)
}
async function copyAll() {
  if (!theme.value) return
  const head = `${t('devotional.title')} · ${t(period.value === 'm' ? 'devotional.morning' : 'devotional.evening')} · ${dateLabel.value}`
  const s = theme.value.segs[0]
  const body = [`«${tidyText(theme.value.text)}» — ${theme.value.label}`, ...verses.value.map((v) => `${tidyText(v.text)} — ${v.label}`)].join('\n\n')
  await navigator.clipboard.writeText(`${head}\n\n${body}\n\n(${abbr.value})\n${passageUrl(s.book, s.chapter, s.verses[0])}`)
  toast(t('selection.copied'), 'success')
}
</script>

<template>
  <div class="page devo">
    <header class="top">
      <p class="eyebrow">{{ $t('devotional.title') }}</p>
      <div class="nav">
        <button class="icon-btn" :aria-label="$t('devotional.prevDay')" @click="go(-1)"><ChevronLeft /></button>
        <h1 class="date">{{ dateLabel }}</h1>
        <button class="icon-btn" :aria-label="$t('devotional.nextDay')" @click="go(1)"><ChevronRight /></button>
      </div>
      <div class="row">
        <div class="segmented">
          <button :class="{ active: period === 'm' }" @click="go(0, 'm')"><Sun /> {{ $t('devotional.morning') }}</button>
          <button :class="{ active: period === 'e' }" @click="go(0, 'e')"><Moon /> {{ $t('devotional.evening') }}</button>
        </div>
        <button v-if="!isToday" class="btn btn-ghost btn-sm" @click="router.replace({ query: {} })">{{ $t('nav.today') }}</button>
      </div>
    </header>

    <article class="reading" :class="{ loading }">
      <template v-if="theme">
        <blockquote class="theme">
          <p>{{ tidyText(theme.text) }}</p>
          <button class="ref" @click="open(theme.segs)">{{ theme.label }}</button>
        </blockquote>
        <div class="verses">
          <p v-for="(v, i) in verses" :key="i" class="verse">
            <span class="text">{{ tidyText(v.text) }}</span>
            <button class="ref" @click="open(v.segs)">{{ v.label }}</button>
          </p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" @click="shareTheme"><ImageIcon /> {{ $t('devotional.shareImage') }}</button>
          <button class="btn" @click="copyAll"><Copy /> {{ $t('devotional.copyAll') }}</button>
        </div>
      </template>
      <div v-else class="skeleton" aria-hidden="true"><i /><i /><i /><i /></div>
    </article>

    <p class="credit">{{ $t('devotional.credit', { version: abbr }) }}</p>
  </div>
</template>

<style scoped>
.devo { max-width: 760px; }
.top { text-align: center; }
.top .eyebrow { color: var(--accent); }
.nav { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 8px 0 16px; }
.date { font-family: var(--font-serif); font-size: clamp(24px, 4vw, 32px); font-weight: 600; letter-spacing: -0.015em; min-width: 0; }
.row { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
.segmented button { display: inline-flex; align-items: center; gap: 6px; }
.segmented svg { width: 15px; height: 15px; }
.reading { margin-top: 34px; transition: opacity var(--dur) var(--ease); }
.reading.loading { opacity: 0.55; }
.theme {
  margin: 0 0 30px; padding: 30px 34px; border-radius: var(--radius-xl); text-align: center;
  background: linear-gradient(160deg, var(--bg-elevated), var(--surface)); border: 1px solid var(--border); box-shadow: var(--shadow-m);
}
.theme p { font-family: var(--font-serif); font-size: clamp(22px, 3.4vw, 28px); line-height: 1.45; font-weight: 500; text-wrap: balance; }
.ref {
  border: 0; background: transparent; padding: 0; margin-top: 12px;
  font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent);
}
.ref:hover { text-decoration: underline; text-underline-offset: 3px; }
.verses { display: grid; gap: 22px; }
.verse { display: grid; gap: 2px; font-family: var(--font-read); font-size: var(--read-size); line-height: var(--read-leading); }
.verse .ref { justify-self: start; margin-top: 4px; font-family: var(--font-ui); font-size: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
.credit { margin-top: 36px; padding-top: 18px; border-top: 1px solid var(--border); font-size: 12.5px; color: var(--text-3); line-height: 1.6; }
.skeleton { display: grid; gap: 14px; }
.skeleton i { display: block; height: 22px; border-radius: 8px; background: var(--surface-2); animation: pulse 1.4s ease-in-out infinite; }
.skeleton i:first-child { height: 120px; border-radius: var(--radius-xl); }
@keyframes pulse { 50% { opacity: 0.5; } }
@media (max-width: 720px) { .theme { padding: 24px 20px; } .actions .btn { flex: 1 1 auto; } }
</style>
