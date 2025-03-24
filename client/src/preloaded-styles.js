// client/src/preload-styles.js

/**
 * Preload critical CSS styles to prevent layout shifts
 * This helps improve CLS (Cumulative Layout Shift) score
 */

// Define critical CSS properties for containers
const criticalStyles = {
  // Main app container
  '.app-container': {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  },
  
  // Content wrapper
  '.content-wrapper': {
    flex: '1',
  },
  
  // Footer to prevent shifts
  'footer': {
    flexShrink: '0'
  },
  
  // Fix for loading indicators
  '.loading-container': {
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

// Apply critical styles immediately
const injectStyles = () => {
  const styleElement = document.createElement('style');
  let styleText = '';
  
  // Convert object to CSS text
  Object.entries(criticalStyles).forEach(([selector, properties]) => {
    styleText += `${selector} {`;
    Object.entries(properties).forEach(([property, value]) => {
      // Convert camelCase to kebab-case
      const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      styleText += `${cssProperty}: ${value};`;
    });
    styleText += '}\n';
  });
  
  styleElement.textContent = styleText;
  document.head.appendChild(styleElement);
};

// Run immediately
injectStyles();

export default {};