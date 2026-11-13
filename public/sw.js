// 旅途手札 service worker
// - 程式、字型、圖示：快取優先（檔名含版本雜湊，不會過期）
// - 旅程頁面的外殼：網路優先，離線時用上次存的版本
// - /api/ 一律不快取：資料由頁面自己存在手機裡並處理離線佇列
const VERSION = 'v1';
const STATIC = `th-static-${VERSION}`;
const PAGES = `th-pages-${VERSION}`;

const OFFLINE_HTML = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>離線中</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F7FAF6;color:#12343F;font-family:'PingFang TC',sans-serif;padding:24px;text-align:center;line-height:1.7}</style>
</head><body><p id="m">目前離線，這個頁面還沒有存到手機裡。<br>請連上網路後再試一次。</p>
<script>try{var id=JSON.parse(localStorage.getItem('th:lastTrip')||'null');if(id&&location.pathname.indexOf('/t/')!==0){location.replace('/t/'+id)}}catch(e){}</script>
</body></html>`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('th-') && k !== STATIC && k !== PAGES).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStatic(url) {
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/pwa-icon/') ||
      url.pathname === '/manifest.webmanifest'
    );
  }
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

async function navigate(request, url) {
  const cache = await caches.open(PAGES);
  const key = url.origin + url.pathname; // 畫面切換只改網址參數，外殼是同一份
  try {
    const res = await fetch(request);
    if (res.ok && url.pathname.startsWith('/t/')) cache.put(key, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(key)) ||
      new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request, url));
    return;
  }
  if (isStatic(url)) event.respondWith(cacheFirst(request));
});

// 第一次開啟時 service worker 還沒接手，頁面會把已載入的檔案清單傳過來補存
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'precache') return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC);
      await Promise.all(
        (data.urls || []).map(async (u) => {
          try {
            const url = new URL(u);
            if (!isStatic(url) || (await cache.match(u))) return;
            const sameOrigin = url.origin === self.location.origin;
            const res = await fetch(u, sameOrigin ? undefined : { mode: 'no-cors' });
            if (res.ok || res.type === 'opaque') await cache.put(u, res);
          } catch {
            /* 個別檔案失敗不影響其他檔案 */
          }
        }),
      );
      if (data.page) {
        try {
          const res = await fetch(data.page);
          if (res.ok) await (await caches.open(PAGES)).put(data.page, res);
        } catch {
          /* 略過 */
        }
      }
    })(),
  );
});
