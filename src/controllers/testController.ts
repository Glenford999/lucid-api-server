import { Request, Response } from 'express';
import { testDeepSeekApiConnection, DeepSeekTestResponse } from '../utils/api-request';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * Test connection to DeepSeek API
 * @param req - Express request object
 * @param res - Express response object
 */
export const testDeepSeekConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      logger.error('No API key configured for DeepSeek');
      res.status(500).json({
        success: false,
        message: 'DeepSeek API key not configured',
        details: {
          fix: 'Please set DEEPSEEK_API_KEY in environment variables or secrets'
        }
      });
      return;
    }

    // List of potential base endpoints to try
    const potentialBaseEndpoints = [
      process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.ai',
      'https://api.deepseek.ai',
      'https://api-prod.deepseek.com'
    ];
    
    // Add backup endpoint if defined
    if (process.env.DEEPSEEK_API_BACKUP_ENDPOINT) {
      potentialBaseEndpoints.push(process.env.DEEPSEEK_API_BACKUP_ENDPOINT);
    }

    // Remove duplicates from the list
    const uniqueBaseEndpoints = [...new Set(potentialBaseEndpoints)];
    
    logger.info(`Testing ${uniqueBaseEndpoints.length} potential DeepSeek API base endpoints`);

    // Try each base endpoint
    for (const baseEndpoint of uniqueBaseEndpoints) {
      logger.info(`Testing DeepSeek API base endpoint: ${baseEndpoint}`);
      
      try {
        // Test with the standard function first
        const testResult = await testDeepSeekApiConnection(apiKey, baseEndpoint);
        
        if (testResult.success) {
          logger.info(`DeepSeek API endpoint working: ${baseEndpoint}`);
          res.status(200).json({
            ...testResult,
            endpoint_used: baseEndpoint
          });
          return;
        }
        
        // If the standard test fails, try a direct API call to models endpoint
        // as some API providers have this endpoint
        try {
          logger.info(`Trying direct models endpoint at ${baseEndpoint}/v1/models`);
          const modelResponse = await axios.get(`${baseEndpoint}/v1/models`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          if (modelResponse.status === 200) {
            logger.info(`DeepSeek API models endpoint working: ${baseEndpoint}/v1/models`);
            res.status(200).json({
              success: true,
              message: 'Successfully connected to DeepSeek API using models endpoint',
              details: {
                endpoint_used: `${baseEndpoint}/v1/models`,
                available_models: modelResponse.data?.data || modelResponse.data?.models || 'Models data structure unknown'
              }
            });
            return;
          }
        } catch (modelError) {
          logger.debug(`Models endpoint test failed: ${(modelError as Error).message}`);
        }
        
      } catch (endpointError) {
        logger.warn(`Failed to connect to DeepSeek API at ${baseEndpoint}: ${(endpointError as Error).message}`);
      }
    }
    
    // If we get here, all endpoints failed
    logger.error('All DeepSeek API endpoints failed');
    
    // Try to get a response from the API to help debug
    try {
      const diagResponse = await axios.get('https://api.deepseek.ai', { 
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      logger.info(`Diagnostic response from DeepSeek API: ${diagResponse.status}`);
      
      res.status(503).json({
        success: false,
        message: 'All DeepSeek API endpoints failed',
        details: {
          endpoints_tried: uniqueBaseEndpoints,
          diagnostic_response: {
            status: diagResponse.status,
            headers: diagResponse.headers
          },
          possible_solutions: [
            'Verify API key is correct and not expired',
            'Check if DeepSeek API service is experiencing an outage',
            'Configure correct API endpoint in environment variables',
            'Ensure firewall/network allows connections to DeepSeek API'
          ]
        }
      });
    } catch (diagError) {
      res.status(503).json({
        success: false,
        message: 'All DeepSeek API endpoints failed',
        details: {
          endpoints_tried: uniqueBaseEndpoints,
          diagnostic_error: (diagError as Error).message,
          possible_solutions: [
            'Verify API key is correct and not expired',
            'Check if DeepSeek API service is experiencing an outage',
            'Configure correct API endpoint in environment variables',
            'Ensure firewall/network allows connections to DeepSeek API'
          ]
        }
      });
    }
  } catch (error) {
    logger.error('Error testing DeepSeek API connection:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while testing DeepSeek API connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 