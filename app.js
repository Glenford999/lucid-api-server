const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./src/config/config');

// Import routes
const deepseekRoutes = require('./src/routes/deepseekRoutes');
const searchRoutes = require('./src/routes/searchRoutes');

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

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined', {
    skip: (req) => config.omitHealthLog && req.path === '/health'
  }));
}

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

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