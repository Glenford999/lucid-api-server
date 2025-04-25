/**
 * API Routes for testing and diagnostics
 */
const express = require('express');
const router = express.Router();

// Import controllers
let testController;
try {
  testController = require('../controllers/testController');
} catch (err) {
  console.error('Failed to load testController:', err.message);
  testController = {
    testDeepSeekConnection: (req, res) => {
      return res.status(503).json({
        success: false,
        message: 'Test controller not available',
        error: err.message
      });
    }
  };
}

// Test DeepSeek API connection
router.get('/test/deepseek', testController.testDeepSeekConnection);

module.exports = router; 