/* sw.js – NK Inventar PWA
   Hinweise:
   - Nach jeder inhaltlichen Änderung CACHE_NAME erhöhen (v3 → v4 …),
     damit Nutzer sofort die neue Version erhalten.
   - In Firebase haben wir für sw.js bereits "Cache-Control: no-store" gesetzt.
*/

const CACHE_NAME = 'nk-inventar-v3'; // <-- bei Updates hochzählen
const ASSETS = [
  '/',                 // Root (nur wenn eure Startseite index.html im Root liegt)
  '/index.html',
  '/login.html',
  '/lager_pwa_238.html',
  '/manifest.json',
  // Icons (anpassen, falls andere Pfade/Dateien)
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png'
  // Optional weitere Dateien ergänzen:
  // '/style.css',
  // '/script.js',
  // '/images/logo.png',
];

// --- Install: statische Assets cachen ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting(); // neue SW sofort aktivierbar machen
});

// --- Activate: alte Caches löschen ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim(); // Kontrolle sofort übernehmen
    })()
  );
});

// --- Fetch-Strategien ---
// HTML/Navigationsanfragen -> Network-first (mit Offline-Fallback)
// Sonst (CSS/JS/Icons) -> Cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET cachen
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first für Seiten
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          // Erfolgreiche Antwort zusätzlich im Cache aktualisieren
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          // Fallback: gecachte Seite oder index.html
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          return cached || cache.match('/index.html') || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // Gleiches Origin? -> Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Fremddomains (z. B. Firebase CDN): ebenfalls Cache-first mit Fallback Netz
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    // Nur erfolgreiche Antworten cachen
    if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    // Kein Netz und nix im Cache
    return new Response('Offline', { status: 503 });
  }
}

// --- Manuelles Sofort-Update per Message (optional) ---
// In der Seite z. B.:
// navigator.serviceWorker.getRegistration()?.then(r=>r?.waiting?.postMessage({type:'SKIP_WAITING'}))
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});