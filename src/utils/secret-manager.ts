/**
 * Secret Manager utilities
 * Handles secure retrieval of API keys and endpoints from Google Cloud Secret Manager
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from './logger';

// Create the Secret Manager client
let secretManagerClient: SecretManagerServiceClient | null = null;

// Enhanced initialization with better error handling
try {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId) {
    logger.info(`Initializing Secret Manager client for project: ${projectId}`);
    
    // Check if running in Cloud Run (Google Cloud) environment
    if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB) {
      logger.info('Detected Cloud Run environment, using implicit authentication');
      secretManagerClient = new SecretManagerServiceClient();
    } else {
      // Check if GOOGLE_APPLICATION_CREDENTIALS is set
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credentialsPath) {
        logger.info(`Using credentials from: ${credentialsPath}`);
        secretManagerClient = new SecretManagerServiceClient({
          keyFilename: credentialsPath
        });
      } else {
        logger.info('No explicit credentials file found, using default authentication');
        secretManagerClient = new SecretManagerServiceClient();
      }
    }
    
    logger.info('Secret Manager client initialized successfully');
  } else {
    logger.warn('GOOGLE_CLOUD_PROJECT environment variable not set, Secret Manager client initialization skipped');
  }
} catch (error) {
  const err = error as Error;
  logger.error('Failed to initialize Secret Manager client:', err.message);
  logger.error('Secret Manager initialization error details:', err);
}

/**
 * Function to sanitize API keys
 * Cleans API keys to prevent issues with newlines, control characters, etc.
 * 
 * @param apiKey - The API key to sanitize
 * @returns Sanitized API key
 */
export function sanitizeApiKey(apiKey: string | null | undefined): string {
  if (!apiKey) return '';
  if (typeof apiKey !== 'string') {
    logger.warn('sanitizeApiKey received non-string input, converting...');
    apiKey = String(apiKey);
  }

  // Apply multiple layers of sanitization for safety
  const sanitized = apiKey
    .replace(/[\r\n\t]+/g, '') // Remove line breaks and tabs aggressively
    .replace(/[^\x21-\x7E]/g, '') // Remove non-printable ASCII chars
    .trim(); // Remove leading/trailing whitespace

  // Log if any changes were made
  if (sanitized.length !== apiKey.length) {
    logger.warn(`Warning: API key was sanitized, removed ${apiKey.length - sanitized.length} characters`);
  }

  return sanitized;
}

/**
 * Function to validate API keys
 * Ensures an API key meets basic validity requirements
 * 
 * @param apiKey - The API key to validate
 * @returns Whether the API key is valid
 */
export function isValidApiKey(apiKey: string | null | undefined): boolean {
  if (!apiKey) return false;
  if (typeof apiKey !== 'string') return false;

  // Sanitize the key first to ensure it doesn't have invalid characters
  const sanitizedKey = sanitizeApiKey(apiKey);

  // Check minimum length and format (adjust prefix check based on your requirements)
  // Adjust these criteria based on the actual format of your API keys
  return sanitizedKey.length >= 8; // Minimum length check only
}

/**
 * Function to get a secret from Google Cloud Secret Manager
 * 
 * @param secretName - The name of the secret to retrieve
 * @returns The secret value or null if not found
 */
export async function getSecretFromGCP(secretName: string): Promise<string | null> {
  if (!secretManagerClient) {
    logger.error('Secret Manager client not initialized, cannot retrieve secret:', secretName);
    return null;
  }

  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      logger.error('GOOGLE_CLOUD_PROJECT not set, cannot access Secret Manager');
      return null;
    }

    logger.info(`Attempting to access secret "${secretName}" from project "${projectId}"`);
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    logger.info(`Full secret path: ${name}`);
    
    try {
      logger.info('Calling SecretManagerServiceClient.accessSecretVersion...');
      
      // Use any type to bypass TypeScript checking - the actual Google Cloud library
      // expects an object with a name property
      const client = secretManagerClient as any;
      const [version] = await client.accessSecretVersion({ name });
      
      logger.info('Successfully retrieved secret version');
      
      if (!version || !version.payload || !version.payload.data) {
        logger.error('Retrieved secret version is missing payload data');
        return null;
      }
      
      const secretValue = version.payload.data.toString('utf8');
      
      if (!secretValue) {
        logger.error(`Retrieved empty value for secret: ${secretName}`);
        return null;
      }
      
      logger.info(`Successfully retrieved secret value for ${secretName} (length: ${secretValue.length})`);
      return sanitizeApiKey(secretValue);
    } catch (accessError) {
      const err = accessError as Error & { code?: string; details?: string };
      logger.error(`Error accessing secret version: ${err.message}`);
      if (err.code) {
        logger.error(`Error code: ${err.code}`);
      }
      if (err.details) {
        logger.error(`Error details: ${err.details}`);
      }
      throw err;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error accessing Secret Manager for secret ${secretName}:`, err.message);
    logger.error(`Error stack: ${err.stack}`);
    return null;
  }
}

/**
 * Function to get a secret from environment variables (fallback for development)
 * 
 * @param secretName - The name of the secret to retrieve from environment variables
 * @returns The secret value or null if not found
 */
export function getSecretFromEnv(secretName: string): string | null {
  // Map secret names to environment variable names
  const envMapping: Record<string, string> = {
    'DEEPSEEK_API_KEY': 'DEEPSEEK_API_KEY',
    'DEEPSEEK_API_ENDPOINT': 'DEEPSEEK_API_ENDPOINT',
    'OPENAI_API_KEY': 'OPENAI_API_KEY',
    'OPENAI_API_ENDPOINT': 'OPENAI_API_BASE_URL'
  };
  
  const envVar = envMapping[secretName] || secretName;
  
  const value = process.env[envVar];
  if (!value) {
    logger.warn(`Environment variable ${envVar} is not set`);
    return null;
  }
  
  logger.info(`Using value from environment variable ${envVar} for ${secretName}`);
  return sanitizeApiKey(value);
}

/**
 * Function to get a secret, prioritizing GCP Secret Manager over environment variables
 * 
 * @param secretName - The name of the secret to retrieve
 * @returns The secret value or null if not found
 */
export async function getSecret(secretName: string): Promise<string | null> {
  logger.info(`Retrieving secret: ${secretName}`);
  
  // First check if we should use Secret Manager
  if (!process.env.DISABLE_SECRET_MANAGER && secretManagerClient && process.env.GOOGLE_CLOUD_PROJECT) {
    try {
      // Try to get from Secret Manager
      const gcpSecret = await getSecretFromGCP(secretName);
      if (gcpSecret) {
        logger.info(`Successfully retrieved ${secretName} from GCP Secret Manager`);
        return gcpSecret;
      }
    } catch (error) {
      const err = error as Error;
      logger.error(`Error retrieving ${secretName} from Secret Manager:`, err.message);
    }
  } else {
    logger.info('Secret Manager is disabled or not configured, skipping GCP secret retrieval');
  }
  
  // Fall back to environment variable
  logger.info(`Falling back to environment variables for ${secretName}`);
  return getSecretFromEnv(secretName);
}

/**
 * Interface for application configuration
 */
interface AppConfig {
  deepseekApiKey?: string | null;
  deepseekApiEndpoint?: string | null;
  openaiApiKey?: string | null;
  openaiApiEndpoint?: string | null;
  openai?: {
    apiKey?: string | null;
  };
  [key: string]: any;
}

/**
 * Async function to initialize API keys from Secret Manager or environment variables
 * 
 * @returns Whether initialization was successful
 */
export async function initializeApiKeys(): Promise<boolean> {
  logger.info("Initializing API keys from Secret Manager or environment variables...");
  
  try {
    // Load configuration dynamically
    let config: AppConfig;
    try {
      config = require('../config/config');
      logger.info('Successfully loaded config module');
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to load config module:', error.message);
      config = {
        deepseekApiKey: null,
        deepseekApiEndpoint: null,
        openaiApiKey: null,
        openaiApiEndpoint: null
      };
      logger.info('Created default config object');
    }
    
    // Print available environment variables for debugging
    logger.info('Available environment variables relevant to secret management:');
    [
      'NODE_ENV', 
      'GOOGLE_CLOUD_PROJECT', 
      'K_SERVICE', 
      'CLOUD_RUN_JOB', 
      'GOOGLE_APPLICATION_CREDENTIALS',
      'DISABLE_SECRET_MANAGER'
    ].forEach(varName => {
      logger.info(`  ${varName}: ${process.env[varName] || 'not set'}`);
    });
    
    // Get the DeepSeek API key
    const deepseekApiKey = await getSecret('DEEPSEEK_API_KEY');
    if (deepseekApiKey) {
      logger.info(`DeepSeek API key configured successfully (length: ${deepseekApiKey.length})`);
      config.deepseekApiKey = deepseekApiKey;
    } else {
      logger.warn('No DeepSeek API key found in Secret Manager or environment');
    }
    
    // Get the DeepSeek API endpoint
    const deepseekApiEndpoint = await getSecret('DEEPSEEK_API_ENDPOINT');
    if (deepseekApiEndpoint) {
      config.deepseekApiEndpoint = deepseekApiEndpoint;
      logger.info(`DeepSeek API endpoint configured: ${deepseekApiEndpoint}`);
    } else {
      config.deepseekApiEndpoint = "https://api.deepseek.com";  // Default fallback
      logger.info(`Using default DeepSeek API endpoint: ${config.deepseekApiEndpoint}`);
    }
    
    // Get OpenAI API key (optional)
    const openaiApiKey = await getSecret('OPENAI_API_KEY');
    if (openaiApiKey) {
      config.openaiApiKey = openaiApiKey;
      config.openai = config.openai || {};
      config.openai.apiKey = openaiApiKey;
      logger.info('OpenAI API key configured');
    }
    
    // Get OpenAI API endpoint (optional)
    const openaiApiEndpoint = await getSecret('OPENAI_API_ENDPOINT');
    if (openaiApiEndpoint) {
      config.openaiApiEndpoint = openaiApiEndpoint;
      logger.info(`OpenAI API endpoint configured: ${openaiApiEndpoint}`);
    } else if (config.openaiApiKey) {
      config.openaiApiEndpoint = "https://api.openai.com";  // Default fallback
      logger.info(`Using default OpenAI API endpoint: ${config.openaiApiEndpoint}`);
    }
    
    // Record initialization status
    const initialized = !!(config.deepseekApiKey && config.deepseekApiEndpoint);
    logger.info(`API keys initialization ${initialized ? 'succeeded' : 'failed'}`);
    
    return initialized;
  } catch (error) {
    const err = error as Error;
    logger.error('Error initializing API keys:', err.message);
    logger.error('Stack trace:', err.stack);
    return false;
  }
}

export default {
  getSecret,
  getSecretFromGCP,
  getSecretFromEnv,
  sanitizeApiKey,
  isValidApiKey,
  initializeApiKeys
}; 