// models/FormSubmission.js - Updated to remove interestedProducts requirement
const mongoose = require('mongoose');

const formSubmissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\d{10}$/, 'Phone number must have 10 digits']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  // Making interestedProducts optional instead of required
  interestedProducts: {
    type: [String],
    default: [] // Set default to empty array
  },
  sentimentAnalysis: {
    type: Object,
    default: null
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

const FormSubmission = mongoose.model('FormSubmission', formSubmissionSchema);

module.exports = FormSubmission;