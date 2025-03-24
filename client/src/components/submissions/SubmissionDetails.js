import React from 'react';
import { useOffline } from '../../context/OfflineContext';
import MessageAnalysis from '../MessageAnalysis';

/**
 * Submission details component to display details of a selected submission
 * @param {object} props - Component props
 * @param {object} props.submission - The selected submission to display
 * @param {object} props.messageAnalyses - Cached message analyses
 * @param {Function} props.onAnalysisComplete - Callback when message analysis completes
 */
function SubmissionDetails({ submission, messageAnalyses, onAnalysisComplete }) {
  const { isOffline } = useOffline();
  
  if (!submission) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600">Select a submission from the list to view details.</p>
      </div>
    );
  }

  // Get cached analysis for the current message if it exists
  const getCurrentAnalysis = (message) => {
    return messageAnalyses[message] || null;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-green-700 mb-4">
        Submission Details
        {submission.isPending && (
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
            <p className="font-medium">{submission.name}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm">Email:</p>
            <p className="font-medium">{submission.email}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm">Phone:</p>
            <p className="font-medium">{submission.phone}</p>
          </div>
          
          {submission.timestamp && (
            <div>
              <p className="text-gray-600 text-sm">Submitted:</p>
              <p className="font-medium">
                {new Date(submission.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Customer Message</h3>
        <p className="bg-gray-50 p-3 rounded">{submission.message}</p>
        
        {/* Only show message analysis if online or we have a cached analysis */}
        {(!isOffline || getCurrentAnalysis(submission.message)) && (
          <MessageAnalysis 
            message={submission.message}
            autoAnalyze={false}
            initialAnalysis={getCurrentAnalysis(submission.message)}
            onAnalysisComplete={(analysis) => 
              onAnalysisComplete(submission.message, analysis)
            }
          />
        )}
        
        {isOffline && !getCurrentAnalysis(submission.message) && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-gray-700 text-sm">
            <p>Message analysis is unavailable while offline.</p>
          </div>
        )}
      </div>
      
      <div className="mt-6 p-4 bg-green-50 rounded-md">
        <p className="font-medium text-green-800">
          {submission.isPending 
            ? "This submission will be processed once you're back online."
            : "One of our representatives will contact this customer soon with more information about our fresh farm products!"}
        </p>
      </div>
    </div>
  );
}

export default SubmissionDetails;