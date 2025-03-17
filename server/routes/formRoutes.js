// routes/formRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const validateFormData = require('../middleware/validateFormData');
const deepseekService = require('../services/deepseekService');
const FormSubmission = require('../models/FormSubmission');

// Get all form submissions
router.get('/form', asyncHandler(async (req, res) => {
  const submissions = await FormSubmission.find().sort({ submittedAt: -1 });
  
  res.status(200).json({
    success: true,
    count: submissions.length,
    data: submissions
  });
}));

// Submit new form data
router.post('/form', validateFormData, asyncHandler(async (req, res) => {
  const formData = req.body;
  
  // Create form submission in database
  const submission = await FormSubmission.create(formData);
  
  res.status(201).json({
    success: true,
    data: submission
  });
}));

// Message analysis endpoint
router.post('/analyze-message', asyncHandler(async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required'
    });
  }
  
  try {
    // Call AI analysis through the service
    const analysisResult = await deepseekService.analyzeMessage(message);
    
    if (analysisResult.error) {
      return res.status(500).json({
        success: false,
        error: analysisResult.message
      });
    }
    
    res.json({
      success: true,
      analysis: {
        sentiment: analysisResult.sentiment || 'neutral',
        keywords: analysisResult.keywords || [],
        suggestion: analysisResult.summary || 'Thank you for your message. We will respond shortly.'
      }
    });
  } catch (error) {
    console.error('Error analyzing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze message'
    });
  }
}));

// Check AI service status
router.get('/ai-status', asyncHandler(async (req, res) => {
  const status = await deepseekService.checkAvailability();
  
  res.status(200).json({
    success: status.available,
    message: status.message,
    available: status.available
  });
}));

// Add this route to handle deletion of form submissions
router.delete('/form/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if ID is valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid submission ID format'
    });
  }
  
  // Attempt to find and delete the submission
  const deletedSubmission = await FormSubmission.findByIdAndDelete(id);
  
  if (!deletedSubmission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Submission deleted successfully'
  });
}));

module.exports = router;