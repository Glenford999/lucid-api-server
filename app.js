/**
 * Lucid API Server - Alternative Entry Point
 * This file exists to ensure backward compatibility if code requires('./app')
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require(path.join(__dirname, 'src', 'config', 'config'));

// Initialize express app
const app = express();

// Apply security headers
app.use(helmet());

// Configure CORS
const corsOptions = {
  origin: config.allowedOrigins === '*' ? '*' : config.allowedOrigins.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parser - before routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Critical health check endpoint - must be defined BEFORE any other middleware that might fail
// This is specifically for Cloud Run health checks and should always return 200
app.get('/health', (req, res) => {
  // Super simple response - guaranteed to work even if other parts of the app fail
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined', {
    skip: (req) => config.omitHealthLog && req.path === '/health'
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.rateLimitRequests || 60, // max requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// More detailed readiness check
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    message: 'Server is ready to handle requests',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || 'unknown'
  });
});

// Import routes - Fix paths to use correct locations
const deepseekRoutes = require(path.join(__dirname, 'dist', 'routes', 'deepseekRoutes.js'));
const searchRoutes = require(path.join(__dirname, 'src', 'routes', 'search.js'));

// API Routes
app.use('/api/deepseek', deepseekRoutes);
app.use('/api/search', searchRoutes);

// API diagnostic endpoint for testing connection
app.get('/api/search/diagnostic', (req, res) => {
  const apiKeyConfigured = !!config.deepseekApiKey;
  res.status(200).json({
    api_key_configured: apiKeyConfigured,
    api_key_length: apiKeyConfigured ? config.deepseekApiKey.length : undefined,
    api_endpoint: config.deepseekApiEndpoint,
    connection_test: apiKeyConfigured && !!config.deepseekApiEndpoint,
    environment: config.nodeEnv,
    is_production: config.nodeEnv === 'production'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    stack: config.nodeEnv === 'development' ? err.stack : undefined
  });
});

module.exports = app; 