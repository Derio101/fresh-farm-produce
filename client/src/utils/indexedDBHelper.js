// client/src/utils/indexedDBHelper.js

const DB_NAME = 'FreshFarmDB';
const DB_VERSION = 1;
const FORM_STORE = 'pendingForms';

// Single source of truth for API URL
import { getApiUrl } from '../services/api';

/**
 * Class to manage IndexedDB operations
 */
class IndexedDBManager {
  constructor() {
    this.dbPromise = null;
  }
  
  /**
   * Get database connection - reuses existing connection if available
   * @returns {Promise<IDBDatabase>} IndexedDB database instance
   */
  async getDB() {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('Error opening IndexedDB:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
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
    
    return this.dbPromise;
  }
  
  /**
   * Execute a transaction on a store
   * @param {string} storeName - Name of the object store
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @param {Function} callback - Function to execute with the store
   * @returns {Promise<any>} Result of the transaction
   */
  async executeTransaction(storeName, mode, callback) {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        
        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = (event) => {
          console.error(`Transaction error on ${storeName}:`, event.target.error);
          reject(event.target.error);
        };
        
        callback(store, resolve, reject);
      });
    } catch (error) {
      console.error(`Failed to execute transaction on ${storeName}:`, error);
      throw error;
    }
  }
  
  /**
   * Save a form submission for later syncing
   * @param {object} formData - Form data to save
   * @returns {Promise<number>} ID of the saved form
   */
  async saveForm(formData) {
    let formId;
    
    await this.executeTransaction(FORM_STORE, 'readwrite', (store, resolve, reject) => {
      // Add timestamp to track when the form was submitted
      const dataToStore = {
        ...formData,
        timestamp: Date.now(),
        synced: false
      };
      
      const request = store.add(dataToStore);
      
      request.onsuccess = (event) => {
        formId = event.target.result;
        resolve();
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
    
    return formId;
  }
  
  /**
   * Get all pending form submissions
   * @returns {Promise<Array>} Array of pending forms
   */
  async getAllForms() {
    let forms = [];
    
    await this.executeTransaction(FORM_STORE, 'readonly', (store, resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        forms = request.result;
        resolve();
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
    
    return forms;
  }
  
  /**
   * Update a form's sync status
   * @param {number} formId - ID of the form to update
   * @param {boolean} synced - New sync status
   * @returns {Promise<boolean>} Success status
   */
  async updateFormSyncStatus(formId, synced) {
    let success = false;
    
    await this.executeTransaction(FORM_STORE, 'readwrite', (store, resolve, reject) => {
      const getRequest = store.get(formId);
      
      getRequest.onsuccess = () => {
        const form = getRequest.result;
        if (form) {
          form.synced = synced;
          
          const updateRequest = store.put(form);
          
          updateRequest.onsuccess = () => {
            success = true;
            resolve();
          };
          
          updateRequest.onerror = (event) => {
            reject(event.target.error);
          };
        } else {
          reject(new Error(`Form with ID ${formId} not found`));
        }
      };
      
      getRequest.onerror = (event) => {
        reject(event.target.error);
      };
    });
    
    return success;
  }
  
  /**
   * Delete a form from IndexedDB
   * @param {number} formId - ID of form to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteForm(formId) {
    let success = false;
    
    await this.executeTransaction(FORM_STORE, 'readwrite', (store, resolve, reject) => {
      const request = store.delete(formId);
      
      request.onsuccess = () => {
        success = true;
        resolve();
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
    
    return success;
  }
  
  /**
   * Sync all pending forms with the server
   * @returns {Promise<object>} Sync results
   */
  async syncForms() {
    try {
      const pendingForms = await this.getAllForms();
      
      if (pendingForms.length === 0) {
        return { success: true, message: 'No forms to sync' };
      }
      
      const results = [];
      const apiUrl = getApiUrl();
      
      console.log(`Syncing ${pendingForms.length} pending forms`);
      
      const syncPromises = pendingForms
        .filter(form => !form.synced)
        .map(async (form) => {
          try {
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
              signal: AbortSignal.timeout(15000)
            });
            
            if (!response.ok) {
              throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
              await this.deleteForm(form.id);
              results.push({ id: form.id, success: true });
            } else {
              results.push({ id: form.id, success: false, error: result.message });
            }
          } catch (error) {
            results.push({ id: form.id, success: false, error: error.message });
          }
        });
      
      await Promise.allSettled(syncPromises);
      
      return { success: true, results };
    } catch (error) {
      console.error('Failed to sync forms with server:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create a singleton instance
const dbManager = new IndexedDBManager();

// Export methods that match the original API for backward compatibility
export const initDB = () => dbManager.getDB();
export const saveFormForLater = (formData) => dbManager.saveForm(formData);
export const getPendingForms = () => dbManager.getAllForms();
export const markFormAsSynced = (formId) => dbManager.updateFormSyncStatus(formId, true);
export const deleteForm = (formId) => dbManager.deleteForm(formId);
export const syncForms = () => dbManager.syncForms();