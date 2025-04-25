import axios, { AxiosResponse } from 'axios';
import { Request, Response } from 'express';
import logger from './logger';
import config from '../config/config';

/**
 * Interface for DeepSeek API test response
 */
export interface DeepSeekTestResponse {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Interface for OpenAI API test response
 */
export interface OpenAITestResponse {
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

    // Try various health endpoints since different APIs may use different paths
    const healthEndpoints = [
      '/health',
      '/v1/health',
      '/api/health',
      '/api/v1/health',
      '/status'
    ];
    
    logger.info(`Trying multiple health endpoints for ${baseUrl}...`);
    
    for (const endpoint of healthEndpoints) {
      try {
        const url = `${baseUrl}${endpoint}`;
        logger.info(`Testing health endpoint: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'Accept': 'application/json',
          },
          timeout: 10000, // 10 second timeout for test
        });
        
        logger.info(`DeepSeek API health endpoint test response (${endpoint}): ${response.status}`);
        
        if (response.status === 200 || response.status === 204) {
          logger.info('DeepSeek API connection test successful');
          return {
            success: true,
            message: 'Successfully connected to DeepSeek API',
            details: {
              status: response.status,
              statusText: response.statusText,
              endpoint: endpoint,
              baseUrl: baseUrl
            },
          };
        }
      } catch (endpointError: any) {
        logger.warn(`Health endpoint ${endpoint} failed: ${endpointError.message}`);
        // Continue to try the next endpoint
      }
    }
    
    // Try product search and chat completion endpoints as fallbacks
    const fallbackEndpoints = [
      '/api/v1/product/search',
      '/v1/product/search',
      '/product/search',
      '/v1/chat/completions',
      '/api/v1/chat/completions'
    ];
    
    logger.info('Trying fallback API endpoint tests...');
    
    for (const fallbackEndpoint of fallbackEndpoints) {
      try {
        const testUrl = `${baseUrl}${fallbackEndpoint}`;
        logger.info(`Testing fallback endpoint: ${testUrl}`);
        
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
          logger.info(`DeepSeek API fallback test successful on ${fallbackEndpoint}`);
          return {
            success: true,
            message: 'Successfully connected to DeepSeek API using fallback endpoint',
            details: {
              status: testResponse.status,
              statusText: testResponse.statusText,
              endpoint: fallbackEndpoint,
              baseUrl: baseUrl
            },
          };
        }
      } catch (fallbackError: any) {
        logger.warn(`Fallback API test on ${fallbackEndpoint} failed: ${fallbackError.message}`);
      }
    }
    
    // All tests failed
    logger.error('All DeepSeek API connection tests failed');
    return {
      success: false,
      message: 'Failed to connect to DeepSeek API: All endpoints failed',
      details: { 
        baseUrl: baseUrl,
        testedEndpoints: [...healthEndpoints, ...fallbackEndpoints] 
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
 * Makes a request to the DeepSeek API with improved error handling and fallback mechanisms
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
  let baseUrl = config.deepseekApiEndpoint 
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

  // Properly construct the full URL with base URL if needed
  const fullUrl = endpoint.startsWith('http') 
    ? endpoint 
    : `${baseUrl}/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;
    
  logger.debug(`[${requestId}] Full request URL: ${fullUrl}`);

  // Common DeepSeek API endpoint patterns to try if the initial request fails
  const alternateEndpointPatterns = [
    (base: string, ep: string) => `${base}/v1/${ep}`,
    (base: string, ep: string) => `${base}/api/${ep}`,
    (base: string, ep: string) => `${base}/api/v1/${ep}`,
    // Product search specific patterns
    (base: string, _: string) => `${base}/api/v1/product/search`,
    (base: string, _: string) => `${base}/v1/product/search`,
    (base: string, _: string) => `${base}/product/search`
  ];

  // Clean the endpoint (remove leading slash)
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

  // Array to keep track of endpoints we've tried
  const triedEndpoints = [fullUrl];

  // Make the actual API request
  try {
    logger.debug(`[${requestId}] Sending request to DeepSeek API with timeout ${timeout}ms`);
    
    let response;
    try {
      response = await axios.post(
        fullUrl,
        payload,
        { 
          headers,
          timeout
        }
      );
      
      logger.info(`[${requestId}] DeepSeek API request successful: ${response.status}`);
      return response;
    } catch (initialError: any) {
      // Only try alternate patterns if we get a 404 (Not Found)
      if (initialError.response && initialError.response.status === 404) {
        logger.info(`[${requestId}] Got 404, trying alternate endpoint patterns...`);
        
        // Try each alternate pattern
        for (const patternFn of alternateEndpointPatterns) {
          const altFullUrl = patternFn(baseUrl, cleanEndpoint);
          
          // Skip if we've already tried this URL
          if (triedEndpoints.includes(altFullUrl)) continue;
          triedEndpoints.push(altFullUrl);
          
          try {
            logger.info(`[${requestId}] Trying alternate endpoint: ${altFullUrl}`);
            
            const altResponse = await axios.post(altFullUrl, payload, {
              headers,
              timeout
            });
            
            logger.info(`[${requestId}] Alternate endpoint succeeded with status: ${altResponse.status}`);
            // Save this successful endpoint for future use
            if (config.isProduction) {
              logger.info(`[${requestId}] Found working endpoint: ${altFullUrl} - consider updating configuration`);
            }
            return altResponse;
          } catch (altError: any) {
            logger.info(`[${requestId}] Alternate endpoint failed: ${altError.message}`);
          }
        }
        
        // If all alternates failed, try backup API endpoints from config
        if (config.deepseekApiAlternatives && Array.isArray(config.deepseekApiAlternatives)) {
          for (const altBaseUrl of config.deepseekApiAlternatives) {
            if (altBaseUrl === baseUrl) continue; // Skip if same as current base URL
            
            const altFullUrl = `${altBaseUrl}/${cleanEndpoint}`;
            if (triedEndpoints.includes(altFullUrl)) continue;
            triedEndpoints.push(altFullUrl);
            
            try {
              logger.info(`[${requestId}] Trying backup API endpoint: ${altFullUrl}`);
              
              const backupResponse = await axios.post(altFullUrl, payload, {
                headers,
                timeout
              });
              
              logger.info(`[${requestId}] Backup endpoint succeeded with status: ${backupResponse.status}`);
              logger.info(`[${requestId}] Found working backup endpoint: ${altBaseUrl} - consider updating primary endpoint`);
              return backupResponse;
            } catch (backupError: any) {
              logger.info(`[${requestId}] Backup endpoint failed: ${backupError.message}`);
            }
          }
        }
      }
      
      // If we reach here, none of the alternate endpoints worked - rethrow the original error
      throw initialError;
    }
  } catch (error: any) {
    logger.error(`[${requestId}] DeepSeek API request failed:`, error.message);
    
    if (error.response) {
      logger.debug(`[${requestId}] Error response:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.code) {
      logger.error(`[${requestId}] Network-related error: ${error.code}`);
    }
    
    // Include the list of tried endpoints in the error for better diagnostics
    error.triedEndpoints = triedEndpoints;
    throw error;
  }
}

export default {
  testDeepSeekApiConnection,
  testOpenAIApiConnection,
  makeDeepSeekRequest
}; 