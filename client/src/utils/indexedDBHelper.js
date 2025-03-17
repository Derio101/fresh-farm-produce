// client/src/utils/indexedDBHelper.js

const DB_NAME = 'FreshFarmDB';
const DB_VERSION = 1;
const FORM_STORE = 'pendingForms';

// Initialize the database
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(FORM_STORE)) {
        const store = db.createObjectStore(FORM_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Save a form submission for later syncing
export const saveFormForLater = async (formData) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([FORM_STORE], 'readwrite');
    const store = transaction.objectStore(FORM_STORE);
    
    // Add timestamp to track when the form was submitted
    const dataToStore = {
      ...formData,
      timestamp: Date.now(),
      synced: false
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(dataToStore);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error saving form data to IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to save form to IndexedDB:', error);
    return false;
  }
};

// Get all pending form submissions
export const getPendingForms = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([FORM_STORE], 'readonly');
    const store = transaction.objectStore(FORM_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error getting pending forms from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to get pending forms from IndexedDB:', error);
    return [];
  }
};

// Mark a form as synced
export const markFormAsSynced = async (formId) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([FORM_STORE], 'readwrite');
    const store = transaction.objectStore(FORM_STORE);
    
    return new Promise((resolve, reject) => {
      // First get the form
      const getRequest = store.get(formId);
      
      getRequest.onsuccess = () => {
        const form = getRequest.result;
        if (form) {
          form.synced = true;
          
          // Update the form
          const updateRequest = store.put(form);
          
          updateRequest.onsuccess = () => {
            resolve(true);
          };
          
          updateRequest.onerror = (event) => {
            console.error('Error updating form in IndexedDB:', event.target.error);
            reject(event.target.error);
          };
        } else {
          reject(new Error('Form not found'));
        }
      };
      
      getRequest.onerror = (event) => {
        console.error('Error getting form from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to mark form as synced in IndexedDB:', error);
    return false;
  }
};

// Delete a form from IndexedDB
export const deleteForm = async (formId) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([FORM_STORE], 'readwrite');
    const store = transaction.objectStore(FORM_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(formId);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error deleting form from IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to delete form from IndexedDB:', error);
    return false;
  }
};

// Sync all pending forms with the server
export const syncForms = async () => {
  try {
    const pendingForms = await getPendingForms();
    
    if (pendingForms.length === 0) {
      return { success: true, message: 'No forms to sync' };
    }
    
    const results = [];
    
    for (const form of pendingForms) {
      if (!form.synced) {
        try {
          const response = await fetch('http://localhost:5001/api/form', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              phone: form.phone,
              message: form.message,
              interestedProducts: form.interestedProducts || []
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            await markFormAsSynced(form.id);
            results.push({ id: form.id, success: true });
          } else {
            results.push({ id: form.id, success: false, error: result.message });
          }
        } catch (error) {
          results.push({ id: form.id, success: false, error: error.message });
        }
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Failed to sync forms with server:', error);
    return { success: false, error: error.message };
  }
};