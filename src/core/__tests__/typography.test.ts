import { describe, expect, it } from 'vitest'
import { leadSmallCaps } from '../typography'

describe('leadSmallCaps', () => {
  it('convierte la palabra inicial en versalitas', () => {
    expect(leadSmallCaps('HE aquí mi siervo')).toBe('H<span class="sc">e</span> aquí mi siervo')
    expect(leadSmallCaps('EN el principio')).toBe('E<span class="sc">n</span> el principio')
    expect(leadSmallCaps('ACONTECIÓ en los días')).toBe('A<span class="sc">conteció</span> en los días')
  })
  it('respeta nombres divinos, siglas y texto normal', () => {
    expect(leadSmallCaps('JEHOVÁ es mi pastor')).toBe('JEHOVÁ es mi pastor')
    expect(leadSmallCaps('I AM THAT I AM')).toBe('I AM THAT I AM')
    expect(leadSmallCaps('Y dijo Dios')).toBe('Y dijo Dios')
    expect(leadSmallCaps('<b>HE</b> aquí')).toBe('<b>HE</b> aquí')
  })
})
