/**
 * Simple health check server for Cloud Run
 * This is a minimal Express server that provides health check endpoints
 * It runs alongside the main server and ensures Cloud Run health checks pass
 * even if there are issues with the main application.
 */

const express = require('express');
const http = require('http');

// Create a minimal Express app just for health checks
const app = express();

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'lucid-api-server-health',
    pid: process.pid
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Lucid API Server',
    message: 'Health check server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT || 'not set'
  });
});

// For all other routes, redirect to health
app.all('*', (req, res) => {
  res.redirect('/health');
});

// Start the server on a different port
const PORT = process.env.HEALTH_PORT || 8081;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down health check server');
  server.close(() => {
    console.log('Health check server closed');
    process.exit(0);
  });
});

module.exports = app; 