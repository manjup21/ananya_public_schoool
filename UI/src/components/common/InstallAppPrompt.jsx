import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';

import { Button } from '../ui/button';
import { collegeReport } from '../../config/collegeReport';
import {
  getInstallPrompt,
  isIosDevice,
  isMobileDevice,
  isRunningInstalled,
  promptInstall,
  rememberInstallDismissed,
  subscribeInstallPrompt,
  wasInstallRecentlyDismissed,
} from '../../utils/pwaInstall';

const SHOW_DELAY_MS = 800;

/** Centred popup on mobile offering to install the app (Android: native dialog, iOS: Add to Home Screen steps). */
export function InstallAppPrompt() {
  const installEvent = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  const [eligible] = useState(() => isMobileDevice() && !isRunningInstalled() && !wasInstallRecentlyDismissed());
  const [ios] = useState(isIosDevice);
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!eligible) return undefined;
    const t = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible]);

  const canInstall = ios || Boolean(installEvent);
  const visible = eligible && ready && !closed && canInstall;

  useEffect(() => {
    if (!visible) return undefined;
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: documentElement.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.bodyOverflow;
      documentElement.style.overflow = prev.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    rememberInstallDismissed();
    setClosed(true);
  };

  const install = async () => {
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome !== 'accepted') rememberInstallDismissed();
      setClosed(true);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex touch-none items-center justify-center overscroll-none bg-black/50 p-5"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install app"
        className="relative w-full max-w-sm rounded-2xl bg-white px-6 pb-6 pt-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-sm text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <img src={collegeReport.logoUrl} alt="" className="mx-auto h-20 w-20 object-contain" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Install Ananya Public School app</h3>

        {ios ? (
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Tap <Share className="inline h-4 w-4 align-text-bottom" /> <span className="font-medium">Share</span> in
            the browser bar, then <SquarePlus className="inline h-4 w-4 align-text-bottom" />{' '}
            <span className="font-medium">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Open it straight from your home screen next time — faster, full screen, no link needed.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {ios ? (
            <Button type="button" className="h-12 w-full rounded-lg text-base font-semibold" onClick={dismiss}>
              Got it
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="h-12 w-full gap-2 rounded-lg text-base font-semibold"
                onClick={install}
                disabled={installing}
              >
                <Download className="h-5 w-5" />
                Install app
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={dismiss} disabled={installing}>
                Not now
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
