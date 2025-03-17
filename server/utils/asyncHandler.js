// utils/asyncHandler.js - Utility to handle async errors in Express

/**
 * Async handler utility to eliminate try-catch blocks in route handlers
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Express middleware function that catches errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;