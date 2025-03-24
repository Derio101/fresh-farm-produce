import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ContactForm from '../components/forms/ContactForm';
import OfflineAlert from '../components/common/OfflineAlert';

/**
 * Index page component with contact form
 * @param {object} props - Component props
 * @param {Function} props.onFormSubmit - Callback function when form is submitted
 */
function IndexPage({ onFormSubmit }) {
  const [submitted, setSubmitted] = useState(false);
  
  const handleFormSubmission = (formData) => {
    onFormSubmit(formData);
    setSubmitted(true);
  };
  
  if (submitted) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto mt-12">
        <h2 className="text-2xl font-bold text-green-800 mb-4">Thank You!</h2>
        <p className="mb-4">Your information has been submitted successfully.</p>
        
        <OfflineAlert message="You are currently offline. Your form has been saved and will be sent when you reconnect." />
        
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
      
      <OfflineAlert message="You are currently offline. Your form will be saved and submitted when you reconnect." />
      
      <ContactForm onSubmitSuccess={handleFormSubmission} />
    </div>
  );
}

export default IndexPage;