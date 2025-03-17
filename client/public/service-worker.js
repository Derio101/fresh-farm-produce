// client/public/service-worker.js
const CACHE_NAME = 'fresh-farm-cache-v1';
const RUNTIME_CACHE = 'runtime-cache';

// Assets to cache immediately on service worker install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/js/vendors~main.chunk.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/offline.html'
];

// API routes to cache on network request
const API_ROUTES = [
  '/api/form'
];

// Install event - precache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Pre-caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting()) // Force waiting service worker to become active
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim(); // Take control of all clients
    })
  );
});

// Helper function to determine if a request is for API
const isApiRequest = (url) => {
  return API_ROUTES.some(route => url.pathname.includes(route));
};

// Helper function to determine if a request is for an image
const isImageRequest = (url) => {
  return url.pathname.endsWith('.png') || 
         url.pathname.endsWith('.jpg') || 
         url.pathname.endsWith('.jpeg') || 
         url.pathname.endsWith('.svg') || 
         url.pathname.endsWith('.gif');
};

// Fetch event - network-first for API, cache-first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // API requests (Network first, fallback to cache)
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If it's a GET request for form data and we can't fetch or find in cache
              // return an empty JSON response with offline indicator
              if (url.pathname.includes('/api/form') && event.request.method === 'GET') {
                return new Response(JSON.stringify({
                  success: false,
                  offline: true,
                  message: 'You are currently offline. Data will be available when you reconnect.',
                  data: []
                }), {
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            });
        })
    );
    return;
  }

  // Images (Cache first, network fallback with generic image for failures)
  if (isImageRequest(url)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          return cachedResponse || fetch(event.request)
            .then(response => {
              // Cache successful responses
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then(cache => {
                cache.put(event.request, responseClone);
              });
              return response;
            })
            .catch(() => {
              // Return fallback image if fetch fails
              return caches.match('/logo192.png');
            });
        })
    );
    return;
  }

  // HTML navigation requests (Network first with offline fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/offline.html') || caches.match('/index.html');
        })
    );
    return;
  }

  // Default strategy (Cache first, network fallback)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache responses with error status
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone the response
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => {
                cache.put(event.request, responseClone);
              });

            return response;
          });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'submit-form') {
    event.waitUntil(
      // Get all pending form submissions from IndexedDB
      // and send them to the server
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_FORMS'
          });
        });
      })
    );
  }
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New form submission received!',
    icon: '/logo192.png',
    badge: '/favicon.ico',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('Fresh Farm Produce', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      const url = event.notification.data.url;
      
      // If so, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If not, open a new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});