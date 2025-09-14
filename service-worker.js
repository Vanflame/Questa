const CACHE_NAME = 'questa-earn-v1';
const STATIC_CACHE_NAME = 'questa-static-v1';
const DYNAMIC_CACHE_NAME = 'questa-dynamic-v1';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/index.html',
    '/assets/css/styles.css',
    '/manifest.json',
    '/favicon.ico',
    '/favicon.svg',
    '/assets/images/logo.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/login/index.html',
    '/register/index.html',
    '/dashboard/index.html',
    '/admin/index.html',
    // Core JavaScript files
    '/assets/js/app.js',
    '/assets/js/auth.js',
    '/assets/js/firebase-config.js',
    '/assets/js/firestore.js',
    '/assets/js/login-handler.js',
    '/assets/js/register-handler.js',
    '/assets/js/dashboard-handler.js',
    '/assets/js/admin-handler.js',
    '/assets/js/storage.js',
    '/assets/js/supabase-config.js',
    '/assets/js/supabase-storage.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle different types of requests
    if (isStaticAsset(request.url)) {
        // Cache-first strategy for static assets
        event.respondWith(cacheFirst(request));
    } else if (isHTMLRequest(request)) {
        // Network-first strategy for HTML pages
        event.respondWith(networkFirst(request));
    } else {
        // Stale-while-revalidate for other requests
        event.respondWith(staleWhileRevalidate(request));
    }
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Cache-first failed:', error);
        return new Response('Offline - Resource not available', { status: 503 });
    }
}

// Network-first strategy for HTML pages
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache:', error);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page for HTML requests
        if (isHTMLRequest(request)) {
            return caches.match('/index.html');
        }

        return new Response('Offline - Page not available', { status: 503 });
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Return cached version if network fails
        return cachedResponse;
    });

    return cachedResponse || fetchPromise;
}

// Helper functions
function isStaticAsset(url) {
    return url.includes('/assets/') ||
        url.includes('/icons/') ||
        url.includes('.css') ||
        url.includes('.js') ||
        url.includes('.png') ||
        url.includes('.jpg') ||
        url.includes('.jpeg') ||
        url.includes('.gif') ||
        url.includes('.svg') ||
        url.includes('.ico') ||
        url.includes('manifest.json');
}

function isHTMLRequest(request) {
    return request.headers.get('accept').includes('text/html');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    console.log('Service Worker: Background sync triggered');
    // Implement background sync logic here
    // For example, sync offline form submissions when connection is restored
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'View Tasks',
                    icon: '/icons/icon-192.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/icons/icon-192.png'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/dashboard')
        );
    } else if (event.action === 'close') {
        // Just close the notification
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
