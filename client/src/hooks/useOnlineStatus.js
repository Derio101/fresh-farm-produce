import { useState, useEffect } from 'react';

/**
 * Custom hook that tracks the browser's online status
 * @returns {boolean} Current online status
 */
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    // Update online status when it changes
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    
    // Add event listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  return isOnline;
};

export default useOnlineStatus;