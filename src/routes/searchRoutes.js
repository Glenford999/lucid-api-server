const express = require('express');
const deepseekController = require('../controllers/deepseekController');

const router = express.Router();

// Search for products (using DeepSeek API)
router.post('/', deepseekController.productSearch);

// GET endpoint for simple queries via URL
router.get('/', (req, res) => {
  if (!req.query.q) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }
  
  // Convert GET to POST format internally
  const searchRequest = {
    query: req.query.q,
    filters: {}
  };
  
  // Add filters if provided as query parameters
  if (req.query.min_price || req.query.max_price) {
    searchRequest.filters.price_range = {};
    if (req.query.min_price) {
      searchRequest.filters.price_range.min = parseInt(req.query.min_price, 10);
    }
    if (req.query.max_price) {
      searchRequest.filters.price_range.max = parseInt(req.query.max_price, 10);
    }
  }
  
  // Set request body for the controller
  req.body = searchRequest;
  
  // Call the controller method
  deepseekController.productSearch(req, res);
});

module.exports = router; 