import { useI18n } from 'vue-i18n'
import { parseIso, type PlanSpec } from '@/core/plans'
import { planUrl } from './links'
import { usePlanLabels } from './planLabels'
import { toast } from './toast'

/** Comparte la invitación a un plan (menú del teléfono o, si no hay, copia el enlace). */
export function useSharePlan() {
  const { t } = useI18n()
  const { name, date } = usePlanLabels()

  return async function share(p: { spec: PlanSpec; title: string | null; start: string }) {
    const url = planUrl({ spec: p.spec, start: p.start, title: p.title })
    const text = t('plans.shareText', { name: name(p), date: date(parseIso(p.start) ?? new Date()) })
    if (navigator.share) {
      try {
        await navigator.share({ text, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await navigator.clipboard.writeText(`${text}\n${url}`)
    toast(t('plans.linkCopied'), 'success')
  }
}
