import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
    fs: { allow: ['..'] },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NUTRIVA – Dinh dưỡng theo cách của bạn',
        short_name: 'NUTRIVA',
        description: 'Sữa hạt tươi, set tự làm và kế hoạch dinh dưỡng cá nhân.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8FAF8',
        theme_color: '#567324',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['**/img/activities/**', '**/img/plans/**'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/img/activities/'),
            handler: 'CacheFirst',
            options: { cacheName: 'activity-images', expiration: { maxEntries: 120 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/img/plans/'),
            handler: 'CacheFirst',
            options: { cacheName: 'plan-images', expiration: { maxEntries: 60 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/files/'),
            handler: 'CacheFirst',
            options: { cacheName: 'uploads', expiration: { maxEntries: 100 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/products'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-products' },
          },
          {
            urlPattern: ({ url }) => url.origin.includes('fonts.g'),
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
