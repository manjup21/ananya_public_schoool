const CHUNK_RELOAD_KEY = 'genius-techno:chunk-reload';

/** True when a dynamic import failed (stale deploy, 404 chunk, offline, etc.). */
export function isChunkLoadError(error) {
  const msg = String(error?.message || error).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('failed to load module script')
  );
}

/** Reload once per tab session to fetch fresh index/chunks after a deploy. Returns true if reloading. */
export function reloadOnceForStaleChunks() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    // sessionStorage unavailable — still reload
  }
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // ignore
  }
}
