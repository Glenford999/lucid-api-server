import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth, conditionalAuth } from '../../middleware/auth';
import config from '../../config/config';

// Mock the config
jest.mock('../../config/config', () => ({
  apiKeys: ['test-api-key'],
  nodeEnv: 'test'
}));

describe('API Key Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      header: jest.fn(),
      path: '/api/test'
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    nextFunction = jest.fn();
  });

  it('should call next() when a valid API key is provided', () => {
    mockRequest.header = jest.fn().mockReturnValue('test-api-key');
    
    apiKeyAuth(mockRequest as unknown as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it('should return 401 when no API key is provided', () => {
    mockRequest.header = jest.fn().mockReturnValue(undefined);
    
    apiKeyAuth(mockRequest as unknown as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  });

  it('should return 401 when an invalid API key is provided', () => {
    mockRequest.header = jest.fn().mockReturnValue('invalid-api-key');
    
    apiKeyAuth(mockRequest as unknown as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  });
});

describe('Conditional Auth Middleware', () => {
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    nextFunction = jest.fn();
  });

  it('should skip auth for specified routes in development environment', () => {
    // Override the nodeEnv for this test
    Object.defineProperty(config, 'nodeEnv', { value: 'development' });
    
    // Create request with the specific path
    const mockRequest = {
      header: jest.fn(),
      path: '/chat-storage/conversations'
    };
    
    const middleware = conditionalAuth('/chat-storage/conversations');
    
    middleware(mockRequest as unknown as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    
    // Reset nodeEnv
    Object.defineProperty(config, 'nodeEnv', { value: 'test' });
  });

  it('should apply auth for non-specified routes even in development environment', () => {
    // Override the nodeEnv for this test
    Object.defineProperty(config, 'nodeEnv', { value: 'development' });
    
    // Create request with a different path
    const mockRequest = {
      header: jest.fn().mockReturnValue(undefined),
      path: '/different-route'
    };
    
    const middleware = conditionalAuth('/chat-storage/conversations');
    
    middleware(mockRequest as unknown as Request, mockResponse as Response, nextFunction);
    
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    
    // Reset nodeEnv
    Object.defineProperty(config, 'nodeEnv', { value: 'test' });
  });
}); 