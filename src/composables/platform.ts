import { APP } from '@/config'

/** ¿Se ejecuta como app instalada desde una tienda (Capacitor en Android/iOS)? */
export function isStoreApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

/** Enlaces de donación visibles en esta plataforma. */
export function donationLinks() {
  return isStoreApp() && !APP.donationsInStoreApps ? [] : APP.donations
}
