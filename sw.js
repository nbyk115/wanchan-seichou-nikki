const CACHE_NAME = 'wanchan-v6';
const ASSETS = [
  '/wanchan-seichou-nikki/',
  '/wanchan-seichou-nikki/index.html',
  '/wanchan-seichou-nikki/firebase-config.js',
  '/wanchan-seichou-nikki/icon-192.png',
  '/wanchan-seichou-nikki/icon-512.png',
  '/wanchan-seichou-nikki/og-image.png',
  '/wanchan-seichou-nikki/manifest.json'
];

const MAX_CACHE_SIZE = 100;

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>オフライン - わんちゃん日記</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Zen Maru Gothic','Hiragino Sans',sans-serif;background:#FFF8F5;display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px;text-align:center;color:#333}
.c{max-width:320px}.icon{font-size:64px;margin-bottom:16px}
h1{font-size:20px;font-weight:900;margin-bottom:8px}
p{font-size:14px;color:#888;line-height:1.7;margin-bottom:24px}
button{background:#FF7B9C;color:#fff;border:none;padding:14px 32px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
button:active{transform:scale(.97)}
</style></head><body>
<div class="c">
<div class="icon">🐾</div>
<h1>オフラインです</h1>
<p>インターネット接続がありません。<br>接続が回復したらもう一度お試しください。</p>
<button onclick="location.reload()">再読み込み</button>
</div></body></html>`;

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await Promise.all(
      keys.slice(0, keys.length - maxItems).map((key) => cache.delete(key))
    );
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Skip cross-origin API requests
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('firebaseapp.com')) return;
  if (e.request.url.includes('googleapis.com/identitytoolkit')) return;
  if (e.request.url.includes('firestore.googleapis.com')) return;

  // For navigation requests, network-first with offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) =>
            cached || new Response(OFFLINE_PAGE, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
          )
        )
    );
    return;
  }

  // For font requests, cache-first (fonts rarely change)
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // For other requests, stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
            trimCache(CACHE_NAME, MAX_CACHE_SIZE);
          });
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
