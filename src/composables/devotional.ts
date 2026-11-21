import { ref, shallowRef, watch, type Ref } from 'vue'
import { engine } from '@/core/engine/client'
import { entryFrom, loadDevotional, runs, segmentLabel, type Period, type Segment } from '@/core/devotional'
import { verseKey } from '@/core/reference'
import { useLibrary } from '@/stores/library'
import { useSettings } from '@/stores/settings'
import { useLocale } from './locale'

export interface DevotionalItem { label: string; text: string; segs: Segment[] }

/** Lectura devocional del día con el texto de la Biblia principal. */
export function useDevotional(date: Ref<Date>, period: Ref<Period>) {
  const library = useLibrary()
  const settings = useSettings()
  const { lang } = useLocale()
  const theme = shallowRef<DevotionalItem | null>(null)
  const verses = shallowRef<DevotionalItem[]>([])
  const loading = ref(true)
  let token = 0

  async function textOf(id: string, segs: Segment[]): Promise<string> {
    const ranges = segs.flatMap((s) => runs(s.verses).map((r) => ({ start: verseKey(s.book, s.chapter, r[0]), end: verseKey(s.book, s.chapter, r[r.length - 1]) })))
    const parts = await engine().plain(id, ranges)
    return parts.filter(Boolean).join(' … ')
  }

  watch(
    () => [date.value.toDateString(), period.value, settings.prefs.bibles[0], lang.value] as const,
    async () => {
      const my = ++token
      loading.value = true
      const id = settings.prefs.bibles[0]
      const entry = entryFrom(await loadDevotional(), date.value, period.value)
      if (!entry || !id) { loading.value = false; return }
      await library.ensureOpen(id)
      const label = (segs: Segment[]) => segs.map((s) => segmentLabel(s, lang.value)).join('; ')
      const [t, ...vs] = await Promise.all([entry.theme, ...entry.verses].map(async (segs) => ({ label: label(segs), text: await textOf(id, segs), segs })))
      if (my !== token) return
      theme.value = t
      verses.value = vs.filter((v) => v.text)
      loading.value = false
    },
    { immediate: true },
  )

  return { theme, verses, loading }
}
