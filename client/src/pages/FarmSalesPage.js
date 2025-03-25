import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOffline } from '../context/OfflineContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OfflineAlert from '../components/common/OfflineAlert';
import SubmissionList from '../components/submissions/SubmissionList';
import SubmissionDetails from '../components/submissions/SubmissionDetails';
import { fetchSubmissions, deleteSubmission, checkHealth } from '../services/api';

/**
 * Farm Sales Page component to display form submissions
 * Enhanced with server wake-up handling for Render platform
 * @param {object} props - Component props
 * @param {object} props.formData - Form data that was just submitted
 */
function FarmSalesPage({ formData }) {
  const { isOffline, pendingForms, setPendingForms } = useOffline();
  
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [messageAnalyses, setMessageAnalyses] = useState({});
  const [deleteStatus, setDeleteStatus] = useState({ inProgress: false, error: null });
  const [serverWaking, setServerWaking] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  
  // Sync pending forms with server when online
  const syncPendingForms = async () => {
    if (isOffline || pendingForms.length === 0) return;
    
    try {
      // Import the IndexedDB helper dynamically
      const { syncForms } = await import('../utils/indexedDBHelper');
      const result = await syncForms();
      
      if (result.success) {
        // Refresh submissions after sync
        loadSubmissions();
        setPendingForms([]); // Clear pending forms after successful sync
        
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Forms Synced', {
            body: `Successfully synced ${result.results?.length || 0} form(s) with the server.`,
            icon: '/logo192.png'
          });
        }
      }
    } catch (error) {
      console.error('Error syncing forms:', error);
    }
  };
  
  // Effect to sync forms and load submissions when online status changes
  useEffect(() => {
    if (!isOffline) {
      syncPendingForms();
      loadSubmissions();
    }
  }, [isOffline]);
  
  // Load submissions when component mounts
  useEffect(() => {
    loadSubmissions();
  }, []);
  
  // Function to check server health
  const checkServerHealth = async () => {
    try {
      console.log('Checking server health...');
      setServerWaking(true);
      
      const health = await checkHealth();
      console.log('Server health response:', health);
      
      setHealthStatus(health);
      
      if (health.mongodb !== 'Connected') {
        console.warn('MongoDB not connected:', health.mongodb);
        // Keep server waking status true to indicate issues
      } else {
        setServerWaking(false);
      }
      
      return health;
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({ status: 'error', error: error.message });
      // Keep server waking status true to indicate issues
      return null;
    }
  };
  
  // Function to load submissions from server or cache
  const loadSubmissions = async () => {
    setLoading(true);
    setLoadError(null);
    
    try {
      // Check server health first
      await checkServerHealth();
      
      // If offline, use cached data from IndexedDB instead
      if (isOffline) {
        // Import the IndexedDB helper dynamically
        const { getPendingForms } = await import('../utils/indexedDBHelper');
        const pendingFormsData = await getPendingForms();
        
        // Get cached submissions from service worker cache
        let cachedSubmissions = [];
        try {
          const cache = await caches.open('runtime-cache');
          const response = await cache.match('/api/form');
          
          if (response) {
            const data = await response.json();
            if (data.success) {
              cachedSubmissions = data.data || [];
            }
          }
        } catch (cacheError) {
          console.error('Error getting cached submissions:', cacheError);
        }
        
        // Combine cached submissions with pending forms
        const combinedData = [
          ...pendingFormsData.map(form => ({
            ...form,
            _id: form.id,
            isPending: true
          })),
          ...cachedSubmissions
        ];
        
        setSubmissions(combinedData);
        
        // Set selected submission
        if (combinedData.length > 0) {
          setSelectedSubmission(combinedData[0]);
        } else if (formData) {
          setSelectedSubmission({...formData, isPending: true});
        }
        
        setLoading(false);
        return;
      }
      
      // Online path - fetch from server with cold start handling
      try {
        // Handle potential server wake-up time
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request is taking longer than expected. The server might be waking up.')), 5000)
        );
        
        const resultPromise = fetchSubmissions();
        
        try {
          // First try with shorter timeout
          const result = await Promise.race([resultPromise, timeoutPromise]);
          setServerWaking(false);
          
          if (result.success) {
            // Process result normally
            const combinedData = [
              ...pendingForms.map(form => ({
                ...form,
                _id: form.id,
                isPending: true
              })),
              ...result.data
            ];
            
            setSubmissions(combinedData);
            
            // Set selected submission
            if (combinedData.length > 0) {
              setSelectedSubmission(combinedData[0]);
            } else if (formData) {
              setSelectedSubmission({...formData, isPending: true});
            }
          } else {
            throw new Error(result.message || 'Failed to load submissions');
          }
        } catch (timeoutError) {
          if (timeoutError.message.includes('taking longer')) {
            // If timed out due to server waking up, show message but keep waiting
            console.log('Server seems to be waking up, continuing to wait for the actual response...');
            
            // Update UI to show server is waking up
            setServerWaking(true);
            
            // Continue with the original promise
            const result = await resultPromise;
            setServerWaking(false);
            
            if (result.success) {
              // Process result normally after extended wait
              const combinedData = [
                ...pendingForms.map(form => ({
                  ...form,
                  _id: form.id,
                  isPending: true
                })),
                ...result.data
              ];
              
              setSubmissions(combinedData);
              
              // Set selected submission
              if (combinedData.length > 0) {
                setSelectedSubmission(combinedData[0]);
              } else if (formData) {
                setSelectedSubmission({...formData, isPending: true});
              }
            } else {
              throw new Error(result.message || 'Failed to load submissions');
            }
          } else {
            // For other errors, re-throw
            throw timeoutError;
          }
        }
      } catch (error) {
        setServerWaking(false);
        throw error;
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setLoadError(
        error.name === 'AbortError'
          ? 'Connection to server timed out. The server might be starting up. Please wait a moment and try again.'
          : `Error loading submissions: ${error.message}`
      );
      
      // Still show pending forms in case of error
      if (pendingForms.length > 0) {
        const pendingData = pendingForms.map(form => ({
          ...form,
          _id: form.id,
          isPending: true
        }));
        
        setSubmissions(pendingData);
        
        if (pendingData.length > 0) {
          setSelectedSubmission(pendingData[0]);
        } else if (formData) {
          setSelectedSubmission({...formData, isPending: true});
        }
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle submission deletion
  const handleDelete = async (submissionId, index) => {
    // Set delete in progress for this item
    setDeleteStatus({ inProgress: true, error: null });
    
    try {
      // Check if this is a pending form in IndexedDB
      const isPending = submissions[index].isPending;
      
      if (isPending) {
        // Delete from IndexedDB
        const { deleteForm } = await import('../utils/indexedDBHelper');
        await deleteForm(submissionId);
        
        // Update local state
        const newSubmissions = [...submissions];
        newSubmissions.splice(index, 1);
        setSubmissions(newSubmissions);
        
        // Update selected submission if needed
        if (selectedSubmission === submissions[index]) {
          if (newSubmissions.length > 0) {
            setSelectedSubmission(newSubmissions[0]);
          } else {
            setSelectedSubmission(null);
          }
        }
        
        // Update pending forms state
        setPendingForms(prev => prev.filter(form => form.id !== submissionId));
        
        return;
      }
      
      // If offline and trying to delete a server-side submission, show error
      if (isOffline && !isPending) {
        throw new Error('Cannot delete server submissions while offline');
      }
      
      // Online path - delete from server
      try {
        const result = await deleteSubmission(submissionId);
        
        if (result.success) {
          // Update local state after successful deletion
          const newSubmissions = [...submissions];
          newSubmissions.splice(index, 1);
          setSubmissions(newSubmissions);
          
          // Update selected submission if needed
          if (selectedSubmission === submissions[index]) {
            if (newSubmissions.length > 0) {
              setSelectedSubmission(newSubmissions[0]);
            } else {
              setSelectedSubmission(null);
            }
          }
        } else {
          throw new Error(result.message || 'Failed to delete submission');
        }
      } catch (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      setDeleteStatus({
        inProgress: false,
        error: error.name === 'AbortError'
          ? 'Connection to server timed out. Please check if the server is running.'
          : `Failed to delete: ${error.message}`
      });
    } finally {
      // Clear delete status after a delay
      setTimeout(() => {
        setDeleteStatus({ inProgress: false, error: null });
      }, 3000);
    }
  };
  
  // Function to store message analysis results
  const handleAnalysisComplete = (message, analysisResult) => {
    setMessageAnalyses(prev => ({
      ...prev,
      [message]: analysisResult
    }));
  };
  
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-8 text-center">
        <h1 className="text-3xl font-bold text-green-800 mb-6">Farm Sales Information</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <LoadingSpinner size="lg" text="Loading submissions..." />
        </div>
      </div>
    );
  }
  
  if (loadError && submissions.length === 0) {
    return (
      <div className="max-w-6xl mx-auto mt-8">
        <h1 className="text-3xl font-bold text-green-800 mb-6">Farm Sales Information</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
            <p><strong>Error:</strong> {loadError}</p>
          </div>
          {serverWaking && (
            <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded mb-4">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>The server appears to be waking up. This might take a few seconds on the first load...</p>
              </div>
            </div>
          )}
          <button 
            onClick={loadSubmissions} 
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (submissions.length === 0 && !formData) {
    return (
      <div className="max-w-6xl mx-auto mt-8 text-center">
        <h1 className="text-3xl font-bold text-green-800 mb-6">Farm Sales Information</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p>No submission data available. Please fill out the contact form.</p>
          <Link to="/" className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Go to Contact Form
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto mt-8">
      <h1 className="text-3xl font-bold text-green-800 mb-6">Farm Sales Information</h1>
      
      <OfflineAlert />
      
      {serverWaking && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          <div className="flex items-center">
            <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p>The server appears to be waking up. This might take a few seconds to fully load...</p>
          </div>
        </div>
      )}
      
      {healthStatus && healthStatus.mongodb && healthStatus.mongodb !== 'Connected' && (
        <div className="mb-4 p-3 bg-orange-100 border border-orange-400 text-orange-800 rounded">
          <p><strong>Database Status:</strong> {healthStatus.mongodb}. Some features may be limited.</p>
        </div>
      )}
      
      {deleteStatus.error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {deleteStatus.error}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left side - All Submissions */}
        <div className="md:w-2/5">
          <SubmissionList 
            submissions={submissions}
            selectedSubmission={selectedSubmission}
            onSelectSubmission={setSelectedSubmission}
            onDeleteSubmission={handleDelete}
            deleteStatus={deleteStatus}
            onRefresh={loadSubmissions}
          />
        </div>
        
        {/* Right side - Selected Submission Details */}
        <div className="md:w-3/5">
          <SubmissionDetails 
            submission={selectedSubmission}
            messageAnalyses={messageAnalyses}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </div>
      </div>
      
      {/* Sync button for offline submissions */}
      {!isOffline && pendingForms.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={syncPendingForms}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Sync {pendingForms.length} Pending Submission{pendingForms.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

export default FarmSalesPage;
