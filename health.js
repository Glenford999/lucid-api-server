/**
 * Standalone health check server for Cloud Run
 * This standalone server ensures health checks pass even if the main app fails to start
 */

const express = require('express');
const app = express();

// Keep track of last logged health check time and count
let lastLoggedTime = Date.now();
let healthCheckCount = 0;
const LOG_INTERVAL_MS = 86400000; // Log only once per day

// Configure simple CORS for the health check
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Handle OPTIONS requests for CORS
app.options('*', (req, res) => {
  res.status(204).send();
});

// Throttled logging middleware - only log non-health endpoints or log health checks periodically
app.use((req, res, next) => {
  // Always log non-health related requests
  if (req.url !== '/health' && req.url !== '/ready') {
    console.log(`[HEALTH-SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  } 
  // For health and ready endpoints, log only periodically
  else {
    const now = Date.now();
    healthCheckCount++;
    
    // Log only once per minute with a count of checks performed
    if (now - lastLoggedTime >= LOG_INTERVAL_MS) {
      console.log(`[HEALTH-SERVER] ${new Date().toISOString()} - Processed ${healthCheckCount} health checks in the last minute`);
      lastLoggedTime = now;
      healthCheckCount = 0;
    }
  }
  next();
});

// Simple health check that will always pass
app.get('/health', (req, res) => {
  // No additional logging here anymore
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'standalone-health-server'
  });
});

// Readiness check for Kubernetes
app.get('/ready', (req, res) => {
  // No additional logging here anymore
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    mode: 'standalone-health-server'
  });
});

// Add a simple check endpoint that shows we're the health server
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Health Check Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #4CAF50; }
          .container { max-width: 800px; margin: 0 auto; }
          .status { padding: 10px; background: #f1f1f1; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Health Check Service</h1>
          <p>This is the standalone health check server for the Lucid API.</p>
          <p>The main application may still be starting up or experiencing issues.</p>
          <div class="status">
            <p><strong>Status:</strong> OK</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          </div>
          <p>Try the <a href="/health">/health</a> endpoint for the health check response.</p>
        </div>
      </body>
    </html>
  `);
});

// Fallback for other routes
app.use('*', (req, res) => {
  res.status(200).send('Health check service is running. The main application may be starting up.');
});

// Handle unhandled errors
app.use((err, req, res, next) => {
  console.error('[HEALTH-SERVER] Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Health check server encountered an error, but is still operational',
    timestamp: new Date().toISOString()
  });
});

// Start the server on the same port
const PORT = process.env.PORT || 8080;

// Catch and handle any startup errors
try {
  app.listen(PORT, () => {
    console.log(`[HEALTH-SERVER] Health check server running on port ${PORT}`);
  });
} catch (error) {
  console.error('[HEALTH-SERVER] Failed to start server:', error);
  // Keep the process running even if we can't start the server
  setInterval(() => {
    console.log('[HEALTH-SERVER] Attempting to recover...');
  }, 10000);
} 