const CACHE_NAME = 'questa-earn-v2';
const STATIC_CACHE_NAME = 'questa-static-v2';
const DYNAMIC_CACHE_NAME = 'questa-dynamic-v2';

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

    // Special handling for root path to ensure standalone mode
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(handleRootRequest(request));
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

// Special handler for root requests to ensure standalone mode
async function handleRootRequest(request) {
    try {
        // Always try network first for root requests
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Fallback to cached version
        const cachedResponse = await caches.match('/index.html');
        if (cachedResponse) {
            return cachedResponse;
        }
        // Last resort - return a basic HTML response
        return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Questa Earn</title>
        <meta name="theme-color" content="#2563eb">
        <link rel="manifest" href="/manifest.json">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #2563eb; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <h1>Questa Earn</h1>
        <p>Loading...</p>
        <div class="spinner"></div>
        <script>
          // Redirect to login page
          setTimeout(() => {
            window.location.href = '/login/';
          }, 1000);
        </script>
      </body>
      </html>
    `, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

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
