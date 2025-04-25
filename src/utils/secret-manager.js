/**
 * Secret Manager utilities
 * Handles secure retrieval of API keys and endpoints from Google Cloud Secret Manager
 */

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// Create the Secret Manager client
let secretManagerClient = null;

// Enhanced initialization with better error handling
try {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId) {
    console.log(`Initializing Secret Manager client for project: ${projectId}`);
    
    // Check if running in Cloud Run (Google Cloud) environment
    if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB) {
      console.log('Detected Cloud Run environment, using implicit authentication');
      secretManagerClient = new SecretManagerServiceClient();
    } else {
      // Check if GOOGLE_APPLICATION_CREDENTIALS is set
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credentialsPath) {
        console.log(`Using credentials from: ${credentialsPath}`);
        secretManagerClient = new SecretManagerServiceClient({
          keyFilename: credentialsPath
        });
      } else {
        console.log('No explicit credentials file found, using default authentication');
        secretManagerClient = new SecretManagerServiceClient();
      }
    }
    
    console.log('Secret Manager client initialized successfully');
  } else {
    console.warn('GOOGLE_CLOUD_PROJECT environment variable not set, Secret Manager client initialization skipped');
  }
} catch (error) {
  console.error('Failed to initialize Secret Manager client:', error.message);
  console.error('Secret Manager initialization error details:', error);
}

// Function to sanitize API keys
function sanitizeApiKey(apiKey) {
  if (!apiKey) return '';
  if (typeof apiKey !== 'string') {
    console.warn('sanitizeApiKey received non-string input, converting...');
    apiKey = String(apiKey);
  }

  // Apply multiple layers of sanitization for safety
  const sanitized = apiKey
    .replace(/[\r\n\t]+/g, '') // Remove line breaks and tabs aggressively
    .replace(/[^\x21-\x7E]/g, '') // Remove non-printable ASCII chars
    .trim(); // Remove leading/trailing whitespace

  // Log if any changes were made
  if (sanitized.length !== apiKey.length) {
    console.warn(`Warning: API key was sanitized, removed ${apiKey.length - sanitized.length} characters`);
  }

  return sanitized;
}

// Function to validate API keys
function isValidApiKey(apiKey) {
  if (!apiKey) return false;
  if (typeof apiKey !== 'string') return false;

  // Sanitize the key first to ensure it doesn't have invalid characters
  const sanitizedKey = sanitizeApiKey(apiKey);

  // Check minimum length and format (adjust prefix check based on your requirements)
  // Adjust these criteria based on the actual format of your API keys
  return sanitizedKey.length >= 8; // Minimum length check only
}

// Function to get a secret from Google Cloud Secret Manager
async function getSecretFromGCP(secretName) {
  if (!secretManagerClient) {
    console.error('Secret Manager client not initialized, cannot retrieve secret:', secretName);
    return null;
  }

  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      console.error('GOOGLE_CLOUD_PROJECT not set, cannot access Secret Manager');
      return null;
    }

    console.log(`Attempting to access secret "${secretName}" from project "${projectId}"`);
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    console.log(`Full secret path: ${name}`);
    
    try {
      console.log('Calling SecretManagerServiceClient.accessSecretVersion...');
      const [version] = await secretManagerClient.accessSecretVersion({name});
      console.log('Successfully retrieved secret version');
      
      if (!version || !version.payload || !version.payload.data) {
        console.error('Retrieved secret version is missing payload data');
        return null;
      }
      
      const secretValue = version.payload.data.toString('utf8');
      
      if (!secretValue) {
        console.error(`Retrieved empty value for secret: ${secretName}`);
        return null;
      }
      
      console.log(`Successfully retrieved secret value for ${secretName} (length: ${secretValue.length})`);
      return sanitizeApiKey(secretValue);
    } catch (accessError) {
      console.error(`Error accessing secret version: ${accessError.message}`);
      if (accessError.code) {
        console.error(`Error code: ${accessError.code}`);
      }
      if (accessError.details) {
        console.error(`Error details: ${accessError.details}`);
      }
      throw accessError;
    }
  } catch (error) {
    console.error(`Error accessing Secret Manager for secret ${secretName}:`, error.message);
    console.error(`Error stack: ${error.stack}`);
    return null;
  }
}

// Function to get a secret from environment variables (fallback for development)
function getSecretFromEnv(secretName) {
  // Map secret names to environment variable names
  const envMapping = {
    'DEEPSEEK_API_KEY': 'DEEPSEEK_API_KEY',
    'DEEPSEEK_API_ENDPOINT': 'DEEPSEEK_API_ENDPOINT',
    'OPENAI_API_KEY': 'OPENAI_API_KEY',
    'OPENAI_API_ENDPOINT': 'OPENAI_API_BASE_URL'
  };
  
  const envVar = envMapping[secretName] || secretName;
  
  const value = process.env[envVar];
  if (!value) {
    console.warn(`Environment variable ${envVar} is not set`);
    return null;
  }
  
  console.log(`Using value from environment variable ${envVar} for ${secretName}`);
  return sanitizeApiKey(value);
}

// Function to get a secret, prioritizing GCP Secret Manager over environment variables
async function getSecret(secretName) {
  console.log(`Retrieving secret: ${secretName}`);
  
  // First check if we should use Secret Manager
  if (!process.env.DISABLE_SECRET_MANAGER && secretManagerClient && process.env.GOOGLE_CLOUD_PROJECT) {
    try {
      // Try to get from Secret Manager
      const gcpSecret = await getSecretFromGCP(secretName);
      if (gcpSecret) {
        console.log(`Successfully retrieved ${secretName} from GCP Secret Manager`);
        return gcpSecret;
      }
    } catch (error) {
      console.error(`Error retrieving ${secretName} from Secret Manager:`, error.message);
    }
  } else {
    console.log('Secret Manager is disabled or not configured, skipping GCP secret retrieval');
  }
  
  // Fall back to environment variable
  console.log(`Falling back to environment variables for ${secretName}`);
  return getSecretFromEnv(secretName);
}

// Async function to initialize API keys from Secret Manager or environment variables
async function initializeApiKeys() {
  console.log("Initializing API keys from Secret Manager or environment variables...");
  
  try {
    // Load configuration dynamically
    let config;
    try {
      config = require('../config/config');
      console.log('Successfully loaded config module');
    } catch (err) {
      console.error('Failed to load config module:', err.message);
      config = {
        deepseekApiKey: null,
        deepseekApiEndpoint: null,
        openaiApiKey: null,
        openaiApiEndpoint: null
      };
      console.log('Created default config object');
    }
    
    // Print available environment variables for debugging
    console.log('Available environment variables relevant to secret management:');
    [
      'NODE_ENV', 
      'GOOGLE_CLOUD_PROJECT', 
      'K_SERVICE', 
      'CLOUD_RUN_JOB', 
      'GOOGLE_APPLICATION_CREDENTIALS',
      'DISABLE_SECRET_MANAGER'
    ].forEach(varName => {
      console.log(`  ${varName}: ${process.env[varName] || 'not set'}`);
    });
    
    // Get the DeepSeek API key
    const deepseekApiKey = await getSecret('DEEPSEEK_API_KEY');
    if (deepseekApiKey) {
      console.log(`DeepSeek API key configured successfully (length: ${deepseekApiKey.length})`);
      config.deepseekApiKey = deepseekApiKey;
    } else {
      console.warn('No DeepSeek API key found in Secret Manager or environment');
    }
    
    // Get the DeepSeek API endpoint
    const deepseekApiEndpoint = await getSecret('DEEPSEEK_API_ENDPOINT');
    if (deepseekApiEndpoint) {
      config.deepseekApiEndpoint = deepseekApiEndpoint;
      console.log(`DeepSeek API endpoint configured: ${deepseekApiEndpoint}`);
    } else {
      config.deepseekApiEndpoint = "https://api.deepseek.com";  // Default fallback
      console.log(`Using default DeepSeek API endpoint: ${config.deepseekApiEndpoint}`);
    }
    
    // Get OpenAI API key (optional)
    const openaiApiKey = await getSecret('OPENAI_API_KEY');
    if (openaiApiKey) {
      config.openaiApiKey = openaiApiKey;
      config.openai = config.openai || {};
      config.openai.apiKey = openaiApiKey;
      console.log('OpenAI API key configured');
    }
    
    // Get OpenAI API endpoint (optional)
    const openaiApiEndpoint = await getSecret('OPENAI_API_ENDPOINT');
    if (openaiApiEndpoint) {
      config.openaiApiEndpoint = openaiApiEndpoint;
      console.log(`OpenAI API endpoint configured: ${openaiApiEndpoint}`);
    } else if (config.openaiApiKey) {
      config.openaiApiEndpoint = "https://api.openai.com";  // Default fallback
      console.log(`Using default OpenAI API endpoint: ${config.openaiApiEndpoint}`);
    }
    
    // Record initialization status
    const initialized = !!(config.deepseekApiKey && config.deepseekApiEndpoint);
    console.log(`API keys initialization ${initialized ? 'succeeded' : 'failed'}`);
    
    return initialized;
  } catch (error) {
    console.error('Error initializing API keys:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

module.exports = {
  getSecret,
  getSecretFromGCP,
  getSecretFromEnv,
  sanitizeApiKey,
  isValidApiKey,
  initializeApiKeys
}; 