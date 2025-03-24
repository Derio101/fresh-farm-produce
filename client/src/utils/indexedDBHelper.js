// client/src/utils/indexedDBHelper.js
import { getApiUrl } from '../services/api';

const DB_NAME = 'FreshFarmDB';
const DB_VERSION = 1;
const FORM_STORE = 'pendingForms';

/**
 * Initialize the database
 * @returns {Promise<IDBDatabase>} IndexedDB database instance
 */
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

/**
 * Save a form submission for later syncing
 * @param {object} formData - Form data to save
 * @returns {Promise<boolean>} Success status
 */
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

/**
 * Get all pending form submissions
 * @returns {Promise<Array>} Array of pending forms
 */
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

/**
 * Mark a form as synced
 * @param {number} formId - ID of the form to update
 * @returns {Promise<boolean>} Success status
 */
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

/**
 * Delete a form from IndexedDB
 * @param {number} formId - ID of form to delete
 * @returns {Promise<boolean>} Success status
 */
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

/**
 * Sync all pending forms with the server
 * @returns {Promise<object>} Sync results
 */
export const syncForms = async () => {
  try {
    const pendingForms = await getPendingForms();
    
    if (pendingForms.length === 0) {
      return { success: true, message: 'No forms to sync' };
    }
    
    const results = [];
    const apiUrl = getApiUrl();
    
    console.log(`Syncing ${pendingForms.length} pending forms to ${apiUrl}/api/form`);
    
    for (const form of pendingForms) {
      if (!form.synced) {
        try {
          console.log(`Syncing form ID ${form.id} to ${apiUrl}/api/form`);
          
          const response = await fetch(`${apiUrl}/api/form`, {
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
            }),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(15000)
          });
          
          if (!response.ok) {
            throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            await deleteForm(form.id); // Delete instead of just marking as synced
            results.push({ id: form.id, success: true });
            console.log(`Successfully synced form ID ${form.id}`);
          } else {
            results.push({ id: form.id, success: false, error: result.message });
            console.error(`Failed to sync form ID ${form.id}:`, result.message);
          }
        } catch (error) {
          results.push({ id: form.id, success: false, error: error.message });
          console.error(`Error syncing form ID ${form.id}:`, error);
        }
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Failed to sync forms with server:', error);
    return { success: false, error: error.message };
  }
};
