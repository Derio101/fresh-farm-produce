// middleware/validateFormData.js - Validation middleware for form data

const validateFormData = (req, res, next) => {
  const { name, email, phone, message, interestedProducts } = req.body;
  const errors = {};

  // Validate name
  if (!name || !name.trim()) {
    errors.name = 'Name is required';
  }

  // Validate email
  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'Email is invalid';
  }

  // Validate phone
  if (!phone) {
    errors.phone = 'Phone number is required';
  } else if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
    errors.phone = 'Phone number must have 10 digits';
  }

  // Validate message
  if (!message || !message.trim()) {
    errors.message = 'Message is required';
  }

  // Validate interestedProducts
  if (!interestedProducts || !Array.isArray(interestedProducts) || interestedProducts.length === 0) {
    errors.interestedProducts = 'Please select at least one product';
  }

  // Return errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = validateFormData;

// middleware/errorHandler.js - Global error handling middleware

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const errors = {};
    
    for (const field in err.errors) {
      errors[field] = err.errors[field].message;
    }
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate data found',
      error: `${Object.keys(err.keyValue)[0]} already exists`
    });
  }

  // Default error response
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    error: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;