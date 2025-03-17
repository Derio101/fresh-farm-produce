import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import MessageAnalysis from './components/MessageAnalysis'; // Import the MessageAnalysis component

// Main App Component
function App() {
  const [formData, setFormData] = useState(null);
  
  const handleFormSubmission = (data) => {
    setFormData(data);
  };

  return (
    <Router>
      <div className="min-h-screen bg-green-50">
        <Navbar />
        <div className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<IndexPage onFormSubmit={handleFormSubmission} />} />
            <Route 
              path="/farm-sales" 
              element={<FarmSalesPage formData={formData} />} 
            />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
}

// Navbar Component
function Navbar() {
  return (
    <nav className="bg-green-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold">Fresh Farm Produce</div>
        <ul className="flex space-x-6">
          <li>
            <Link to="/" className="hover:text-green-200">Home</Link>
          </li>
          <li>
            <Link to="/farm-sales" className="hover:text-green-200">Farm Sales</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

// Index Page with Dynamic Form and Offline Support
function IndexPage({ onFormSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Check online status when component mounts and when it changes
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when field is being edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Phone number must have 10 digits';
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (validateForm()) {
      setIsSubmitting(true);
      
      // Check if we're offline
      if (isOffline) {
        try {
          // Import the IndexedDB helper dynamically to avoid issues with SSR
          const { saveFormForLater } = await import('./utils/indexedDBHelper');
          
          // Save form data to IndexedDB for later submission
          await saveFormForLater(formData);
          
          // Register for background sync if available
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('submit-form');
          }
          
          onFormSubmit(formData);
          setSubmitted(true);
          setSubmitError(null);
          
          // Show notification that the form will be submitted when online
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Form Saved', {
              body: 'Your form has been saved and will be submitted when you are back online.',
              icon: '/logo192.png'
            });
          }
        } catch (error) {
          console.error('Error saving form for later:', error);
          setSubmitError('Failed to save form for offline submission. Please try again when you are online.');
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
      
      // Online submission path
      try {
        const response = await fetch('http://localhost:5001/api/form', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
          // Add timeout to prevent hanging if server is not responding
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          onFormSubmit(formData);
          setSubmitted(true);
        } else {
          // Handle validation errors from API
          setErrors(result.errors || {});
          setSubmitError(result.message || 'Form submission failed due to validation errors');
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        
        // If the error is due to network issues, try to save for later
        if (error.name === 'TypeError' || error.name === 'AbortError') {
          setSubmitError('Network error. Trying to save your form for later submission...');
          
          try {
            // Import the IndexedDB helper dynamically
            const { saveFormForLater } = await import('./utils/indexedDBHelper');
            
            // Save form data to IndexedDB for later submission
            await saveFormForLater(formData);
            
            // Update error message
            setSubmitError('Your form has been saved and will be submitted when you are back online.');
            
            // Register for background sync if available
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
              const registration = await navigator.serviceWorker.ready;
              await registration.sync.register('submit-form');
            }
          } catch (offlineError) {
            console.error('Error saving form for later:', offlineError);
            setSubmitError('Failed to save form. Please try again later when you are online.');
          }
        } else {
          setSubmitError(
            error.name === 'AbortError' 
              ? 'Connection to server timed out. Please check if the server is running and try again.' 
              : `Failed to submit form: ${error.message}`
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  if (submitted) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto mt-12">
        <h2 className="text-2xl font-bold text-green-800 mb-4">Thank You!</h2>
        <p className="mb-4">Your information has been submitted successfully.</p>
        {isOffline && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            You are currently offline. Your form has been saved and will be sent when you reconnect.
          </div>
        )}
        <p className="mb-4">Please visit the Farm Sales page to see your submitted data.</p>
        <Link to="/farm-sales" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Go to Farm Sales
        </Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-3xl font-bold text-green-800 mb-6">Contact Us</h1>
      
      {isOffline && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          <p className="flex items-center">
            <span className="mr-2">📡</span>
            You are currently offline. Your form will be saved and submitted when you reconnect.
          </p>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {submitError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2" htmlFor="name">
              Full Name
            </label>
            <input
              className={`w-full px-3 py-2 border rounded-md ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
            />
            {errors.name && <p className="text-red-500 mt-1">{errors.name}</p>}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              className={`w-full px-3 py-2 border rounded-md ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
            />
            {errors.email && <p className="text-red-500 mt-1">{errors.email}</p>}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2" htmlFor="phone">
              Phone Number
            </label>
            <input
              className={`w-full px-3 py-2 border rounded-md ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />
            {errors.phone && <p className="text-red-500 mt-1">{errors.phone}</p>}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2" htmlFor="message">
              Message
            </label>
            <textarea
              className={`w-full px-3 py-2 border rounded-md ${errors.message ? 'border-red-500' : 'border-gray-300'}`}
              id="message"
              name="message"
              rows="4"
              value={formData.message}
              onChange={handleChange}
              placeholder="Tell us what you're interested in"
            ></textarea>
            {errors.message && <p className="text-red-500 mt-1">{errors.message}</p>}
          </div>
          
          <button
            type="submit"
            className={`bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full flex justify-center items-center ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Updated FarmSalesPage with offline support
function FarmSalesPage({ formData }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [messageAnalyses, setMessageAnalyses] = useState({});
  const [deleteStatus, setDeleteStatus] = useState({ inProgress: false, error: null });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingForms, setPendingForms] = useState([]);
  
  // Check online status
  useEffect(() => {
    const handleOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      
      // If we just came back online, attempt to sync forms
      if (online) {
        syncPendingForms();
        fetchSubmissions();
      }
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  // Get pending forms from IndexedDB when component mounts
  useEffect(() => {
    const getPendingFormsFromDB = async () => {
      try {
        // Import the IndexedDB helper dynamically
        const { getPendingForms } = await import('./utils/indexedDBHelper');
        const forms = await getPendingForms();
        setPendingForms(forms);
      } catch (error) {
        console.error('Error getting pending forms:', error);
      }
    };
    
    getPendingFormsFromDB();
  }, []);
  
  // Sync pending forms with server when online
  const syncPendingForms = async () => {
    if (isOffline || pendingForms.length === 0) return;
    
    try {
      // Import the IndexedDB helper dynamically
      const { syncForms } = await import('./utils/indexedDBHelper');
      const result = await syncForms();
      
      if (result.success) {
        // Refresh submissions after sync
        fetchSubmissions();
        
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
  
  useEffect(() => {
    fetchSubmissions();
  }, []);
  
  const fetchSubmissions = async () => {
    setLoading(true);
    setLoadError(null);
    
    try {
      // If offline, use cached data from IndexedDB instead
      if (isOffline) {
        // Import the IndexedDB helper dynamically
        const { getPendingForms } = await import('./utils/indexedDBHelper');
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
      
      // Online path - fetch from server
      const response = await fetch('http://localhost:5001/api/form', {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Combine server submissions with pending forms
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
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setLoadError(
        error.name === 'AbortError'
          ? 'Connection to server timed out. Please check if the server is running.'
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
  
  const handleDelete = async (submissionId, index) => {
    // Set delete in progress for this item
    setDeleteStatus({ inProgress: true, error: null });
    
    try {
      // Check if this is a pending form in IndexedDB
      const isPending = submissions[index].isPending;
      
      if (isPending) {
        // Delete from IndexedDB
        const { deleteForm } = await import('./utils/indexedDBHelper');
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
      const response = await fetch(`http://localhost:5001/api/form/${submissionId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
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

  // Get the stored analysis for the current message if it exists
  const getCurrentAnalysis = (message) => {
    return messageAnalyses[message] || null;
  };
  
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-8 text-center">
        <h1 className="text-3xl font-bold text-green-800 mb-6">Farm Sales Information</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-center">
            <svg className="animate-spin h-10 w-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="mt-4">Loading submissions...</p>
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
          <button 
            onClick={fetchSubmissions} 
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
      
      {isOffline && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          <p className="flex items-center">
            <span className="mr-2">📡</span>
            You are currently offline. Some features may be limited.
          </p>
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-green-700">All Submissions</h2>
              <button 
                onClick={isOffline ? null : fetchSubmissions}
                className={`text-sm text-green-600 hover:text-green-800 ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isOffline ? "Cannot refresh while offline" : "Refresh submissions"}
                disabled={isOffline}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            {submissions.length === 0 ? (
              <p className="text-gray-600">No submissions found.</p>
            ) : (
              <div className="overflow-y-auto max-h-96">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-50">
                      <th className="p-2 border text-left">Name</th>
                      <th className="p-2 border text-left">Email</th>
                      <th className="p-2 border text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission, index) => (
                      <tr 
                        key={submission._id || index} 
                        className={`cursor-pointer hover:bg-green-50 ${
                          selectedSubmission === submission ? 'bg-green-100' : ''
                        } ${submission.isPending ? 'bg-yellow-50' : ''}`}
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        <td className="p-2 border">
                          {submission.name}
                          {submission.isPending && (
                            <span className="ml-2 inline-block px-1 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-2 border">{submission.email}</td>
                        <td className="p-2 border">
                          <button 
                            className={`text-red-600 hover:text-red-800 underline text-sm flex items-center ${deleteStatus.inProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row selection
                              if (!deleteStatus.inProgress) {
                                handleDelete(submission._id || submission.id, index);
                              }
                            }}
                            disabled={deleteStatus.inProgress}
                          >
                            {deleteStatus.inProgress ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Deleting...
                              </>
                              
                            ) : 'Delete'
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        {/* Right side - Selected Submission Details */}
        <div className="md:w-3/5">
          {selectedSubmission ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-green-700 mb-4">
                Submission Details
                {selectedSubmission.isPending && (
                  <span className="ml-2 inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    Pending Sync
                  </span>
                )}
              </h2>
              
              <div className="border-t border-b border-gray-200 py-4 mb-4">
                <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600 text-sm">Name:</p>
                    <p className="font-medium">{selectedSubmission.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600 text-sm">Email:</p>
                    <p className="font-medium">{selectedSubmission.email}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600 text-sm">Phone:</p>
                    <p className="font-medium">{selectedSubmission.phone}</p>
                  </div>
                  
                  {selectedSubmission.timestamp && (
                    <div>
                      <p className="text-gray-600 text-sm">Submitted:</p>
                      <p className="font-medium">
                        {new Date(selectedSubmission.timestamp).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Customer Message</h3>
                <p className="bg-gray-50 p-3 rounded">{selectedSubmission.message}</p>
                
                {/* Only show message analysis if online or we have a cached analysis */}
                {(!isOffline || getCurrentAnalysis(selectedSubmission.message)) && (
                  <MessageAnalysis 
                    message={selectedSubmission.message}
                    autoAnalyze={false}
                    initialAnalysis={getCurrentAnalysis(selectedSubmission.message)}
                    onAnalysisComplete={(analysis) => 
                      handleAnalysisComplete(selectedSubmission.message, analysis)
                    }
                  />
                )}
                
                {isOffline && !getCurrentAnalysis(selectedSubmission.message) && (
                  <div className="mt-4 p-3 bg-gray-100 rounded text-gray-700 text-sm">
                    <p>Message analysis is unavailable while offline.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 p-4 bg-green-50 rounded-md">
                <p className="font-medium text-green-800">
                  {selectedSubmission.isPending 
                    ? "This submission will be processed once you're back online."
                    : "One of our representatives will contact this customer soon with more information about our fresh farm products!"}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600">Select a submission from the list to view details.</p>
            </div>
          )}
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

// Footer Component
function Footer() {
  return (
    <footer className="bg-green-800 text-white p-4 mt-12">
      <div className="container mx-auto text-center">
        <p>&copy; {new Date().getFullYear()} Fresh Farm Produce. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default App;