import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';

const POLL_MS = 60_000;
const RELOAD_ATTEMPT_KEY = 'genius-techno:version-reload-for';
/* global __APP_BUILD_ID__ */
// Injected at build time via vite.config.js define (not import.meta.env — more reliable).
const LOCAL_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : '';

async function fetchRemoteBuildId() {
  const res = await fetch(`/version.json?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.buildId === 'string' ? data.buildId : null;
}

async function hardReload(remoteBuildId) {
  try {
    if (remoteBuildId) sessionStorage.setItem(RELOAD_ATTEMPT_KEY, remoteBuildId);
  } catch {
    // ignore
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs?.length) {
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }
  // Cache-bust the document navigation itself.
  const url = new URL(window.location.href);
  url.searchParams.set('_appv', Date.now().toString(36));
  window.location.replace(url.toString());
}

/**
 * After a deploy, old tabs keep the previous JS bundle.
 * Polls /version.json and prompts the user to reload when the build id changes.
 */
export function AppVersionGuard() {
  const [open, setOpen] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState(null);
  const [reloading, setReloading] = useState(false);
  const promptedRef = useRef(false);

  const checkVersion = useCallback(async () => {
    if (!LOCAL_BUILD_ID || LOCAL_BUILD_ID === 'dev' || promptedRef.current) return;
    try {
      const remote = await fetchRemoteBuildId();
      if (!remote) return;

      if (remote === LOCAL_BUILD_ID) {
        try {
          sessionStorage.removeItem(RELOAD_ATTEMPT_KEY);
        } catch {
          // ignore
        }
        return;
      }

      // Already reloaded once for this remote id and still mismatched (e.g. local test
      // left version.json edited). Avoid an infinite reload popup loop.
      try {
        if (sessionStorage.getItem(RELOAD_ATTEMPT_KEY) === remote) return;
      } catch {
        // ignore
      }

      promptedRef.current = true;
      setRemoteBuildId(remote);
      setOpen(true);
    } catch {
      // offline / version file missing — ignore
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const id = window.setInterval(checkVersion, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkVersion);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkVersion);
    };
  }, [checkVersion]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-version-title"
        className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="bg-gradient-to-br from-sky-50 to-white px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              {reloading ? (
                <RefreshCw className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
                {reloading ? 'Please wait' : 'Update available'}
              </p>
              <h2 id="app-version-title" className="mt-0.5 text-base font-semibold text-slate-900">
                {reloading ? 'Updating the app…' : 'A new version is ready'}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-1">
          {reloading ? (
            <div className="space-y-2" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-sky-100">
                <div className="h-full w-full origin-left animate-[app-update-progress_2.5s_ease-out_forwards] rounded-full bg-sky-500" />
              </div>
              <p className="text-sm text-slate-600">Getting the latest version. This takes a few seconds.</p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Update now to get the latest fixes and features.
              </p>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                Save your work first. Unsaved changes on this page will be lost.
              </p>
            </>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={reloading}
            onClick={async () => {
              setReloading(true);
              await hardReload(remoteBuildId);
            }}
          >
            {reloading ? (
              <>
                <Spinner className="h-4 w-4" />
                Updating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Update now
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
