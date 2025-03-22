#!/usr/bin/env node

// Script to set Firebase environment variables from .env.local
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to your .env.local file
const envFilePath = path.join(__dirname, '..', '.env.local');

// Check if the file exists
if (!fs.existsSync(envFilePath)) {
  console.error('❌ .env.local file not found');
  process.exit(1);
}

// Read the .env.local file
const envFileContent = fs.readFileSync(envFilePath, 'utf8');

// Parse environment variables
const envVars = {};
envFileContent.split('\n').forEach(line => {
  // Skip empty lines and comments
  if (!line || line.startsWith('#')) return;
  
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // Remove quotes if present
    envVars[key] = value;
  }
});

console.log('🔑 Setting Firebase environment variables...');

// Set Firebase environment variables
Object.entries(envVars).forEach(([key, value]) => {
  try {
    // Skip empty values
    if (!value) return;
    
    console.log(`Setting ${key}...`);
    execSync(`firebase functions:config:set ${key.toLowerCase().replace(/_/g, '.')}="${value}"`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`❌ Error setting ${key}: ${error.message}`);
  }
});

console.log('✅ Environment variables set successfully');