/**
 * Lucid API Server - Alternative Entry Point
 * This file exists to ensure backward compatibility if code requires('./app')
 */

const express = require('express');
const app = express();

// Add basic routes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Lucid API server is running from app.js',
    startup_time: new Date().toISOString()
  });
});

module.exports = app; 