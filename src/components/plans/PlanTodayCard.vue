<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Check, CircleCheck } from 'lucide-vue-next'
import { bookByNumber } from '@/core/canon'
import { usePlanLabels } from '@/composables/planLabels'
import { usePlans, type ActivePlan } from '@/stores/plans'

const props = defineProps<{ plan: ActivePlan }>()
const plans = usePlans()
const router = useRouter()
const { name, readings, date } = usePlanLabels()

const st = computed(() => plans.status(props.plan))
const firstUnread = computed(() => st.value.readings.findIndex((_, i) => !plans.isRead(props.plan, st.value.today, i)))

function read(i = firstUnread.value) {
  const r = st.value.readings[Math.max(i, 0)]
  void router.push({
    name: 'read', params: { book: bookByNumber(r.book)!.osis, chapter: r.chapter },
    query: { plan: props.plan.id, day: st.value.today },
  })
}
</script>

<template>
  <article class="plan card">
    <RouterLink :to="{ name: 'plan', params: { id: plan.id } }" class="head">
      <div>
        <p class="eyebrow">{{ $t('plans.dayOf', { n: st.today + 1, total: st.total }) }}</p>
        <h3>{{ name(plan) }}</h3>
      </div>
      <span class="pct">{{ st.percent }}%</span>
    </RouterLink>
    <div class="bar"><i :style="{ width: `${st.percent}%` }" /></div>

    <p v-if="st.notStarted" class="muted">{{ $t('plans.notStarted', { date: date(new Date(plan.start + 'T00:00')) }) }}</p>
    <template v-else>
      <ul class="readings">
        <li v-for="(r, i) in st.readings" :key="i">
          <button class="check" :class="{ on: plans.isRead(plan, st.today, i) }" :aria-pressed="plans.isRead(plan, st.today, i)"
            @click="plans.setRead(plan.id, st.today, i, !plans.isRead(plan, st.today, i))"><Check /></button>
          <button class="ref" @click="read(i)">{{ readings([r]) }}</button>
        </li>
      </ul>
      <div class="foot">
        <span v-if="plans.isDayDone(plan, st.today)" class="done"><CircleCheck /> {{ $t('plans.doneToday') }}</span>
        <span v-else-if="st.behind" class="behind">{{ $t('plans.behind', st.behind) }}</span>
        <span v-else />
        <button v-if="!plans.isDayDone(plan, st.today)" class="btn btn-primary btn-sm" @click="read()">
          {{ firstUnread > 0 ? $t('plans.continue') : $t('plans.read') }} <ArrowRight />
        </button>
      </div>
    </template>
  </article>
</template>

<style scoped>
.plan { padding: 20px 22px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; color: inherit; }
.head:hover { text-decoration: none; }
.head:hover h3 { color: var(--accent); }
h3 { font-family: var(--font-serif); font-size: 19px; font-weight: 600; margin-top: 2px; transition: color var(--dur) var(--ease); }
.pct { font-size: 13px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.bar { height: 5px; margin: 12px 0 14px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); border-radius: 5px; transition: width 300ms var(--ease); }
.readings { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.readings li { display: flex; align-items: center; gap: 10px; }
.check {
  display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; flex: none; padding: 0;
  border: 1.5px solid var(--border-strong); background: transparent; color: transparent;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.check svg { width: 15px; height: 15px; }
.check.on { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
.ref { border: 0; background: transparent; padding: 6px 4px; font-family: var(--font-serif); font-size: 16.5px; text-align: left; }
.ref:hover { color: var(--accent); }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
.done { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--accent); }
.done svg { width: 17px; height: 17px; }
.behind { font-size: 13px; font-weight: 600; color: #b9770e; }
.muted { color: var(--text-3); font-size: 14px; }
</style>
