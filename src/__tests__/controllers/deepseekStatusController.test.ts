import { Request, Response } from 'express';
import { getDeepseekStatus } from '../../controllers/deepseekStatusController';
import config from '../../config/config';

// Mock the config
jest.mock('../../config/config', () => ({
  deepseekApiKey: 'mock-api-key',
  deepseekApiEndpoint: 'https://api.deepseek.com'
}));

describe('DeepSeek Status Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {};
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('should indicate DeepSeek API is configured', async () => {
    await getDeepseekStatus(mockRequest as Request, mockResponse as Response);
    
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        isConfigured: true,
        endpoint: 'https://api.deepseek.com',
        message: 'DeepSeek API is properly configured'
      })
    );
  });

  it('should indicate DeepSeek API is not configured when API key is missing', async () => {
    // Temporarily override the config for this test
    Object.defineProperty(config, 'deepseekApiKey', { 
      get: jest.fn().mockReturnValue(null) 
    });
    
    await getDeepseekStatus(mockRequest as Request, mockResponse as Response);
    
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        isConfigured: false,
        endpoint: null,
        message: 'DeepSeek API is not configured'
      })
    );
  });

  it('should handle errors gracefully', async () => {
    // Force an error to occur during the handler execution
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = new Error('Test error');
    Object.defineProperty(config, 'deepseekApiKey', { 
      get: jest.fn().mockImplementation(() => { throw mockError; }) 
    });
    
    await getDeepseekStatus(mockRequest as Request, mockResponse as Response);
    
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        isConfigured: false,
        error: 'Test error'
      })
    );
    
    // Clean up the console.error mock
    (console.error as jest.Mock).mockRestore();
  });
}); 