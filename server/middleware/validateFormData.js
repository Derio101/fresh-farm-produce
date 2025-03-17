// middleware/validateFormData.js - Validation middleware for form data

const validateFormData = (req, res, next) => {
  const { name, email, phone, message } = req.body;
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

  // interestedProducts is now optional, so we don't validate it

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