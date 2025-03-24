import React from 'react';
import { useOffline } from '../../context/OfflineContext';

/**
 * Submission list component to display all form submissions
 * @param {object} props - Component props
 * @param {Array} props.submissions - List of submissions to display
 * @param {object} props.selectedSubmission - Currently selected submission
 * @param {Function} props.onSelectSubmission - Callback when submission is selected
 * @param {Function} props.onDeleteSubmission - Callback when delete button is clicked
 * @param {object} props.deleteStatus - Status of delete operation
 * @param {Function} props.onRefresh - Callback when refresh button is clicked
 */
function SubmissionList({ 
  submissions, 
  selectedSubmission, 
  onSelectSubmission, 
  onDeleteSubmission, 
  deleteStatus,
  onRefresh 
}) {
  const { isOffline } = useOffline();
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-green-700">All Submissions</h2>
        <button 
          onClick={isOffline ? null : onRefresh}
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
                  onClick={() => onSelectSubmission(submission)}
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
                          onDeleteSubmission(submission._id || submission.id, index);
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
  );
}

export default SubmissionList;