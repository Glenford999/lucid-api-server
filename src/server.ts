import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { healthRoutes } from './routes/healthRoutes';
import { chatRoutes } from './routes/chat';
import openaiRoutes from './routes/openaiRoutes';
import deepseekRoutes from './routes/deepseekRoutes';
import chatStorageRoutes from './routes/chatStorageRoutes';
// Import search routes
const searchRoutes = require('./routes/search');
// Import Secret Manager
const secretManager = require('./utils/secret-manager');

// Load environment variables
dotenv.config();

// Create Express server
const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Secret Manager and start the server
async function startServer() {
  try {
    console.log('Starting Lucid API Server...');
    console.log(`GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT || 'not set'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize API keys from Secret Manager
    console.log('Initializing API keys from Secret Manager...');
    const secretsInitialized = await secretManager.initializeApiKeys();
    console.log(`Secrets initialized: ${secretsInitialized ? 'SUCCESS' : 'FAILED'}`);
    
    // Import and log config after initialization
    const config = require('./config/config');
    console.log('Configuration loaded with the following settings:');
    console.log(`- DeepSeek API Key configured: ${!!config.deepseekApiKey}`);
    console.log(`- DeepSeek API Key length: ${config.deepseekApiKey ? config.deepseekApiKey.length : 0}`);
    console.log(`- DeepSeek API Endpoint: ${config.deepseekApiEndpoint || 'not set'}`);
    console.log(`- Production mode: ${config.isProduction}`);
    
    // Apply middleware
    app.use(helmet()); // Security headers
    app.use(compression()); // Compress responses
    app.use(cors()); // Handle CORS
    app.use(express.json()); // Parse JSON bodies
    app.use(morgan('combined')); // Logging
    
    // Explicitly add a simple root route for testing
    app.get('/', (_req, res) => {
      res.status(200).json({
        message: 'Lucid API Server is running',
        time: new Date().toISOString(),
        apiConfigured: !!config.deepseekApiKey,
        environment: process.env.NODE_ENV || 'development'
      });
    });
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 100, // Limit each IP to 100 requests per window
      standardHeaders: 'draft-7', // Set rate limit headers
      legacyHeaders: false, // Disable X-RateLimit headers
    });
    app.use(limiter);
    
    // Routes
    app.use('/health', healthRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/openai', openaiRoutes);
    app.use('/api/deepseek', deepseekRoutes);
    app.use('/api/chat-storage', chatStorageRoutes);
    // Register search routes
    app.use('/api/search', searchRoutes);
    app.use('/search', searchRoutes); // Also register at /search for compatibility with the mobile app
    
    // Error handling middleware
    app.use(errorHandler);
    
    // Start server with error handling
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health endpoint: http://localhost:${PORT}/health`);
      console.log(`Chat API endpoint: http://localhost:${PORT}/api/chat`);
      console.log(`OpenAI API endpoint: http://localhost:${PORT}/api/openai`);
      console.log(`DeepSeek API endpoint: http://localhost:${PORT}/api/deepseek`);
      console.log(`Chat Storage endpoint: http://localhost:${PORT}/api/chat-storage`);
    }).on('error', (err) => {
      console.error('Error starting server:', err);
      process.exit(1);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app; 