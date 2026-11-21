import { useI18n } from 'vue-i18n'
import { bookByNumber } from '@/core/canon'
import { dateOfDay, formatReadings, presetFor, type PlanSpec, type Reading } from '@/core/plans'
import { useLocale } from './locale'

/** Nombres, fechas y textos de los planes en el idioma de la interfaz. */
export function usePlanLabels() {
  const { t, locale } = useI18n()
  const { lang } = useLocale()

  function name(p: { spec: PlanSpec; title: string | null }): string {
    if (p.title) return p.title
    const preset = presetFor(p.spec)
    if (preset) return t(`plans.presets.${preset.key}.name`)
    if (p.spec.type === 'books') {
      const a = bookByNumber(p.spec.from)!.name[lang.value]
      const b = bookByNumber(p.spec.to)!.name[lang.value]
      return a === b ? a : `${a} – ${b}`
    }
    return t('plans.title')
  }

  const date = (d: Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) =>
    new Intl.DateTimeFormat(locale.value, opts).format(d)

  return {
    name,
    date,
    dayDate: (start: string, day: number) => date(dateOfDay(start, day), { weekday: 'short', day: 'numeric', month: 'short' }),
    readings: (rs: Reading[], short = false) => formatReadings(rs, lang.value, short),
  }
}
