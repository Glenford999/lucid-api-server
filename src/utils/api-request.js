/**
 * API Request Utilities
 * Handles connections to external APIs like DeepSeek and OpenAI
 */

const axios = require('axios');
const config = require('../config/config');

/**
 * Tests the connection to the DeepSeek API
 * 
 * @param {string} apiKey - The DeepSeek API key
 * @param {string} apiEndpoint - The base endpoint for the DeepSeek API
 * @returns {Promise<boolean>} - True if connection is successful, false otherwise
 */
async function testDeepSeekApiConnection(apiKey, apiEndpoint) {
  if (!apiKey) {
    console.error('Cannot test DeepSeek API connection: No API key provided');
    return false;
  }

  try {
    console.log(`Testing DeepSeek API connection to: ${apiEndpoint}`);
    
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    
    // Try to connect to the API status endpoint
    const response = await axios.get(`${apiEndpoint}/health`, {
      headers: {
        'Authorization': `Bearer ${sanitizedApiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`DeepSeek API connection test response status: ${response.status}`);
    
    if (response.status === 200 || response.status === 204) {
      console.log('DeepSeek API connection test successful');
      return true;
    } else {
      console.error(`DeepSeek API connection test failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Error testing DeepSeek API connection:', error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
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
    console.error('Cannot test OpenAI API connection: No API key provided');
    return false;
  }

  try {
    console.log(`Testing OpenAI API connection to: ${apiEndpoint}`);
    
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    
    // Try to connect to the API models endpoint
    const response = await axios.get(`${apiEndpoint}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${sanitizedApiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`OpenAI API connection test response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('OpenAI API connection test successful');
      return true;
    } else {
      console.error(`OpenAI API connection test failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Error testing OpenAI API connection:', error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
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
  
  console.log(`[${requestId}] Making DeepSeek API request to endpoint: ${endpoint}`);
  
  if (!apiKey) {
    console.error(`[${requestId}] No API key provided for DeepSeek request`);
    return {
      success: false,
      error: 'API key is required',
      request_id: requestId
    };
  }
  
  try {
    // Clean the API key to ensure it doesn't contain invalid characters
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    
    // Get the base URL from configuration, ensure it doesn't have a trailing slash
    let baseUrl = config.deepseekApiEndpoint || 'https://api.deepseek.com';
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Ensure endpoint starts with a slash
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Generate the full URL
    const apiUrl = `${baseUrl}${normalizedEndpoint}`;
    
    console.log(`[${requestId}] Full API URL: ${apiUrl}`);
    console.log(`[${requestId}] Request payload keys: ${Object.keys(payload).join(', ')}`);
    
    // Create the request headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sanitizedApiKey}`,
      'X-Request-ID': requestId,
      'Accept': 'application/json'
    };
    
    // Make the request
    console.log(`[${requestId}] Sending request to DeepSeek API...`);
    const response = await axios.post(apiUrl, payload, {
      headers,
      timeout: 30000 // 30 second timeout
    });
    
    console.log(`[${requestId}] Received response with status: ${response.status}`);
    
    // Return the response data
    return {
      success: true,
      data: response.data,
      status: response.status,
      request_id: requestId
    };
  } catch (error) {
    console.error(`[${requestId}] Error making DeepSeek API request:`, error.message);
    
    // Log detailed error information
    if (error.response) {
      console.error(`[${requestId}] Response status: ${error.response.status}`);
      console.error(`[${requestId}] Response headers:`, error.response.headers);
      console.error(`[${requestId}] Response data:`, error.response.data);
    } else if (error.request) {
      console.error(`[${requestId}] No response received, request made`);
    } else {
      console.error(`[${requestId}] Error setting up request:`, error.message);
    }
    
    // Try with alternate endpoint patterns if the error is a 404
    if (error.response && error.response.status === 404) {
      console.log(`[${requestId}] Got 404, trying alternate endpoint patterns...`);
      
      // Get the base URL
      let baseUrl = config.deepseekApiEndpoint || 'https://api.deepseek.com';
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      // Clean the endpoint (remove leading slash)
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
      
      // Try these common patterns
      const alternateEndpoints = [
        `/v1/${cleanEndpoint}`,
        `/api/${cleanEndpoint}`,
        `/api/v1/${cleanEndpoint}`
      ];
      
      // Try each alternate pattern
      for (const altEndpoint of alternateEndpoints) {
        try {
          console.log(`[${requestId}] Trying alternate endpoint: ${baseUrl}${altEndpoint}`);
          
          const altResponse = await axios.post(`${baseUrl}${altEndpoint}`, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sanitizedApiKey}`,
              'X-Request-ID': requestId,
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          console.log(`[${requestId}] Alternate endpoint succeeded with status: ${altResponse.status}`);
          
          return {
            success: true,
            data: altResponse.data,
            status: altResponse.status,
            request_id: requestId,
            endpoint_used: altEndpoint
          };
        } catch (altError) {
          console.log(`[${requestId}] Alternate endpoint failed: ${altError.message}`);
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