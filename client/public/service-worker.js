// This is your complete service-worker.js file with all enhancements

// Cache names
const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';
const RUNTIME_CACHE = 'runtime-cache';

// Cache API responses during install
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll([
          '/',
          '/index.html',
          '/static/js/main.chunk.js',
          '/static/js/0.chunk.js',
          '/static/js/bundle.js',
          '/manifest.json',
          '/logo192.png',
          '/logo512.png',
          '/offline.html'
        ]);
      })
  );
});

// Cache API responses during activation
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  // Delete old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients...');
      return self.clients.claim();
    })
  );
  
  // Preload essential API data
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(cache => {
      console.log('Service Worker: Preloading API data');
      
      // Create a request with custom fetch options
      const apiUrl = new URL('/api/form', self.location.origin);
      
      return fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-cache'
      })
      .then(response => {
        // Clone the response before caching
        const responseToCache = response.clone();
        
        if (response.ok) {
          console.log('Service Worker: Successfully preloaded API data');
          return cache.put(apiUrl, responseToCache);
        }
        
        console.log('Service Worker: Failed to preload API data, status:', response.status);
        return Promise.resolve();
      })
      .catch(error => {
        console.error('Service Worker: Error preloading API data:', error);
        return Promise.resolve();
      });
    })
  );
});

// Improved fetch event handler with network-first strategy for API requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // For API requests, try network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the response for later offline use
          const responseToCache = response.clone();
          
          caches.open(RUNTIME_CACHE)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // If network fetch fails, try to get from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // If not in cache, return a generic offline response for API
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'You are currently offline. Please check your internet connection.'
                }),
                {
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
  } else {
    // For non-API requests, use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              // Don't cache non-GET requests
              if (event.request.method !== 'GET') {
                return response;
              }
              
              // Clone the response for caching
              const responseToCache = response.clone();
              
              caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(() => {
              // If both network and cache fail for a page, show fallback
              if (event.request.headers.get('accept') && 
                  event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/offline.html');
              }
              
              // Return empty response for other resources
              return new Response('', { status: 408, statusText: 'Offline' });
            });
        })
    );
  }
});

// Listen for the SKIP_WAITING message from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync functionality for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-forms') {
    console.log('Service Worker: Attempting to sync forms...');
    event.waitUntil(syncForms());
  }
});

// Function to sync stored forms with the server
const syncForms = async () => {
  try {
    // Send a message to all clients to sync forms
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_FORMS'
      });
    });
    
    return true;
  } catch (error) {
    console.error('Service Worker: Error syncing forms:', error);
    return false;
  }
};

// Push notification functionality
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New update available',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Fresh Farm Produce', 
      options
    )
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // Check if there is already a window open with the target URL
      const url = event.notification.data.url;
      
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no open window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle service worker update found
self.addEventListener('updatefound', () => {
  const newWorker = self.registration.installing;
  
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && self.registration.active) {
      // There is a new service worker available
      console.log('New service worker installed');
    }
  });
});

console.log('Service Worker: Script loaded!');
