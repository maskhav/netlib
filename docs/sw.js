// Кеш оболонки програми. Бібліотека шаблонів і чернетки живуть в IndexedDB, не тут.
// Після змін в app.js або index.html підніми VERSION.
const VERSION = 'netlib-v2';
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(u => fetch(u, { credentials: 'same-origin', redirect: 'manual' })
      .then(r => { if (r.ok && r.type === 'basic') return c.put(u, r); throw new Error('shell ' + u + ' ' + r.status); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname === 'api.github.com' || url.pathname.startsWith('/api/')) return; // API ніколи не кешуємо
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;

  e.respondWith(
    fetch(req).then(r => {
      // Кешуємо тільки справжню відповідь нашого сайту. Якщо сесія Access закінчилась,
      // прийде редірект на сторінку входу, і вона НЕ повинна потрапити в кеш.
      const clean = r.ok && !r.redirected && r.type === 'basic';
      if (clean || (isFont && (r.ok || r.type === 'opaque'))) {
        const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
