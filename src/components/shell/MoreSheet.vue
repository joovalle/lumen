<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CalendarCheck, Headphones, Heart, Languages, Library, Map, Settings, Sparkles, Users, type LucideIcon } from 'lucide-vue-next'
import ModalSheet from '@/components/common/ModalSheet.vue'
import { donationLinks } from '@/composables/platform'
import { toast } from '@/composables/toast'
import { useSettings } from '@/stores/settings'
import { useSpeech } from '@/stores/speech'
import { APP } from '@/config'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const settings = useSettings()
const speech = useSpeech()
const { t } = useI18n()
const donations = donationLinks()

interface Tile { id: string; icon: LucideIcon; label: string; badge?: 'new' | 'soon'; accent?: boolean; run: () => void }
const go = (path: string) => () => router.push(path)
const soon = () => toast(t('more.soonToast'))

function listen() {
  if (!speech.supported) return toast(t('listen.noSupport'), 'error')
  const id = settings.prefs.bibles[0]
  const { book, chapter } = settings.prefs.last
  if (id) void speech.start(id, book, chapter, 1)
  void router.push('/read')
}

const tiles: Tile[] = [
  { id: 'devotional', icon: Sparkles, label: 'nav.devotional', run: go('/devotional') },
  { id: 'plans', icon: CalendarCheck, label: 'nav.plans', run: go('/plans') },
  { id: 'library', icon: Library, label: 'nav.library', run: go('/library') },
  ...(APP.features.listen ? [{ id: 'listen', icon: Headphones, label: 'more.listen', badge: 'new' as const, run: listen }] : []),
  { id: 'live', icon: Users, label: 'more.live', badge: 'soon', run: soon },
  { id: 'maps', icon: Map, label: 'more.maps', badge: 'soon', run: soon },
  { id: 'interlinear', icon: Languages, label: 'more.interlinear', badge: 'soon', run: soon },
  { id: 'settings', icon: Settings, label: 'nav.settings', run: go('/settings') },
  {
    id: 'support', icon: Heart, label: donations.length ? 'more.donate' : 'nav.about', accent: true,
    run: () => (donations.length ? window.open(donations[0].url, '_blank', 'noopener') : router.push('/about')),
  },
]

function run(tile: Tile) {
  emit('close')
  tile.run()
}
</script>

<template>
  <ModalSheet :open="open" :title="$t('nav.more')" width="520px" @close="emit('close')">
    <div class="grid">
      <button v-for="tile in tiles" :key="tile.id" class="tile" :class="{ accent: tile.accent, soon: tile.badge === 'soon' }" @click="run(tile)">
        <span v-if="tile.badge" class="badge">{{ $t(tile.badge === 'new' ? 'more.new' : 'more.soon') }}</span>
        <component :is="tile.icon" class="icon" />
        <span class="label">{{ $t(tile.label) }}</span>
      </button>
    </div>
  </ModalSheet>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 6px 18px 24px; }
.tile {
  position: relative; display: grid; justify-items: center; align-content: center; gap: 8px; min-height: 96px;
  padding: 14px 6px; border: 0; border-radius: 18px; background: var(--surface); color: var(--text);
  font-size: 13px; font-weight: 600; text-align: center;
  transition: background var(--dur) var(--ease), transform 120ms var(--ease);
}
.tile:hover { background: var(--surface-2); }
.tile:active { transform: scale(0.97); }
.icon { width: 26px; height: 26px; color: var(--accent); }
.tile.soon { color: var(--text-2); }
.tile.soon .icon { opacity: 0.7; }
.tile.accent { background: var(--accent); color: var(--accent-contrast); }
.tile.accent .icon { color: var(--accent-contrast); }
.badge {
  position: absolute; top: 7px; right: 7px; padding: 2px 7px; border-radius: 999px;
  font-size: 9.5px; font-weight: 750; letter-spacing: 0.05em; text-transform: uppercase;
  background: var(--accent-soft); color: var(--accent);
}
</style>
