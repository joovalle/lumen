<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Check, Share2, Trash2 } from 'lucide-vue-next'
import PlanTodayCard from '@/components/plans/PlanTodayCard.vue'
import { bookByNumber } from '@/core/canon'
import { usePlanLabels } from '@/composables/planLabels'
import { useSharePlan } from '@/composables/sharePlan'
import { toast } from '@/composables/toast'
import { usePlans } from '@/stores/plans'

const route = useRoute()
const router = useRouter()
const plans = usePlans()
const { t } = useI18n()
const { name, dayDate, readings } = usePlanLabels()
const sharePlan = useSharePlan()

const plan = computed(() => plans.get(String(route.params.id)))
const st = computed(() => (plan.value ? plans.status(plan.value) : null))
const days = computed(() => (plan.value ? plans.days(plan.value) : []))

onMounted(async () => {
  await nextTick()
  // Solo se desplaza si el día de hoy no está ya a la vista
  if ((st.value?.today ?? 0) > 2) document.getElementById(`day-${st.value!.today}`)?.scrollIntoView({ block: 'center' })
})

function open(day: number, i: number) {
  const r = days.value[day][i]
  void router.push({ name: 'read', params: { book: bookByNumber(r.book)!.osis, chapter: r.chapter }, query: { plan: plan.value!.id, day } })
}

function remove() {
  if (!plan.value || !confirm(t('plans.removeConfirm', { name: name(plan.value) }))) return
  plans.remove(plan.value.id)
  toast(t('plans.removed'))
  void router.replace({ name: 'plans' })
}
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'plans' }" class="back"><ArrowLeft /> {{ $t('plans.title') }}</RouterLink>
    <p v-if="!plan" class="empty">{{ $t('plans.invalid') }}</p>
    <template v-else-if="st">
      <header class="top">
        <div>
          <h1 class="page-title">{{ name(plan) }}</h1>
          <p class="page-sub">
            {{ $t('plans.days', { n: st.total }) }} · {{ dayDate(plan.start, 0) }} → {{ dayDate(plan.start, st.total - 1) }}
          </p>
        </div>
        <div class="tools">
          <button class="btn btn-sm" @click="sharePlan(plan)"><Share2 /> {{ $t('plans.share') }}</button>
          <button class="icon-btn" :title="$t('plans.remove')" :aria-label="$t('plans.remove')" @click="remove"><Trash2 /></button>
        </div>
      </header>

      <section class="section"><PlanTodayCard :plan="plan" /></section>

      <section class="section">
        <ol class="days">
          <li
            v-for="(d, day) in days" :id="`day-${day}`" :key="day" class="day"
            :class="{ today: day === st.today && !st.notStarted, done: plans.isDayDone(plan, day), late: !st.notStarted && day < st.today && !plans.isDayDone(plan, day) }"
          >
            <button class="check" :aria-pressed="plans.isDayDone(plan, day)" :aria-label="$t('plans.markRead')" @click="plans.setDay(plan.id, day, !plans.isDayDone(plan, day))"><Check /></button>
            <div class="info">
              <span class="label">{{ $t('plans.day', { n: day + 1 }) }} · {{ dayDate(plan.start, day) }}</span>
              <span class="refs">
                <button v-for="(r, i) in d" :key="i" :class="{ read: plans.isRead(plan, day, i) }" @click="open(day, i)">{{ readings([r]) }}</button>
              </span>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; margin-bottom: 18px; }
.back svg { width: 16px; height: 16px; }
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.tools { display: flex; align-items: center; gap: 6px; }
.days { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.day { display: flex; align-items: flex-start; gap: 14px; padding: 12px 14px; border-radius: 14px; scroll-margin: 120px; }
.day.today { background: var(--accent-soft); }
.check {
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; flex: none; margin-top: 2px; padding: 0;
  border: 1.5px solid var(--border-strong); background: var(--bg-elevated); color: transparent;
}
.check svg { width: 16px; height: 16px; }
.day.done .check { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
.day.late .check { border-color: #d4a04c; }
.info { display: grid; gap: 4px; min-width: 0; }
.label { font-size: 12.5px; font-weight: 650; color: var(--text-3); letter-spacing: 0.02em; }
.day.today .label { color: var(--accent); }
.refs { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.refs button { border: 0; background: transparent; padding: 0; font-family: var(--font-serif); font-size: 16px; color: var(--text); text-align: left; }
.refs button:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.refs button.read { color: var(--text-3); text-decoration: line-through; text-decoration-color: var(--border-strong); }
.day.done .refs button { color: var(--text-3); }
</style>
