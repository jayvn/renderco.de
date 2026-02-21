const CACHE_NAME = 'wikifeed-v4';
const STATIC_ASSETS = [
    '/wiki_rabbithole/',
    '/wiki_rabbithole/index.html',
    '/wiki_rabbithole/style.css',
    '/wiki_rabbithole/app.js',
    '/wiki_rabbithole/manifest.json'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch - network first, fallback to cache for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // For Wikipedia/Wikimedia requests - let browser handle natively
    // (preserves referrerpolicy for images, handles CORS properly)
    if (url.hostname.includes('wikipedia.org') || url.hostname.includes('wikimedia.org')) {
        return;
    }

    // For static assets - cache first, network fallback
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // Return cache but also update in background
                fetch(event.request).then((response) => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
                    }
                });
                return cached;
            }
            return fetch(event.request).then((response) => {
                // Cache new requests
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
