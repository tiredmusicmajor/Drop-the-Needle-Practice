// Caches just the static shell so the app launches instantly and has an
// icon/splash screen even on a slow connection. It deliberately does NOT
// cache YouTube API responses, the IFrame player, or fonts — those must
// always be fresh (and the quiz needs live network access to work at all).

const CACHE_NAME = 'dtn-shell-v1';
const SHELL_FILES = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShellFile = url.origin === self.location.origin
    && SHELL_FILES.some((f) => url.pathname.endsWith(f))
    || url.pathname === '/' || url.pathname.endsWith('/');

  if (event.request.method !== 'GET' || !isShellFile) return; // let the browser handle it normally

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
