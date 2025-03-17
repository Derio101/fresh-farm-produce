import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { register, requestNotificationPermission, setupBackgroundSync } from './serviceWorkerRegistration';

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
    const updateButton = document.createElement('button');
    updateButton.classList.add('update-button');
    updateButton.textContent = 'Update available! Click to update.';
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
});

// Request notification permission after a short delay
setTimeout(() => {
  requestNotificationPermission();
}, 3000);

// Set up background sync for offline form submissions
setupBackgroundSync();

// Add listener for service worker controlling the page
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}