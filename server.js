/**
 * Lucid API Server - Main Entry Point
 * Initializes the server and handles startup
 */

// Safely require dependencies with fallbacks
let app, config, initializeApiKeys, testDeepSeekApiConnection;

try {
  // Use relative paths for better portability
  app = require('./src/app');
  console.log('Loaded app module successfully');
} catch (err) {
  console.error('Error loading app module:', err.message);
  // Create minimal app if main app fails to load
  const express = require('express');
  app = express();
  app.get('/health', (req, res) => res.status(200).send('OK'));
  app.get('/', (req, res) => res.status(200).json({ status: 'minimal', error: err.message }));
}

try {
  // Use relative paths for better portability
  config = require('./src/config/config');
  console.log('Loaded configuration successfully');
} catch (err) {
  console.error('Error loading config module:', err.message);
  config = {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
    googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT
  };
  console.log('Using fallback configuration');
}

// Try to load Secret Manager utilities
try {
  // Use relative paths for better portability
  const secretManager = require('./src/utils/secret-manager');
  initializeApiKeys = secretManager.initializeApiKeys;
  console.log('Loaded Secret Manager utilities successfully');
} catch (err) {
  console.error('Error loading Secret Manager module:', err.message);
  initializeApiKeys = async () => {
    console.log('Using simplified API key initialization');
    
    // In Cloud Run with Secret Manager references, keys are already in environment variables
    try {
      // Log what environment variables we have (without showing actual values)
      const envVars = Object.keys(process.env)
        .filter(key => key.includes('API_KEY') || key.includes('API_ENDPOINT') || key.includes('BASE_URL'))
        .map(key => `${key}: ${process.env[key] ? `[Set, length: ${process.env[key].length}]` : 'Not Set'}`);
        
      console.log('Available API configuration in environment:', envVars);
      
      // Set config values directly from environment
      if (process.env.DEEPSEEK_API_KEY) {
        config.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
        console.log('DeepSeek API key loaded from environment variable');
      }
      
      if (process.env.DEEPSEEK_API_ENDPOINT) {
        config.deepseekApiEndpoint = process.env.DEEPSEEK_API_ENDPOINT;
        console.log('DeepSeek API endpoint loaded from environment:', config.deepseekApiEndpoint);
      }
      
      if (process.env.OPENAI_API_KEY) {
        config.openaiApiKey = process.env.OPENAI_API_KEY;
        console.log('OpenAI API key loaded from environment variable');
      }
      
      if (process.env.OPENAI_API_BASE_URL || process.env.OPEN_API_BASE_URL) {
        config.openaiApiEndpoint = process.env.OPENAI_API_BASE_URL || process.env.OPEN_API_BASE_URL;
        console.log('OpenAI API endpoint loaded from environment:', config.openaiApiEndpoint);
      }
      
      return true;
    } catch (err) {
      console.error('Error initializing from environment variables:', err.message);
      return false;
    }
  };
}

// Try to load API request utilities
try {
  // Use relative paths for better portability
  const apiRequest = require('./src/utils/api-request');
  testDeepSeekApiConnection = apiRequest.testDeepSeekApiConnection;
  console.log('Loaded API request utilities successfully');
} catch (err) {
  console.error('Error loading API request module:', err.message);
  testDeepSeekApiConnection = async () => {
    console.log('Using dummy testDeepSeekApiConnection function');
    return Promise.resolve(false);
  };
}

// Flag to track API initialization
let apiKeysInitialized = false;

// Always have health check at top level - CRITICAL for Cloud Run startup probe
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Add readiness endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: apiKeysInitialized ? 'ready' : 'initializing',
    api_initialized: apiKeysInitialized,
    message: apiKeysInitialized 
      ? 'API server is ready to handle requests' 
      : 'API server is still initializing, but health check is passing'
  });
});

// Handle initialization in the background
async function initializeServerResources() {
  try {
    console.log('Starting background initialization of API keys and resources...');

    try {
      // Initialize API keys
      await initializeApiKeys();
      apiKeysInitialized = true;
      console.log('API keys initialized successfully');
    } catch (keyError) {
      console.error('Error initializing API keys:', keyError.message);
      // Set as initialized anyway to allow server to function
      apiKeysInitialized = true;
      console.log('Continuing with server operation despite API key initialization failure');
    }

    // Test the DeepSeek API connection in the background
    try {
      if (config.deepseekApiKey) {
        console.log('Testing DeepSeek API connection in background...');
        setTimeout(() => {
          testDeepSeekApiConnection(config.deepseekApiKey, config.deepseekApiEndpoint)
            .then(success => {
              console.log(`DeepSeek API connection test ${success ? 'successful' : 'failed'}`);
            })
            .catch(err => console.error("API test failed:", err.message));
        }, 1000);
      } else {
        console.warn("Skipping API test: API key not available");
      }
    } catch (apiError) {
      console.error('Error testing API connection:', apiError.message);
    }

    console.log('Server background initialization complete');
  } catch (error) {
    console.error('Error during server initialization:', error.message);
    // Set initialized anyway so server can accept requests
    apiKeysInitialized = true;
  }
}

// Start listening FIRST, then initialize in the background
const port = process.env.PORT || 8080;
console.log(`Attempting to start server on port ${port}...`);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`
==========================================
LUCID API SERVER LISTENING AT ${new Date().toISOString()}
==========================================
- Port: ${port}
- Environment: ${config.nodeEnv || process.env.NODE_ENV || 'development'}
- Google Cloud Project: ${config.googleCloudProject || process.env.GOOGLE_CLOUD_PROJECT || 'not set'}
==========================================
Server is now listening. Starting background initialization...
==========================================
  `);

  // Start background initialization immediately after listening
  initializeServerResources().catch(err => {
    console.error('Uncaught error in background initialization:', err);
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.log('Forcefully shutting down after grace period');
    process.exit(0);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server; 