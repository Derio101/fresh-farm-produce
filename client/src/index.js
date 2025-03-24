import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { register } from './serviceWorkerRegistration';

// Render the app immediately for best performance
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// Register service worker for PWA functionality
register({
  onUpdate: registration => {
    // Create a button to let users update the app
    // This is handled in the serviceWorkerRegistration.js file
  }
});

// Defer non-critical operations
// Use requestIdleCallback to run in browser idle time if available
const runWhenIdle = window.requestIdleCallback || 
  ((cb) => setTimeout(cb, 1000)); // Fallback with timeout

runWhenIdle(() => {
  import('./serviceWorkerRegistration')
    .then(({ requestNotificationPermission, setupBackgroundSync }) => {
      // Only request notification after user interaction
      requestNotificationPermission();
      
      // Set up background sync
      setupBackgroundSync();
    });
});

// Use the pagehide event instead of unload for better bfcache compatibility
window.addEventListener('pagehide', () => {
  // Don't use synchronous APIs here that would prevent bfcache
  // Just log for now
  if (process.env.NODE_ENV === 'development') {
    console.log('Page hidden, may be eligible for bfcache');
  }
});