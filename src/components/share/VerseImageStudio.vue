<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { Download, ImagePlus, LoaderCircle, Share2 } from 'lucide-vue-next'
import ModalSheet from '@/components/common/ModalSheet.vue'
import {
  TEMPLATES, canvasToBlob, loadFonts, renderVerseImage,
  type ImageFont, type ImageFormat, type TemplateId,
} from '@/core/share/verseImage'
import { shareStudio } from '@/composables/shareStudio'
import { toast } from '@/composables/toast'
import { useSettings } from '@/stores/settings'

const { t } = useI18n()
const settings = useSettings()
const prefs = computed(() => settings.prefs)

const canvas = ref<HTMLCanvasElement>()
const photoInput = ref<HTMLInputElement>()
const photo = shallowRef<HTMLImageElement | null>(null)
const file = shallowRef<File | null>(null)
const busy = ref(false)
const truncated = ref(false)

const formats: ImageFormat[] = ['story', 'portrait', 'square']
const fonts: ImageFont[] = ['serif', 'italic', 'sans']
const templates = Object.keys(TEMPLATES) as TemplateId[]

const fileName = computed(() =>
  `lumen-${shareStudio.reference.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`,
)

/** Se dibuja y se prepara el archivo por adelantado: así «Compartir» responde al instante
 *  (Safari exige que el menú de compartir se abra dentro del mismo toque). */
async function render() {
  if (!shareStudio.open || !canvas.value) return
  busy.value = true
  await loadFonts(shareStudio.text + shareStudio.reference)
  const r = renderVerseImage(canvas.value, {
    text: shareStudio.text,
    reference: shareStudio.reference,
    format: prefs.value.shareFormat,
    template: prefs.value.shareTemplate,
    font: prefs.value.shareFont,
    signature: prefs.value.shareSignature,
    photo: prefs.value.shareTemplate === 'photo' ? photo.value : null,
  })
  truncated.value = r.truncated || r.small
  const blob = await canvasToBlob(canvas.value)
  file.value = new File([blob], fileName.value, { type: 'image/png' })
  busy.value = false
}
const renderSoon = useDebounceFn(render, 120)

watch(() => shareStudio.open, async (open) => {
  if (!open) return
  file.value = null
  // La foto no se guarda entre sesiones: si no hay, se vuelve a un estilo predeterminado
  if (prefs.value.shareTemplate === 'photo' && !photo.value) prefs.value.shareTemplate = 'dawn'
  await nextTick()
  void render()
})
watch(
  () => [prefs.value.shareFormat, prefs.value.shareTemplate, prefs.value.shareFont, prefs.value.shareSignature, photo.value],
  () => void renderSoon(),
)

function pickPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const img = new Image()
  img.onload = () => {
    photo.value = img
    prefs.value.shareTemplate = 'photo'
  }
  img.src = URL.createObjectURL(f)
}

const canShareFiles = computed(() => {
  if (!file.value || typeof navigator === 'undefined' || !navigator.canShare) return false
  try { return navigator.canShare({ files: [file.value] }) } catch { return false }
})

async function share() {
  if (!file.value) return
  if (!canShareFiles.value) return download()
  try {
    await navigator.share({ files: [file.value], text: `${shareStudio.reference}` })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') download()
  }
}

function download() {
  if (!file.value) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file.value)
  a.download = file.value.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  toast(t('share.saved'), 'success')
}
</script>

<template>
  <ModalSheet :open="shareStudio.open" :title="$t('share.title')" width="980px" @close="shareStudio.open = false">
    <div class="studio">
      <div class="preview" :class="prefs.shareFormat">
        <canvas ref="canvas" :aria-label="`${shareStudio.reference}`" />
        <div v-if="busy && !file" class="loading"><LoaderCircle class="spin" /></div>
      </div>

      <div class="controls">
        <section>
          <h3 class="eyebrow">{{ $t('share.format') }}</h3>
          <div class="segmented full">
            <button v-for="f in formats" :key="f" :class="{ active: prefs.shareFormat === f }" @click="prefs.shareFormat = f">
              <span class="ratio" :class="f" />{{ $t(`share.formats.${f}`) }}
            </button>
          </div>
        </section>

        <section>
          <h3 class="eyebrow">{{ $t('share.style') }}</h3>
          <div class="templates">
            <button
              v-for="id in templates" :key="id" class="tpl" :class="{ on: prefs.shareTemplate === id }"
              :title="$t(`share.styles.${id}`)" @click="id === 'photo' && !photo ? photoInput?.click() : (prefs.shareTemplate = id)"
            >
              <span class="sw" :style="{ background: TEMPLATES[id].swatch }"><ImagePlus v-if="id === 'photo'" /></span>
              <span class="name">{{ $t(`share.styles.${id}`) }}</span>
            </button>
          </div>
          <input ref="photoInput" type="file" accept="image/*" class="sr-only" @change="pickPhoto">
          <button v-if="prefs.shareTemplate === 'photo'" class="btn btn-sm photo-btn" @click="photoInput?.click()">
            <ImagePlus /> {{ $t('share.choosePhoto') }}
          </button>
        </section>

        <section>
          <h3 class="eyebrow">{{ $t('share.font') }}</h3>
          <div class="segmented full">
            <button v-for="f in fonts" :key="f" :class="[f, { active: prefs.shareFont === f }]" @click="prefs.shareFont = f">{{ $t(`share.fonts.${f}`) }}</button>
          </div>
        </section>

        <section>
          <h3 class="eyebrow">{{ $t('share.signature') }}</h3>
          <input v-model="prefs.shareSignature" class="input" maxlength="48" :placeholder="$t('share.signaturePlaceholder')">
        </section>

        <p v-if="truncated" class="warn">{{ $t('share.long') }}</p>
        <p class="hint">{{ $t('share.hint') }}</p>
      </div>
    </div>
    <template #footer>
      <div class="actions">
        <button class="btn btn-primary btn-lg" :disabled="!file" @click="share">
          <Share2 v-if="canShareFiles" /><Download v-else /> {{ canShareFiles ? $t('common.share') : $t('share.download') }}
        </button>
        <button v-if="canShareFiles" class="btn btn-lg" :disabled="!file" @click="download"><Download /> {{ $t('share.download') }}</button>
      </div>
    </template>
  </ModalSheet>
</template>

<style scoped>
.studio { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; padding: 8px 24px 26px; }
.preview {
  position: relative; display: grid; place-items: center;
  background: var(--surface); border-radius: var(--radius-l); padding: 18px; min-height: 420px;
}
.preview canvas {
  display: block; max-width: 100%; max-height: min(64vh, 620px); width: auto; height: auto;
  border-radius: 14px; box-shadow: var(--shadow-l);
}
.loading { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); }
.controls { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 20px; min-width: 0; }
.controls > section { min-width: 0; }
.eyebrow { margin-bottom: 10px; }
.segmented.full { display: flex; width: 100%; }
.segmented.full button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
.ratio { display: inline-block; border: 1.5px solid currentColor; border-radius: 3px; opacity: 0.7; }
.ratio.story { width: 9px; height: 15px; }
.ratio.portrait { width: 11px; height: 14px; }
.ratio.square { width: 13px; height: 13px; }
.segmented .serif { font-family: var(--font-serif); }
.segmented .italic { font-family: var(--font-serif); font-style: italic; }
.templates { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.tpl { display: grid; justify-items: center; gap: 6px; padding: 0; border: 0; background: transparent; }
.sw {
  display: grid; place-items: center; width: 100%; aspect-ratio: 3 / 4; border-radius: 12px;
  border: 1px solid var(--border); color: #fff; box-shadow: var(--shadow-s);
  transition: box-shadow var(--dur) var(--ease), transform 140ms var(--ease);
}
.sw svg { width: 20px; height: 20px; opacity: 0.9; }
.tpl:hover .sw { transform: translateY(-2px); }
.tpl.on .sw { box-shadow: 0 0 0 2px var(--bg-elevated), 0 0 0 4px var(--accent); }
.name { font-size: 11.5px; font-weight: 600; color: var(--text-2); }
.tpl.on .name { color: var(--accent); }
.photo-btn { margin-top: 10px; }
.warn { font-size: 13px; color: #b9770e; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
.actions .btn-primary { min-width: 220px; }
.hint { font-size: 12.5px; color: var(--text-3); }

@media (max-width: 820px) {
  .studio { grid-template-columns: minmax(0, 1fr); padding: 4px 16px 24px; gap: 18px; }
  .preview { min-height: 0; padding: 12px; }
  .preview canvas { max-height: 38vh; }
  .actions .btn-primary { flex: 1; min-width: 0; }
  .templates { grid-template-columns: repeat(7, 64px); overflow-x: auto; padding: 6px; margin: 0 -6px; scrollbar-width: none; }
  .segmented.full button { padding: 7px 6px; }
}
</style>
