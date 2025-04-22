/**
 * Diagnostic API Routes
 * Provides diagnostic information about the API server
 */

const express = require('express');
const router = express.Router();
const config = require('../config/config');
const os = require('os');

// GET /api/diagnose - Server diagnostic information
router.get('/diagnose', (req, res) => {
  try {
    // Only provide detailed diagnostics in development mode
    if (config.isProduction) {
      return res.status(403).json({
        error: true,
        message: 'Diagnostic endpoints are disabled in production mode'
      });
    }
    
    // Get server information
    const serverInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      uptime: os.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      node_version: process.version,
      pid: process.pid
    };
    
    // Get API configuration (without sensitive data)
    const apiConfig = {
      env: config.nodeEnv,
      deepseek_api_configured: !!config.deepseekApiKey,
      deepseek_endpoint: config.deepseekApiEndpoint,
      openai_api_configured: !!config.openaiApiKey,
      features: config.features,
      project_id: config.googleCloudProject || 'not set'
    };
    
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: serverInfo,
      config: apiConfig,
      request_info: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        user_agent: req.get('user-agent')
      }
    });
  } catch (error) {
    console.error('Error in diagnostic endpoint:', error);
    
    return res.status(500).json({
      error: true,
      message: 'Failed to generate diagnostic information',
      details: error.message
    });
  }
});

// GET /api/info - Basic server info (safe for production)
router.get('/info', (req, res) => {
  try {
    // Basic server information safe for production
    const info = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      node_version: process.version,
      environment: config.nodeEnv
    };
    
    return res.json(info);
  } catch (error) {
    console.error('Error in info endpoint:', error);
    
    return res.status(500).json({
      error: true,
      message: 'Failed to generate server information'
    });
  }
});

// GET /api/endpoints - Lists available endpoints
router.get('/endpoints', (req, res) => {
  const endpoints = [
    { path: '/health', method: 'GET', description: 'Health check endpoint' },
    { path: '/ready', method: 'GET', description: 'Readiness probe for container orchestration' },
    { path: '/api/test', method: 'GET', description: 'Test endpoint to verify API is working' },
    { path: '/api/search', method: 'POST', description: 'Product search endpoint' },
    { path: '/api/search/status', method: 'GET', description: 'Search API status' },
    { path: '/api/simple-search', method: 'POST', description: 'Simplified search endpoint' },
    { path: '/api/info', method: 'GET', description: 'Basic server information' },
    { path: '/api/endpoints', method: 'GET', description: 'List available endpoints' }
  ];
  
  if (!config.isProduction) {
    endpoints.push({ 
      path: '/api/diagnose', 
      method: 'GET', 
      description: 'Detailed diagnostic information (development only)' 
    });
  }
  
  return res.json({
    endpoints: endpoints,
    count: endpoints.length,
    base_url: `${req.protocol}://${req.get('host')}`
  });
});

module.exports = router; 