import { describe, expect, it } from 'vitest'
import { chunks } from '../voice/lumenVoice'

describe('chunks (voz de Lumen)', () => {
  it('deja intacto un versículo corto', () => {
    expect(chunks('Jesús lloró.')).toEqual(['Jesús lloró.'])
  })

  it('divide un versículo largo en frases sin perder texto', () => {
    const v = 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.'
    const out = chunks(v)
    expect(out.length).toBeGreaterThan(1)
    expect(out[0].length).toBeLessThanOrEqual(70)
    expect(out.join(' ')).toBe(v)
    for (const c of out.slice(1)) expect(c.length).toBeLessThanOrEqual(140)
  })

  it('conserva los signos de apertura y no deja trozos diminutos al final', () => {
    const v = '¿Quién es este Rey de gloria? Jehová el fuerte y valiente, Jehová el poderoso en batalla. Amén.'
    const out = chunks(v)
    expect(out.join(' ')).toBe(v)
    expect(out[0].startsWith('¿')).toBe(true)
    expect(out[out.length - 1].length).toBeGreaterThanOrEqual(18)
  })

  it('no corta palabras aunque una frase sea más larga que el límite', () => {
    const v = 'Y aconteció en aquellos días que salió edicto de parte de Augusto César que toda la tierra fuese empadronada'
    expect(chunks(v)).toEqual([v])
  })
})
