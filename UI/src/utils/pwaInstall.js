const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

let deferredPrompt = null;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

/**
 * Chrome fires `beforeinstallprompt` once, usually before the dashboard mounts,
 * so it must be captured at startup and held until the install card asks for it.
 */
export function initPwaInstallCapture() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

export function subscribeInstallPrompt(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getInstallPrompt() {
  return deferredPrompt;
}

/** Opens the browser's install dialog. Resolves to 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return 'unavailable';
  deferredPrompt = null;
  emit();
  await event.prompt();
  const choice = await event.userChoice;
  return choice?.outcome ?? 'dismissed';
}

export function isRunningInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return isIosDevice() || /android|mobile/i.test(navigator.userAgent || '');
}

export function wasInstallRecentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function rememberInstallDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}
