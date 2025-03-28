#!/usr/bin/env node

/**
 * Add Anthropic API Key to .env.local
 * 
 * This script adds the ANTHROPIC_API_KEY to your .env.local file
 * which is required for Claude AI functionality.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
const prompt = (question) => new Promise(resolve => rl.question(question, resolve));

async function addAnthropicKey() {
  console.log('\n===== Add Anthropic API Key =====\n');
  console.log('This script will add your Anthropic API Key to the .env.local file.');
  console.log('This key is required for Claude AI functionality in your application.\n');
  
  // Check if .env.local exists
  const envFilePath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFilePath)) {
    console.error('Error: .env.local file not found.');
    console.log('Please run the setup-firebase-env.js script first to create your .env.local file.');
    rl.close();
    return;
  }
  
  // Read existing .env.local content
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  
  // Check if ANTHROPIC_API_KEY is already set
  if (envContent.includes('ANTHROPIC_API_KEY=')) {
    const shouldReplace = await prompt('ANTHROPIC_API_KEY already exists in .env.local. Replace it? (y/n): ');
    if (shouldReplace.toLowerCase() !== 'y') {
      console.log('Exiting without changes.');
      rl.close();
      return;
    }
  }
  
  // Get the API key from the user
  const apiKey = await prompt('Enter your Anthropic API Key (starts with "sk-ant-"): ');
  
  if (!apiKey.trim()) {
    console.log('No API key provided. Exiting without changes.');
    rl.close();
    return;
  }
  
  if (!apiKey.startsWith('sk-ant-')) {
    const confirm = await prompt('Warning: This doesn\'t look like a valid Anthropic API key (should start with "sk-ant-"). Continue anyway? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Exiting without changes.');
      rl.close();
      return;
    }
  }
  
  // Create updated content
  let updatedContent;
  
  if (envContent.includes('ANTHROPIC_API_KEY=')) {
    // Replace existing key
    updatedContent = envContent.replace(/ANTHROPIC_API_KEY=.*(\r?\n|$)/g, `ANTHROPIC_API_KEY=${apiKey}$1`);
  } else {
    // Add new key
    updatedContent = envContent.trim() + `\n\n# AI API Keys\nANTHROPIC_API_KEY=${apiKey}\n`;
  }
  
  // Write the updated content back to .env.local
  fs.writeFileSync(envFilePath, updatedContent);
  
  console.log('\n✅ Successfully added ANTHROPIC_API_KEY to .env.local');
  console.log('\nYou can now use Claude AI functionality in your application.');
  
  rl.close();
}

// Run the function
addAnthropicKey().catch(err => {
  console.error('Error:', err);
  rl.close();
});