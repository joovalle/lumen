<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { LoaderCircle, ScrollText } from 'lucide-vue-next'
import { engine } from '@/core/engine/client'
import type { CommentaryEntry } from '@/core/engine/modules'
import { useLibrary } from '@/stores/library'
import { useReader } from '@/stores/reader'
import { useSettings } from '@/stores/settings'

/**
 * Comentario del capítulo completo que acompaña la lectura:
 * la nota de los versículos visibles (o del versículo tocado) se resalta
 * y se desplaza a la vista automáticamente.
 */
const reader = useReader()
const library = useLibrary()
const settings = useSettings()
const entries = shallowRef<CommentaryEntry[]>([])
const loading = ref(false)
const list = ref<HTMLElement>()

const selected = computed({
  get: () => (library.commentaries.some((c) => c.id === settings.prefs.commentaryId) ? settings.prefs.commentaryId : library.commentaries[0]?.id) ?? null,
  set: (id) => (settings.prefs.commentaryId = id),
})

watch(
  () => [selected.value, reader.passage.book, reader.passage.chapter] as const,
  async ([id, book, chapter]) => {
    entries.value = []
    if (!id) return
    loading.value = true
    try {
      await library.ensureOpen(id)
      entries.value = await engine().commentaryChapter(id, book, chapter)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const intro = computed(() => entries.value.filter((e) => e.scope !== 'verse'))
const notes = computed(() => entries.value.filter((e) => e.scope === 'verse'))

/** Versículo de referencia: el que tocaste o, si no, el primero visible al leer. */
const current = computed(() => reader.focus ?? reader.visibleVerse ?? 1)
const active = computed(() => {
  let found = -1
  notes.value.forEach((e, i) => {
    if ((e.from ?? 0) <= current.value && current.value <= (e.to ?? 0)) found = i
  })
  return found
})

watch(active, async (i) => {
  if (i < 0) return
  await nextTick()
  // Se desplaza solo el panel (scrollIntoView movería también la página y la lectura)
  const el = list.value?.querySelector<HTMLElement>(`[data-i="${i}"]`)
  const box = el?.closest<HTMLElement>('.body')
  if (el && box) {
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8
    box.scrollTo({ top, behavior: 'smooth' })
  }
})

function goTo(e: CommentaryEntry) {
  const v = e.from ?? 1
  reader.focus = v
  document.getElementById(`v${v}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
</script>

<template>
  <div ref="list" class="commentary">
    <div v-if="!library.commentaries.length" class="empty">
      <ScrollText /><p>{{ $t('study.noCommentaryInstalled') }}</p>
      <RouterLink to="/library" class="btn btn-sm">{{ $t('nav.library') }}</RouterLink>
    </div>
    <template v-else>
      <select v-if="library.commentaries.length > 1" v-model="selected" class="input select">
        <option v-for="c in library.commentaries" :key="c.id" :value="c.id">{{ c.info.title }}</option>
      </select>
      <p v-else class="eyebrow source">{{ library.commentaries[0].info.title }}</p>

      <div v-if="loading" class="empty"><LoaderCircle class="spin" /></div>
      <div v-else-if="!entries.length" class="empty"><ScrollText /><p>{{ $t('study.noCommentary') }}</p></div>

      <details v-for="(e, i) in intro" :key="`i${i}`" class="intro" :open="e.scope === 'chapter'">
        <summary class="eyebrow">{{ e.scope === 'book' ? $t('study.bookScope') : $t('study.chapterScope', { r: e.range }) }}</summary>
        <div class="html" v-html="e.html" />
      </details>

      <article
        v-for="(e, i) in notes" :key="i" :data-i="i" class="entry" :class="{ active: i === active }"
      >
        <button class="range" :title="$t('study.goToVerse')" @click="goTo(e)">{{ $t('study.verseScope', { r: e.range }) }}</button>
        <div class="html" v-html="e.html" />
      </article>
      <p v-if="notes.length" class="hint">{{ $t('study.followHint') }}</p>
    </template>
  </div>
</template>

<style scoped>
.commentary { padding: 12px 14px 60px; }
.select { margin-bottom: 12px; }
.source { padding: 4px 6px 10px; }
.intro { margin: 0 0 10px; padding: 12px 14px; border-radius: 12px; background: var(--surface); }
.intro summary { cursor: pointer; list-style: none; }
.intro summary::before { content: '▸ '; }
.intro[open] summary::before { content: '▾ '; }
.intro .html { margin-top: 10px; }
.entry {
  padding: 14px 14px 16px; border-radius: 14px; scroll-margin-top: 8px;
  border-left: 3px solid transparent;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.entry + .entry { margin-top: 4px; }
.entry.active { background: var(--accent-soft); border-left-color: var(--accent); }
.range {
  border: 0; background: transparent; padding: 0; margin-bottom: 8px;
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent);
}
.range:hover { text-decoration: underline; text-underline-offset: 3px; }
.html { font-family: var(--font-serif); font-size: 15.5px; line-height: 1.7; color: var(--text); overflow-wrap: anywhere; }
.html :deep(p) { margin: 0 0 0.8em; }
.html :deep(b) { font-weight: 650; }
.hint { margin-top: 18px; font-size: 12px; color: var(--text-3); text-align: center; }
</style>
