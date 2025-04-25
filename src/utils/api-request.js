/**
 * API Request Utilities
 * Handles connections to external APIs like DeepSeek and OpenAI
 */

const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Function to sanitize an API key to prevent header issues
 * @param {string} apiKey - The API key to sanitize
 * @returns {string} Sanitized API key
 */
function sanitizeApiKey(apiKey) {
  if (!apiKey) return '';
  
  // Remove any newlines, carriage returns, control characters, and trim whitespace
  return apiKey.trim()
    .replace(/\r?\n|\r/g, '')        // Remove newlines and carriage returns
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, '');            // Remove any remaining whitespace
}

/**
 * Tests the connection to the DeepSeek API
 * 
 * @param {string} apiKey - The DeepSeek API key
 * @param {string} apiEndpoint - The base endpoint for the DeepSeek API
 * @returns {Promise<boolean>} - True if connection is successful, false otherwise
 */
async function testDeepSeekApiConnection(apiKey, apiEndpoint) {
  if (!apiKey) {
    logger.error('Cannot test DeepSeek API connection: No API key provided');
    return false;
  }

  // Generate a request ID for tracing
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  logger.info(`[${requestId}] Testing DeepSeek API connection to: ${apiEndpoint}`);
  
  // Clean the API key to ensure it doesn't contain invalid characters
  const sanitizedApiKey = sanitizeApiKey(apiKey);
  
  // Validate the sanitized key
  if (!sanitizedApiKey) {
    logger.error(`[${requestId}] API key sanitization failed - value became empty`);
    return false;
  }
  
  try {
    // Try various health endpoints since different APIs may use different paths
    const healthEndpoints = [
      '/health',
      '/v1/health',
      '/api/health',
      '/api/v1/health',
      '/status'
    ];
    
    logger.info(`[${requestId}] Trying multiple health endpoints...`);
    
    // Normalize API endpoint (remove trailing slash)
    const baseUrl = apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint;
    logger.debug(`[${requestId}] Normalized base URL: ${baseUrl}`);
    
    for (const endpoint of healthEndpoints) {
      try {
        const url = `${baseUrl}${endpoint}`;
        logger.info(`[${requestId}] Testing health endpoint: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });
        
        logger.info(`[${requestId}] DeepSeek API connection test response from ${endpoint}: ${response.status}`);
        
        if (response.status === 200 || response.status === 204) {
          logger.info(`[${requestId}] DeepSeek API connection test successful`);
          return true;
        }
      } catch (endpointError) {
        logger.warn(`[${requestId}] Health endpoint ${endpoint} failed: ${endpointError.message}`);
        // Continue to try the next endpoint
      }
    }
    
    // Try a fallback method - check if the API is available by attempting
    // a simple product search (some APIs don't have health endpoints)
    try {
      logger.info(`[${requestId}] Trying fallback API endpoint test...`);
      const testUrl = `${baseUrl}/api/v1/product/search`;
      
      const testResponse = await axios.post(testUrl, 
        { query: 'test', max_tokens: 10 },
        {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      
      if (testResponse.status < 400) {
        logger.info(`[${requestId}] DeepSeek API fallback test successful`);
        return true;
      }
    } catch (fallbackError) {
      logger.warn(`[${requestId}] Fallback API test failed: ${fallbackError.message}`);
    }
    
    logger.error(`[${requestId}] All DeepSeek API connection tests failed`);
    return false;
  } catch (error) {
    logger.error(`[${requestId}] Error testing DeepSeek API connection:`, error.message);
    if (error.response) {
      logger.error(`[${requestId}] Response status: ${error.response.status}`);
      logger.debug(`[${requestId}] Response data:`, error.response.data);
    } else if (error.code) {
      logger.error(`[${requestId}] Error code: ${error.code}`);
    }
    return false;
  }
}

/**
 * Tests the connection to the OpenAI API
 * 
 * @param {string} apiKey - The OpenAI API key
 * @param {string} apiEndpoint - The base endpoint for the OpenAI API
 * @returns {Promise<boolean>} - True if connection is successful, false otherwise
 */
async function testOpenAIApiConnection(apiKey, apiEndpoint) {
  if (!apiKey) {
    logger.error('Cannot test OpenAI API connection: No API key provided');
    return false;
  }

  // Generate a request ID for tracing
  const requestId = `test_openai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    logger.info(`[${requestId}] Testing OpenAI API connection to: ${apiEndpoint}`);
    
    // Clean the API key to ensure it doesn't contain invalid characters
    const sanitizedApiKey = sanitizeApiKey(apiKey);
    
    // Try to connect to the API models endpoint
    const response = await axios.get(`${apiEndpoint}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${sanitizedApiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    logger.info(`[${requestId}] OpenAI API connection test response status: ${response.status}`);
    
    if (response.status === 200) {
      logger.info(`[${requestId}] OpenAI API connection test successful`);
      return true;
    } else {
      logger.error(`[${requestId}] OpenAI API connection test failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error(`[${requestId}] Error testing OpenAI API connection:`, error.message);
    if (error.response) {
      logger.error(`[${requestId}] Response status: ${error.response.status}`);
      logger.debug(`[${requestId}] Response data:`, error.response.data);
    }
    return false;
  }
}

/**
 * Makes a request to the DeepSeek API
 * 
 * @param {string} endpoint - The endpoint to call (e.g., "/v1/product/search")
 * @param {string} apiKey - The DeepSeek API key
 * @param {object} payload - The request payload
 * @returns {Promise<object>} - The response data
 */
async function makeDeepSeekRequest(endpoint, apiKey, payload) {
  // Generate a request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  logger.info(`[${requestId}] Making DeepSeek API request to endpoint: ${endpoint}`);
  
  if (!apiKey) {
    logger.error(`[${requestId}] No API key provided for DeepSeek request`);
    return {
      success: false,
      error: 'API key is required',
      request_id: requestId
    };
  }
  
  // Clean the API key to ensure it doesn't contain invalid characters
  const sanitizedApiKey = sanitizeApiKey(apiKey);
  
  // Ensure the sanitized key isn't empty after cleaning
  if (!sanitizedApiKey) {
    logger.error(`[${requestId}] API key sanitization issue - value became empty`);
    return {
      success: false,
      error: 'API key validation failed',
      request_id: requestId
    };
  }
  
  try {
    // Get the base URL from configuration, ensure it doesn't have a trailing slash
    let baseUrl = config.deepseekApiEndpoint || 'https://api.deepseek.ai';
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Ensure endpoint starts with a slash
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Generate the full URL
    const apiUrl = `${baseUrl}${normalizedEndpoint}`;
    
    logger.info(`[${requestId}] Full API URL: ${apiUrl}`);
    logger.debug(`[${requestId}] Request payload keys: ${Object.keys(payload).join(', ')}`);
    
    // Create the request headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sanitizedApiKey}`,
      'X-Request-ID': requestId,
      'Accept': 'application/json'
    };
    
    // Make the request
    logger.info(`[${requestId}] Sending request to DeepSeek API...`);
    const response = await axios.post(apiUrl, payload, {
      headers,
      timeout: 30000 // 30 second timeout
    });
    
    logger.info(`[${requestId}] Received response with status: ${response.status}`);
    
    // Return the response data
    return {
      success: true,
      data: response.data,
      status: response.status,
      request_id: requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] Error making DeepSeek API request:`, error.message);
    
    // Log detailed error information
    if (error.response) {
      logger.error(`[${requestId}] Response status: ${error.response.status}`);
      logger.debug(`[${requestId}] Response headers:`, error.response.headers);
      logger.debug(`[${requestId}] Response data:`, error.response.data);
    } else if (error.request) {
      logger.error(`[${requestId}] No response received, request made`);
    } else {
      logger.error(`[${requestId}] Error setting up request:`, error.message);
    }
    
    // Try with alternate endpoint patterns if the error is a 404
    if (error.response && error.response.status === 404) {
      logger.info(`[${requestId}] Got 404, trying alternate endpoint patterns...`);
      
      // Get the base URL - reuse from above to ensure consistency
      let baseUrl = config.deepseekApiEndpoint || 'https://api.deepseek.ai';
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      // Clean the endpoint (remove leading slash)
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
      
      // Common DeepSeek API endpoint patterns to try
      const alternateEndpoints = [
        `/v1/${cleanEndpoint}`,
        `/api/${cleanEndpoint}`,
        `/api/v1/${cleanEndpoint}`,
        `/api/product/search`, // Specific to product search
        `/v1/product/search`,  // Specific to product search
        `/product/search`      // Specific to product search
      ];
      
      // Try each alternate pattern
      for (const altEndpoint of alternateEndpoints) {
        try {
          const altFullUrl = `${baseUrl}${altEndpoint}`;
          logger.info(`[${requestId}] Trying alternate endpoint: ${altFullUrl}`);
          
          // Important: Reuse sanitizedApiKey variable that we defined earlier
          const altResponse = await axios.post(altFullUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sanitizedApiKey}`, // Use the sanitized variable
              'X-Request-ID': requestId,
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          logger.info(`[${requestId}] Alternate endpoint succeeded with status: ${altResponse.status}`);
          
          return {
            success: true,
            data: altResponse.data,
            status: altResponse.status,
            request_id: requestId,
            endpoint_used: altEndpoint
          };
        } catch (altError) {
          logger.info(`[${requestId}] Alternate endpoint failed: ${altError.message}`);
        }
      }
    }
    
    // Check if network-related error
    if (error.code) {
      logger.error(`[${requestId}] Network-related error: ${error.code}`);
      
      // Provide more specific error messages for common network issues
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Connection refused. The API server rejected the connection.',
          error_code: error.code,
          request_id: requestId,
          status: 503
        };
      } else if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Connection timed out. The API server took too long to respond.',
          error_code: error.code,
          request_id: requestId,
          status: 504
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'DNS lookup failed. The API domain could not be resolved.',
          error_code: error.code,
          request_id: requestId,
          status: 502
        };
      }
    }
    
    // Return the error details
    return {
      success: false,
      error: error.message,
      status: error.response ? error.response.status : 500,
      error_data: error.response ? error.response.data : null,
      error_code: error.code || 'UNKNOWN',
      request_id: requestId
    };
  }
}

module.exports = {
  sanitizeApiKey,
  testDeepSeekApiConnection,
  testOpenAIApiConnection,
  makeDeepSeekRequest
}; 