/**
 * Lucid API Server - Main Application
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Debug output for Cloud Run
console.log(`[APP] Starting app.js in ${process.env.NODE_ENV || 'development'} mode`);
console.log(`[APP] Current directory: ${__dirname}`);
console.log(`[APP] Google Cloud Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'not set'}`);

// Initialize express app
const app = express();

// Enable trust proxy to work behind Google Cloud Run's load balancer
// More secure than setting to 'true' - trust only requests coming through Google's proxy
// See: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Apply security headers
app.use(helmet());

// Get config from different potential locations
let config;
try {
  // First try direct require
  config = require('./src/config/config');
  console.log('[APP] Loaded config from ./src/config/config');
} catch (configError) {
  console.error('[APP] Failed to load config directly:', configError.message);
  try {
    // Look for the config in different directories
    const potentialPaths = [
      path.join(__dirname, 'src', 'config', 'config.js'),
      path.join(__dirname, 'config', 'config.js'),
      path.join(__dirname, 'dist', 'config', 'config.js')
    ];
    
    let configPath = null;
    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        configPath = p;
        break;
      }
    }
    
    if (configPath) {
      console.log(`[APP] Found config at ${configPath}`);
      config = require(configPath);
    } else {
      // Create a default config as fallback
      console.warn('[APP] Creating default config');
      config = {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8080,
        deepseekApiKey: process.env.DEEPSEEK_API_KEY,
        deepseekApiEndpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com',
        allowedOrigins: process.env.CORS_ORIGINS || '*',
        rateLimitRequests: 60,
        omitHealthLog: true
      };
    }
  } catch (fallbackError) {
    console.error('[APP] Failed to load config from fallback locations:', fallbackError.message);
    process.exit(1);
  }
}

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
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
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
  const apiKeyConfigured = config && config.deepseekApiKey && config.deepseekApiKey.length > 0;
  
  res.status(200).json({
    status: 'ready',
    message: 'Server is ready to handle requests',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || 'unknown',
    api_configured: apiKeyConfigured
  });
});

// Setup routes
console.log('[APP] Setting up routes...');

// Import controllers and routes
let deepseekController;
try {
  deepseekController = require('./src/controllers/deepseekController');
  console.log('[APP] Loaded deepseekController');
} catch (err) {
  console.error('[APP] Error loading deepseekController:', err.message);
  deepseekController = {
    productSearch: (req, res) => {
      return res.status(500).json({
        success: false,
        error: 'DeepSeek controller not available'
      });
    },
    productComparison: (req, res) => {
      return res.status(500).json({
        success: false,
        error: 'DeepSeek controller not available'
      });
    }
  };
}

// Import search routes
let searchRouter;
try {
  searchRouter = require('./src/routes/search');
  console.log('[APP] Loaded search router');
} catch (err) {
  console.error('[APP] Error loading search router:', err.message);
  
  // Create a basic router that returns errors
  const router = express.Router();
  router.all('*', (req, res) => {
    return res.status(500).json({
      success: false,
      error: 'Search router not available'
    });
  });
  searchRouter = router;
}

// Register routes
app.use('/api/search', searchRouter);

// Define comparison route if available
if (deepseekController.productComparison) {
  const comparisonRouter = express.Router();
  
  comparisonRouter.post('/', (req, res) => {
    const product_ids = req.body?.product_ids;
    
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least two product_ids are required'
      });
    }
    
    console.log(`[APP] Processing comparison for products:`, product_ids);
    
    // Return error if no API key is available
    if (!config.deepseekApiKey) {
      console.log('[APP] No API key available, returning error');
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key.'
      });
    }
    
    // Forward the request to the DeepSeek controller
    return deepseekController.productComparison(req, res);
  });
  
  app.use('/api/compare', comparisonRouter);
  console.log('[APP] Registered comparison route');
}

// API diagnostic endpoint for testing connection
app.get('/api/diagnostic', (req, res) => {
  const apiKeyConfigured = !!config.deepseekApiKey;
  const secretManagerConfigured = !!process.env.GOOGLE_CLOUD_PROJECT;
  
  res.status(200).json({
    api_key_configured: apiKeyConfigured,
    api_key_length: apiKeyConfigured ? config.deepseekApiKey.length : undefined,
    api_key_source: config.deepseekApiKey ? 
      (secretManagerConfigured ? 'secret_manager' : 'environment_variable') : 
      'not_configured',
    api_endpoint: config.deepseekApiEndpoint,
    connection_test: apiKeyConfigured && !!config.deepseekApiEndpoint,
    environment: config.nodeEnv,
    is_production: config.nodeEnv === 'production',
    google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT || 'not_configured',
    secret_manager_enabled: secretManagerConfigured,
    server_timestamp: new Date().toISOString()
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
  console.error('[APP] Error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    stack: config.nodeEnv === 'development' ? err.stack : undefined
  });
});

console.log('[APP] Initialization complete');

module.exports = app; 