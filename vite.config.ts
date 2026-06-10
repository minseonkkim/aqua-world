import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sentryEnabled = Boolean(
    env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT,
  );
  const isCapacitor = process.env.VITE_TARGET === 'capacitor';

  return {
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // 무거운 vendor 라이브러리를 분리 — 병렬 다운로드 + 앱 코드 변경 시 캐시 유지
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('three')) return 'three';
          // analytics 는 동적 import 로 별도 청크 분리 — firebase 청크에 묶이지 않게 먼저 가로챈다.
          if (id.includes('firebase/analytics') || id.includes('@firebase/analytics')) return 'firebase-analytics';
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
          if (id.includes('@sentry')) return 'sentry';
          if (id.includes('howler')) return 'audio';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    !isCapacitor && VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.svg'],
      manifest: {
        name: 'AquaWorld — 나만의 3D 수족관',
        short_name: 'AquaWorld',
        description: '내 손안의 살아있는 3D 수족관 — 물고기를 키우고, 꾸미고, 친구와 공유하는 힐링 게임',
        lang: 'ko',
        dir: 'ltr',
        categories: ['games', 'entertainment', 'lifestyle'],
        theme_color: '#0a1628',
        background_color: '#0a1628',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,glb,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    sentryEnabled &&
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
      }),
  ],
  resolve: {
    alias: {
      '@': '/src',
      ...(isCapacitor
        ? { 'virtual:pwa-register/react': '/src/stubs/pwa-register-react.ts' }
        : {}),
    },
  },
  };
});
