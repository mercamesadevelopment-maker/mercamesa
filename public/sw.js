/*
 * Service worker de MercaMesa.
 *
 * Mínimo a propósito: existe para que el sitio se pueda instalar como app y
 * para mostrar una pantalla propia cuando no hay internet. No guarda ningún
 * dato del negocio —precios, inventario, pedidos, sesión—, así que nadie puede
 * ver un precio o un estado desactualizado.
 *
 * - Al instalarse guarda solo la pantalla sin conexión y su ícono.
 * - Al abrir una página va siempre a la red; si no hay red, muestra esa pantalla.
 * - Todo lo demás (API, Supabase, imágenes, archivos de Next) no lo toca.
 *
 * Al cambiar algo de lo guardado, subir la versión: al activarse se borran las
 * cachés anteriores.
 */
const CACHE = 'mercamesa-offline-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo la navegación entre páginas. Lo demás sigue directo a la red.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    })
  );
});
