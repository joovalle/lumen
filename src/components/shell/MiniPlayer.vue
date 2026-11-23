<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Copy, Headphones, LoaderCircle, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, Stethoscope, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { toast } from '@/composables/toast'
import PopMenu from '@/components/common/PopMenu.vue'
import { bookByNumber, bookByOsis } from '@/core/canon'
import { useLocale } from '@/composables/locale'
import { useLibrary } from '@/stores/library'
import { useReader } from '@/stores/reader'
import { RATES, useSpeech } from '@/stores/speech'

/** Reproductor flotante de «Escuchar la Biblia». */
const speech = useSpeech()
const reader = useReader()
const library = useLibrary()
const route = useRoute()
const router = useRouter()
const { passage } = useLocale()
const { t } = useI18n()

/** Navegador, para el diagnóstico (Samsung Internet y Chrome se comportan distinto). */
const browser = computed(() => {
  const ua = navigator.userAgent
  const name = /SamsungBrowser\/([\d.]+)/.exec(ua)?.[0] ?? /EdgA?\/([\d.]+)/.exec(ua)?.[0] ?? /Firefox\/([\d.]+)/.exec(ua)?.[0]
    ?? /CriOS\/([\d.]+)/.exec(ua)?.[0] ?? /Chrome\/([\d.]+)/.exec(ua)?.[0] ?? (/Safari/.test(ua) ? 'Safari' : ua.slice(0, 40))
  const os = /Android [\d.]+/.exec(ua)?.[0] ?? /iPhone OS [\d_]+/.exec(ua)?.[0]?.replace(/_/g, '.') ?? ''
  return `${name} · ${os}`
})
const report = computed(() => [
  `Lumen · ${browser.value}`,
  `Voces: ${speech.voices.length} en total, ${speech.voicesForLang.length} para «${speech.lang}»`,
  `Voz elegida: ${speech.voice?.name ?? '(ninguna)'} · nivel ${speech.prefs.level}`,
  `Último error: ${speech.errorCode ?? '—'}`,
  ...speech.diag,
].join('\n'))
async function copyReport() {
  await navigator.clipboard.writeText(report.value)
  toast(t('selection.copied'), 'success')
}

const label = computed(() => (speech.passage ? passage(speech.passage) : ''))
const abbr = computed(() => (speech.bibleId ? library.get(speech.bibleId)?.info.abbreviation ?? '' : ''))
const onReading = computed(() => route.name === 'read')

/** Si se está mirando el capítulo que suena, la lectura avanza de capítulo junto con el audio. */
watch(() => speech.passage, (now, before) => {
  if (!now || !before || route.name !== 'read') return
  const shown = bookByOsis(String(route.params.book ?? ''))
  if (shown?.n === before.book && Number(route.params.chapter) === before.chapter) {
    void router.replace({ name: 'read', params: { book: bookByNumber(now.book)!.osis, chapter: now.chapter } })
  }
})

function open() {
  if (!speech.passage) return
  void router.push({ name: 'read', params: { book: bookByNumber(speech.passage.book)!.osis, chapter: speech.passage.chapter } })
}
function cycleRate() {
  const i = RATES.indexOf(speech.prefs.rate)
  speech.setRate(RATES[(i + 1) % RATES.length])
}
</script>

<template>
  <Transition name="rise">
    <div v-if="speech.state !== 'idle'" class="player" :class="{ reading: onReading, hidden: reader.selection.length }" role="region" :aria-label="$t('listen.listening')">
      <button class="pp" :aria-label="speech.state === 'playing' ? $t('listen.pause') : $t('listen.play')" @click="speech.toggle()">
        <LoaderCircle v-if="speech.state === 'loading'" class="spin" />
        <Pause v-else-if="speech.state === 'playing'" />
        <Play v-else />
      </button>
      <button class="info" @click="open">
        <strong><Headphones /> {{ label }}</strong>
        <span v-if="speech.error" class="err">{{ $t(speech.error === 'blocked' ? 'listen.tapToStart' : speech.error === 'engine' ? 'listen.engineShort' : 'listen.failed') }}<template v-if="speech.errorCode"> ({{ speech.errorCode }})</template></span>
        <span v-else>{{ abbr }}<template v-if="speech.current"> · {{ $t('listen.verse', { n: speech.current.verse }) }}</template></span>
      </button>
      <button class="ctl hide-xs" :aria-label="$t('listen.prev')" @click="speech.step(-1)"><SkipBack /></button>
      <button class="ctl hide-xs" :aria-label="$t('listen.next')" @click="speech.step(1)"><SkipForward /></button>
      <button class="rate" :title="$t('listen.speed')" @click="cycleRate">{{ speech.prefs.rate }}×</button>
      <PopMenu width="290px" class="opts">
        <template #trigger="{ toggle }">
          <button class="ctl" :aria-label="$t('listen.settings')" @click="toggle"><SlidersHorizontal /></button>
        </template>
        <div class="menu">
          <p class="menu-label">{{ $t('listen.voice') }}</p>
          <p v-if="!speech.voicesForLang.length" class="note">{{ $t('listen.noVoice') }}</p>
          <button v-for="v in speech.voicesForLang" :key="v.voiceURI" class="menu-item" @click="speech.setVoice(v.voiceURI)">
            <span>{{ v.name }}</span><Check v-if="speech.voice?.voiceURI === v.voiceURI" />
          </button>
          <label class="auto"><span>{{ $t('listen.autoNext') }}</span><input v-model="speech.prefs.autoNext" type="checkbox" class="switch"></label>
          <div class="steps">
            <button class="btn btn-sm" @click="speech.step(-1)"><SkipBack /> {{ $t('listen.prev') }}</button>
            <button class="btn btn-sm" @click="speech.step(1)">{{ $t('listen.next') }} <SkipForward /></button>
          </div>
          <div v-if="speech.error === 'engine'" class="help">
            <strong>{{ $t('listen.engineTitle') }}</strong>
            <ol><li v-for="(step, i) in ($tm('listen.engineSteps') as string[])" :key="i">{{ $rt(step) }}</li></ol>
          </div>
          <details class="diag">
            <summary><Stethoscope /> {{ $t('listen.diagnostics') }}</summary>
            <pre>{{ report }}</pre>
            <div class="steps">
              <button class="btn btn-sm" @click="speech.test($t('listen.testPhrase'))">{{ $t('listen.test') }}</button>
              <button class="btn btn-sm" @click="copyReport"><Copy /> {{ $t('common.copy') }}</button>
            </div>
          </details>
        </div>
      </PopMenu>
      <button class="ctl" :aria-label="$t('listen.stop')" @click="speech.stop()"><X /></button>
    </div>
  </Transition>
</template>

<style scoped>
.player {
  position: fixed; z-index: 38; left: 50%; transform: translateX(-50%); bottom: 22px;
  display: flex; align-items: center; gap: 4px; width: min(560px, calc(100vw - 24px));
  padding: 8px 8px 8px 8px; border-radius: 20px;
  background: var(--bg-elevated); border: 1px solid var(--border); box-shadow: var(--shadow-l);
}
.rise-enter-from, .rise-leave-to { transform: translate(-50%, 12px); }
.player.hidden { display: none; }
.pp { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--accent); color: var(--accent-contrast); flex: none; }
.pp svg { width: 20px; height: 20px; }
.info { flex: 1; min-width: 0; display: grid; text-align: left; border: 0; background: transparent; padding: 2px 8px; }
.info strong { display: flex; align-items: center; gap: 6px; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.info strong svg { width: 15px; height: 15px; color: var(--accent); flex: none; }
.info .err { color: #b9770e; white-space: normal; }
.info span { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctl { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); flex: none; }
.ctl:hover { background: var(--surface); color: var(--text); }
.ctl svg { width: 18px; height: 18px; }
.rate { height: 30px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; flex: none; }
.opts :deep(.panel) { top: auto; bottom: calc(100% + 10px); }
.menu { display: grid; gap: 2px; padding: 4px; max-height: 50vh; overflow: auto; }
.menu-label { padding: 6px 8px; font-size: 12px; font-weight: 600; color: var(--text-3); }
.note { padding: 0 8px 8px; font-size: 12.5px; color: var(--text-3); }
.menu-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 8px; border: 0; border-radius: 10px; background: transparent; text-align: left; font-size: 14px; }
.menu-item:hover { background: var(--surface); }
.menu-item svg { width: 16px; height: 16px; color: var(--accent); flex: none; }
.auto { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 8px; border-top: 1px solid var(--border); margin-top: 6px; font-size: 14px; }
.steps { display: flex; gap: 6px; padding: 4px; }
.steps .btn { flex: 1; }
.help { margin: 6px 4px; padding: 10px 12px; border-radius: 12px; background: rgba(185, 119, 14, 0.1); font-size: 12.5px; color: var(--text-2); }
.help strong { display: block; color: var(--text); margin-bottom: 6px; }
.help ol { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.diag { margin-top: 6px; border-top: 1px solid var(--border); padding-top: 6px; }
.diag summary { display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-size: 13px; font-weight: 600; color: var(--text-2); cursor: pointer; }
.diag summary svg { width: 15px; height: 15px; }
.diag pre { margin: 4px; padding: 10px; border-radius: 10px; background: var(--surface); font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; }
@media (max-width: 720px) {
  .player { bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 10px); }
  .hide-xs { display: none; }
}
</style>
