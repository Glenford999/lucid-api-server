/**
 * API Request Utilities
 * Handles connections to external APIs like DeepSeek and OpenAI
 */

const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

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

  try {
    logger.info(`Testing DeepSeek API connection to: ${apiEndpoint}`);
    
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    
    // Try various health endpoints since different APIs may use different paths
    const healthEndpoints = [
      '/health',
      '/v1/health',
      '/api/health',
      '/api/v1/health',
      '/status'
    ];
    
    logger.info(`Trying multiple health endpoints...`);
    
    for (const endpoint of healthEndpoints) {
      try {
        const url = `${apiEndpoint}${endpoint}`;
        logger.info(`Testing health endpoint: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });
        
        logger.info(`DeepSeek API connection test response from ${endpoint}: ${response.status}`);
        
        if (response.status === 200 || response.status === 204) {
          logger.info('DeepSeek API connection test successful');
          return true;
        }
      } catch (endpointError) {
        logger.warn(`Health endpoint ${endpoint} failed: ${endpointError.message}`);
        // Continue to try the next endpoint
      }
    }
    
    // Try a fallback method - check if the API is available by attempting
    // a simple product search (some APIs don't have health endpoints)
    try {
      logger.info('Trying fallback API endpoint test...');
      const testUrl = `${apiEndpoint}/api/v1/product/search`;
      
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
        logger.info('DeepSeek API fallback test successful');
        return true;
      }
    } catch (fallbackError) {
      logger.warn(`Fallback API test failed: ${fallbackError.message}`);
    }
    
    logger.error('All DeepSeek API connection tests failed');
    return false;
  } catch (error) {
    logger.error('Error testing DeepSeek API connection:', error.message);
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.debug(`Response data:`, error.response.data);
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

  try {
    logger.info(`Testing OpenAI API connection to: ${apiEndpoint}`);
    
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    
    // Try to connect to the API models endpoint
    const response = await axios.get(`${apiEndpoint}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${sanitizedApiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    logger.info(`OpenAI API connection test response status: ${response.status}`);
    
    if (response.status === 200) {
      logger.info('OpenAI API connection test successful');
      return true;
    } else {
      logger.error(`OpenAI API connection test failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error('Error testing OpenAI API connection:', error.message);
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.debug(`Response data:`, error.response.data);
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
  const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
  
  try {
    // Get the base URL from configuration, ensure it doesn't have a trailing slash
    let baseUrl = config.deepseekApiEndpoint || 'https://api.deepseek.com';
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
      let baseUrl = config.deepseekApiEndpoint || 'https://api.deepseek.com';
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
          
          // Important: Re-use the sanitizedApiKey variable here, instead of recreating it
          const altResponse = await axios.post(altFullUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sanitizedApiKey}`, // Use the sanitized API key from above
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
    
    // Return the error details
    return {
      success: false,
      error: error.message,
      status: error.response ? error.response.status : 500,
      error_data: error.response ? error.response.data : null,
      request_id: requestId
    };
  }
}

module.exports = {
  testDeepSeekApiConnection,
  testOpenAIApiConnection,
  makeDeepSeekRequest
}; 