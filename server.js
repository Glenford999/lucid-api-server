const app = require('./app');
const config = require('./src/config/config');

// Get port from environment or use default
const PORT = process.env.PORT || 8080;

// Cloud Run requires listening on the PORT environment variable
const server = app.listen(PORT, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api/...`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = server; // Export for testing 