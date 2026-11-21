<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Moon, Sun } from 'lucide-vue-next'
import { periodFor } from '@/core/devotional'
import { tidyText } from '@/core/share/verseImage'
import { useDevotional } from '@/composables/devotional'

const date = ref(new Date())
const period = computed(() => periodFor(date.value))
const { theme, verses } = useDevotional(date, period)
</script>

<template>
  <RouterLink :to="{ name: 'devotional' }" class="devo card">
    <div class="head">
      <p class="eyebrow"><Sun v-if="period === 'm'" /><Moon v-else /> {{ $t('devotional.title') }} · {{ $t(period === 'm' ? 'devotional.morning' : 'devotional.evening') }}</p>
      <ArrowRight class="arrow" />
    </div>
    <template v-if="theme">
      <p class="theme">{{ tidyText(theme.text) }}</p>
      <p class="ref">{{ theme.label }}</p>
      <p class="more">{{ $t('devotional.read') }} · {{ $t('devotional.count', { n: verses.length + 1 }) }}</p>
    </template>
    <div v-else class="skeleton"><i /><i /></div>
  </RouterLink>
</template>

<style scoped>
.devo { display: block; padding: 22px 24px; color: inherit; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.devo:hover { text-decoration: none; border-color: var(--accent); box-shadow: var(--shadow-m); }
.head { display: flex; align-items: center; justify-content: space-between; }
.eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); }
.eyebrow svg { width: 14px; height: 14px; }
.arrow { width: 18px; height: 18px; color: var(--accent); }
.theme { margin-top: 12px; font-family: var(--font-serif); font-size: 19px; line-height: 1.5; font-weight: 500; }
.ref { margin-top: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); }
.more { margin-top: 12px; font-size: 13.5px; font-weight: 600; color: var(--text-2); }
.skeleton { display: grid; gap: 10px; margin-top: 12px; }
.skeleton i { display: block; height: 18px; border-radius: 6px; background: var(--surface-2); }
.skeleton i:last-child { width: 60%; }
</style>
