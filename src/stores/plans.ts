import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { buildPlan, dayIndex, isoDate, specKey, type PlanSpec, type Reading } from '@/core/plans'

export interface ActivePlan {
  id: string
  spec: PlanSpec
  /** Nombre propio (planes de grupo); null = nombre del plan predefinido */
  title: string | null
  start: string
  /** Lecturas hechas: "día:índice" */
  read: string[]
  createdAt: number
}

/** Planes del usuario. Se guardan solo en este dispositivo. */
export const usePlans = defineStore('plans', () => {
  const plans = useLocalStorage<ActivePlan[]>('lumen.plans', [])
  const cache = new Map<string, Reading[][]>()

  const days = (p: ActivePlan) => {
    const key = specKey(p.spec)
    let d = cache.get(key)
    if (!d) cache.set(key, (d = buildPlan(p.spec)))
    return d
  }

  const get = (id: string) => plans.value.find((p) => p.id === id)

  function start(spec: PlanSpec, title: string | null = null, startDate = isoDate()): ActivePlan {
    const id = `${specKey(spec)}@${startDate}${title ? `:${title}` : ''}`
    const existing = get(id)
    if (existing) return existing
    const plan: ActivePlan = { id, spec, title, start: startDate, read: [], createdAt: Date.now() }
    plans.value = [...plans.value, plan]
    return plan
  }

  function remove(id: string) {
    plans.value = plans.value.filter((p) => p.id !== id)
  }

  const isRead = (p: ActivePlan, day: number, i: number) => p.read.includes(`${day}:${i}`)
  const isDayDone = (p: ActivePlan, day: number) => days(p)[day]?.every((_, i) => isRead(p, day, i)) ?? false

  function setRead(id: string, day: number, i: number, value: boolean) {
    const p = get(id)
    if (!p) return
    const key = `${day}:${i}`
    const has = p.read.includes(key)
    if (value && !has) p.read = [...p.read, key]
    if (!value && has) p.read = p.read.filter((k) => k !== key)
  }

  function setDay(id: string, day: number, value: boolean) {
    const p = get(id)
    if (!p) return
    days(p)[day]?.forEach((_, i) => setRead(id, day, i, value))
  }

  /** Progreso y estado de hoy de un plan. */
  function status(p: ActivePlan, today = new Date()) {
    const all = days(p)
    const index = dayIndex(p.start, today)
    const doneDays = all.filter((_, d) => isDayDone(p, d)).length
    const current = Math.min(Math.max(index, 0), all.length - 1)
    const behind = index < 0 ? 0 : all.slice(0, Math.min(index, all.length)).filter((_, d) => !isDayDone(p, d)).length
    return {
      total: all.length,
      doneDays,
      percent: Math.round((doneDays / all.length) * 100),
      /** día que toca hoy (o el primero si aún no empieza / el último si terminó) */
      today: current,
      notStarted: index < 0,
      finished: doneDays === all.length,
      behind,
      readings: all[current] ?? [],
    }
  }

  const active = computed(() => plans.value.filter((p) => !status(p).finished))

  return { plans, active, days, get, start, remove, isRead, isDayDone, setRead, setDay, status }
})
