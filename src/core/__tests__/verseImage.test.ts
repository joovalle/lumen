import { describe, expect, it } from 'vitest'
import { tidyText } from '../share/verseImage'

describe('tidyText', () => {
  it('suaviza las versalitas iniciales de las versiones antiguas', () => {
    expect(tidyText('EN el principio crió Dios')).toBe('En el principio crió Dios')
    expect(tidyText('ACONTECIÓ en los días')).toBe('Aconteció en los días')
    expect(tidyText('JEHOVÁ es mi pastor')).toBe('JEHOVÁ es mi pastor')
  })
  it('respeta el resto del texto', () => {
    expect(tidyText('Y dijo Dios: Sea la luz')).toBe('Y dijo Dios: Sea la luz')
    expect(tidyText('Porque de tal manera  amó   Dios')).toBe('Porque de tal manera amó Dios')
    expect(tidyText('I AM THAT I AM')).toBe('I AM THAT I AM')
  })
})
