require('dotenv').config();
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Initialize Secret Manager client (only in production)
let secretManagerClient;
if (process.env.NODE_ENV === 'production') {
  secretManagerClient = new SecretManagerServiceClient();
}

// Function to sanitize API keys to prevent HTTP header issues
function sanitizeApiKey(apiKey) {
  if (!apiKey) return '';
  
  // Remove any newlines, carriage returns, control characters, and trim whitespace
  return apiKey.trim()
    .replace(/\r?\n|\r/g, '')        // Remove newlines and carriage returns
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, '');            // Remove any remaining whitespace
}

// Function to access secrets from Secret Manager
async function getSecret(secretName) {
  if (!secretManagerClient) return null;
  
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      console.warn('GOOGLE_CLOUD_PROJECT environment variable not set');
      return null;
    }
    
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretManagerClient.accessSecretVersion({ name });
    const secretValue = version.payload.data.toString('utf8');
    
    // Sanitize the API key value before returning
    return sanitizeApiKey(secretValue);
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error);
    return null;
  }
}

// Initialize with environment variables, will be overridden by secrets if available
const config = {
  // Server configuration
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API Endpoints
  deepseekApiEndpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com',
  deepseekApiKey: sanitizeApiKey(process.env.DEEPSEEK_API_KEY || ''),
  
  // Web search configuration
  disableSyntheticFallback: process.env.DISABLE_SYNTHETIC_FALLBACK === 'true',
  
  // CORS Configuration
  allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  
  // Cache configuration
  cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  cacheTtl: parseInt(process.env.CACHE_TTL || '86400000', 10), // 24 hours in milliseconds
  
  // Rate limiting configuration
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '60', 10), // requests per minute
  
  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  structuredLogging: process.env.STRUCTURED_LOGGING === 'true',
  omitHealthLog: process.env.OMIT_HEALTH_LOG === 'true',
  
  // Feature flags
  features: {
    useMockData: false, // Always disable mock data
    enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === 'true' || process.env.NODE_ENV === 'development'
  },
  
  // Calculate if this is a production environment
  get isProduction() {
    return this.nodeEnv === 'production';
  }
};

// Log configuration details
console.log(`[CONFIG] Environment: ${config.nodeEnv}`);
console.log(`[CONFIG] DeepSeek API key available: ${config.deepseekApiKey ? 'Yes' : 'No'}`);
console.log(`[CONFIG] DeepSeek API key length: ${config.deepseekApiKey?.length || 0}`);

// Log API key for debugging (only first and last 3 characters)
if (config.deepseekApiKey && config.deepseekApiKey.length > 6) {
  const firstThree = config.deepseekApiKey.substring(0, 3);
  const lastThree = config.deepseekApiKey.substring(config.deepseekApiKey.length - 3);
  console.log(`[CONFIG] DeepSeek API key format: ${firstThree}...${lastThree}`);
}

console.log(`[CONFIG] DeepSeek API endpoint: ${config.deepseekApiEndpoint}`);
console.log(`[CONFIG] Mock data enabled: ${config.features.useMockData}`);

// Try making a test request to verify API key works
if (config.nodeEnv === 'development' && config.deepseekApiKey && config.deepseekApiEndpoint) {
  const axios = require('axios');
  const testHealthcheck = async () => {
    try {
      console.log(`[CONFIG] Testing API connectivity to ${config.deepseekApiEndpoint}...`);
      const response = await axios.get(`${config.deepseekApiEndpoint}/health`, {
        headers: {
          'Authorization': `Bearer ${config.deepseekApiKey}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      console.log(`[CONFIG] API healthcheck response: ${response.status}`);
      console.log(`[CONFIG] API connectivity test successful`);
    } catch (error) {
      console.error(`[CONFIG] API connectivity test failed:`, error.message);
      if (error.response) {
        console.error(`[CONFIG] API response status:`, error.response.status);
        console.error(`[CONFIG] API response data:`, error.response.data);
      }
    }
  };
  
  // Run the test but don't block startup
  testHealthcheck().catch(err => console.error('[CONFIG] API test error:', err.message));
}

// Load secrets if in production
if (process.env.NODE_ENV === 'production') {
  // Initialize secrets asynchronously, will be available after startup
  (async () => {
    try {
      // Load DeepSeek API Key from Secret Manager
      const deepseekApiKey = await getSecret('DEEPSEEK_API_KEY');
      if (deepseekApiKey) {
        config.deepseekApiKey = deepseekApiKey;
        console.log('DeepSeek API Key loaded from Secret Manager');
        console.log(`DeepSeek API key length (from Secret Manager): ${deepseekApiKey.length}`);
      }
      
      // Additional secrets can be loaded here
      
    } catch (error) {
      console.error('Error loading secrets:', error);
    }
  })();
}

module.exports = config; 