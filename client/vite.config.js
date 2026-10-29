import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Mã phiên bản của mỗi lần build: server đọc dist/version.json và gửi kèm mọi phản hồi API (X-App-Build)
// → app đang chạy bản cũ (service worker còn giữ) tự nhận ra và cập nhật.
const BUILD_ID = Date.now().toString(36);
const versionFile = () => ({
  name: 'nutriva-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
    versionFile(),
    VitePWA({
      registerType: 'prompt', // có bản mới → AppBanners tự áp dụng lúc an toàn (vừa mở app / chuyển trang / app ẩn đi), không tải lại khi đang gõ
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
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // Font: chỉ cài sẵn bộ latin + tiếng Việt (các bộ khác như cyrillic, greek không dùng)
        globIgnores: ['**/img/activities/**', '**/img/plans/**', '**/img/products/**', '**/img/banners/**', '**/img/research/**', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,hebrew,math,symbols}-*.woff2'],
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
            // Ảnh sản phẩm & banner: tải khi cần (không cài sẵn để lần cài app nhẹ hơn); thay ảnh cùng tên vẫn được cập nhật ở nền
            urlPattern: ({ url }) => /^\/img\/(products|banners|research)\//.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'catalog-images', expiration: { maxEntries: 150, maxAgeSeconds: 30 * 86400 } },
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
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
