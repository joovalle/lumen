<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, Users } from 'lucide-vue-next'
import { buildPlan, dayIndex, decodePlan, parseIso, specKey } from '@/core/plans'
import { usePlanLabels } from '@/composables/planLabels'
import { usePlans } from '@/stores/plans'

const route = useRoute()
const router = useRouter()
const plans = usePlans()
const { name, readings, date, dayDate } = usePlanLabels()

const shared = computed(() => decodePlan(route.query as Record<string, unknown>))
const days = computed(() => (shared.value ? buildPlan(shared.value.spec) : []))
const existing = computed(() =>
  shared.value ? plans.plans.find((p) => specKey(p.spec) === specKey(shared.value!.spec) && p.start === shared.value!.start) : undefined,
)
const started = computed(() => (shared.value ? dayIndex(shared.value.start) > 0 : false))

function join() {
  if (!shared.value) return
  const p = existing.value ?? plans.start(shared.value.spec, shared.value.title, shared.value.start)
  void router.replace({ name: 'plan', params: { id: p.id } })
}
</script>

<template>
  <div class="page narrow">
    <p v-if="!shared" class="empty">{{ $t('plans.invalid') }}</p>
    <article v-else class="invite card">
      <Users class="icon" />
      <p class="eyebrow">{{ $t('plans.joinTitle') }}</p>
      <h1>{{ name(shared) }}</h1>
      <p class="meta"><CalendarDays /> {{ $t('plans.days', { n: days.length }) }} · {{ dayDate(shared.start, 0) }} → {{ dayDate(shared.start, days.length - 1) }}</p>
      <div class="first">
        <p class="eyebrow">{{ $t('plans.day', { n: 1 }) }}</p>
        <p class="reading">{{ readings(days[0] ?? []) }}</p>
      </div>
      <p v-if="started" class="note">{{ $t('plans.startedAgo', { date: date(parseIso(shared.start) ?? new Date()) }) }}</p>
      <button class="btn btn-primary btn-lg" @click="join">{{ existing ? $t('plans.open') : $t('plans.join') }}</button>
      <p v-if="existing" class="note">{{ $t('plans.joined') }}</p>
    </article>
  </div>
</template>

<style scoped>
.narrow { max-width: 620px; }
.invite { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 40px 28px; margin-top: 20px; }
.icon { width: 34px; height: 34px; color: var(--accent); }
h1 { font-family: var(--font-serif); font-size: clamp(26px, 5vw, 34px); font-weight: 600; letter-spacing: -0.015em; }
.meta { display: inline-flex; align-items: center; gap: 6px; color: var(--text-2); font-size: 14.5px; }
.meta svg { width: 16px; height: 16px; }
.first { margin: 14px 0 6px; padding: 14px 22px; border-radius: 14px; background: var(--surface); }
.reading { font-family: var(--font-serif); font-size: 18px; margin-top: 4px; }
.note { font-size: 13.5px; color: var(--text-3); max-width: 44ch; }
.btn-lg { margin-top: 10px; min-width: 240px; }
</style>
