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

// Cache expiration times (in seconds)
const CACHE_TIMES = {
  STATIC: 365 * 24 * 60 * 60, // 1 year
  IMAGES: 30 * 24 * 60 * 60,  // 30 days
  API: 24 * 60 * 60,          // 1 day
  HTML: 0                     // No cache for HTML (always get fresh)
};

// Resource types for different caching strategies
const RESOURCE_TYPES = {
  API: 'api',
  IMAGE: 'image',
  HTML: 'html',
  STATIC: 'static'
};

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
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => !currentCaches.includes(cacheName))
            .map(cacheName => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Claiming clients');
        return self.clients.claim(); // Important for bfcache support
      })
  );
});

/**
 * Determine the resource type of a request
 * @param {Request} request - The fetch request
 * @returns {string} Resource type
 */
function getResourceType(request) {
  const url = new URL(request.url);
  
  // Check if this is an API request
  if (API_ROUTES.some(route => url.pathname.includes(route))) {
    return RESOURCE_TYPES.API;
  }
  
  // Check if this is an image request
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i)) {
    return RESOURCE_TYPES.IMAGE;
  }
  
  // Check if this is a HTML navigation request
  if (request.mode === 'navigate') {
    return RESOURCE_TYPES.HTML;
  }
  
  // Default to static resource (JS, CSS, etc.)
  return RESOURCE_TYPES.STATIC;
}

/**
 * Create a response with proper cache headers
 * @param {Response} response - Original response
 * @param {string} resourceType - Type of resource
 * @returns {Response} Enhanced response with cache headers
 */
function createCacheableResponse(response, resourceType) {
  if (!response || !response.ok) {
    return response;
  }
  
  const cacheTime = CACHE_TIMES[resourceType] || 0;
  
  // Skip enhancing if no cache time
  if (cacheTime === 0) {
    return response;
  }
  
  // Clone the response
  const responseClone = response.clone();
  const headers = new Headers(responseClone.headers);
  
  // Set appropriate Cache-Control header
  if (resourceType === RESOURCE_TYPES.STATIC) {
    // Use immutable for hashed static resources for best performance
    headers.set('Cache-Control', `public, max-age=${cacheTime}, immutable`);
  } else {
    headers.set('Cache-Control', `public, max-age=${cacheTime}`);
  }
  
  // Create enhanced response with cache headers
  return new Response(responseClone.body, {
    status: responseClone.status,
    statusText: responseClone.statusText,
    headers: headers
  });
}

/**
 * Cache a response and return it
 * @param {Request} request - The fetch request
 * @param {Response} response - The fetch response
 * @param {string} resourceType - Type of resource
 * @returns {Response} The original or enhanced response
 */
function cacheResponse(request, response, resourceType) {
  if (!response || !response.ok) {
    return response;
  }
  
  const cacheableResponse = createCacheableResponse(response, resourceType);
  const responseToCache = cacheableResponse.clone();
  
  caches.open(RUNTIME_CACHE)
    .then(cache => {
      cache.put(request, responseToCache);
    })
    .catch(err => {
      console.error('[ServiceWorker] Error caching response:', err);
    });
  
  return cacheableResponse;
}

/**
 * Handle API requests (Network first, fallback to cache)
 * @param {FetchEvent} event - The fetch event
 * @returns {Promise<Response>} The response
 */
async function handleApiRequest(event) {
  try {
    const response = await fetch(event.request);
    return cacheResponse(event.request, response, RESOURCE_TYPES.API);
  } catch (error) {
    const cachedResponse = await caches.match(event.request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's a GET request for form data and we can't fetch or find in cache
    // return an empty JSON response with offline indicator
    const url = new URL(event.request.url);
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
    
    throw error;
  }
}

/**
 * Handle image requests (Cache first, network fallback with generic image for failures)
 * @param {FetchEvent} event - The fetch event
 * @returns {Promise<Response>} The response
 */
async function handleImageRequest(event) {
  const cachedResponse = await caches.match(event.request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(event.request);
    return cacheResponse(event.request, response, RESOURCE_TYPES.IMAGE);
  } catch (error) {
    // Return fallback image if fetch fails
    return caches.match('/logo192.png');
  }
}

/**
 * Handle HTML navigation requests (Network first with offline fallback)
 * @param {FetchEvent} event - The fetch event
 * @returns {Promise<Response>} The response
 */
async function handleHtmlRequest(event) {
  try {
    const response = await fetch(event.request);
    // Don't cache HTML responses for long to ensure freshness
    return cacheResponse(event.request, response, RESOURCE_TYPES.HTML);
  } catch (error) {
    const cachedResponse = await caches.match('/offline.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    return caches.match('/index.html');
  }
}

/**
 * Handle static resource requests (Cache first, network fallback)
 * @param {FetchEvent} event - The fetch event
 * @returns {Promise<Response>} The response
 */
async function handleStaticRequest(event) {
  const cachedResponse = await caches.match(event.request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(event.request);
    return cacheResponse(event.request, response, RESOURCE_TYPES.STATIC);
  } catch (error) {
    console.error('[ServiceWorker] Static resource fetch failed:', error);
    throw error;
  }
}

// Fetch event - apply different strategies based on request type
self.addEventListener('fetch', event => {
  // Skip non-GET requests and cross-origin requests
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }
  
  const resourceType = getResourceType(event.request);
  
  switch (resourceType) {
    case RESOURCE_TYPES.API:
      event.respondWith(handleApiRequest(event));
      break;
    case RESOURCE_TYPES.IMAGE:
      event.respondWith(handleImageRequest(event));
      break;
    case RESOURCE_TYPES.HTML:
      event.respondWith(handleHtmlRequest(event));
      break;
    case RESOURCE_TYPES.STATIC:
    default:
      event.respondWith(handleStaticRequest(event));
      break;
  }
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'submit-form') {
    event.waitUntil(
      // Get all pending form submissions from IndexedDB
      // and notify client to sync them
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

// Listen for message events (for handling update requests)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
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