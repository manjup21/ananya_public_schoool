import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

const appBuildId =
  process.env.VITE_APP_BUILD_ID ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Writes /version.json at build time and injects the same id into the client bundle. */
function appVersionPlugin(buildId) {
  return {
    name: 'app-version',
    config() {
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(buildId),
        },
      };
    },
    writeBundle(options) {
      const outDir = options.dir || path.resolve('dist');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, 'version.json'),
        `${JSON.stringify({ buildId, builtAt: new Date().toISOString() }, null, 2)}\n`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('exceljs')) return 'vendor-exceljs';
          if (id.includes('jspdf')) return 'vendor-jspdf';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts';
          if (id.includes('@reduxjs') || id.includes('react-redux')) return 'vendor-redux';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    appVersionPlugin(appBuildId),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-48.png', 'favicon-192.png', 'logo.png'],
      manifest: {
        name: 'Ananya Public School',
        short_name: 'Ananya School',
        description: 'Ananya Public School — ERP for attendance, examinations, fees, and notifications.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Main bundle (~3 MB) includes exceljs/jspdf; default Workbox limit is 2 MiB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Always hit the network for version checks (never serve a stale build id).
            urlPattern: ({ url }) => url.pathname === '/version.json',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname === '/index.html' || url.pathname === '/',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-entry',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-assets',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
