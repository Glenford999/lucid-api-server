/**
 * Standalone health check server for Cloud Run
 * This provides a reliable health check endpoint even if the main app crashes
 */

const express = require('express');
const http = require('http');

// Create simple express app
const app = express();

// Configure health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'lucid-api-server-health',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  // Check if main app is running
  try {
    // Try to connect to the main server on its health endpoint
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 8080,
      path: '/health',
      method: 'GET',
      timeout: 1000 // 1 second timeout
    };

    const healthReq = http.request(options, (healthRes) => {
      let data = '';
      healthRes.on('data', (chunk) => {
        data += chunk;
      });
      
      healthRes.on('end', () => {
        if (healthRes.statusCode === 200) {
          res.status(200).json({
            status: 'ready',
            main_app: 'healthy',
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({
            status: 'not_ready',
            main_app: 'unhealthy',
            timestamp: new Date().toISOString()
          });
        }
      });
    });
    
    healthReq.on('error', () => {
      res.status(503).json({
        status: 'not_ready',
        main_app: 'unreachable',
        timestamp: new Date().toISOString()
      });
    });
    
    healthReq.on('timeout', () => {
      healthReq.abort();
      res.status(503).json({
        status: 'not_ready',
        main_app: 'timeout',
        timestamp: new Date().toISOString()
      });
    });
    
    healthReq.end();
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all route
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'This is just a health check server. The main app may be starting up or experiencing issues.'
  });
});

// Start the server on a different port
const PORT = process.env.HEALTH_PORT || 8081;
app.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
}); 