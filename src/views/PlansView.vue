<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarDays, Share2, Users } from 'lucide-vue-next'
import PlanTodayCard from '@/components/plans/PlanTodayCard.vue'
import { BOOKS } from '@/core/canon'
import { PRESETS, buildPlan, dateOfDay, isoDate, type PlanSpec, type Preset } from '@/core/plans'
import { useLocale } from '@/composables/locale'
import { usePlanLabels } from '@/composables/planLabels'
import { useSharePlan } from '@/composables/sharePlan'
import { usePlans } from '@/stores/plans'

const router = useRouter()
const plans = usePlans()
const { lang } = useLocale()
const { date } = usePlanLabels()
const sharePlan = useSharePlan()

function startPreset(p: Preset) {
  const plan = plans.start(p.spec)
  void router.push({ name: 'plan', params: { id: plan.id } })
}
const presetDays = (spec: PlanSpec) => buildPlan(spec).length

// Plan para el grupo
const title = ref('')
const from = ref(45)
const to = ref(45)
const perDay = ref(1)
const start = ref(isoDate())
const spec = computed<PlanSpec>(() => ({ type: 'books', from: Math.min(from.value, to.value), to: Math.max(from.value, to.value), perDay: perDay.value }))
const groupDays = computed(() => buildPlan(spec.value).length)
const end = computed(() => date(dateOfDay(start.value, groupDays.value - 1)))

async function createGroup() {
  const plan = plans.start(spec.value, title.value.trim() || null, start.value)
  await sharePlan(plan)
  void router.push({ name: 'plan', params: { id: plan.id } })
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">{{ $t('plans.title') }}</h1>
    <p class="page-sub">{{ $t('plans.subtitle') }}</p>

    <section v-if="plans.plans.length" class="section">
      <h2 class="section-title">{{ $t('plans.mine') }}</h2>
      <div class="grid">
        <PlanTodayCard v-for="p in plans.plans" :key="p.id" :plan="p" />
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">{{ $t('plans.start') }}</h2>
      <div class="presets">
        <button v-for="p in PRESETS" :key="p.key" class="preset card" @click="startPreset(p)">
          <CalendarDays class="icon" />
          <strong>{{ $t(`plans.presets.${p.key}.name`) }}</strong>
          <span class="desc">{{ $t(`plans.presets.${p.key}.desc`) }}</span>
          <span class="meta">{{ $t('plans.days', { n: presetDays(p.spec) }) }}</span>
        </button>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title"><Users class="ti" /> {{ $t('plans.group') }}</h2>
      <p class="page-sub small">{{ $t('plans.groupText') }}</p>
      <form class="group card" @submit.prevent="createGroup">
        <label class="field wide">
          <span>{{ $t('plans.name') }}</span>
          <input v-model="title" class="input" maxlength="80" :placeholder="$t('plans.namePlaceholder')">
        </label>
        <label class="field">
          <span>{{ $t('plans.from') }}</span>
          <select v-model.number="from" class="input"><option v-for="b in BOOKS" :key="b.n" :value="b.n">{{ b.name[lang] }}</option></select>
        </label>
        <label class="field">
          <span>{{ $t('plans.to') }}</span>
          <select v-model.number="to" class="input"><option v-for="b in BOOKS" :key="b.n" :value="b.n">{{ b.name[lang] }}</option></select>
        </label>
        <div class="field">
          <span>{{ $t('plans.perDay') }}</span>
          <div class="segmented">
            <button v-for="n in [1, 2, 3, 4, 5]" :key="n" type="button" :class="{ active: perDay === n }" @click="perDay = n">{{ n }}</button>
          </div>
        </div>
        <label class="field">
          <span>{{ $t('plans.startDate') }}</span>
          <input v-model="start" type="date" class="input" required>
        </label>
        <div class="submit wide">
          <p class="summary">{{ $t('plans.summary', { days: groupDays, end }) }}</p>
          <button class="btn btn-primary"><Share2 /> {{ $t('plans.create') }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.preset {
  display: grid; gap: 6px; align-content: start; text-align: left; padding: 20px;
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform 160ms var(--ease);
}
.preset:hover { border-color: var(--accent); box-shadow: var(--shadow-m); transform: translateY(-2px); }
.preset .icon { width: 22px; height: 22px; color: var(--accent); margin-bottom: 4px; }
.preset strong { font-family: var(--font-serif); font-size: 17.5px; font-weight: 600; }
.desc { font-size: 13.5px; color: var(--text-2); }
.meta { font-size: 12px; font-weight: 650; color: var(--text-3); letter-spacing: 0.03em; margin-top: 4px; }
.section-title { display: flex; align-items: center; gap: 8px; }
.ti { width: 18px; height: 18px; color: var(--accent); }
.small { font-size: 14px; margin: -6px 0 14px; max-width: 62ch; }
.group { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 22px; }
.field { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.field .segmented { width: fit-content; }
.wide { grid-column: 1 / -1; }
.submit { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 4px; }
.summary { font-size: 14px; color: var(--text-2); }
@media (max-width: 600px) { .group { grid-template-columns: 1fr; } }
</style>
