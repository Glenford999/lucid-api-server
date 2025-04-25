const path = require('path');
const fs = require('fs');

// For debugging in Cloud Run
console.log('========== SERVER STARTUP DEBUG INFO ==========');
console.log('Current directory:', __dirname);
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT
});
console.log('Files in current directory:', fs.readdirSync(__dirname));

if (fs.existsSync(path.join(__dirname, 'src'))) {
  console.log('Files in src directory:', fs.readdirSync(path.join(__dirname, 'src')));
}

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
    
    // Add more comprehensive debug endpoints
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'degraded', 
        message: 'Running in fallback mode',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT || 'not set'
      });
    });
    
    app.get('/debug', (req, res) => {
      // Only in development or if explicitly enabled
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_ENDPOINT === 'true') {
        res.status(200).json({
          environment: {
            NODE_ENV: process.env.NODE_ENV || 'not set',
            PORT: process.env.PORT || 'not set',
            GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'not set'
          },
          filesystem: {
            currentDirectory: __dirname,
            rootFiles: fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : 'not accessible',
            srcExists: fs.existsSync(path.join(__dirname, 'src')),
            appJsExists: fs.existsSync(path.join(__dirname, 'app.js')),
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(403).json({ error: 'Debug endpoint not available in production' });
      }
    });
    
    app.use('*', (req, res) => {
      res.status(500).json({ 
        error: 'Server is running in fallback mode due to startup error',
        path: req.originalUrl 
      });
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

let config;
try {
  config = require('./src/config/config');
  console.log(`Loaded configuration for ${config.nodeEnv} environment`);
} catch (error) {
  console.error('Error loading config from src/config/config:', error.message);
  
  try {
    // Try alternate locations for the config
    const configLocations = [
      './config/config',
      './dist/config/config',
      './build/config/config'
    ];
    
    let loaded = false;
    for (const location of configLocations) {
      try {
        console.log(`Attempting to load config from ${location}`);
        config = require(location);
        console.log(`Successfully loaded config from ${location}`);
        loaded = true;
        break;
      } catch (e) {
        console.log(`Failed to load config from ${location}: ${e.message}`);
      }
    }
    
    if (!loaded) {
      // Create a minimal config
      console.log('Creating minimal configuration');
      config = {
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        port: parseInt(process.env.PORT || '8080', 10),
        deepseekApiKey: process.env.DEEPSEEK_API_KEY || null,
        deepseekApiEndpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com'
      };
    }
  } catch (fallbackError) {
    console.error('Error creating fallback config:', fallbackError.message);
    
    // Absolute minimum config
    config = {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '8080', 10)
    };
  }
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
  console.log('========== SERVER STARTED SUCCESSFULLY ==========');
  
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