import React from 'react';

/**
 * Loading spinner component
 * @param {object} props - Component props
 * @param {string} props.size - Size of spinner (sm, md, lg)
 * @param {string} props.color - Color class for spinner (e.g., text-green-600)
 * @param {string} props.text - Optional loading text
 */
function LoadingSpinner({ size = 'md', color = 'text-green-600', text = null }) {
  // Map size to dimensions
  const sizeMap = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };
  
  const spinnerSize = sizeMap[size] || sizeMap.md;
  
  return (
    <div className="flex flex-col items-center justify-center">
      <svg 
        className={`animate-spin ${spinnerSize} ${color}`} 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        ></circle>
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {text && <p className="mt-2">{text}</p>}
    </div>
  );
}

export default LoadingSpinner;