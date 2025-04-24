import axios, { AxiosResponse } from 'axios';
import { Request, Response } from 'express';
import logger from './logger';
import config from '../config/config';

/**
 * Interface for DeepSeek API test response
 */
interface DeepSeekTestResponse {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Interface for OpenAI API test response
 */
interface OpenAITestResponse {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Tests the connection to the DeepSeek API
 * @param apiKey - The API key for DeepSeek
 * @param apiEndpoint - The endpoint URL for DeepSeek API
 * @returns Promise resolving to test response object
 */
export async function testDeepSeekApiConnection(
  apiKey: string,
  apiEndpoint: string
): Promise<DeepSeekTestResponse> {
  try {
    // Validate API key
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('DeepSeek API connection test: No API key provided');
      return {
        success: false,
        message: 'No API key provided',
      };
    }

    // Clean API key from any invalid characters
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '');

    // Extract base URL from endpoint
    const baseUrl = apiEndpoint.endsWith('/')
      ? apiEndpoint.slice(0, -1)
      : apiEndpoint;

    // Construct test URL - will try to get a simple response from the API
    const testUrl = `${baseUrl}/health`;

    logger.info(`Testing DeepSeek API connection to: ${testUrl}`);

    const response = await axios.get(testUrl, {
      headers: {
        'Authorization': `Bearer ${sanitizedApiKey}`,
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 second timeout for test
    });

    logger.info('DeepSeek API connection test successful');
    logger.debug('DeepSeek API response status:', response.status);

    return {
      success: true,
      message: 'Successfully connected to DeepSeek API',
      details: {
        status: response.status,
        statusText: response.statusText,
      },
    };
  } catch (error: any) {
    logger.error('DeepSeek API connection test failed:', error.message);

    if (error.response) {
      logger.debug('DeepSeek API error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    }

    return {
      success: false,
      message: `Failed to connect to DeepSeek API: ${error.message}`,
      details: error.response?.data || {},
    };
  }
}

/**
 * Tests the connection to the OpenAI API
 * @param apiKey - The API key for OpenAI
 * @param apiEndpoint - Optional custom endpoint for OpenAI API
 * @returns Promise resolving to test response object
 */
export async function testOpenAIApiConnection(
  apiKey: string,
  apiEndpoint?: string
): Promise<OpenAITestResponse> {
  try {
    // Validate API key
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('OpenAI API connection test: No API key provided');
      return {
        success: false,
        message: 'No API key provided',
      };
    }

    // Clean API key from any invalid characters
    const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '');

    // Use either custom endpoint or default OpenAI API URL
    const baseUrl = apiEndpoint
      ? apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint
      : 'https://api.openai.com/v1';

    // Construct test URL - will list available models
    const testUrl = `${baseUrl}/models`;

    logger.info(`Testing OpenAI API connection to: ${testUrl}`);

    const response = await axios.get(testUrl, {
      headers: {
        'Authorization': `Bearer ${sanitizedApiKey}`,
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 second timeout for test
    });

    logger.info('OpenAI API connection test successful');
    logger.debug('OpenAI API response status:', response.status);

    return {
      success: true,
      message: 'Successfully connected to OpenAI API',
      details: {
        status: response.status,
        statusText: response.statusText,
      },
    };
  } catch (error: any) {
    logger.error('OpenAI API connection test failed:', error.message);

    if (error.response) {
      logger.debug('OpenAI API error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    }

    return {
      success: false,
      message: `Failed to connect to OpenAI API: ${error.message}`,
      details: error.response?.data || {},
    };
  }
}

/**
 * Interface for DeepSeek API request payload
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
  include_categories?: string[];
  include_conclusion?: boolean;
  [key: string]: any;
}

/**
 * Makes a request to the DeepSeek API
 * @param endpoint - The API endpoint path (without base URL)
 * @param apiKey - The API key for DeepSeek
 * @param payload - The request payload
 * @param timeout - Optional timeout in milliseconds
 * @returns Promise resolving to API response
 */
export async function makeDeepSeekRequest(
  endpoint: string,
  apiKey: string,
  payload: DeepSeekRequestPayload,
  timeout: number = 30000
): Promise<AxiosResponse> {
  // Validate API key
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('No API key provided for DeepSeek request');
  }

  // Clean API key to ensure it doesn't contain invalid characters
  const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '');

  // Create request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Log API request (limited to protect sensitive data)
  logger.info(`[${requestId}] Making DeepSeek API request to: ${endpoint}`);
  logger.debug(`[${requestId}] Request payload type:`, typeof payload);
  
  // Set up the base URL - use configuration value or fallback to default
  const baseUrl = config.deepseekApiEndpoint 
    ? (config.deepseekApiEndpoint.endsWith('/') 
        ? config.deepseekApiEndpoint.slice(0, -1) 
        : config.deepseekApiEndpoint)
    : 'https://api.deepseek.com';
  
  // Create API signature and headers
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sanitizedApiKey}`,
    'X-Timestamp': timestamp,
    'Accept': 'application/json',
    'X-Request-ID': requestId
  };

  // Make the actual API request
  try {
    logger.debug(`[${requestId}] Sending request to DeepSeek API with timeout ${timeout}ms`);
    
    // Properly construct the full URL with base URL if needed
    const fullUrl = endpoint.startsWith('http') 
      ? endpoint 
      : `${baseUrl}/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;
      
    logger.debug(`[${requestId}] Full request URL: ${fullUrl}`);
    
    const response = await axios.post(
      fullUrl,
      payload,
      { 
        headers,
        timeout
      }
    );
    
    logger.info(`[${requestId}] DeepSeek API request successful: ${response.status}`);
    return response;
  } catch (error: any) {
    logger.error(`[${requestId}] DeepSeek API request failed:`, error.message);
    
    if (error.response) {
      logger.debug(`[${requestId}] Error response:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Add fallback endpoint logic (similar to the JavaScript version)
    if (error.response && error.response.status === 404 && !endpoint.startsWith('http')) {
      logger.info(`[${requestId}] Got 404, trying alternate endpoint patterns...`);
      
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
          const altFullUrl = `${baseUrl}${altEndpoint}`;
          logger.info(`[${requestId}] Trying alternate endpoint: ${altFullUrl}`);
          
          const altResponse = await axios.post(altFullUrl, payload, {
            headers,
            timeout
          });
          
          logger.info(`[${requestId}] Alternate endpoint succeeded with status: ${altResponse.status}`);
          return altResponse;
        } catch (altError: any) {
          logger.info(`[${requestId}] Alternate endpoint failed: ${altError.message}`);
        }
      }
    }
    
    throw error;
  }
}

export default {
  testDeepSeekApiConnection,
  testOpenAIApiConnection,
  makeDeepSeekRequest
}; 