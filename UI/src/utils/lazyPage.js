import { lazy } from 'react';
import { isChunkLoadError, reloadOnceForStaleChunks, clearChunkReloadFlag } from './chunkLoadRecovery';

/** Lazy-load a page module that uses a named export. */
export function lazyPage(importFn, exportName) {
  return lazy(() =>
    importFn()
      .then((mod) => {
        clearChunkReloadFlag();
        const exported = mod[exportName];
        if (exported == null) {
          throw new Error(`lazyPage: missing export "${exportName}"`);
        }
        return { default: exported };
      })
      .catch((err) => {
        if (isChunkLoadError(err) && reloadOnceForStaleChunks()) {
          return new Promise(() => {});
        }
        throw err;
      })
  );
}
