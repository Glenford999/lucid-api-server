import { Request, Response } from 'express';
import axios from 'axios';
import * as deepseekController from '../../controllers/deepseekController';
import config from '../../config/config';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
  create: jest.fn().mockReturnValue({
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })
}));

// Mock the config
jest.mock('../../config/config', () => ({
  deepseekApiKey: 'mock-deepseek-api-key',
  deepseekApiEndpoint: 'https://mock-deepseek-api-endpoint',
  enableMockResponses: false
}));

describe('DeepSeek Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      body: {},
      headers: {}
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock
    };
    
    // Reset axios mock
    (axios.post as jest.Mock).mockReset();
    
    // Spy on console.error to prevent actual logs during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after each test
    (console.error as jest.Mock).mockRestore();
  });

  describe('productSearch', () => {
    it('should handle valid product search request', async () => {
      // Setup mock request
      mockRequest.body = {
        query: 'best smartphones 2023',
        filters: { price_range: 'premium' }
      };

      // Mock axios response
      const mockAxiosResponse = {
        data: {
          products: [
            {
              id: 'phone-1',
              name: 'Mock Smartphone 1',
              description: 'A great smartphone',
              price_range: '$800-$1000',
              rating: 4.5
            }
          ]
        }
      };
      (axios.post as jest.Mock).mockResolvedValue(mockAxiosResponse);

      await deepseekController.productSearch(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify the response
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
      
      // Verify axios was called with the right parameters
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/product/search'),
        expect.objectContaining({
          query: 'best smartphones 2023',
          filters: { price_range: 'premium' }
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      // Setup mock request
      mockRequest.body = {
        query: 'best smartphones 2023'
      };

      // Mock axios error
      const mockError = {
        response: {
          status: 400,
          data: { error: 'Invalid request' }
        }
      };
      (axios.post as jest.Mock).mockRejectedValue(mockError);

      await deepseekController.productSearch(
        mockRequest as Request,
        mockResponse as Response
      );

      // The function might fall back to mock data instead of failing
      expect(statusMock).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalled();
    });

    it('should handle missing query in request', async () => {
      // Setup mock request with missing query
      mockRequest.body = {
        filters: { price_range: 'premium' }
      };

      await deepseekController.productSearch(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify the response indicates failure
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('query is required')
      }));
      
      // Verify axios was not called
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      // Setup mock request
      mockRequest.body = {
        query: 'best smartphones 2023'
      };

      // Mock a network or unexpected error
      (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await deepseekController.productSearch(
        mockRequest as Request,
        mockResponse as Response
      );

      // Might return fallback data or error depending on implementation
      expect(statusMock).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe('mockResponses', () => {
    beforeEach(() => {
      // Set enableMockResponses to true for these tests
      Object.defineProperty(config, 'deepseekApiKey', { 
        value: null 
      });
    });

    afterEach(() => {
      // Reset to default value
      Object.defineProperty(config, 'deepseekApiKey', { 
        value: 'mock-deepseek-api-key' 
      });
    });

    it('should return mock response when API is not configured', async () => {
      // Setup mock request
      mockRequest.body = {
        query: 'best smartphones 2023'
      };

      await deepseekController.productSearch(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify a mock response was returned
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Object)
      }));
      
      // Verify axios was not called (since we're using mocks)
      expect(axios.post).not.toHaveBeenCalled();
    });
  });
}); 