const CACHE_NAME = 'homerecord-cache-v3';
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
  '/static/images/favicon/favicon.ico'
];

// 预缓存 images 目录中的所有文件，以提升后续访问速度
const IMAGE_ASSETS = [
  // avatars
  '/static/images/avatars/avatar1.svg',
  '/static/images/avatars/avatar2.svg',
  '/static/images/avatars/avatar3.svg',
  '/static/images/avatars/avatar4.svg',
  '/static/images/avatars/avatar5.svg',
  '/static/images/avatars/avatar6.svg',
  '/static/images/avatars/avatar7.svg',
  '/static/images/avatars/avatar8.svg',
  '/static/images/avatars/avatar9.svg',
  '/static/images/avatars/default.svg',
  // favicon
  '/static/images/favicon/android-chrome-192x192.png',
  '/static/images/favicon/android-chrome-512x512.png',
  '/static/images/favicon/apple-touch-icon.png',
  '/static/images/favicon/favicon-16x16.png',
  '/static/images/favicon/favicon-32x32.png',
  '/static/images/favicon/favicon.ico',
  '/static/images/favicon/site.webmanifest',
  // honors
  '/static/images/honors/default.png',
  '/static/images/honors/专注达人.png',
  '/static/images/honors/任务高手.png',
  '/static/images/honors/全能选手.png',
  '/static/images/honors/勤奋努力.png',
  '/static/images/honors/周末战士.png',
  '/static/images/honors/坚持不懈.png',
  '/static/images/honors/坚持到底.png',
  '/static/images/honors/学习小能手.png',
  '/static/images/honors/学习规划师.png',
  '/static/images/honors/学习达人.png',
  '/static/images/honors/学科之星.png',
  '/static/images/honors/完美主义.png',
  '/static/images/honors/心愿达人.png',
  '/static/images/honors/成长先锋.png',
  '/static/images/honors/持之以恒.png',
  '/static/images/honors/早起鸟.png',
  '/static/images/honors/时间管理.png',
  '/static/images/honors/时间管理大师.png',
  '/static/images/honors/知识探索者.png',
  '/static/images/honors/积分富翁.png',
  '/static/images/honors/计划大师.png',
  '/static/images/honors/进步神速.png',
  '/static/images/honors/连续打卡7天.png',
  '/static/images/honors/错题克星.png',
  '/static/images/honors/阅读之星.png',
  '/static/images/honors/高效学习.png',
  // others
  '/static/images/others/panda.png',
  '/static/images/others/陪伴学习-熊猫.png',
  // root images
  '/static/images/玩平板.png',
  '/static/images/玩手机.png',
  '/static/images/玩游戏.png',
  '/static/images/番茄钟.png',
  '/static/images/看电视.png',
  '/static/images/自由活动.png',
  '/static/images/零花钱.png'
];

const PRECACHE_ASSETS = CORE_ASSETS.concat(IMAGE_ASSETS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)));
    // Enable navigation preload to speed up navigation fetches when possible
    try {
      if (self.registration && self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    } catch (e) {
      // ignore
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 处理页面导航请求（HTML文档）离线兜底
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedIndex = await cache.match('/static/index.html');

      // Try to use navigation preload if available, else normal fetch
      const preloadResponse = await event.preloadResponse;
      const networkPromise = (preloadResponse ? Promise.resolve(preloadResponse) : fetch(request))
        .then(async (resp) => {
          try {
            await cache.put('/static/index.html', resp.clone());
          } catch (e) {}
          return resp;
        })
        .catch(async () => {
          if (cachedIndex) return cachedIndex;
          const offline = await caches.match('/static/offline.html');
          return offline;
        });

      // 优先返回缓存的 index.html，提高首屏与回前台速度；后台更新网络内容
      return cachedIndex || networkPromise;
    })());
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