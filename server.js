const path = require('path');
const fs = require('fs');

// For debugging in Cloud Run
console.log('Current directory:', __dirname);
console.log('Files in current directory:', fs.readdirSync(__dirname));

// Try multiple paths to find app.js
let app;
try {
  // Try the standard local path first
  app = require('./app');
  console.log('Successfully loaded app from ./app');
} catch (error) {
  console.error('Error loading app from ./app:', error.message);
  
  try {
    // Try absolute path as a fallback
    const appPath = path.join(__dirname, 'app.js');
    console.log('Attempting to load from:', appPath);
    
    // Check if file exists first
    if (fs.existsSync(appPath)) {
      console.log('app.js file exists at', appPath);
      app = require(appPath);
      console.log('Successfully loaded app from absolute path');
    } else {
      console.error('app.js file does not exist at', appPath);
      // Search for app.js in the project
      console.log('Searching for app.js in the project...');
      const searchResult = searchForFile('app.js', __dirname);
      if (searchResult) {
        console.log('Found app.js at', searchResult);
        app = require(searchResult);
        console.log('Successfully loaded app from search result');
      } else {
        throw new Error('Could not find app.js in the project');
      }
    }
  } catch (secondError) {
    console.error('Fatal error: Could not load app module:', secondError.message);
    
    // Create a minimal express app as fallback
    console.log('Creating minimal Express app as fallback');
    const express = require('express');
    app = express();
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'degraded', message: 'Running in fallback mode' });
    });
    app.use('*', (req, res) => {
      res.status(500).json({ error: 'Server is running in fallback mode due to startup error' });
    });
  }
}

// Helper function to search for a file in the project
function searchForFile(filename, startDir) {
  try {
    const queue = [startDir];
    const visited = new Set();
    
    while (queue.length > 0) {
      const currentDir = queue.shift();
      if (visited.has(currentDir)) continue;
      visited.add(currentDir);
      
      const files = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file.name);
        
        if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
          queue.push(fullPath);
        } else if (file.isFile() && file.name === filename) {
          return fullPath;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching for file:', error);
    return null;
  }
}

try {
  const config = require('./src/config/config');
  console.log(`Loaded configuration for ${config.nodeEnv} environment`);
} catch (error) {
  console.error('Error loading config:', error.message);
}

// Get port from environment or use default
const PORT = process.env.PORT || 8080;

// Startup log
console.log(`Starting server with PID ${process.pid}`);

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