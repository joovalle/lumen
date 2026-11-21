import { reactive } from 'vue'

/** Estado global del estudio de imágenes (se abre desde la lectura o desde «Hoy»). */
export const shareStudio = reactive({
  open: false,
  text: '',
  reference: '',
})

export function openShareStudio(text: string, reference: string) {
  shareStudio.text = text
  shareStudio.reference = reference
  shareStudio.open = true
}
