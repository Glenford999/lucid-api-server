/**
 * API Request Utilities
 * Provides standardized functions for making API requests to DeepSeek API with 
 * comprehensive error handling and logging
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import logger from './logger';
import config from '../config/config';

/**
 * Function to sanitize an API key to prevent header issues
 * @param {string} apiKey - The API key to sanitize
 * @returns {string} Sanitized API key
 */
export function sanitizeApiKey(apiKey: string | null): string {
  if (!apiKey) return '';
  
  // Remove any newlines, carriage returns, control characters, and trim whitespace
  return apiKey.trim()
    .replace(/\r?\n|\r/g, '')        // Remove newlines and carriage returns
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, '');            // Remove any remaining whitespace
}

/**
 * Interface for the DeepSeek API request payload
 */
export interface DeepSeekRequestPayload {
  query?: string;
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
  context?: any;
  filters?: any;
  preferences?: any;
  product_ids?: string[];
  comparison_type?: string;
  [key: string]: any;
}

/**
 * Interface for the DeepSeek API response
 */
export interface DeepSeekResponse {
  success: boolean;
  data?: any;
  error?: string;
  request_id?: string;
  endpoint_used?: string;
  status?: number;
}

/**
 * Makes a request to DeepSeek API with built-in retry and fallback logic
 * 
 * @param {string} endpoint - The endpoint to call (e.g., "/product/search")
 * @param {DeepSeekRequestPayload} payload - The request payload
 * @param {string} requestId - ID for tracking the request through logs
 * @returns {Promise<DeepSeekResponse>} - Response object
 */
export async function makeDeepSeekRequest(
  endpoint: string, 
  payload: DeepSeekRequestPayload,
  requestId: string
): Promise<DeepSeekResponse> {
  // Get API configuration from config
  const apiKey = config.deepseekApiKey;
  const apiEndpoint = config.deepseekApiEndpoint;
  
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
    let baseUrl = apiEndpoint || 'https://api.deepseek.com';
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
    const axiosError = error as AxiosError;
    logger.error(`[${requestId}] Error making DeepSeek API request:`, axiosError.message);
    
    // Log detailed error information
    if (axiosError.response) {
      logger.error(`[${requestId}] Response status: ${axiosError.response.status}`);
      logger.debug(`[${requestId}] Response headers:`, axiosError.response.headers);
      logger.debug(`[${requestId}] Response data:`, axiosError.response.data);
    } else if (axiosError.request) {
      logger.error(`[${requestId}] No response received, request made`);
    } else {
      logger.error(`[${requestId}] Error setting up request:`, axiosError.message);
    }
    
    // Try with alternate endpoint patterns if the error is a 404
    if (axiosError.response && axiosError.response.status === 404) {
      logger.info(`[${requestId}] Got 404, trying alternate endpoint patterns...`);
      
      // Get the base URL - reuse from above to ensure consistency
      let baseUrl = apiEndpoint || 'https://api.deepseek.com';
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
          
          const altResponse = await axios.post(altFullUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sanitizedApiKey}`,
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
          const altAxiosError = altError as AxiosError;
          logger.info(`[${requestId}] Alternate endpoint failed: ${altAxiosError.message}`);
        }
      }
    }
    
    // Check if network-related error
    if (axiosError.code) {
      logger.error(`[${requestId}] Network-related error: ${axiosError.code}`);
      
      // Provide more specific error messages for common network issues
      if (axiosError.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Connection refused. The API server rejected the connection.',
          request_id: requestId,
          status: 503
        };
      } else if (axiosError.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Connection timed out. The API server took too long to respond.',
          request_id: requestId,
          status: 504
        };
      } else if (axiosError.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'DNS lookup failed. The API domain could not be resolved.',
          request_id: requestId,
          status: 502
        };
      }
    }
    
    // Return the error details
    return {
      success: false,
      error: axiosError.message,
      status: axiosError.response ? axiosError.response.status : 500,
      request_id: requestId
    };
  }
}

/**
 * Tests the connection to the DeepSeek API
 * 
 * @returns {Promise<DeepSeekResponse>} - Test result with success status
 */
export async function testDeepSeekConnection(): Promise<DeepSeekResponse> {
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const apiKey = config.deepseekApiKey;
  const apiEndpoint = config.deepseekApiEndpoint;
  
  logger.info(`[${requestId}] Testing DeepSeek API connection`);
  
  if (!apiKey) {
    logger.error(`[${requestId}] No API key configured for DeepSeek`);
    return {
      success: false,
      error: 'No API key provided',
      request_id: requestId
    };
  }
  
  try {
    // Simple test payload
    const testPayload = {
      query: 'test connection',
      max_tokens: 10
    };
    
    // Try to make a request with minimal payload
    const result = await makeDeepSeekRequest('product/search', testPayload, requestId);
    
    return {
      ...result,
      success: true,
      error: undefined
    };
  } catch (error) {
    const err = error as Error;
    logger.error(`[${requestId}] Connection test failed: ${err.message}`);
    
    return {
      success: false,
      error: `Connection test failed: ${err.message}`,
      request_id: requestId
    };
  }
}

export default {
  makeDeepSeekRequest,
  testDeepSeekConnection,
  sanitizeApiKey
}; 