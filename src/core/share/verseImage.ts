/**
 * Generador de imágenes de versículos para redes sociales
 * (historias de Instagram/WhatsApp/TikTok, publicaciones cuadradas y verticales).
 *
 * Todo se dibuja en un <canvas> dentro del dispositivo: los fondos son
 * procedurales (degradados, estrellas, textura de papel), así que no hay
 * imágenes de terceros ni problemas de licencias.
 */

import { DIVINE_CAPS } from '../typography'

export type ImageFormat = 'story' | 'square' | 'portrait'
export type ImageFont = 'serif' | 'italic' | 'sans'
export type TemplateId = 'dawn' | 'night' | 'parchment' | 'olive' | 'minimal' | 'ink' | 'photo'

export const FORMATS: Record<ImageFormat, [number, number]> = {
  story: [1080, 1920],
  square: [1080, 1080],
  portrait: [1080, 1350],
}

export interface VerseImageOptions {
  text: string
  reference: string
  format: ImageFormat
  template: TemplateId
  font: ImageFont
  signature: string
  photo?: CanvasImageSource | null
}

interface Palette { text: string; accent: string; muted: string }

/** Generador pseudoaleatorio determinista (mismo dibujo en cada render). */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function linear(ctx: CanvasRenderingContext2D, h: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, photo?: CanvasImageSource | null) => Palette

export const TEMPLATES: Record<TemplateId, { swatch: string; paint: Painter }> = {
  dawn: {
    swatch: 'linear-gradient(180deg,#2b1d3f,#a8565e 55%,#f2b26b)',
    paint(ctx, w, h) {
      ctx.fillStyle = linear(ctx, h, [[0, '#24183a'], [0.5, '#8f4a63'], [0.85, '#e39a6a'], [1, '#f6c27a']])
      ctx.fillRect(0, 0, w, h)
      glow(ctx, w / 2, h * 1.02, w * 0.9, 'rgba(255,214,150,0.55)')
      ctx.globalAlpha = 0.06
      const r = rng(7)
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        const a = -Math.PI / 2 + (r() - 0.5) * 1.6
        ctx.moveTo(w / 2, h * 1.02)
        ctx.lineTo(w / 2 + Math.cos(a - 0.03) * h * 1.4, h * 1.02 + Math.sin(a - 0.03) * h * 1.4)
        ctx.lineTo(w / 2 + Math.cos(a + 0.03) * h * 1.4, h * 1.02 + Math.sin(a + 0.03) * h * 1.4)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      vignette(ctx, w, h, 0.35)
      return { text: '#fffaf2', accent: '#ffd9a0', muted: 'rgba(255,245,230,0.8)' }
    },
  },
  night: {
    swatch: 'radial-gradient(circle at 70% 25%,#3a4a8a,#0b1026 70%)',
    paint(ctx, w, h) {
      ctx.fillStyle = linear(ctx, h, [[0, '#070b1f'], [0.6, '#121a3d'], [1, '#1d2a5a']])
      ctx.fillRect(0, 0, w, h)
      glow(ctx, w * 0.78, h * 0.14, w * 0.5, 'rgba(160,180,255,0.18)')
      const r = rng(42)
      for (let i = 0; i < (w * h) / 5200; i++) {
        const s = r() ** 3 * 2.6 + 0.4
        ctx.globalAlpha = 0.25 + r() * 0.75
        ctx.fillStyle = r() > 0.85 ? '#ffe6b0' : '#ffffff'
        ctx.beginPath()
        ctx.arc(r() * w, r() * h, s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      vignette(ctx, w, h, 0.4)
      return { text: '#f4efe4', accent: '#e9c27a', muted: 'rgba(230,230,245,0.75)' }
    },
  },
  parchment: {
    swatch: 'radial-gradient(circle,#f7efdc,#dcc79c)',
    paint(ctx, w, h) {
      ctx.fillStyle = '#f2e7cf'
      ctx.fillRect(0, 0, w, h)
      const r = rng(3)
      for (let i = 0; i < (w * h) / 90; i++) {
        ctx.globalAlpha = r() * 0.05
        ctx.fillStyle = r() > 0.5 ? '#7a5a2a' : '#ffffff'
        ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
      }
      ctx.globalAlpha = 1
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72)
      g.addColorStop(0, 'rgba(120,80,30,0)')
      g.addColorStop(1, 'rgba(120,80,30,0.28)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(140,87,24,0.45)'
      ctx.lineWidth = 3
      ctx.strokeRect(48, 48, w - 96, h - 96)
      ctx.lineWidth = 1.5
      ctx.strokeRect(62, 62, w - 124, h - 124)
      return { text: '#36281a', accent: '#8c5718', muted: 'rgba(60,42,22,0.7)' }
    },
  },
  olive: {
    swatch: 'linear-gradient(160deg,#3f5e3c,#16211a)',
    paint(ctx, w, h) {
      ctx.fillStyle = linear(ctx, h, [[0, '#2f4a33'], [1, '#121b15']])
      ctx.fillRect(0, 0, w, h)
      glow(ctx, w * 0.2, h * 0.1, w * 0.8, 'rgba(200,220,150,0.14)')
      ctx.strokeStyle = 'rgba(220,210,150,0.10)'
      ctx.lineWidth = 2
      const r = rng(11)
      for (let i = 0; i < 9; i++) {
        const y = h * (0.08 + r() * 0.84)
        ctx.beginPath()
        ctx.moveTo(-20, y)
        ctx.bezierCurveTo(w * 0.3, y - 120 * r(), w * 0.7, y + 120 * r(), w + 20, y - 40)
        ctx.stroke()
      }
      vignette(ctx, w, h, 0.35)
      return { text: '#f2eee3', accent: '#dcc77e', muted: 'rgba(235,230,210,0.75)' }
    },
  },
  minimal: {
    swatch: '#fbfaf7',
    paint(ctx, w, h) {
      ctx.fillStyle = '#fbfaf7'
      ctx.fillRect(0, 0, w, h)
      glow(ctx, w / 2, h * 0.45, w * 0.7, 'rgba(233,180,90,0.10)')
      return { text: '#1e1b16', accent: '#96661c', muted: 'rgba(40,34,26,0.6)' }
    },
  },
  ink: {
    swatch: 'linear-gradient(160deg,#1d1a16,#050505)',
    paint(ctx, w, h) {
      ctx.fillStyle = linear(ctx, h, [[0, '#1a1712'], [1, '#060606']])
      ctx.fillRect(0, 0, w, h)
      glow(ctx, w / 2, h * 0.42, w * 0.75, 'rgba(220,174,98,0.10)')
      return { text: '#f5efe3', accent: '#dcae62', muted: 'rgba(240,230,210,0.65)' }
    },
  },
  photo: {
    swatch: 'linear-gradient(135deg,#6b7c8f,#2d3540)',
    paint(ctx, w, h, photo) {
      if (photo) {
        const iw = (photo as HTMLImageElement).naturalWidth || (photo as ImageBitmap).width
        const ih = (photo as HTMLImageElement).naturalHeight || (photo as ImageBitmap).height
        const s = Math.max(w / iw, h / ih)
        ctx.drawImage(photo, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s)
      } else {
        ctx.fillStyle = linear(ctx, h, [[0, '#5a6b7e'], [1, '#232a33']])
        ctx.fillRect(0, 0, w, h)
      }
      ctx.fillStyle = linear(ctx, h, [[0, 'rgba(0,0,0,0.25)'], [0.5, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0.6)']])
      ctx.fillRect(0, 0, w, h)
      return { text: '#ffffff', accent: '#ffe0a3', muted: 'rgba(255,255,255,0.8)' }
    },
  },
}

const FONT_FAMILY: Record<ImageFont, { family: string; style: string; weight: number }> = {
  serif: { family: '"Literata Variable", Georgia, serif', style: 'normal', weight: 500 },
  italic: { family: '"Literata Variable", Georgia, serif', style: 'italic', weight: 450 },
  sans: { family: '"Inter Variable", system-ui, sans-serif', style: 'normal', weight: 550 },
}
const UI_FONT = '"Inter Variable", system-ui, sans-serif'

/** Espera a que las tipografías estén listas (si no, el canvas usa la del sistema). */
export async function loadFonts(sample: string) {
  if (!('fonts' in document)) return
  const text = sample.slice(0, 200) || 'Aa'
  await Promise.all([
    document.fonts.load(`500 64px "Literata Variable"`, text),
    document.fonts.load(`italic 450 64px "Literata Variable"`, text),
    document.fonts.load(`550 64px "Inter Variable"`, text),
    document.fonts.load(`650 32px "Inter Variable"`, 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789:·'),
  ]).catch(() => undefined)
}

/** Corta el texto en líneas que caben en el ancho dado. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth || !line) line = test
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** "EN el principio" → "En el principio" (las versiones antiguas usan versalitas iniciales). */
export function tidyText(text: string): string {
  return text
    .replace(/^(\p{Lu})(\p{Lu}+)(?=\s+\p{Ll})/u, (all: string, a: string, b: string) =>
      DIVINE_CAPS.has(all) ? all : a + b.toLowerCase())
    .replace(/\s+/g, ' ')
    .trim()
}

let flame: Path2D | null = null
const FLAME_PATH = (
  'M32 9.5c5.6 7.4 12 13.6 12 23.2C44 40.6 38.6 46 32 46s-12-5.4-12-13.3c0-6.1 3.4-10.4 7-14.5.4 5.4 2.4 8.4 5.6 9.6-1.4-5.4-1.6-11.4-.6-18.3Z'
)

/** truncated: se cortó el texto · small: cabe, pero con letra pequeña */
export interface RenderResult { truncated: boolean; small: boolean }

export function renderVerseImage(canvas: HTMLCanvasElement, o: VerseImageOptions): RenderResult {
  const [w, h] = FORMATS[o.format]
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.save()
  const pal = TEMPLATES[o.template].paint(ctx, w, h, o.photo)
  ctx.restore()

  const f = FONT_FAMILY[o.font]
  const text = `${tidyText(o.text)}`
  // Zonas seguras: Instagram/WhatsApp tapan ~14 % arriba y abajo en las historias
  const boxW = w * 0.8
  const boxH = o.format === 'story' ? h * 0.5 : o.format === 'portrait' ? h * 0.56 : h * 0.56
  const max = o.format === 'story' ? 92 : 80
  const min = 30

  let size = max
  let lines: string[] = []
  for (; size >= min; size -= 2) {
    ctx.font = `${f.style} ${f.weight} ${size}px ${f.family}`
    lines = wrap(ctx, text, boxW)
    if (lines.length * size * 1.4 <= boxH) break
  }
  let truncated = false
  if (size < min) {
    size = min
    ctx.font = `${f.style} ${f.weight} ${size}px ${f.family}`
    lines = wrap(ctx, text, boxW)
    const maxLines = Math.floor(boxH / (size * 1.4))
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines)
      lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,;:.]*\S*$/, '') + '…'
      truncated = true
    }
  }

  const lh = size * 1.4
  const quoteSize = size * 2.2
  const refSize = Math.max(26, Math.round(size * 0.4))
  const gap = size * 0.95
  const blockH = quoteSize * 0.55 + lines.length * lh + gap + refSize
  const centerY = o.format === 'story' ? h * 0.47 : h * 0.48
  let y = centerY - blockH / 2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Comilla decorativa
  ctx.fillStyle = pal.accent
  ctx.globalAlpha = 0.55
  ctx.font = `normal 500 ${quoteSize}px "Literata Variable", Georgia, serif`
  ctx.fillText('“', w / 2, y + quoteSize * 0.62)
  ctx.globalAlpha = 1
  y += quoteSize * 0.55

  // Texto
  ctx.fillStyle = pal.text
  ctx.font = `${f.style} ${f.weight} ${size}px ${f.family}`
  const darkBg = o.template !== 'minimal' && o.template !== 'parchment'
  if (darkBg) {
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 18
  }
  for (const line of lines) {
    y += lh
    ctx.fillText(line, w / 2, y - lh * 0.22)
  }
  ctx.shadowBlur = 0

  // Línea y referencia
  y += gap * 0.45
  ctx.fillStyle = pal.accent
  ctx.fillRect(w / 2 - 28, y - 2, 56, 3)
  y += gap * 0.55 + refSize
  ctx.font = `normal 650 ${refSize}px ${UI_FONT}`
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(refSize * 0.14)}px`
  ctx.fillStyle = pal.accent
  ctx.fillText(o.reference.toUpperCase(), w / 2, y)
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'

  // Firma (logo + nombre)
  const sigY = o.format === 'story' ? h - 210 : h - 86
  const label = o.signature.trim() || 'Lumen'
  ctx.font = `normal 600 28px ${UI_FONT}`
  const tw = ctx.measureText(label).width
  const iconS = 34
  const startX = w / 2 - (iconS + 12 + tw) / 2
  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.translate(startX, sigY - iconS + 6)
  ctx.scale(iconS / 64, iconS / 64)
  ctx.fillStyle = pal.accent
  ctx.fill((flame ??= new Path2D(FLAME_PATH)))
  ctx.restore()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = pal.muted
  ctx.textAlign = 'left'
  ctx.fillText(label, startX + iconS + 12, sigY)
  ctx.globalAlpha = 1
  return { truncated, small: size <= 44 }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'),
  )
}
