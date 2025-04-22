import { Request, Response } from 'express';
import config from '../config/config';

/**
 * Controller for checking DeepSeek API configuration status
 * Returns whether the DeepSeek API is properly configured on the server
 */
export const getDeepseekStatus = async (_req: Request, res: Response) => {
  try {
    // Check if DeepSeek API key and endpoint are configured
    const isConfigured = Boolean(config.deepseekApiKey) && Boolean(config.deepseekApiEndpoint);
    
    // For security, don't return the actual API key, just whether it's configured
    return res.status(200).json({
      success: true,
      isConfigured,
      endpoint: isConfigured ? config.deepseekApiEndpoint : null,
      message: isConfigured 
        ? 'DeepSeek API is properly configured' 
        : 'DeepSeek API is not configured'
    });
  } catch (error: any) {
    console.error('Error checking DeepSeek API status:', error);
    
    return res.status(500).json({
      success: false,
      isConfigured: false,
      error: error.message || 'An error occurred while checking DeepSeek API configuration'
    });
  }
};

export default {
  getDeepseekStatus
}; 