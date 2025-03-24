import React from 'react';
import { useOffline } from '../../context/OfflineContext';

/**
 * Offline alert component to display when user is offline
 * @param {object} props - Component props
 * @param {string} props.message - Custom message to display
 */
function OfflineAlert({ message }) {
  const { isOffline } = useOffline();
  
  if (!isOffline) return null;
  
  return (
    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
      <p className="flex items-center">
        <span className="mr-2">📡</span>
        {message || 'You are currently offline. Some features may be limited.'}
      </p>
    </div>
  );
}

export default OfflineAlert;