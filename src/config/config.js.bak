require('dotenv').config();
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Initialize Secret Manager client (only in production)
let secretManagerClient;
if (process.env.NODE_ENV === 'production') {
  secretManagerClient = new SecretManagerServiceClient();
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
    return version.payload.data.toString('utf8');
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
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  
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
  omitHealthLog: process.env.OMIT_HEALTH_LOG === 'true'
};

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
      }
      
      // Additional secrets can be loaded here
      
    } catch (error) {
      console.error('Error loading secrets:', error);
    }
  })();
}

module.exports = config; 