require('dotenv').config();
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Initialize Secret Manager client (only in production)
let secretManagerClient;
if (process.env.NODE_ENV === 'production' || process.env.GOOGLE_CLOUD_PROJECT) {
  try {
    secretManagerClient = new SecretManagerServiceClient();
    console.log('Secret Manager client initialized');
  } catch (error) {
    console.error('Failed to initialize Secret Manager client:', error.message);
  }
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
  if (!secretManagerClient) {
    console.warn(`Cannot access secret ${secretName}: Secret Manager client not initialized`);
    return null;
  }
  
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      console.warn('GOOGLE_CLOUD_PROJECT environment variable not set');
      return null;
    }
    
    console.log(`Accessing secret ${secretName} from project ${projectId}`);
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    
    console.log(`Fetching secret from: ${name}`);
    const [version] = await secretManagerClient.accessSecretVersion({ name });
    const secretValue = version.payload.data.toString('utf8');
    
    console.log(`Successfully retrieved secret ${secretName} (length: ${secretValue.length})`);
    
    // Sanitize the API key value before returning
    return sanitizeApiKey(secretValue);
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error.message);
    if (error.details) {
      console.error('Error details:', error.details);
    }
    return null;
  }
}

// Function to normalize API endpoint URLs
function normalizeApiEndpoint(url) {
  if (!url) return '';
  
  // Ensure URL has a protocol prefix
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  // Remove trailing slash if present
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Known alternatives for DeepSeek API endpoints
const DEEPSEEK_API_ALTERNATIVES = [
  'https://api.deepseek.ai',
  'https://api.deepseek.com',
  'https://api-prod.deepseek.com',
  'https://api.deepseek-api.com'
];

// Initialize with environment variables, will be overridden by secrets if available
const config = {
  // Server configuration
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API Endpoints - default placeholders, will be overridden
  deepseekApiEndpoint: normalizeApiEndpoint(process.env.DEEPSEEK_API_ENDPOINT || DEEPSEEK_API_ALTERNATIVES[0]),
  deepseekApiKey: sanitizeApiKey(process.env.DEEPSEEK_API_KEY || ''),
  
  // Alternative DeepSeek endpoints to try if the primary fails
  deepseekApiAlternatives: DEEPSEEK_API_ALTERNATIVES,
  
  // Web search configuration
  disableSyntheticFallback: true, // Always disable synthetic responses
  
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
    enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === 'true' || process.env.NODE_ENV === 'development',
    // Make synthetic responses explicitly disabled
    disableSyntheticFallback: true
  },
  
  // Calculate if this is a production environment
  get isProduction() {
    return this.nodeEnv === 'production';
  }
};

// Log core configuration
console.log(`[CONFIG] Environment: ${config.nodeEnv}`);
console.log(`[CONFIG] Project ID: ${process.env.GOOGLE_CLOUD_PROJECT || 'not set'}`);
console.log(`[CONFIG] Secret Manager available: ${!!secretManagerClient}`);

// Load secrets from Secret Manager (with promises to ensure they're loaded)
let secretPromises = [];

// Only attempt to load secrets if Secret Manager is configured
if (secretManagerClient && process.env.GOOGLE_CLOUD_PROJECT) {
  console.log('[CONFIG] Loading secrets from Secret Manager...');
  
  // Get DeepSeek API Key
  const loadDeepseekApiKey = async () => {
    try {
      const deepseekApiKey = await getSecret('DEEPSEEK_API_KEY');
      if (deepseekApiKey) {
        config.deepseekApiKey = deepseekApiKey;
        console.log('[CONFIG] DeepSeek API Key loaded from Secret Manager');
        console.log(`[CONFIG] DeepSeek API key length: ${deepseekApiKey.length}`);
        console.log(`[CONFIG] DeepSeek API key first 3 chars: ${deepseekApiKey.substring(0, 3)}...`);
      } else {
        console.warn('[CONFIG] Failed to load DeepSeek API Key from Secret Manager');
      }
    } catch (error) {
      console.error('[CONFIG] Error loading DeepSeek API Key:', error.message);
    }
  };
  secretPromises.push(loadDeepseekApiKey());
  
  // Get DeepSeek API Endpoint
  const loadDeepseekApiEndpoint = async () => {
    try {
      const deepseekApiEndpoint = await getSecret('DEEPSEEK_API_ENDPOINT');
      if (deepseekApiEndpoint) {
        config.deepseekApiEndpoint = normalizeApiEndpoint(deepseekApiEndpoint);
        console.log('[CONFIG] DeepSeek API Endpoint loaded from Secret Manager');
        console.log(`[CONFIG] DeepSeek API Endpoint: ${config.deepseekApiEndpoint}`);
      } else {
        console.warn('[CONFIG] Failed to load DeepSeek API Endpoint from Secret Manager');
      }
    } catch (error) {
      console.error('[CONFIG] Error loading DeepSeek API Endpoint:', error.message);
    }
  };
  secretPromises.push(loadDeepseekApiEndpoint());
  
  // Wait for all secrets to be loaded
  Promise.all(secretPromises).then(() => {
    console.log('[CONFIG] All secrets loaded');
    
    // Log configuration details
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
    
    // Test the API connection
    testApiConnection();
  }).catch(error => {
    console.error('[CONFIG] Error loading secrets:', error.message);
  });
} else {
  // No Secret Manager or Project ID, use environment variables
  console.log('[CONFIG] Secret Manager not available, using environment variables');
  console.log(`[CONFIG] DeepSeek API key available: ${config.deepseekApiKey ? 'Yes' : 'No'}`);
  console.log(`[CONFIG] DeepSeek API key length: ${config.deepseekApiKey?.length || 0}`);
  
  // Log API key for debugging (only first and last 3 characters)
  if (config.deepseekApiKey && config.deepseekApiKey.length > 6) {
    const firstThree = config.deepseekApiKey.substring(0, 3);
    const lastThree = config.deepseekApiKey.substring(config.deepseekApiKey.length - 3);
    console.log(`[CONFIG] DeepSeek API key format: ${firstThree}...${lastThree}`);
  }
  
  console.log(`[CONFIG] DeepSeek API endpoint: ${config.deepseekApiEndpoint}`);
  
  // Test the API connection
  testApiConnection();
}

// Test the API connection in development and production
function testApiConnection() {
  if (config.deepseekApiKey && config.deepseekApiEndpoint) {
    const axios = require('axios');
    
    const testHealthcheck = async () => {
      try {
        console.log(`[CONFIG] Testing API connectivity to ${config.deepseekApiEndpoint}...`);
        
        // Test endpoints in order of likelihood
        const endpointsToTry = [
          '/health',
          '/v1/health',
          '/api/health',
          '/api/v1/health',
          '/status'
        ];
        
        let success = false;
        
        for (const endpoint of endpointsToTry) {
          if (success) break;
          
          try {
            console.log(`[CONFIG] Testing endpoint: ${config.deepseekApiEndpoint}${endpoint}`);
            const response = await axios.get(`${config.deepseekApiEndpoint}${endpoint}`, {
              headers: {
                'Authorization': `Bearer ${config.deepseekApiKey}`,
                'Accept': 'application/json'
              },
              timeout: 5000
            });
            
            console.log(`[CONFIG] API healthcheck response from ${endpoint}: ${response.status}`);
            console.log(`[CONFIG] API connectivity test successful`);
            success = true;
          } catch (endpointError) {
            console.log(`[CONFIG] Endpoint ${endpoint} test failed: ${endpointError.message}`);
          }
        }
        
        // If health checks fail, try a fallback method
        if (!success) {
          try {
            console.log('[CONFIG] Trying fallback API test with product search endpoint...');
            
            const testUrl = `${config.deepseekApiEndpoint}/api/v1/product/search`;
            const testPayload = { query: 'test', max_tokens: 10 };
            
            const testResponse = await axios.post(testUrl, testPayload, {
              headers: {
                'Authorization': `Bearer ${config.deepseekApiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              timeout: 5000
            });
            
            if (testResponse.status < 400) {
              console.log('[CONFIG] API fallback test successful');
              success = true;
            }
          } catch (fallbackError) {
            console.log(`[CONFIG] Fallback API test failed: ${fallbackError.message}`);
          }
        }
        
        // If primary endpoint fails, try alternative endpoints
        if (!success && config.deepseekApiAlternatives) {
          for (const altEndpoint of config.deepseekApiAlternatives) {
            if (altEndpoint === config.deepseekApiEndpoint) continue; // Skip the primary endpoint
            
            try {
              console.log(`[CONFIG] Trying alternative API endpoint: ${altEndpoint}`);
              
              const response = await axios.get(`${altEndpoint}/health`, {
                headers: {
                  'Authorization': `Bearer ${config.deepseekApiKey}`,
                  'Accept': 'application/json'
                },
                timeout: 5000
              });
              
              if (response.status === 200 || response.status === 204) {
                console.log(`[CONFIG] Alternative API endpoint successful: ${altEndpoint}`);
                // Update the primary endpoint to use the working alternative
                config.deepseekApiEndpoint = altEndpoint;
                console.log(`[CONFIG] Updated primary endpoint to: ${altEndpoint}`);
                success = true;
                break;
              }
            } catch (altError) {
              console.log(`[CONFIG] Alternative endpoint ${altEndpoint} failed: ${altError.message}`);
            }
          }
        }
        
        if (!success) {
          console.error('[CONFIG] All API endpoint tests failed');
        }
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
  } else {
    console.warn('[CONFIG] API connectivity test skipped (missing API key or endpoint)');
  }
}

module.exports = config; 