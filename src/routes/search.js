/**
 * Search API Routes
 * Handles product search functionality
 */

const express = require('express');
const router = express.Router();
const config = require('../config/config');
const apiRequest = require('../utils/api-request');
const logger = require('../utils/logger');
const axios = require('axios'); // For direct API testing

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
  
  // Log partial API key for debugging (first/last 3 chars only)
  if (apiKey && apiKey.length > 6) {
    const firstThree = apiKey.substring(0, 3);
    const lastThree = apiKey.substring(apiKey.length - 3);
    logger.debug(`API key format: ${firstThree}...${lastThree}, Length: ${apiKey.length}`);
  } else {
    logger.debug(`API key available: ${!!apiKey}, Length: ${apiKey ? apiKey.length : 0}`);
  }
  
  if (!apiKey) {
    // Return a service unavailable error
    logger.warn('API key not configured, returning service unavailable error');
    return res.status(503).json({
      success: false,
      error: 'Search API is currently unavailable. API key not configured.',
      troubleshooting: {
        check_env: "DEEPSEEK_API_KEY environment variable is missing or empty",
        check_secret_manager: "Verify Secret Manager setup for 'DEEPSEEK_API_KEY'",
        google_project: process.env.GOOGLE_CLOUD_PROJECT || "not set"
      }
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
 * Test a single API endpoint directly
 * @param {string} baseUrl - Base API URL
 * @param {string} endpoint - Endpoint to test
 * @param {string} apiKey - API key to use
 * @returns {Promise<object>} Test result
 */
async function testApiEndpoint(baseUrl, endpoint, apiKey) {
  const url = `${baseUrl}${endpoint}`;
  logger.info(`Testing endpoint directly: ${url}`);
  
  try {
    const response = await axios.post(
      url,
      {
        query: 'test query',
        max_tokens: 100,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return {
      success: true,
      status: response.status,
      data: { 
        hasProducts: !!(response.data && response.data.products),
        products: response.data && response.data.products ? response.data.products.length : 0 
      }
    };
  } catch (error) {
    return {
      success: false,
      status: error.response ? error.response.status : 'no response',
      error: error.message,
      errorCode: error.code,
      errorDetails: error.response ? error.response.data : null
    };
  }
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
  let lastEndpoint = null;
  let tries = 0;
  
  // Try each endpoint pattern with the primary API endpoint
  logger.info(`[${requestId}] Trying primary API endpoint: ${config.deepseekApiEndpoint}`);
  for (const endpointPath of ENDPOINTS_TO_TRY) {
    tries++;
    if (successfulResponse) break;
    
    logger.info(`[${requestId}] Trying endpoint path: ${endpointPath}`);
    lastEndpoint = endpointPath;
    
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
        tries++;
        if (successfulResponse) break;
        
        lastEndpoint = `${altApiEndpoint}/${endpointPath}`;
        
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
    logger.error(`[${requestId}] All API endpoints failed (${tries} attempts). Last error: ${lastError}`);
  }
  
  return {
    response: successfulResponse,
    error: lastError,
    lastEndpoint: lastEndpoint,
    tryCount: tries
  };
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
    error: message,
    timestamp: new Date().toISOString()
  };
  
  if (details && !config.isProduction) {
    response.details = details;
  }
  
  // Add troubleshooting info for API connectivity issues
  if (status === 502 || status === 503) {
    response.troubleshooting = {
      api_key_configured: !!config.deepseekApiKey,
      api_key_length: config.deepseekApiKey ? config.deepseekApiKey.length : 0,
      api_endpoint: config.deepseekApiEndpoint,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      diagnostics_url: '/api/search/deep-diagnostics'
    };
  }
  
  return res.status(status).json(response);
}

/**
 * Use mock data if real API fails
 * @param {string} query Search query
 * @returns Mock search response
 */
function generateFallbackResponse(query) {
  return {
    success: true,
    source: "fallback",
    results: [
      {
        id: "fallback_prod_1",
        name: `Fallback Product for "${query}"`,
        description: "This is a fallback product shown when the API is unavailable",
        rating: { value: 4.2, count: 85 },
        price: { value: 99.99, currency: "USD", formatted: "$99.99" },
        image_url: "https://via.placeholder.com/300x200?text=Fallback+Product",
        pros: "Not a real product, but available when the API is down.",
        cons: "Limited details since this is a fallback mechanism.",
        purchasing_options: [
          { retailer_name: "Example Store", price: 99.99, retailer_url: "https://example.com" }
        ]
      },
      {
        id: "fallback_prod_2",
        name: `Another Result for "${query}"`,
        description: "Backup product result",
        rating: { value: 3.8, count: 42 },
        price: { value: 79.99, currency: "USD", formatted: "$79.99" },
        image_url: "https://via.placeholder.com/300x200?text=Backup+Product",
        pros: "Available regardless of API status.",
        cons: "Not real product data.",
        purchasing_options: [
          { retailer_name: "Sample Shop", price: 79.99, retailer_url: "https://example.com/shop" }
        ]
      }
    ],
    query: query,
    total_results: 2,
    message: "Showing fallback results due to API service unavailability."
  };
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
      const result = await tryMultipleEndpoints(requestId, query, payload);
      
      if (result.response) {
        return res.json(result.response.data);
      } else {
        // If allowFallback is specifically set to true, return fallback data
        if (req.body.allowFallback === true) {
          logger.info(`[${requestId}] Using fallback data for query: ${query}`);
          return res.json(generateFallbackResponse(query));
        }
        
        throw new Error(`All API endpoints failed after ${result.tryCount} attempts. Last error: ${result.error}`);
      }
    } catch (apiError) {
      logger.error(`[${requestId}] Error calling DeepSeek API:`, apiError.message);
      
      // Return more detailed error to help troubleshoot
      return sendErrorResponse(res, 502, 'Failed to get search results from API service', {
        error: apiError.message,
        request_id: requestId,
        api_endpoint: config.deepseekApiEndpoint,
        endpoints_tried: ENDPOINTS_TO_TRY.length,
        last_error: apiError.message
      });
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
      const result = await tryMultipleEndpoints(requestId, query, payload);
      
      if (result.response) {
        return res.json(result.response.data);
      } else {
        // If allowFallback is specifically set to true, return fallback data
        if (req.query.allowFallback === 'true') {
          logger.info(`[${requestId}] Using fallback data for query: ${query}`);
          return res.json(generateFallbackResponse(query));
        }
        
        throw new Error(`All API endpoints failed after ${result.tryCount} attempts. Last error: ${result.error}`);
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
      server_time: new Date().toISOString(),
      diagnostics_url: '/api/search/deep-diagnostics'
    });
  } catch (error) {
    logger.error('Error in diagnostic endpoint:', error);
    return sendErrorResponse(res, 500, 'Diagnostic check failed', error.message);
  }
});

// GET /api/search/deep-diagnostics - For detailed API testing
router.get('/deep-diagnostics', async (req, res) => {
  try {
    logger.info('Running deep diagnostics for API connectivity');
    
    // Check environment variables
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV || 'not set',
        google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
        region: process.env.REGION || 'not set',
        port: process.env.PORT || '8080',
        host: req.headers.host,
        user_agent: req.headers['user-agent'],
      },
      config: {
        api_key_available: !!config.deepseekApiKey,
        api_key_length: config.deepseekApiKey ? config.deepseekApiKey.length : 0,
        api_endpoint: config.deepseekApiEndpoint,
        api_alternatives: config.deepseekApiAlternatives || []
      },
      tests: {
        health_check: null,
        direct_api_call: null,
        endpoint_tests: []
      }
    };
    
    // Only run tests if API key is available
    if (config.deepseekApiKey) {
      // Test health endpoint (standard health check)
      try {
        const healthCheck = await apiRequest.testDeepSeekApiConnection(
          config.deepseekApiKey,
          config.deepseekApiEndpoint
        );
        diagnostics.tests.health_check = healthCheck;
      } catch (healthError) {
        diagnostics.tests.health_check = {
          success: false,
          error: healthError.message
        };
      }
      
      // Try a direct API call for each endpoint
      const baseUrl = config.deepseekApiEndpoint.endsWith('/') ? 
        config.deepseekApiEndpoint.slice(0, -1) : 
        config.deepseekApiEndpoint;
      
      // Test each endpoint directly
      for (const endpoint of [
        '/api/v1/product/search',
        '/v1/product/search',
        '/product/search'
      ]) {
        try {
          const endpointTest = await testApiEndpoint(
            baseUrl,
            endpoint,
            config.deepseekApiKey
          );
          
          diagnostics.tests.endpoint_tests.push({
            endpoint,
            result: endpointTest
          });
          
          // If successful, record it
          if (endpointTest.success) {
            diagnostics.tests.direct_api_call = {
              success: true,
              working_endpoint: endpoint
            };
            break;  // Found a working endpoint, don't need to test more
          }
        } catch (endpointError) {
          diagnostics.tests.endpoint_tests.push({
            endpoint,
            result: {
              success: false,
              error: endpointError.message
            }
          });
        }
      }
      
      // Test alternative endpoints if primary failed
      if (!diagnostics.tests.direct_api_call && config.deepseekApiAlternatives) {
        for (const altEndpoint of config.deepseekApiAlternatives) {
          if (altEndpoint === baseUrl) continue;
          
          const altBaseUrl = altEndpoint.endsWith('/') ? 
            altEndpoint.slice(0, -1) : 
            altEndpoint;
          
          // Test first endpoint with alternative base URL
          try {
            const altTest = await testApiEndpoint(
              altBaseUrl,
              '/api/v1/product/search',
              config.deepseekApiKey
            );
            
            diagnostics.tests.endpoint_tests.push({
              endpoint: `${altBaseUrl}/api/v1/product/search`,
              result: altTest
            });
            
            if (altTest.success) {
              diagnostics.tests.direct_api_call = {
                success: true,
                working_endpoint: `${altBaseUrl}/api/v1/product/search`,
                message: 'Alternative endpoint succeeded'
              };
              
              // Update the primary endpoint for future requests
              config.deepseekApiEndpoint = altBaseUrl;
              break;
            }
          } catch (altError) {
            // Just log the error, don't stop testing
            logger.error(`Alternative endpoint test failed: ${altError.message}`);
          }
        }
      }
    }
    
    res.json(diagnostics);
  } catch (error) {
    logger.error('Error in deep diagnostics endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Error running diagnostics',
      error_message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 