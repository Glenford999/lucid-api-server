import express, { Request, Response } from 'express';

const router = express.Router();

// Basic health check endpoint
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Detailed health check for Cloud Run / monitoring systems
router.get('/detailed', async (_req: Request, res: Response) => {
  // Could be extended to check database connections, external services, etc.
  try {
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    };

    res.status(200).json({
      status: 'success',
      message: 'All systems operational',
      timestamp: new Date().toISOString(),
      systemInfo,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export const healthRoutes = router; 