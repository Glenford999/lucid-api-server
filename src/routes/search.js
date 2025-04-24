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
  
  console.log('Checking DeepSeek API key configuration...');
  console.log(`API key available: ${!!apiKey}`);
  console.log(`API key length: ${apiKey ? apiKey.length : 0}`);
  console.log(`Is production: ${config.isProduction}`);
  console.log(`Features object: ${JSON.stringify(config.features || {})}`);
  
  if (!apiKey) {
    // Return a service unavailable error
    console.log('API key not configured, returning service unavailable error');
    return res.status(503).json({
      success: false,
      error: 'Search API is currently unavailable. API key not configured.'
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
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    console.log(`Processing search request for query: ${query}`);
    
    // Generate a request ID for tracking
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Make API calls to DeepSeek 
    try {
      // Import the API request utility
      const apiRequest = require('../utils/api-request');
      console.log('Making DeepSeek API request for query:', query);
      
      // Call the DeepSeek API
      const apiResponse = await apiRequest.makeDeepSeekRequest('/v1/product/search', config.deepseekApiKey, { query });
      
      // Check if the request was successful
      if (apiResponse.success && apiResponse.data) {
        console.log('DeepSeek API request successful');
        return res.json(apiResponse.data);
      } else {
        console.error('DeepSeek API request failed:', apiResponse.error);
        throw new Error(`DeepSeek API request failed: ${apiResponse.error}`);
      }
    } catch (apiError) {
      console.error('Error calling DeepSeek API:', apiError.message);
      
      // Return error instead of fallback data
      return res.status(502).json({
        success: false,
        error: 'Failed to get search results from API service',
        error_details: apiError.message
      });
    }
  } catch (error) {
    console.error('Error processing search request:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process search request',
      details: config.isProduction ? undefined : error.message
    });
  }
});

// GET /api/search - Support for GET requests
router.get('/', checkApiKeysMiddleware, async (req, res) => {
  try {
    const query = req.query.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    console.log(`Processing GET search request for query: ${query}`);
    
    // Generate a request ID for tracking
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Make API calls to DeepSeek 
    try {
      // Import the API request utility
      const apiRequest = require('../utils/api-request');
      console.log('Making DeepSeek API request for query (GET):', query);
      
      // Call the DeepSeek API
      const apiResponse = await apiRequest.makeDeepSeekRequest('/v1/product/search', config.deepseekApiKey, { query });
      
      // Check if the request was successful
      if (apiResponse.success && apiResponse.data) {
        console.log('DeepSeek API request successful (GET)');
        return res.json(apiResponse.data);
      } else {
        console.error('DeepSeek API request failed (GET):', apiResponse.error);
        throw new Error(`DeepSeek API request failed: ${apiResponse.error}`);
      }
    } catch (apiError) {
      console.error('Error calling DeepSeek API (GET):', apiError.message);
      
      // Return error instead of fallback data
      return res.status(502).json({
        success: false,
        error: 'Failed to get search results from API service',
        error_details: apiError.message
      });
    }
  } catch (error) {
    console.error('Error processing GET search request:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process search request',
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

// GET /api/search/diagnostic - For checking API configuration
router.get('/diagnostic', async (req, res) => {
  try {
    // Load the API request utility
    const apiRequest = require('../utils/api-request');
    
    // Check API key configuration
    const apiKeyConfigured = !!config.deepseekApiKey;
    const apiKeyLength = config.deepseekApiKey ? config.deepseekApiKey.length : 0;
    const apiEndpoint = config.deepseekApiEndpoint || 'https://api.deepseek.com';
    
    // Test the API connection if key is available
    let connectionTestResult = false;
    let connectionError = null;
    
    if (apiKeyConfigured) {
      try {
        connectionTestResult = await apiRequest.testDeepSeekApiConnection(
          config.deepseekApiKey, 
          apiEndpoint
        );
      } catch (testError) {
        connectionError = testError.message;
      }
    }
    
    // Return diagnostic information
    res.json({
      api_key_configured: apiKeyConfigured,
      api_key_length: apiKeyLength,
      api_endpoint: apiEndpoint,
      connection_test: connectionTestResult,
      connection_error: connectionError,
      environment: process.env.NODE_ENV || 'development',
      is_production: config.isProduction,
      google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
      server_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in diagnostic endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Diagnostic check failed',
      details: error.message
    });
  }
});

module.exports = router; 