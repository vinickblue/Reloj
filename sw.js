/**
 * RELOJ DIGITAL PWA — sw.js
 * Service Worker con estrategia Cache First + Network Fallback
 * Permite uso 100% offline una vez instalada la app.
 */

'use strict';

/* ============================================================
   CONFIGURACIÓN DEL CACHÉ
   ============================================================ */

const CACHE_NAME    = 'reloj-pwa-v1';
const CACHE_VERSION = 1;

/** Archivos que se cachean en la instalación (pre-cache) */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ============================================================
   EVENTO: INSTALL
   Pre-cachea todos los assets estáticos y activa el SW
   inmediatamente (skipWaiting).
   ============================================================ */

self.addEventListener('install', event => {
  console.log(`[SW] Instalando caché: ${CACHE_NAME}`);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-cacheando assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Pre-caché completo. Activando inmediatamente.');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error durante la instalación:', err);
      })
  );
});

/* ============================================================
   EVENTO: ACTIVATE
   Elimina cachés antiguos (versiones anteriores) y toma
   control de todos los clientes abiertos.
   ============================================================ */

self.addEventListener('activate', event => {
  console.log('[SW] Activado. Limpiando cachés anteriores...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletions = cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Eliminando caché obsoleto: ${name}`);
            return caches.delete(name);
          });
        return Promise.all(deletions);
      })
      .then(() => {
        console.log('[SW] Tomando control de todos los clientes.');
        return self.clients.claim();
      })
  );
});

/* ============================================================
   EVENTO: FETCH — Estrategia Cache First con Network Fallback
   
   Flujo:
   1. Busca el recurso en el caché.
   2. Si existe → devuelve desde caché (rápido, offline).
   3. Si NO existe → busca en red, guarda en caché y devuelve.
   4. Si la red falla y no hay caché → devuelve página offline
      (solo para navegación HTML).
   ============================================================ */

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no sean GET
  if (request.method !== 'GET') return;

  // Ignorar peticiones externas (ej. analytics, CDN externos)
  if (url.origin !== self.location.origin) return;

  event.respondWith(cacheFirst(request));
});

/* ============================================================
   HELPERS DE ESTRATEGIA
   ============================================================ */

/**
 * Cache First con actualización en background (Stale-While-Revalidate lite).
 * Devuelve desde caché si existe; si no, busca en red y cachea el resultado.
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request, { ignoreSearch: false });

  if (cachedResponse) {
    // Actualización en background: refresca el caché sin bloquear la respuesta
    refreshCache(request);
    return cachedResponse;
  }

  // No está en caché → buscar en red
  return fetchAndCache(request);
}

/**
 * Hace fetch a la red y guarda la respuesta válida en el caché.
 */
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);

    // Solo cachear respuestas válidas (status 200, tipo básico)
    if (
      networkResponse &&
      networkResponse.status === 200 &&
      networkResponse.type === 'basic'
    ) {
      const cache = await caches.open(CACHE_NAME);
      // Clonar: el body solo puede leerse una vez
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    console.warn('[SW] Red no disponible para:', request.url);

    // Fallback offline para navegación (peticiones HTML)
    if (request.destination === 'document') {
      const offlineFallback = await caches.match('./index.html');
      if (offlineFallback) return offlineFallback;
    }

    // Sin respuesta posible
    return new Response('Sin conexión', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
    });
  }
}

/**
 * Refresca el caché en segundo plano (no bloquea la UI).
 */
async function refreshCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (
      networkResponse &&
      networkResponse.status === 200 &&
      networkResponse.type === 'basic'
    ) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse);
    }
  } catch (_) {
    // Silencioso: sin red no se actualiza, pero el caché sigue siendo válido
  }
}
