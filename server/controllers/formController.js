// server/controllers/formController.js
const FormSubmission = require('../models/FormSubmission');
const deepseekService = require('../services/deepseekService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Submit a new form with message analysis
 * @route POST /api/form
 * @access Public
 */
exports.submitForm = asyncHandler(async (req, res) => {
  const formData = req.body;
  
  // Create form submission in database
  const submission = await FormSubmission.create(formData);
  
  // If there's a message, analyze it
  let analysis = null;
  if (formData.message) {
    analysis = await deepseekService.analyzeMessage(formData.message);
  }
  
  res.status(201).json({
    success: true,
    data: submission,
    analysis
  });
});

/**
 * Get all form submissions
 * @route GET /api/form
 * @access Public
 */
exports.getFormSubmissions = asyncHandler(async (req, res) => {
  const submissions = await FormSubmission.find().sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: submissions.length,
    data: submissions
  });
});

/**
 * Analyze a message
 * @route POST /api/form/analyze
 * @access Public
 */
exports.analyzeMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a message to analyze'
    });
  }
  
  const analysis = await deepseekService.analyzeMessage(message);
  
  if (analysis.error) {
    return res.status(500).json({
      success: false,
      error: analysis.message,
      details: analysis
    });
  }
  
  res.status(200).json({
    success: true,
    data: analysis
  });
});

/**
 * Check AI service availability
 * @route GET /api/form/ai-status
 * @access Public
 */
exports.checkAiStatus = asyncHandler(async (req, res) => {
  const status = await deepseekService.checkAvailability();
  
  res.status(200).json({
    success: status.available,
    message: status.message,
    available: status.available
  });
});