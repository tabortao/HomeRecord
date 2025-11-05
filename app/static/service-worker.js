const CACHE_NAME = 'homerecord-cache-v1';
const CORE_ASSETS = [
  // HTML
  '/static/index.html',
  '/static/offline.html',
  // CSS
  '/static/css/tailwind.min.css',
  '/static/css/font-awesome.local.css',
  // JS
  '/static/js/app.js',
  '/static/js/api.js',
  '/static/js/utils.js',
  '/static/js/subaccountManager.js',
  '/static/js/subjectSettings.js',
  '/static/js/taskTabs.js',
  '/static/js/pwa.js',
  // Images
  '/static/images/favicon/favicon.ico',
  '/static/images/icons/pwa-icon.svg',
  '/static/images/icons/pwa-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 处理页面导航请求（HTML文档）离线兜底
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // 更新缓存中的首页副本（可选）
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/static/index.html', clone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('/static/offline.html'))
    );
    return;
  }
  // 仅处理当前源的静态资源
  if (url.origin === self.location.origin && url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResp) => {
          // 动态更新缓存
          const respClone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
          return networkResp;
        }).catch(() => cached);
        // 优先返回缓存，其次网络
        return cached || fetchPromise;
      })
    );
  }
});