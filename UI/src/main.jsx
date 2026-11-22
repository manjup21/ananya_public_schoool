import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import AuthProvider from 'react-auth-kit/AuthProvider';
import './index.css';
import App from './App.jsx';
import { store } from './store/store';
import { authKitStore } from './auth/authKitStore';
import { AuthBootstrap } from './auth/AuthBootstrap';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clearChunkReloadFlag } from './utils/chunkLoadRecovery';
import { initPwaInstallCapture } from './utils/pwaInstall';

clearChunkReloadFlag();

// iOS Safari zooms into inputs under 16px on focus and stays zoomed; maximum-scale stops that
// while iOS still allows pinch-zoom. Not applied elsewhere because Android would block pinch-zoom.
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover');
}
initPwaInstallCapture();

window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <AuthProvider store={authKitStore}>
          <AuthBootstrap>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthBootstrap>
        </AuthProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
)
