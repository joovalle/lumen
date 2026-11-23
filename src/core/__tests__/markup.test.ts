import { describe, expect, it } from 'vitest'
import { toPlainText, toSafeHtml } from '../markup'

describe('toSafeHtml', () => {
  it('escapa texto plano', () => {
    expect(toSafeHtml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;')
  })

  it('convierte RTF de e-Sword', () => {
    expect(toSafeHtml('{\\b Dios} es \\i amor\\i0 .')).toBe('<b>Dios</b> es <i>amor</i>.')
    expect(toSafeHtml("cri\\'f3 los cielos")).toBe('creó los cielos'.replace('creó', 'crió'))
    expect(toSafeHtml('l\\u237?nea\\par dos')).toBe('línea<br>dos')
  })

  it('reconoce números Strong en RTF y GBF', () => {
    expect(toSafeHtml('In the beginning{\\super H7225} God')).toContain('data-strong="H7225"')
    expect(toSafeHtml('God<WH430> created<WH1254>')).toBe(
      'God<sup class="strong" data-strong="H430">H430</sup> created<sup class="strong" data-strong="H1254">H1254</sup>',
    )
    expect(toSafeHtml('<FI>was<Fi> <FR>I am<Fr>')).toBe('<i>was</i> <span class="woj">I am</span>')
  })

  it('ignora tablas de fuentes y colores', () => {
    expect(toSafeHtml('{\\rtf1{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}\\f0 Hola}')).toBe('Hola')
  })

  it('limpia HTML peligroso de comentarios', () => {
    const out = toSafeHtml('<p onclick="x()">Hola <script>alert(1)</script><b>mundo</b><img src=x onerror=y></p>')
    expect(out).toBe('<p>Hola <b>mundo</b></p>')
    expect(toSafeHtml('<a href="javascript:alert(1)">ver</a>')).toBe('<span>ver</span>')
    expect(toSafeHtml('<b>sin cerrar')).toBe('<b>sin cerrar</b>')
  })
})

describe('toPlainText', () => {
  it('quita marcas y números Strong', () => {
    expect(toPlainText('God<WH430> created<WH1254> the heaven')).toBe('God created the heaven')
    expect(toPlainText('{\\b Dios}\\par es amor')).toBe('Dios es amor')
    expect(toPlainText('<p>A &amp; B</p>')).toBe('A & B')
  })
})

describe('entidades HTML de los módulos', () => {
  it('convierte entidades con nombre en texto sin formato (p. ej. NTV de e-Sword)', () => {
    const raw = 'Señor, a lo largo de todas las generaciones, &iexcl;tú has sido nuestro hogar!'
    expect(toSafeHtml(raw)).toBe('Señor, a lo largo de todas las generaciones, ¡tú has sido nuestro hogar!')
    expect(toPlainText(raw)).toBe('Señor, a lo largo de todas las generaciones, ¡tú has sido nuestro hogar!')
    expect(toPlainText('&iquest;Qui&eacute;n? &mdash;dijo&hellip; &laquo;S&iacute;&raquo; &Ntilde;')).toBe('¿Quién? —dijo… «Sí» Ñ')
  })
  it('también dentro de HTML, RTF y GBF', () => {
    expect(toSafeHtml('<i>&iexcl;Aleluya!</i>')).toBe('<i>¡Aleluya!</i>')
    expect(toSafeHtml('{\\b &iexcl;Gloria!}')).toBe('<b>¡Gloria!</b>')
    expect(toPlainText('&iexcl;Dios<WH430> es bueno!')).toBe('¡Dios es bueno!')
    expect(toSafeHtml('&alpha;&Omega; &sigmaf;')).toBe('αΩ ς')
  })
  it('no convierte en etiquetas lo que era texto escapado', () => {
    expect(toSafeHtml('a &lt;b&gt; c')).toBe('a &lt;b&gt; c')
    expect(toSafeHtml('&desconocida; queda igual')).toBe('&amp;desconocida; queda igual')
  })
})
