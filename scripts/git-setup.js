/**
 * Git Setup Script
 * 
 * This script helps manage the git repository structure of the project.
 * It provides options to:
 * 1. Convert the Lucid subdirectory to a git submodule
 * 2. Remove the nested .git directory from Lucid and include it in the parent repo
 * 3. Check the current git status of both repositories
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper functions
function runCommand(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
  } catch (error) {
    if (options.ignoreErrors) {
      return error.stdout?.toString() || '';
    }
    console.error(`Error running command: ${command}`);
    console.error(error.stdout?.toString() || error.message);
    process.exit(1);
  }
}

function checkGitStatus() {
  console.log('=== Checking Git Repository Status ===');
  
  // Check parent repository
  console.log('\n🔍 Parent Repository:');
  try {
    const rootGitConfig = runCommand('git config --list', { silent: true });
    const rootRemote = runCommand('git remote -v', { silent: true });
    
    console.log('Git configuration found in root directory');
    console.log('Remote URLs:');
    console.log(rootRemote || 'No remotes configured');
  } catch (error) {
    console.log('No git repository initialized in root directory');
  }
  
  // Check Lucid repository
  console.log('\n🔍 Lucid Repository:');
  if (fs.existsSync(path.join('Lucid', '.git'))) {
    try {
      const lucidGitConfig = runCommand('cd Lucid && git config --list', { silent: true });
      const lucidRemote = runCommand('cd Lucid && git remote -v', { silent: true });
      
      console.log('Git configuration found in Lucid directory');
      console.log('Remote URLs:');
      console.log(lucidRemote || 'No remotes configured');
      console.log('\n⚠️ Warning: Nested git repository found in Lucid directory');
    } catch (error) {
      console.log('Error reading git configuration in Lucid directory');
    }
  } else {
    console.log('No git repository initialized in Lucid directory');
  }
}

function convertToSubmodule() {
  console.log('=== Converting Lucid to Git Submodule ===');
  
  if (!fs.existsSync(path.join('Lucid', '.git'))) {
    console.error('❌ Error: Lucid directory does not have a git repository');
    return;
  }
  
  try {
    // Get the remote URL of the Lucid repository
    const remoteUrl = runCommand('cd Lucid && git remote get-url origin', { silent: true }).trim();
    
    if (!remoteUrl) {
      console.error('❌ Error: Lucid repository does not have a remote origin');
      return;
    }
    
    // Remove the Lucid directory from the parent repository
    runCommand('git rm -rf --cached Lucid');
    
    // Add Lucid as a submodule
    runCommand(`git submodule add ${remoteUrl} Lucid`);
    
    console.log('✅ Successfully converted Lucid to a git submodule');
    console.log('Next steps:');
    console.log('1. Commit the changes to the parent repository');
    console.log('2. Push the changes to your remote repository');
  } catch (error) {
    console.error('❌ Error converting to submodule:', error.message);
  }
}

function removeNestedGit() {
  console.log('=== Removing Nested Git Repository ===');
  
  if (!fs.existsSync(path.join('Lucid', '.git'))) {
    console.log('✅ No nested git repository found in Lucid directory');
    return;
  }
  
  try {
    // Backup any uncommitted changes in the Lucid repository
    if (fs.existsSync(path.join('Lucid', '.git'))) {
      const status = runCommand('cd Lucid && git status --porcelain', { silent: true });
      
      if (status.trim()) {
        console.log('⚠️ Warning: Uncommitted changes found in Lucid repository');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = `Lucid-backup-${timestamp}`;
        
        console.log(`Creating backup in ${backupDir}`);
        fs.mkdirSync(backupDir);
        runCommand(`xcopy /E /H /Y Lucid ${backupDir}`);
      }
    }
    
    // Remove the .git directory from Lucid
    runCommand('rmdir /S /Q Lucid\\.git');
    
    // Add Lucid to the parent repository
    runCommand('git add Lucid');
    
    console.log('✅ Successfully removed nested git repository from Lucid');
    console.log('Next steps:');
    console.log('1. Commit the changes to the parent repository');
    console.log('2. Push the changes to your remote repository');
  } catch (error) {
    console.error('❌ Error removing nested git:', error.message);
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Git Setup Script - Help
=======================

Usage: node scripts/git-setup.js [command]

Commands:
  status        Check the current git status of both repositories
  submodule     Convert the Lucid directory to a git submodule
  remove-nested Remove the nested .git directory from Lucid
  help          Show this help message

Example:
  node scripts/git-setup.js status
`);
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'status':
      checkGitStatus();
      break;
    case 'submodule':
      convertToSubmodule();
      break;
    case 'remove-nested':
      removeNestedGit();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "node scripts/git-setup.js --help" for usage information');
  }
}

main(); 