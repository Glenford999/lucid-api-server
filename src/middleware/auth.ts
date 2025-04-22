import { Request, Response, NextFunction } from 'express';
import config from '../config/config';

/**
 * Middleware to authenticate API requests using an API key
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  // Get the API key from the request header
  const apiKey = req.header('x-api-key');
  
  // Check if the API key is provided and matches the expected value
  if (!apiKey || (config.apiKeys.length === 0 || !config.apiKeys.includes(apiKey))) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  }
  
  // Authentication successful, proceed to the next middleware or route handler
  next();
  return;
};

/**
 * Skip API key auth in development mode for specified routes (for easy testing)
 */
export const conditionalAuth = (routePath: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip authentication in development mode for specified routes
    if (config.nodeEnv === 'development' && req.path.startsWith(routePath)) {
      return next();
    }
    
    // Otherwise, use API key authentication
    return apiKeyAuth(req, res, next);
  };
}; 