import React, { useState } from 'react';
import { useOffline } from '../../context/OfflineContext';
import { submitForm } from '../../services/api';

/**
 * Contact form component with validation and offline support
 * @param {object} props - Component props
 * @param {Function} props.onSubmitSuccess - Callback function on successful submission
 */
function ContactForm({ onSubmitSuccess }) {
  const { isOffline } = useOffline();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
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
          const { saveFormForLater } = await import('../../utils/indexedDBHelper');
          
          // Save form data to IndexedDB for later submission
          await saveFormForLater(formData);
          
          // Register for background sync if available
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('submit-form');
          }
          
          onSubmitSuccess(formData);
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
        const result = await submitForm(formData);
        
        if (result.success) {
          onSubmitSuccess(formData);
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
            const { saveFormForLater } = await import('../../utils/indexedDBHelper');
            
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
  
  return (
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
  );
}

export default ContactForm;