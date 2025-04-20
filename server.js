const app = require('./app');
const config = require('./src/config/config');

// Get port from environment or use default
const PORT = process.env.PORT || 8080;

// Startup log
console.log(`Starting server in ${config.nodeEnv} mode with PID ${process.pid}`);

// Track termination state
let isShuttingDown = false;

// Cloud Run requires listening on the PORT environment variable
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api/...`);
  
  // Signal to PM2 that we're ready (when running under PM2)
  if (process.send) {
    console.log('Sending ready signal to PM2');
    process.send('ready');
  }
}).on('error', (err) => {
  console.error('Server startup error:', err);
  
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Check if another instance is running.`);
  }
  
  // Don't exit immediately, give Cloud Run a chance to see the error
  setTimeout(() => process.exit(1), 1000);
});

// Helper function for graceful shutdown
function gracefulShutdown(signal) {
  return () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`${signal} signal received: closing HTTP server`);
    
    // Give existing connections 5 seconds to complete
    server.close(() => {
      console.log('HTTP server closed successfully');
      process.exit(0);
    });
    
    // Force close after timeout if server.close() doesn't finish
    setTimeout(() => {
      console.log('Forcing server shutdown after timeout');
      process.exit(1);
    }, 5000);
  };
}

// Handle signals for graceful shutdown
process.on('SIGTERM', gracefulShutdown('SIGTERM'));
process.on('SIGINT', gracefulShutdown('SIGINT'));

// Handle other common errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // If it's a critical error, shut down
  if (isCriticalError(err)) {
    gracefulShutdown('UNCAUGHT_EXCEPTION')();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Keep the server running but log the error
});

// Helper to determine if an error is critical
function isCriticalError(err) {
  // Check for specific errors that should trigger shutdown
  return (
    err.code === 'EACCES' || 
    err.code === 'EADDRINUSE' || 
    err.code === 'ECONNRESET' ||
    /\b(out of memory|heap|stack overflow)\b/i.test(err.message)
  );
}

module.exports = server; // Export for testing 