/// <reference lib="webworker" />
/* EduShare Service Worker - offline-first
 * - Precache app shell (Workbox injectManifest)
 * - Điều hướng: phục vụ index.html khi offline (app mở được không cần mạng)
 * - Runtime cache: ảnh/icon/font CacheFirst, tài liệu tĩnh StaleWhileRevalidate
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// App shell cho mọi điều hướng (SPA) - hoạt động ngoại tuyến.
const handler = createHandlerBoundToURL('index.html');
registerRoute(new NavigationRoute(handler, { denylist: [/^\/peers/, /^\/health/] }));

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'edushare-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 })]
  })
);

registerRoute(
  ({ request }) => ['style', 'script', 'font'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'edushare-static' })
);

// Thông điệp từ trang: yêu cầu SW giữ cache / thông báo cập nhật.
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') self.skipWaiting();
});
