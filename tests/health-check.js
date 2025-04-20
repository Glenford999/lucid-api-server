/**
 * Cloud Run Health Check Handler
 * 
 * This script ensures that Cloud Run health checks pass immediately,
 * even if the main application is still initializing.
 */

const express = require('express');

// Setup health check endpoints
function setupHealthCheck(app) {
  console.log('Setting up health check endpoints...');
  
  // Add a health check endpoint that responds immediately
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime() + ' seconds'
    });
  });
  
  // Add a readiness probe endpoint
  app.get('/ready', (req, res) => {
    // This endpoint could check database connections, etc.
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('Health check endpoints configured successfully');
}

// Start a minimal server if this file is executed directly
if (require.main === module) {
  const app = express();
  setupHealthCheck(app);
  
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
  });
}

module.exports = setupHealthCheck; 