import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import apiRouter from '../api';

// Create a mock express app for testing
const app = express();
app.use('/api', apiRouter);

// Mock the testDeepSeekConnection controller
jest.mock('../../controllers/testController', () => ({
  testDeepSeekConnection: jest.fn((req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Mock DeepSeek API connection test successful',
      details: {
        endpoint_used: 'https://api.deepseek.com/health'
      }
    });
  })
}));

describe('API Routes', () => {
  describe('GET /api/test/deepseek', () => {
    it('should return successful response', async () => {
      const response = await request(app)
        .get('/api/test/deepseek')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details.endpoint_used');
    });
  });
}); 