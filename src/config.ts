/**
 * Configuración general del proyecto. Edita aquí los enlaces de donación
 * y del repositorio cuando estén listos: la pantalla «Acerca de» los
 * mostrará automáticamente.
 */
export const APP = {
  name: 'Lumen',
  version: '0.1.0',
  /** p. ej. 'https://github.com/usuario/lumen' */
  repoUrl: 'https://github.com/joovalle/lumen',
  /** p. ej. [{ label: 'Ko-fi', url: 'https://ko-fi.com/…' }, { label: 'PayPal', url: '…' }] */
  donations: [] as { label: string; url: string }[],
  /**
   * Apple y Google no permiten enlaces de pago externos dentro de las apps de sus
   * tiendas (salvo organizaciones sin fines de lucro reconocidas). Con «false», las
   * donaciones solo se muestran en la versión web.
   */
  donationsInStoreApps: false,
  contactEmail: '',
  /** Funciones que se pueden encender o apagar sin borrar su código. */
  features: {
    /** «Escuchar» (lectura en voz alta). En pausa por ahora; se retomará más adelante. */
    listen: false,
  },
}
