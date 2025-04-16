/**
 * Search API Routes
 * Handles product search functionality
 */

const express = require('express');
const router = express.Router();
const config = require('../config/config');

// Simple middleware to check if API keys are configured
const checkApiKeysMiddleware = (req, res, next) => {
  const apiKey = config.deepseekApiKey;
  
  if (!apiKey) {
    // If no API key is configured, return a synthetic response in development
    if (!config.isProduction && !config.features.disableSyntheticFallback) {
      console.log('Using synthetic search response due to missing API key');
      return res.json(createSyntheticSearchResponse(req.body?.query || 'unknown query'));
    }
    
    // In production, return an error
    return res.status(503).json({
      error: true,
      message: 'Search API is currently unavailable. API key not configured.'
    });
  }
  
  next();
};

// Create a synthetic search response for development and testing
function createSyntheticSearchResponse(query) {
  const requestId = `synthetic_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const timestamp = new Date().toISOString();
  
  // Create some synthetic product data
  const products = [
    {
      productName: "Synthetic Product 1",
      description: "This is a synthetic product for testing when real API is unavailable",
      averageRating: 4.5,
      reviewCount: 120,
      price: 29.99,
      imageUrl: "https://example.com/placeholder1.jpg",
      retailers: [
        { name: "Store A", price: 29.99, url: "https://example.com/storeA" },
        { name: "Store B", price: 32.99, url: "https://example.com/storeB" }
      ],
      features: ["Feature 1", "Feature 2", "Feature 3"],
      pros: "Good quality, affordable",
      cons: "Limited availability"
    },
    {
      productName: "Synthetic Product 2",
      description: "Another synthetic product with different characteristics",
      averageRating: 3.8,
      reviewCount: 85,
      price: 49.99,
      imageUrl: "https://example.com/placeholder2.jpg",
      retailers: [
        { name: "Store C", price: 49.99, url: "https://example.com/storeC" },
        { name: "Store D", price: 45.99, url: "https://example.com/storeD" }
      ],
      features: ["Premium Feature 1", "Premium Feature 2"],
      pros: "High quality, durable",
      cons: "More expensive"
    }
  ];
  
  return {
    query: query,
    products: products,
    results: products, // Alternative format for compatibility
    success: true,
    timestamp: timestamp,
    request_id: requestId,
    source: 'synthetic',
    message: 'This is a synthetic response for development/testing'
  };
}

// POST /api/search
router.post('/', checkApiKeysMiddleware, async (req, res) => {
  try {
    const query = req.body?.query;
    
    if (!query) {
      return res.status(400).json({
        error: true,
        message: 'Query parameter is required'
      });
    }
    
    console.log(`Processing search request for query: ${query}`);
    
    // Generate a request ID for tracking
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // In a real implementation, we would call an external API or database here
    // For now, we'll use our synthetic data function
    if (!config.isProduction && !config.features.disableSyntheticFallback) {
      const response = createSyntheticSearchResponse(query);
      return res.json(response);
    } else {
      // Here you would make actual API calls to DeepSeek or other services
      // For example:
      // const apiRequest = require('../utils/api-request');
      // const response = await apiRequest.makeDeepSeekRequest('/v1/search', config.deepseekApiKey, { query });
      // return res.json(response.data);
      
      // For now, return synthetic data
      const response = createSyntheticSearchResponse(query);
      return res.json(response);
    }
  } catch (error) {
    console.error('Error processing search request:', error.message);
    
    return res.status(500).json({
      error: true,
      message: 'Failed to process search request',
      details: config.isProduction ? undefined : error.message
    });
  }
});

// GET /api/search/status
router.get('/status', (req, res) => {
  const apiConfigured = !!config.deepseekApiKey;
  
  res.json({
    status: apiConfigured ? 'ready' : 'not_configured',
    api_available: apiConfigured,
    synthetic_fallback: !config.isProduction && !config.features.disableSyntheticFallback,
    message: apiConfigured ? 
      'Search API is ready' : 
      'Search API is not fully configured. ' + 
      ((!config.isProduction && !config.features.disableSyntheticFallback) ? 
        'Using synthetic responses.' : 
        'Service may be unavailable.')
  });
});

module.exports = router; 