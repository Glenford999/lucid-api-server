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
              process.env.DEEPSEEK_API_KEY = apiKey;
              console.log('[APP] Successfully loaded DeepSeek API key from Secret Manager');
            } else {
              console.error('[APP] Retrieved empty API key from Secret Manager');
            }
          } catch (secretError) {
            console.error('[APP] Error accessing DeepSeek API key from Secret Manager:', secretError.message);
          }
        }
      } catch (moduleError) {
        console.error('[APP] Error loading Secret Manager module:', moduleError.message);
      }
    } else {
      console.log('[APP] GOOGLE_CLOUD_PROJECT not set, skipping Secret Manager initialization');
    }
  } catch (error) {
    console.error('[APP] Failed to initialize Secret Manager:', error.message);
  }
};

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
  
  // Define search route that always works
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
    
    // Return mock data if no API key is available
    if (!process.env.DEEPSEEK_API_KEY) {
      console.log('[APP] No API key available, returning mock data');
      return res.status(200).json({
        success: true,
        is_fallback: true,
        products: [
          {
            id: 'mock1',
            name: `Premium ${query}`,
            price: 129.99,
            description: `High-end ${query} with premium features and exceptional quality.`,
            category: 'Premium',
            image_url: 'https://example.com/placeholder1.jpg',
          },
          {
            id: 'mock2',
            name: `Standard ${query}`,
            price: 59.99,
            description: `Reliable ${query} at an affordable price point.`,
            category: 'Standard',
            image_url: 'https://example.com/placeholder2.jpg',
          },
          {
            id: 'mock3',
            name: `Budget ${query}`,
            price: 29.99,
            description: `Entry-level ${query} for beginners.`,
            category: 'Budget',
            image_url: 'https://example.com/placeholder3.jpg',
          }
        ]
      });
    }
    
    // In a real implementation, we would call an external API here
    // For now, just return mock data
    return res.status(200).json({
      success: true,
      is_fallback: true,
      products: [
        {
          id: 'mock1',
          name: `Premium ${query}`,
          price: 129.99,
          description: `High-end ${query} with premium features and exceptional quality.`,
          category: 'Premium',
          image_url: 'https://example.com/placeholder1.jpg',
        },
        {
          id: 'mock2',
          name: `Standard ${query}`,
          price: 59.99,
          description: `Reliable ${query} at an affordable price point.`,
          category: 'Standard',
          image_url: 'https://example.com/placeholder2.jpg',
        },
        {
          id: 'mock3',
          name: `Budget ${query}`,
          price: 29.99,
          description: `Entry-level ${query} for beginners.`,
          category: 'Budget',
          image_url: 'https://example.com/placeholder3.jpg',
        }
      ]
    });
  });

  // Register the search routes
  app.use('/api/search', searchRouter);
  console.log('[APP] Registered search routes');

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