import { useI18n } from 'vue-i18n'
import { toast } from './toast'
import { useAnnotations } from '@/stores/annotations'
import { usePlans, type ActivePlan } from '@/stores/plans'

/** Exportar e importar notas, subrayados y marcadores como archivo JSON. */
export function useBackup() {
  const notes = useAnnotations()
  const plans = usePlans()
  const { t } = useI18n()

  async function exportFile() {
    const data = { ...(await notes.exportBackup()), plans: plans.plans }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lumen-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast(t('settings.exported'), 'success')
  }

  function importFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const data = JSON.parse(await file.text())
        await notes.importBackup(data)
        if (Array.isArray(data.plans)) {
          for (const p of data.plans as ActivePlan[]) {
            if (!p?.id || !p.spec || !p.start || !Array.isArray(p.read)) continue
            const cur = plans.get(p.id)
            if (cur) cur.read = [...new Set([...cur.read, ...p.read])]
            else plans.plans = [...plans.plans, p]
          }
        }
        toast(t('settings.importedOk'), 'success')
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    }
    input.click()
  }

  return { exportFile, importFile }
}
