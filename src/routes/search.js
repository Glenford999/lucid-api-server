/**
 * Search API Routes
 * Handles product search functionality
 */

const express = require('express');
const router = express.Router();
const config = require('../config/config');
const apiRequest = require('../utils/api-request');
const logger = require('../utils/logger');

// Define the standard prompt template just once
const PROMPT_TEMPLATE = `You are an expert Shopping Research Assistant called Lucid Search. Analyze and return 6 optimal products for: [USER_QUERY_HERE]. Follow these steps:

1. Conduct comprehensive research across:
   - Professional review websites
   - Verified customer reviews from major e-commerce platforms
   - Forum discussions (Reddit, specialized communities)
   - YouTube video comparisons and expert analyses

2. For each product, structure findings with:
   - Comparative strengths/weaknesses against top competitors
   - Price analysis across multiple retailers
   - Authentic review sentiment aggregation

3. Format response as JSON with this exact structure:
{
  "products": [
    {
      "product_name": "Full product name",
      "image_url": "Direct image link to product",
      "average_price": Average market price in decimal,
      "star_rating": 0.0-5.0 rating,
      "review_count": Total reviews aggregated,
      "pros": "Detailed paragraph comparing strengths to competitors",
      "cons": "Detailed paragraph comparing weaknesses to competitors",
      "purchasing_options": [
        {
          "retailer_name": "Retailer brand",
          "retailer_url": "Direct product page URL",
          "price": Current price in decimal,
          "is_lowest_price": true/false,
          "is_reputable": true/false
        }
      ]
    }
  ]
}

Requirements:
- Include EXACTLY 4 purchasing options per product (2 lowest price, 2 reputable)
- Currency must match product's primary market (e.g., GBP, USD)
- Ensure all URLs are current and functional
- Use snake_case for all JSON keys
- Pros/cons must contain comparative analysis phrases like:
  'Compared to [Competitor], this product...'
  'While [Alternative] offers X, this model...'
- Prioritize recent reviews (<18 months) and current pricing
- Exclude markdown formatting
- Validate JSON syntax`;

// Common endpoint paths to try - expanded with more possibilities
const ENDPOINTS_TO_TRY = [
  'v1/product/search',
  'api/v1/product/search',
  'product/search',
  'api/product/search',  // Additional endpoint
  'search/product',      // Additional endpoint
  'search',              // Simplified endpoint
  'v1/search'            // Simplified endpoint with version
];

// Simple middleware to check if API keys are configured
const checkApiKeysMiddleware = (req, res, next) => {
  const apiKey = config.deepseekApiKey;
  
  logger.info('Checking DeepSeek API key configuration');
  logger.debug(`API key available: ${!!apiKey}, Length: ${apiKey ? apiKey.length : 0}`);
  
  if (!apiKey) {
    // Return a service unavailable error
    logger.warn('API key not configured, returning service unavailable error');
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

/**
 * Prepares API request payload with query and prompt 
 * @param {string} query - User search query
 * @param {object} options - Additional options like context, filters, preferences
 * @returns {object} Formatted payload for the API
 */
function prepareApiPayload(query, options = {}) {
  // Replace placeholder with actual query
  const enhancedPrompt = PROMPT_TEMPLATE.replace('[USER_QUERY_HERE]', query);
  
  return {
    query,
    prompt: enhancedPrompt,
    temperature: 0.3,
    max_tokens: 4000,
    context: options.context || { search_type: 'product' },
    filters: options.filters || {},
    preferences: options.preferences || { include_pros_cons: true }
  };
}

/**
 * Try multiple endpoints for the DeepSeek API request
 * @param {string} requestId - Request ID for tracking
 * @param {string} query - Search query
 * @param {object} payload - API request payload 
 * @returns {Promise<object>} API response or null if all fail
 */
async function tryMultipleEndpoints(requestId, query, payload) {
  logger.info(`[${requestId}] Making DeepSeek API request for query: ${query}`);
  
  // If multiple API endpoints are configured, try them in sequence
  let alternativeEndpoints = [];
  if (config.deepseekApiAlternatives && Array.isArray(config.deepseekApiAlternatives)) {
    alternativeEndpoints = config.deepseekApiAlternatives.filter(
      endpoint => endpoint !== config.deepseekApiEndpoint
    );
  }
  
  let successfulResponse = null;
  let lastError = null;
  
  // Try each endpoint pattern with the primary API endpoint
  logger.info(`[${requestId}] Trying primary API endpoint: ${config.deepseekApiEndpoint}`);
  for (const endpointPath of ENDPOINTS_TO_TRY) {
    if (successfulResponse) break;
    
    logger.info(`[${requestId}] Trying endpoint path: ${endpointPath}`);
    
    try {
      // Call the DeepSeek API
      const apiResponse = await apiRequest.makeDeepSeekRequest(endpointPath, config.deepseekApiKey, payload);
      
      // Check if the request was successful
      if (apiResponse.success && apiResponse.data) {
        logger.info(`[${requestId}] DeepSeek API request successful using endpoint: ${endpointPath}`);
        successfulResponse = apiResponse;
        break;
      } else {
        logger.error(`[${requestId}] DeepSeek API request failed for endpoint ${endpointPath}:`, apiResponse.error);
        lastError = apiResponse.error || 'Unknown error';
      }
    } catch (endpointError) {
      logger.error(`[${requestId}] Error trying endpoint ${endpointPath}:`, endpointError.message);
      lastError = endpointError.message;
    }
  }
  
  // If primary endpoint failed, try alternative API endpoints
  if (!successfulResponse && alternativeEndpoints.length > 0) {
    logger.info(`[${requestId}] Primary endpoint failed, trying ${alternativeEndpoints.length} alternative API endpoints`);
    
    for (const altApiEndpoint of alternativeEndpoints) {
      if (successfulResponse) break;
      
      logger.info(`[${requestId}] Trying alternative API endpoint: ${altApiEndpoint}`);
      
      // Try each endpoint pattern with this alternative API endpoint
      for (const endpointPath of ENDPOINTS_TO_TRY) {
        if (successfulResponse) break;
        
        try {
          // Override the config temporarily to use the alternative endpoint
          const originalEndpoint = config.deepseekApiEndpoint;
          config.deepseekApiEndpoint = altApiEndpoint;
          
          // Call the DeepSeek API with the alternative endpoint
          const apiResponse = await apiRequest.makeDeepSeekRequest(endpointPath, config.deepseekApiKey, payload);
          
          // Restore the original endpoint
          config.deepseekApiEndpoint = originalEndpoint;
          
          if (apiResponse.success && apiResponse.data) {
            logger.info(`[${requestId}] DeepSeek API request successful using alternative endpoint: ${altApiEndpoint}/${endpointPath}`);
            successfulResponse = apiResponse;
            
            // Update the primary endpoint to use the working alternative for future requests
            config.deepseekApiEndpoint = altApiEndpoint;
            logger.info(`[${requestId}] Updated primary endpoint to: ${altApiEndpoint}`);
            break;
          }
        } catch (altError) {
          logger.error(`[${requestId}] Error trying alternative endpoint ${altApiEndpoint}/${endpointPath}:`, altError.message);
          lastError = altError.message;
        }
      }
    }
  }
  
  if (!successfulResponse && lastError) {
    logger.error(`[${requestId}] All API endpoints failed. Last error: ${lastError}`);
  }
  
  return successfulResponse;
}

/**
 * Handle API error responses consistently
 * @param {*} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {*} details - Additional error details
 * @returns Express response
 */
function sendErrorResponse(res, status, message, details = null) {
  const response = {
    success: false,
    error: message
  };
  
  if (details && !config.isProduction) {
    response.details = details;
  }
  
  // Add troubleshooting info for API connectivity issues
  if (status === 502 || status === 503) {
    response.troubleshooting = {
      api_key_configured: !!config.deepseekApiKey,
      api_endpoint: config.deepseekApiEndpoint,
      timestamp: new Date().toISOString()
    };
  }
  
  return res.status(status).json(response);
}

// POST /api/search
router.post('/', checkApiKeysMiddleware, async (req, res) => {
  try {
    const query = req.body?.query;
    
    if (!query) {
      return sendErrorResponse(res, 400, 'Query parameter is required');
    }
    
    logger.info(`Processing search request for query: ${query}`);
    
    // Generate a request ID for tracking
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Make API calls to DeepSeek
    try {
      // Prepare the payload for the DeepSeek API
      const payload = prepareApiPayload(query, {
        context: req.body.context,
        filters: req.body.filters,
        preferences: req.body.preferences
      });
      
      // Try multiple endpoints
      const successfulResponse = await tryMultipleEndpoints(requestId, query, payload);
      
      if (successfulResponse) {
        return res.json(successfulResponse.data);
      } else {
        throw new Error('All API endpoints failed');
      }
    } catch (apiError) {
      logger.error(`[${requestId}] Error calling DeepSeek API:`, apiError.message);
      
      // Return error instead of fallback data
      return sendErrorResponse(res, 502, 'Failed to get search results from API service', apiError.message);
    }
  } catch (error) {
    logger.error('Error processing search request:', error.message);
    return sendErrorResponse(res, 500, 'Failed to process search request', error.message);
  }
});

// GET /api/search - Support for GET requests
router.get('/', checkApiKeysMiddleware, async (req, res) => {
  try {
    const query = req.query.query || req.query.q;
    
    if (!query) {
      return sendErrorResponse(res, 400, 'Query parameter is required');
    }
    
    logger.info(`Processing GET search request for query: ${query}`);
    
    // Generate a request ID for tracking
    const requestId = `search_get_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Make API calls to DeepSeek
    try {
      // Prepare the payload for the DeepSeek API
      const payload = prepareApiPayload(query);
      
      // Try multiple endpoints
      const successfulResponse = await tryMultipleEndpoints(requestId, query, payload);
      
      if (successfulResponse) {
        return res.json(successfulResponse.data);
      } else {
        throw new Error('All API endpoints failed');
      }
    } catch (apiError) {
      logger.error(`[${requestId}] Error calling DeepSeek API (GET):`, apiError.message);
      
      // Return error instead of fallback data
      return sendErrorResponse(res, 502, 'Failed to get search results from API service', apiError.message);
    }
  } catch (error) {
    logger.error('Error processing GET search request:', error.message);
    return sendErrorResponse(res, 500, 'Failed to process search request', error.message);
  }
});

// GET /api/search/status
router.get('/status', (req, res) => {
  const apiConfigured = !!config.deepseekApiKey;
  
  res.json({
    status: apiConfigured ? 'ready' : 'not_configured',
    api_available: apiConfigured,
    api_endpoint: config.deepseekApiEndpoint,
    synthetic_fallback: false, // Never use synthetic fallback
    message: apiConfigured ? 
      'Search API is ready' : 
      'Search API is not fully configured. Service may be unavailable.'
  });
});

// GET /api/search/diagnostic - For checking API configuration
router.get('/diagnostic', async (req, res) => {
  try {
    // Check API key configuration
    const apiKeyConfigured = !!config.deepseekApiKey;
    const apiKeyLength = config.deepseekApiKey ? config.deepseekApiKey.length : 0;
    const apiEndpoint = config.deepseekApiEndpoint || 'https://api.deepseek.com';
    
    // Test the API connection if key is available
    let connectionTestResult = false;
    let connectionError = null;
    let testedEndpoints = [];
    
    if (apiKeyConfigured) {
      try {
        // Try to test the connection
        const testResult = await apiRequest.testDeepSeekApiConnection(
          config.deepseekApiKey, 
          apiEndpoint
        );
        
        connectionTestResult = testResult;
        
        // If test failed, try alternative endpoints
        if (!connectionTestResult && config.deepseekApiAlternatives) {
          for (const altEndpoint of config.deepseekApiAlternatives) {
            if (altEndpoint === apiEndpoint) continue;
            
            logger.info(`Diagnostic: Trying alternative endpoint: ${altEndpoint}`);
            testedEndpoints.push(altEndpoint);
            
            try {
              const altTestResult = await apiRequest.testDeepSeekApiConnection(
                config.deepseekApiKey,
                altEndpoint
              );
              
              if (altTestResult) {
                connectionTestResult = true;
                logger.info(`Diagnostic: Alternative endpoint successful: ${altEndpoint}`);
                
                // Update the primary endpoint to use this working alternative
                config.deepseekApiEndpoint = altEndpoint;
                logger.info(`Diagnostic: Updated primary endpoint to: ${altEndpoint}`);
                break;
              }
            } catch (altError) {
              logger.warn(`Diagnostic: Alternative endpoint failed: ${altEndpoint}`);
            }
          }
        }
      } catch (testError) {
        connectionError = testError.message;
        logger.error(`Diagnostic: API connection test error: ${testError.message}`);
      }
    }
    
    // Return diagnostic information
    res.json({
      api_key_configured: apiKeyConfigured,
      api_key_length: apiKeyLength,
      api_endpoint: apiEndpoint,
      connection_test: connectionTestResult,
      connection_error: connectionError,
      tested_endpoints: testedEndpoints,
      available_endpoints: config.deepseekApiAlternatives || [],
      environment: process.env.NODE_ENV || 'development',
      is_production: config.isProduction,
      google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
      server_time: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in diagnostic endpoint:', error);
    return sendErrorResponse(res, 500, 'Diagnostic check failed', error.message);
  }
});

module.exports = router; 