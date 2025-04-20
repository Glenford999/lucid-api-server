/**
 * Custom test runner script for the Lucid API Server
 * 
 * This script sets up the environment correctly before running Jest
 */

const { execSync } = require('child_process');
const path = require('path');

// Set the NODE_ENV to test
process.env.NODE_ENV = 'test';

try {
  // Run Jest with proper configuration
  console.log('Running tests with Jest...');
  
  // Determine the path to Jest binary
  const jestBinPath = path.resolve(__dirname, '../node_modules/.bin/jest');
  
  // Execute Jest with our configuration
  execSync(`"${jestBinPath}" --config=jest.config.js`, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
} catch (error) {
  console.error('Error running tests:', error.message);
  process.exit(1);
} 