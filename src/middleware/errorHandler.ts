import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    status: err.status || 'error',
    message: process.env.NODE_ENV === 'production' 
      ? statusCode === 500 ? 'Something went wrong' : err.message
      : err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    requestId: req.headers['x-request-id'] || '',
  });
};

// Custom error class
export class ApiError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
} 