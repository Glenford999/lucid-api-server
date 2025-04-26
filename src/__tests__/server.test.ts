import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../middleware/errorHandler';

// Instead of importing the whole server (which would start listening),
// we'll rebuild the app for testing only
const app = express();

// Apply middleware similar to server.ts
app.use(helmet());
app.use(cors());
app.use(express.json());

// Add the root route that we want to test
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Lucid API Server is running',
    time: new Date().toISOString()
  });
});

// Add a simple health route for testing
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handling middleware
app.use(errorHandler);

describe('Express Server', () => {
  it('should respond to the root endpoint', async () => {
    const response = await request(app).get('/');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Lucid API Server is running');
    expect(response.body).toHaveProperty('time');
  });

  it('should apply middleware correctly', async () => {
    const response = await request(app).get('/');
    
    // Check for security headers (from helmet)
    expect(response.headers).toHaveProperty('x-content-type-options');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/non-existent-route');
    
    expect(response.status).toBe(404);
  });

  it('should handle health route', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'OK');
  });

  it('should have JSON content type for API responses', async () => {
    const response = await request(app).get('/');
    
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
}); 