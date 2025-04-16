/**
 * Simplified Secret Manager utilities
 * Handles secure retrieval of API keys and endpoints from environment variables
 */

// Simplified version that uses environment variables instead of Secret Manager
console.log('Loading simplified Secret Manager module...');

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

  // Check minimum length and format (adjust prefix check if needed)
  return sanitizedKey.length >= 20 && (sanitizedKey.startsWith('sk-') || sanitizedKey.startsWith('ds-'));
}

// Function to get a secret from environment variables
function getSecretFromEnv(secretName) {
  // Map secret names to environment variable names
  const envMapping = {
    'DEEPSEEK_API_KEY': 'DEEPSEEK_API_KEY',
    'DEEPSEEK_API_ENDPOINT': 'DEEPSEEK_API_ENDPOINT',
    'OPENAI_API_KEY': 'OPENAI_API_KEY',
    'OPENAI_API_ENDPOINT': 'OPENAI_API_BASE_URL'
  };
  
  const envVar = envMapping[secretName];
  if (!envVar) {
    console.warn(`No environment mapping for secret: ${secretName}`);
    return null;
  }
  
  const value = process.env[envVar];
  if (!value) {
    console.warn(`Environment variable ${envVar} is not set`);
    return null;
  }
  
  console.log(`Using environment for ${secretName}`);
  return value;
}

// Async function to initialize API keys from environment variables
async function initializeApiKeys() {
  console.log("Initializing API keys from environment variables...");
  
  // This function handles fetching secrets from the environment
  // and configuring them in the application
  
  try {
    // Load configuration dynamically
    let config;
    try {
      config = require('../config/config');
    } catch (err) {
      console.error('Failed to load config module:', err.message);
      config = {
        deepseekApiKey: null,
        deepseekApiEndpoint: null,
        openaiApiKey: null,
        openaiApiEndpoint: null
      };
    }
    
    // Get the DeepSeek API key
    const deepseekApiKey = getSecretFromEnv('DEEPSEEK_API_KEY');
    if (deepseekApiKey) {
      config.deepseekApiKey = deepseekApiKey;
      console.log('DeepSeek API key is configured from environment variable');
    } else {
      console.warn('No DeepSeek API key found in environment');
    }
    
    // Get the DeepSeek API endpoint
    const deepseekApiEndpoint = getSecretFromEnv('DEEPSEEK_API_ENDPOINT');
    if (deepseekApiEndpoint) {
      config.deepseekApiEndpoint = deepseekApiEndpoint;
      console.log('DeepSeek API endpoint configured from environment');
    } else {
      config.deepseekApiEndpoint = "https://api.deepseek.com";  // Default fallback
      console.log('Using default DeepSeek API endpoint');
    }
    
    // Get OpenAI API key (optional)
    const openaiApiKey = getSecretFromEnv('OPENAI_API_KEY');
    if (openaiApiKey) {
      config.openaiApiKey = openaiApiKey;
      console.log('OpenAI API key is configured from environment variable');
    }
    
    // Get OpenAI API endpoint (optional)
    const openaiApiEndpoint = getSecretFromEnv('OPENAI_API_ENDPOINT');
    if (openaiApiEndpoint) {
      config.openaiApiEndpoint = openaiApiEndpoint;
      console.log('OpenAI API endpoint configured from environment');
    } else if (config.openaiApiKey) {
      config.openaiApiEndpoint = "https://api.openai.com";  // Default fallback
      console.log('Using default OpenAI API endpoint');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing API keys:', error.message);
    return false;
  }
}

module.exports = {
  getSecretFromEnv,
  sanitizeApiKey,
  isValidApiKey,
  initializeApiKeys
}; 