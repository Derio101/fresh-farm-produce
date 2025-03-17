import React, { useState, useEffect, useCallback } from 'react';

const MessageAnalysis = ({ 
  message, 
  autoAnalyze = false, 
  initialAnalysis = null,
  onAnalysisComplete = () => {} 
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [error, setError] = useState(null);
  const [serviceAvailable, setServiceAvailable] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Function to check AI service availability
  const checkServiceAvailability = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/ai-status');
      const result = await response.json();
      setServiceAvailable(result.available);
      
      if (!result.available) {
        setError(`AI service unavailable: ${result.message}`);
      }
      
      return result.available;
    } catch (err) {
      console.error('Error checking AI service:', err);
      setServiceAvailable(false);
      setError('Cannot connect to AI service');
      return false;
    }
  };

  // Function to analyze message - wrapped in useCallback to stabilize the reference
  const analyzeMessage = useCallback(async () => {
    if (!message || analyzing) return;
    
    setAnalyzing(true);
    setError(null);
    
    // First check if the service is available
    const isAvailable = serviceAvailable === null ? await checkServiceAvailability() : serviceAvailable;
    
    if (!isAvailable) {
      setAnalyzing(false);
      return;
    }
    
    try {
      // Call your API endpoint for message analysis
      const response = await fetch('http://localhost:5001/api/analyze-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.analysis);
        // Call the callback with the analysis result
        onAnalysisComplete(result.analysis);
      } else {
        setError(result.error || 'Failed to analyze message');
      }
    } catch (err) {
      console.error('Error analyzing message:', err);
      setError('Error connecting to analysis service');
    } finally {
      setAnalyzing(false);
    }
  }, [message, analyzing, serviceAvailable, onAnalysisComplete]);

  // Check service availability when component mounts
  useEffect(() => {
    if (autoAnalyze && message) {
      checkServiceAvailability();
    }
  }, [autoAnalyze, message]);

  // Auto-analyze on component mount if autoAnalyze is true and service is available
  useEffect(() => {
    if (autoAnalyze && message && !analysis && serviceAvailable) {
      analyzeMessage();
    }
  }, [message, autoAnalyze, analysis, serviceAvailable, analyzeMessage]);

  if (!message) {
    return null;
  }

  // Get sentiment color class
  const getSentimentColorClass = (sentiment) => {
    if (!sentiment) return 'bg-gray-100 text-gray-800';
    
    switch(sentiment.toLowerCase()) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      case 'neutral':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-semibold text-green-700 mb-2">Message Analysis</h4>
        {analysis && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="text-blue-500 text-sm hover:text-blue-700"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
      
      {!analysis && !analyzing && !error && (
        <button
          onClick={analyzeMessage}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
          disabled={serviceAvailable === false}
        >
          Analyze Message
        </button>
      )}
      
      {analyzing && (
        <div className="flex items-center text-gray-600">
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Analyzing message...
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
          {error}
          {serviceAvailable === false && (
            <div className="mt-1 text-xs">
              Cannot connect to DeepSeek API. The API might be down or there could be network issues.
            </div>
          )}
          <button
            onClick={analyzeMessage}
            className="mt-2 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
      
      {analysis && (
        <div className={`bg-blue-50 p-3 rounded text-sm ${expanded ? '' : 'max-h-40 overflow-hidden relative'}`}>
          <div className="mb-2">
            <span className="font-medium">Sentiment:</span> 
            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getSentimentColorClass(analysis.sentiment)}`}>
              {analysis.sentiment || 'Unknown'}
            </span>
          </div>
          
          {analysis.keywords && analysis.keywords.length > 0 && (
            <div className="mb-2">
              <span className="font-medium">Key Topics:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {analysis.keywords.map((keyword, idx) => (
                  <span key={idx} className="bg-gray-200 px-2 py-1 rounded-full text-xs">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.suggestion && (
            <div>
              <span className="font-medium">Suggested Response:</span>
              <p className="mt-1 text-gray-700">{analysis.suggestion}</p>
              
              {expanded && (
                <button
                  className="mt-3 bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                  onClick={() => {
                    // Copy suggested response to clipboard
                    navigator.clipboard.writeText(analysis.suggestion)
                      .then(() => alert('Response copied to clipboard!'))
                      .catch(err => console.error('Failed to copy: ', err));
                  }}
                >
                  Copy Response
                </button>
              )}
            </div>
          )}
          
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-blue-50 to-transparent"></div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageAnalysis;