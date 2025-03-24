// client/src/serviceWorkerRegistration.js

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

/**
 * Register service worker for PWA functionality
 * @param {Object} config - Configuration options
 */
export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // from what our page is served on. This might happen if a CDN is used.
      return;
    }

    // Use window load event for best reliability
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // Running on localhost - Check existing service worker
        checkValidServiceWorker(swUrl, config);

        // Add logging for developers
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://cra.link/PWA'
          );
        });
      } else {
        // Not localhost - Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

/**
 * Register valid service worker and set up update handling
 * @param {string} swUrl - Service worker URL
 * @param {Object} config - Configuration options
 */
function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      // Check for updates but not too frequently
      registration.update();
      
      // Set up periodic checks for service worker updates - once per hour
      // Using setInterval can impact performance, so we'll use a less aggressive approach
      let lastUpdateCheck = Date.now();
      const checkInterval = 60 * 60 * 1000; // 1 hour
      
      // Check for updates when the user navigates back to the page
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastUpdateCheck > checkInterval) {
          registration.update();
          lastUpdateCheck = Date.now();
        }
      });
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older content.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://cra.link/PWA.'
              );

              // Show notification to the user
              showUpdateNotification(registration);

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              console.log('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
      
      // Listen for the controlling service worker changing
      // and reload the page for bfcache compatibility
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Avoid reloading the page while the page is already unloading
        if (!document.hidden) {
          window.location.reload();
        }
      });
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

/**
 * Show notification that updates are available
 * @param {ServiceWorkerRegistration} registration - Service worker registration
 */
function showUpdateNotification(registration) {
  // Use Notification API if permission granted
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Fresh Farm Produce', {
        body: 'New content is available! Close and reopen the app to see the latest updates.',
        icon: '/logo192.png'
      });
    });
  }
  
  // Don't create too many DOM elements - check if update button already exists
  if (!document.querySelector('.update-container')) {
    // Create a button for updating
    const updateButton = document.createElement('button');
    updateButton.classList.add('update-button');
    updateButton.textContent = 'Update available! Click to update.';
    updateButton.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;padding:8px 16px;background:#1b5e20;color:white;border:none;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.2);cursor:pointer;';
    
    updateButton.addEventListener('click', () => {
      if (registration.waiting) {
        // Send message to waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
    
    // Add update notification to UI
    const updateContainer = document.createElement('div');
    updateContainer.classList.add('update-container');
    updateContainer.appendChild(updateButton);
    document.body.appendChild(updateContainer);
  }
}

/**
 * Check if the service worker can be found. If not, reload the page.
 * @param {string} swUrl - Service worker URL
 * @param {Object} config - Configuration options
 */
function checkValidServiceWorker(swUrl, config) {
  // Use fetch API to check if service worker exists
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

/**
 * Request notification permission with better UX approach
 * Only ask for permission after user interaction
 */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    // Wait for user interaction before requesting permission
    const requestAfterInteraction = () => {
      // Remove the event listener once it's been triggered
      document.removeEventListener('click', requestAfterInteraction);
      
      // Small delay to avoid confusing the user
      setTimeout(() => {
        Notification.requestPermission().then(permission => {
          console.log(`Notification permission ${permission}`);
        });
      }, 1000);
    };
    
    // Listen for user interaction
    document.addEventListener('click', requestAfterInteraction);
  }
}

/**
 * Set up background sync for form submissions
 * Deferrable to avoid impacting initial page load
 */
export function setupBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    // Defer setup to avoid impacting initial page load
    setTimeout(() => {
      navigator.serviceWorker.ready.then(registration => {
        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'SYNC_FORMS') {
            // Dynamically import the helper to reduce initial load
            import('./utils/indexedDBHelper').then(({ syncForms }) => {
              console.log('Syncing stored forms');
              syncForms();
            });
          }
        });
      });
    }, 2000); // Delay by 2 seconds
  }
}

/**
 * Unregister service worker
 */
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}