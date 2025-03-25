/**
 * API service for form submissions with improved error handling and health checks
 */

// Get the API URL from environment variables or use a default
export const getApiUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:5002';
};

/**
 * Check server and database health
 * @returns {Promise} - API health check response
 */
export const checkHealth = async () => {
  const apiUrl = getApiUrl();
  try {
    console.log(`Checking health at ${apiUrl}/api/health`);
    const response = await fetch(`${apiUrl}/api/health`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

/**
 * Submit form data to the API
 * @param {object} formData - Form data to submit
 * @returns {Promise} - API response
 */
export const submitForm = async (formData) => {
  const apiUrl = getApiUrl();
  console.log(`Submitting form to ${apiUrl}/api/form`);
  console.log('Form data:', formData);
  
  try {
    const response = await fetch(`${apiUrl}/api/form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
      signal: AbortSignal.timeout(15000) // 15 second timeout for MongoDB operations
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Server returned ${response.status}: ${response.statusText}. ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Form submission error:', error);
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. The server might be starting up or experiencing issues.');
    } else if (!navigator.onLine) {
      throw new Error('You appear to be offline. Please check your internet connection.');
    } else {
      throw error;
    }
  }
};

/**
 * Fetch all form submissions with improved error handling
 * @returns {Promise} - API response with submissions data
 */
export const fetchSubmissions = async () => {
  const apiUrl = getApiUrl();
  console.log(`Fetching submissions from ${apiUrl}/api/form`);
  
  try {
    const response = await fetch(`${apiUrl}/api/form`, {
      signal: AbortSignal.timeout(15000) // Increased timeout for cold starts
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Server returned ${response.status}: ${response.statusText}. ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching submissions:', error);
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. The server might be starting up or experiencing issues.');
    } else if (!navigator.onLine) {
      throw new Error('You appear to be offline. Please check your internet connection.');
    } else {
      throw error;
    }
  }
};

/**
 * Delete a submission by ID with improved error handling
 * @param {string} submissionId - ID of submission to delete
 * @returns {Promise} - API response
 */
export const deleteSubmission = async (submissionId) => {
  const apiUrl = getApiUrl();
  console.log(`Deleting submission ${submissionId} from ${apiUrl}/api/form/${submissionId}`);
  
  try {
    const response = await fetch(`${apiUrl}/api/form/${submissionId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Server returned ${response.status}: ${response.statusText}. ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting submission:', error);
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. The server might be starting up or experiencing issues.');
    } else if (!navigator.onLine) {
      throw new Error('You appear to be offline. Please check your internet connection.');
    } else {
      throw error;
    }
  }
};
