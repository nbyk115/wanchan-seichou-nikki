const CACHE_NAME = 'wanchan-v4';
const ASSETS = [
  '/wanchan-seichou-nikki/',
  '/wanchan-seichou-nikki/index.html',
  '/wanchan-seichou-nikki/icon-192.png',
  '/wanchan-seichou-nikki/icon-512.png',
  '/wanchan-seichou-nikki/og-image.png',
  '/wanchan-seichou-nikki/manifest.json'
];

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

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
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

  // For navigation requests, provide offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetched = fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => cached || new Response(OFFLINE_PAGE, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }));
        return cached || fetched;
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
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
