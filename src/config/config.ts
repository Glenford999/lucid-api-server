import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Configuration Types
 * TypeScript interfaces for configuration
 */

// Configuration interface definition
export interface Config {
  // Server configuration
  port: number;
  nodeEnv: string;
  isDevelopment: boolean;
  
  // API keys and endpoints
  deepseekApiKey: string | null;
  deepseekApiEndpoint: string;
  
  // OpenAI API settings
  openaiApiKey: string | null;
  openaiApiEndpoint: string;
  openai: {
    apiKey: string | null;
    model: string;
  };
  
  // Supabase settings
  supabase: {
    url: string | null;
    anonKey: string | null;
    serviceRoleKey: string | null;
  };
  
  // Authentication settings
  authEnabled: boolean;
  apiKeys: string[];
  
  // Web search configuration
  disableSyntheticFallback: boolean;
  
  // CORS Configuration
  allowedOrigins: string;
  corsOrigins: string[];
  
  // Cache configuration
  cacheEnabled: boolean;
  cacheTtl: number;
  
  // Rate limiting configuration
  rateLimitRequests: number;
  
  // Logging configuration
  logLevel: string;
  structuredLogging: boolean;
  omitHealthLog: boolean;
  
  // Feature flags
  enableMockResponses: boolean;
  enableRateLimiting: boolean;
  enableRequestLogging: boolean;
  features: {
    useMockData: boolean;
    enableDebugLogging: boolean;
    disableSyntheticFallback: boolean;
  };
  
  // Calculated properties
  isProduction: boolean;
}

/**
 * Default configuration
 */
const config: Config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  
  // Authentication settings
  authEnabled: process.env.AUTH_ENABLED === 'true',
  apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],
  
  // DeepSeek API settings
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || null,
  deepseekApiEndpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.ai',
  
  // OpenAI API settings
  openaiApiKey: process.env.OPENAI_API_KEY || null,
  openaiApiEndpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo',
  },
  
  // Supabase settings
  supabase: {
    url: process.env.SUPABASE_URL || null,
    anonKey: process.env.SUPABASE_ANON_KEY || null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  },
  
  // Feature flags
  enableMockResponses: process.env.ENABLE_MOCK_RESPONSES === 'true',
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
  
  // Web search configuration
  disableSyntheticFallback: process.env.DISABLE_SYNTHETIC_FALLBACK === 'true',
  
  // CORS Configuration
  allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  
  // Cache configuration
  cacheEnabled: process.env.CACHE_ENABLED === 'true',
  cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10),
  
  // Rate limiting configuration
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '10', 10),
  
  // Logging configuration
  structuredLogging: process.env.STRUCTURED_LOGGING === 'true',
  omitHealthLog: process.env.OMIT_HEALTH_LOG === 'true',
  
  // Feature flags
  features: {
    useMockData: process.env.USE_MOCK_DATA === 'true',
    enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === 'true',
    disableSyntheticFallback: process.env.DISABLE_SYNTHETIC_FALLBACK === 'true',
  },
};

/**
 * Get a safe version of the config (without sensitive keys) for logging
 */
export function getSafeConfig(): Omit<Config, 'deepseekApiKey' | 'openaiApiKey' | 'apiKeys'> {
  const safeConfig = { ...config };
  delete (safeConfig as any).deepseekApiKey;
  delete (safeConfig as any).openaiApiKey;
  delete (safeConfig as any).apiKeys;
  delete (safeConfig as any).openai.apiKey;
  delete (safeConfig as any).supabase.anonKey;
  delete (safeConfig as any).supabase.serviceRoleKey;
  return safeConfig;
}

export default config; 