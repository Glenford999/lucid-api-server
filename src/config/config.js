/**
 * Configuration settings for the Lucid API Server
 * Loads from environment variables with reasonable defaults
 */

// Load environment variables from .env if available
require('dotenv').config();

// Basic server configuration
const config = {
  // Server settings
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Google Cloud configuration
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  
  // API configurations (these will be populated by secret-manager.js)
  deepseekApiKey: null,
  deepseekApiEndpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com',
  openaiApiKey: null,
  openaiApiEndpoint: null,
  
  // CORS configuration
  corsAllowedOrigins: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['*'],
  
  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_REQUESTS) || 60, // limit each IP to 60 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    structured: process.env.STRUCTURED_LOGGING === 'true',
    omitHealthLog: process.env.OMIT_HEALTH_LOG !== 'false',
  },
  
  // Cache settings
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 86400000, // 24 hours in milliseconds
  },
  
  // Feature flags
  features: {
    disableSyntheticFallback: process.env.DISABLE_SYNTHETIC_FALLBACK === 'true',
  }
};

// Log configuration on startup (without sensitive values)
const safeConfig = { ...config };
delete safeConfig.deepseekApiKey;
delete safeConfig.openaiApiKey;

console.log('Loaded configuration:', JSON.stringify(safeConfig, null, 2));

module.exports = config; 