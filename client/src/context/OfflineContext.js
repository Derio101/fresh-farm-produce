import React, { createContext, useContext, useState, useEffect } from 'react';

// Create context
const OfflineContext = createContext({
  isOffline: false,
  pendingForms: [],
  setPendingForms: () => {}
});

/**
 * OfflineProvider component to manage offline status application-wide
 */
export const OfflineProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingForms, setPendingForms] = useState([]);
  
  // Track online/offline status
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Get pending forms on mount
    const getPendingFormsFromDB = async () => {
      try {
        // Import the IndexedDB helper dynamically
        const { getPendingForms } = await import('../utils/indexedDBHelper');
        const forms = await getPendingForms();
        setPendingForms(forms);
      } catch (error) {
        console.error('Error getting pending forms:', error);
      }
    };
    
    getPendingFormsFromDB();
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  return (
    <OfflineContext.Provider value={{ isOffline, pendingForms, setPendingForms }}>
      {children}
    </OfflineContext.Provider>
  );
};

// Custom hook to use the offline context
export const useOffline = () => useContext(OfflineContext);

export default OfflineContext;