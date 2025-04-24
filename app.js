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

// Initialize Google Cloud Secret Manager integration
const initializeSecretManager = async () => {
  try {
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      console.log(`[APP] Initializing Secret Manager for project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
      
      try {
        // Only require these modules in production to avoid dev dependencies
        const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
        const secretManager = new SecretManagerServiceClient();
        
        // Access DeepSeek API key from Secret Manager
        if (!process.env.DEEPSEEK_API_KEY) {
          const secretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/deepseek-api-key/versions/latest`;
          console.log(`[APP] Fetching DeepSeek API key from Secret Manager: ${secretName}`);
          
          try {
            const [version] = await secretManager.accessSecretVersion({ name: secretName });
            const apiKey = version.payload.data.toString('utf8');
            
            if (apiKey) {
              // Clean the API key to ensure it doesn't contain invalid characters
              const sanitizedApiKey = apiKey.trim().replace(/\r?\n|\r/g, '').replace(/[\x00-\x1F\x7F]/g, '');
              process.env.DEEPSEEK_API_KEY = sanitizedApiKey;
              
              // Set it in config directly as well (belt and suspenders approach)
              if (config && config.deepseekApiKey !== undefined) {
                config.deepseekApiKey = sanitizedApiKey;
              }
              
              console.log('[APP] Successfully loaded DeepSeek API key from Secret Manager');
              console.log(`[APP] API key length: ${sanitizedApiKey.length}`);
              console.log(`[APP] API key first 3 chars: ${sanitizedApiKey.substring(0, 3)}...`);
            } else {
              console.error('[APP] Retrieved empty API key from Secret Manager');
            }
          } catch (secretError) {
            console.error('[APP] Error accessing DeepSeek API key from Secret Manager:', secretError.message);
          }
        } else {
          // Sanitize the API key that was set directly in environment variables
          const sanitizedApiKey = process.env.DEEPSEEK_API_KEY.trim()
            .replace(/\r?\n|\r/g, '')
            .replace(/[\x00-\x1F\x7F]/g, '');
          process.env.DEEPSEEK_API_KEY = sanitizedApiKey;
          
          // Set it in config directly as well (belt and suspenders approach)
          if (config && config.deepseekApiKey !== undefined) {
            config.deepseekApiKey = sanitizedApiKey;
          }
          
          console.log('[APP] Using API key from environment variables');
          console.log(`[APP] API key length: ${sanitizedApiKey.length}`);
          console.log(`[APP] API key first 3 chars: ${sanitizedApiKey.substring(0, 3)}...`);
        }
        
        // Also fetch the DeepSeek API endpoint if configured in Secret Manager
        if (!process.env.DEEPSEEK_API_ENDPOINT) {
          try {
            const endpointSecretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/deepseek-api-endpoint/versions/latest`;
            const [endpointVersion] = await secretManager.accessSecretVersion({ name: endpointSecretName });
            const apiEndpoint = endpointVersion.payload.data.toString('utf8');
            
            if (apiEndpoint) {
              process.env.DEEPSEEK_API_ENDPOINT = apiEndpoint;
              
              // Set it in config directly as well
              if (config && config.deepseekApiEndpoint !== undefined) {
                config.deepseekApiEndpoint = apiEndpoint;
              }
              
              console.log('[APP] Successfully loaded DeepSeek API endpoint from Secret Manager');
              console.log(`[APP] API endpoint: ${apiEndpoint}`);
            }
          } catch (endpointError) {
            console.log('[APP] DeepSeek API endpoint not found in Secret Manager (using default)');
          }
        }
      } catch (moduleError) {
        console.error('[APP] Error loading Secret Manager module:', moduleError.message);
      }
    } else {
      console.log('[APP] GOOGLE_CLOUD_PROJECT not set, skipping Secret Manager initialization');
      
      // Sanitize the API key if it exists in environment variables
      if (process.env.DEEPSEEK_API_KEY) {
        const sanitizedApiKey = process.env.DEEPSEEK_API_KEY.trim()
          .replace(/\r?\n|\r/g, '')
          .replace(/[\x00-\x1F\x7F]/g, '');
        process.env.DEEPSEEK_API_KEY = sanitizedApiKey;
        
        // Set it in config directly as well
        if (config && config.deepseekApiKey !== undefined) {
          config.deepseekApiKey = sanitizedApiKey;
        }
        
        console.log('[APP] Using API key from environment variables (no GCP project)');
        console.log(`[APP] API key length: ${sanitizedApiKey.length}`);
        console.log(`[APP] API key first 3 chars: ${sanitizedApiKey.substring(0, 3)}...`);
      }
    }
  } catch (error) {
    console.error('[APP] Failed to initialize Secret Manager:', error.message);
  }
};

// Initialize express app
const app = express();

// Enable trust proxy to work behind Google Cloud Run's load balancer
// More secure than setting to 'true' - trust only requests coming through Google's proxy
// See: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

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
  res.status(200).json({
    status: 'ready',
    message: 'Server is ready to handle requests',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || 'unknown'
  });
});

// Setup routes after Secret Manager initialization
(async () => {
  // Initialize Secret Manager first to get API keys
  await initializeSecretManager().catch(err => {
    console.error('[APP] Secret Manager initialization error:', err.message);
  });
  
  // Import the DeepSeek controller for product search
  let deepseekController;
  try {
    // Try to import the TypeScript version first
    deepseekController = require('./src/controllers/deepseekController');
    console.log('[APP] Loaded DeepSeek controller from TypeScript file');
  } catch (err) {
    try {
      // Fall back to the migrated JavaScript version
      deepseekController = require('./src/controllers/deepseekController.js.migrated');
      console.log('[APP] Loaded DeepSeek controller from migrated JavaScript file');
    } catch (secondErr) {
      console.error('[APP] Failed to load DeepSeek controller:', secondErr.message);
      // Create a minimal controller that returns errors
      deepseekController = {
        productSearch: (req, res) => {
          return res.status(500).json({
            success: false,
            error: 'DeepSeek controller not available.'
          });
        }
      };
    }
  }
  
  // Define search route that forwards to the DeepSeek controller
  const searchRouter = express.Router();
  searchRouter.post('/', (req, res) => {
    const query = req.body?.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    console.log(`[APP] Processing search for: ${query}`);
    
    // Return error if no API key is available
    if (!process.env.DEEPSEEK_API_KEY) {
      console.log('[APP] No API key available, returning error');
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key.'
      });
    }
    
    // Forward the request to the DeepSeek controller
    return deepseekController.productSearch(req, res);
  });

  // Define comparison route that forwards to the DeepSeek controller
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
    if (!process.env.DEEPSEEK_API_KEY) {
      console.log('[APP] No API key available, returning error');
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key.'
      });
    }
    
    // Forward the request to the DeepSeek controller
    return deepseekController.productComparison(req, res);
  });

  // Add GET endpoint to handle requests via URL parameters
  searchRouter.get('/', (req, res) => {
    const query = req.query.query || req.query.q;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required (use ?query=term or ?q=term)'
      });
    }
    
    console.log(`[APP] Processing GET search for: ${query}`);
    
    // Return error if no API key is available
    if (!process.env.DEEPSEEK_API_KEY) {
      console.log('[APP] No API key available, returning error');
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key.'
      });
    }
    
    // Set the query in req.body for the controller
    req.body = { query };
    
    // Forward the request to the DeepSeek controller
    return deepseekController.productSearch(req, res);
  });

  // Register the search routes
  app.use('/api/search', searchRouter);
  // Register the comparison routes
  app.use('/api/compare', comparisonRouter);
  console.log('[APP] Registered search and comparison routes');

  // API diagnostic endpoint for testing connection
  app.get('/api/search/diagnostic', (req, res) => {
    const apiKeyConfigured = !!process.env.DEEPSEEK_API_KEY;
    const secretManagerConfigured = !!process.env.GOOGLE_CLOUD_PROJECT;
    
    res.status(200).json({
      api_key_configured: apiKeyConfigured,
      api_key_length: apiKeyConfigured ? process.env.DEEPSEEK_API_KEY.length : undefined,
      api_key_source: process.env.DEEPSEEK_API_KEY ? 
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
})();

module.exports = app; 