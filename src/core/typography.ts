/**
 * Convenciones tipográficas de las Biblias impresas.
 * Nunca cambian el texto, solo cómo se muestra.
 */

/** Nombres divinos que algunas versiones escriben siempre en mayúsculas a propósito. */
export const DIVINE_CAPS = new Set(['JEHOVÁ', 'JEHOVA', 'SEÑOR', 'LORD', 'GOD', 'YAHVEH', 'YHWH', 'SENHOR'])

const LEAD_CAPS = /^(\s*)(\p{Lu})(\p{Lu}+)(?=\s+\p{Ll})/u

/**
 * Las versiones antiguas (p. ej. RV 1909) empiezan cada capítulo con la primera
 * palabra en mayúsculas, pensada para imprimirse en versalitas: «HE aquí» → «Hᴇ aquí».
 * Recibe HTML ya saneado y solo envuelve letras, sin tocar etiquetas.
 */
export function leadSmallCaps(html: string): string {
  return html.replace(LEAD_CAPS, (all, space: string, first: string, rest: string) =>
    DIVINE_CAPS.has(first + rest) ? all : `${space}${first}<span class="sc">${rest.toLowerCase()}</span>`,
  )
}
