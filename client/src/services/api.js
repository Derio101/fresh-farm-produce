/**
 * API service for form submissions
 */

// Get the API URL from environment variables or use a default
export const getApiUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:5002';
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
    throw error;
  }
};

/**
 * Fetch all form submissions
 * @returns {Promise} - API response with submissions data
 */
export const fetchSubmissions = async () => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/form`, {
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });
  
  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
};

/**
 * Delete a submission by ID
 * @param {string} submissionId - ID of submission to delete
 * @returns {Promise} - API response
 */
export const deleteSubmission = async (submissionId) => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/form/${submissionId}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });
  
  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
};