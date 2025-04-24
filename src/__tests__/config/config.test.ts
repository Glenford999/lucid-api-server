import config, { getSafeConfig } from '../../config/config';

describe('Config Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Save original process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  it('should load default configuration values', () => {
    // Check some default values
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('nodeEnv');
    expect(config).toHaveProperty('isProduction');
    expect(config).toHaveProperty('isDevelopment');
  });

  it('should determine environment correctly', () => {
    // Test development environment
    process.env.NODE_ENV = 'development';
    // We need to re-import to get updated values
    jest.resetModules();
    const devConfig = require('../../config/config').default;
    expect(devConfig.isDevelopment).toBe(true);
    expect(devConfig.isProduction).toBe(false);

    // Test production environment
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const prodConfig = require('../../config/config').default;
    expect(prodConfig.isDevelopment).toBe(false);
    expect(prodConfig.isProduction).toBe(true);
  });

  it('should override defaults with environment variables', () => {
    // Set environment variables
    process.env.PORT = '3000';
    process.env.LOG_LEVEL = 'debug';
    process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com';
    
    // Re-import config to get updated values
    jest.resetModules();
    const updatedConfig = require('../../config/config').default;
    
    // Check if values are updated
    expect(updatedConfig.port).toBe(3000);
    expect(updatedConfig.logLevel).toBe('debug');
    expect(updatedConfig.corsOrigins).toEqual(['http://localhost:3000', 'https://example.com']);
  });

  it('should handle API keys as arrays', () => {
    // Set environment variables
    process.env.API_KEYS = 'key1,key2,key3';
    
    // Re-import config to get updated values
    jest.resetModules();
    const updatedConfig = require('../../config/config').default;
    
    // Check if API keys are parsed correctly
    expect(updatedConfig.apiKeys).toEqual(['key1', 'key2', 'key3']);
  });

  it('should provide a safe version of config without sensitive data', () => {
    // Set sensitive data
    process.env.DEEPSEEK_API_KEY = 'secret-deepseek-key';
    process.env.OPENAI_API_KEY = 'secret-openai-key';
    process.env.API_KEYS = 'secret-api-key-1,secret-api-key-2';
    process.env.SUPABASE_ANON_KEY = 'secret-supabase-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-supabase-role-key';
    
    // Re-import config to get updated values
    jest.resetModules();
    const { getSafeConfig } = require('../../config/config');
    const safeConfig = getSafeConfig();
    
    // Check that sensitive data is removed
    expect(safeConfig).not.toHaveProperty('deepseekApiKey');
    expect(safeConfig).not.toHaveProperty('openaiApiKey');
    expect(safeConfig).not.toHaveProperty('apiKeys');
    expect(safeConfig.openai).not.toHaveProperty('apiKey');
    expect(safeConfig.supabase).not.toHaveProperty('anonKey');
    expect(safeConfig.supabase).not.toHaveProperty('serviceRoleKey');
    
    // But non-sensitive data should still be there
    expect(safeConfig).toHaveProperty('port');
    expect(safeConfig).toHaveProperty('nodeEnv');
    expect(safeConfig.supabase).toHaveProperty('url');
  });
}); 