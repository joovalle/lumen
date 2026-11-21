<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CalendarCheck, Check } from 'lucide-vue-next'
import { bookByNumber } from '@/core/canon'
import { usePlanLabels } from '@/composables/planLabels'
import { toast } from '@/composables/toast'
import { usePlans } from '@/stores/plans'
import { useReader } from '@/stores/reader'

/** Aparece al final del capítulo cuando se llega desde un plan de lectura. */
const route = useRoute()
const router = useRouter()
const plans = usePlans()
const reader = useReader()
const { t } = useI18n()
const { name } = usePlanLabels()

const plan = computed(() => (route.query.plan ? plans.get(String(route.query.plan)) : undefined))
const day = computed(() => Number(route.query.day) || 0)
const list = computed(() => (plan.value ? plans.days(plan.value)[day.value] ?? [] : []))
const index = computed(() => list.value.findIndex((r) => r.book === reader.passage.book && r.chapter === reader.passage.chapter))
const read = computed(() => (plan.value && index.value >= 0 ? plans.isRead(plan.value, day.value, index.value) : false))

function markAndContinue() {
  if (!plan.value) return
  plans.setRead(plan.value.id, day.value, index.value, true)
  const next = list.value.findIndex((_, i) => !plans.isRead(plan.value!, day.value, i))
  if (next === -1) {
    toast(t('plans.dayComplete'), 'success', 4000)
    void router.push({ name: 'today' })
    return
  }
  const r = list.value[next]
  void router.push({ name: 'read', params: { book: bookByNumber(r.book)!.osis, chapter: r.chapter }, query: { plan: plan.value.id, day: day.value } })
}
</script>

<template>
  <aside v-if="plan && index >= 0" class="plan-foot">
    <CalendarCheck class="icon" />
    <div class="text">
      <strong>{{ name(plan) }}</strong>
      <span>{{ $t('plans.fromPlan', { n: day + 1, i: index + 1, total: list.length }) }}</span>
    </div>
    <button v-if="!read" class="btn btn-primary" @click="markAndContinue"><Check /> {{ index < list.length - 1 ? $t('plans.next') : $t('plans.markRead') }}</button>
    <span v-else class="done"><Check /> {{ $t('plans.completed') }}</span>
  </aside>
</template>

<style scoped>
.plan-foot {
  max-width: var(--read-measure); margin: 48px auto 0;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 16px 18px; border-radius: var(--radius-l);
  background: var(--accent-soft); border: 1px solid transparent;
}
.icon { width: 24px; height: 24px; color: var(--accent); flex: none; }
.text { display: grid; flex: 1; min-width: 160px; }
.text strong { font-family: var(--font-serif); font-size: 16.5px; }
.text span { font-size: 13px; color: var(--text-2); }
.done { display: inline-flex; align-items: center; gap: 6px; font-weight: 650; color: var(--accent); font-size: 14px; }
.done svg { width: 17px; height: 17px; }
</style>
