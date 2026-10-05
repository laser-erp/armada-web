/* АРМАДА PWA — HTML network-first + offline fallback; кэш привязан к APP_BUILD (?v= в URL sw.js) */
/** Ревизия оболочки SW (поднимать при деплое вместе с APP_BUILD). */
const SW_SHELL_REV = 'v102';
const SW_BUILD = (() => {
  try {
    return new URL(self.location.href).searchParams.get('v') || 'dev';
  } catch (_) {
    return 'dev';
  }
})();
const CACHE = 'armada-shell-' + SW_SHELL_REV + '-' + String(SW_BUILD).replace(/[^a-zA-Z0-9._-]/g, '_');

function asResponse(promise) {
  return Promise.resolve(promise).then(
    (r) => (r instanceof Response ? r : Response.error()),
    () => Response.error()
  );
}

/** Кэш по полному URL, затем по pathname (без ?v=). */
function cacheMatchFlexible(req) {
  return caches.match(req).then((hit) => {
    if (hit) return hit;
    try {
      const url = new URL(req.url);
      const path = url.pathname;
      return caches.match(path).then((hit2) => {
        if (hit2) return hit2;
        if (path.startsWith('/')) return caches.match('.' + path);
        return undefined;
      });
    } catch (_) {
      return undefined;
    }
  });
}

function networkFirstAsset(req) {
  return fetch(req, { cache: 'no-store' })
    .then((res) => {
      if (res && res.ok) cachePut(req, res);
      return res;
    })
    .catch(() => cacheMatchFlexible(req));
}

function cachePut(req, res) {
  if (!req || !res || !res.ok) return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

const SHELL = [
  './',
  './index.html',
  './order.html',
  './landing.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('armada-shell-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(req, path) {
  if (req.mode === 'navigate') return true;
  if (path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) return true;
  return /index\.html$/i.test(path) || /\/sw\.js$/i.test(path);
}

function offlineShellFallback(req) {
  return cacheMatchFlexible(req).then((cached) => {
    if (cached) return cached;
    try {
      const path = new URL(req.url).pathname;
      if (/\/order\.html$/i.test(path)) {
        return caches.match('./order.html');
      }
    } catch (_) {}
    return caches.match('./index.html').then((idx) => idx || caches.match('./'));
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith('/armada-api') || path.startsWith('/api/')) return;
  const isDoc = isNavigationRequest(req, path);
  const isScriptOrStyle = /\.(js|css)$/i.test(path);

  if (isDoc) {
    event.respondWith(
      asResponse(
        networkFirstAsset(req).catch(() => offlineShellFallback(req))
      )
    );
    return;
  }

  if (isScriptOrStyle) {
    event.respondWith(
      asResponse(
        networkFirstAsset(req).then((res) => {
          if (res instanceof Response) return res;
          return cacheMatchFlexible(req).then((cached) => cached || fetch(req, { cache: 'no-store' }));
        })
      )
    );
    return;
  }

  event.respondWith(
    asResponse(
      cacheMatchFlexible(req).then((cached) => {
        if (cached) return cached;
        return networkFirstAsset(req);
      })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
