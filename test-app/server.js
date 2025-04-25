/**
 * Minimal test server for Cloud Run deployment troubleshooting
 */
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  // Log incoming request
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Health check endpoint
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'not-set'
    }));
    return;
  }
  
  // Root endpoint with version info
  if (req.url === '/') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      message: 'Lucid API Server (Minimal Test Version)',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }));
    return;
  }
  
  // Default 404 for any other endpoint
  res.statusCode = 404;
  res.end('Not Found');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Google Cloud Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'not-set'}`);
}); 