const app = require('./app');
const config = require('./src/config/config');

// Get port from environment or use default
const PORT = process.env.PORT || 8080;

// Startup log
console.log(`Starting server in ${config.nodeEnv} mode`);

// Cloud Run requires listening on the PORT environment variable
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api/...`);
}).on('error', (err) => {
  console.error('Server startup error:', err);
  // Don't exit immediately, give Cloud Run a chance to see the error
  setTimeout(() => process.exit(1), 1000);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Handle other common errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Keep the server running but log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Keep the server running but log the error
});

module.exports = server; // Export for testing 