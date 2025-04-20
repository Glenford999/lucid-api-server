import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      headers: {
        'x-request-id': 'test-request-id'
      }
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock
    };
    mockNext = jest.fn();
    
    // Spy on console.error to prevent actual logs during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after each test
    (console.error as jest.Mock).mockRestore();
  });

  it('should handle Error objects with status code', () => {
    const error = new Error('Test error');
    (error as any).statusCode = 400;
    
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Test error',
      requestId: 'test-request-id'
    }));
  });

  it('should handle Error objects without status code (default to 500)', () => {
    const error = new Error('Internal server error');
    
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Internal server error',
      requestId: 'test-request-id'
    }));
  });

  it('should handle string errors', () => {
    const error = 'String error message';
    
    errorHandler(error as any, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      requestId: 'test-request-id'
    }));
  });

  it('should handle object errors with message property', () => {
    const error = { message: 'Object error message' };
    
    errorHandler(error as any, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Object error message',
      requestId: 'test-request-id'
    }));
  });

  it('should handle object errors without message property', () => {
    const error = { someProperty: 'value' };
    
    errorHandler(error as any, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      requestId: 'test-request-id'
    }));
  });

  it('should handle undefined/null errors', () => {
    // Create a dummy error object for undefined case
    const error = { statusCode: 500, message: 'Mock error for undefined test' };
    
    errorHandler(error as any, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Mock error for undefined test',
      requestId: 'test-request-id'
    }));
  });
}); 