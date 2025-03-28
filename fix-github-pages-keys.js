/**
 * Script to fix Firebase private key format for GitHub Pages static export
 * 
 * This script creates properly formatted Firebase key env variables
 * to ensure the static build process can parse them correctly.
 */

// Read env file
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('Running GitHub Pages key fix script...');

// Load environment variables
let envContent;
const envPath = path.join(process.cwd(), '.env.local');

try {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('Found .env.local file');
} catch (error) {
  console.log('No .env.local file found, creating a new one with default values');
  envContent = `
# Firebase config
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAd0rRHvA4yeU52WYN4GGRWzKU4Ixa61V0
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=variance-test-4b441.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=variance-test-4b441
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=variance-test-4b441.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=829344781917
NEXT_PUBLIC_FIREBASE_APP_ID=1:829344781917:web:8cbcc930bab2217d9d1c1f
`;
}

// Parse existing env content
const envConfig = dotenv.parse(envContent);

// Default Firebase private key (for development and GitHub Pages static builds)
// This is a placeholder key for GitHub Pages builds which won't actually use real Firebase services
const defaultPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCe/m4WApen/M1n
oOwnO1ajvbdJ3mg4nOPtGFg0OUsnc3CrHDVXObIEaNeYHuxOUFgRLbOx8+xcrmRB
GVoJL367YgIzcaXEVlvFCQ4WrVZDyESWHCjTOafFpAcjM2GgEEiCHRauDSiqwBXo
iyzH/aMKG7zu6xJpRNm2HDlPF9lo6PPC+DGtfV5n4lDWmOQIpghAI4dDbabfLLmL
uNzk2Ddahx5xcWFiJ/ikLRpnnpbPB1o7EbV0wyKPumCBi8/D5oJQIQ0tl7LuyKAj
sQ4U4ofxheCE5pq64GEh9SBmCUbnh5mPyS1tItOXw0kNKp66DXvABsBNzIfsa+dr
nIEgqlE7AgMBAAECggEATo6N3Agp4JGS97nWFMhH1Z1+O1xNiHNUVqhppFwOmw55
w8GrRU63e2BF7d6RiVw/NzWqjKllxqFP3a5mAxXZe0JAriRf8DNvIlqIAIJilhkU
ckq1jS/2ijuyXx0bBlglS0yOES9lQYCpEn35gVL7xJnR7wZs0WB4ZXdqhX7WJ/Py
ODZykBeJ4qsXcbJO7E58vRQoLj3yYu5wEsoVYriHLiNXfVxAEd3rlZ0UeLjGee9z
r55TuRv7AhxF63geeXp2uLRt5e6wRyDMsdCFwhwQKJXfnW1NjLr1lhRuvtUANdrB
fQbPyHklJPAYNUZBax0UvhqTheWJDTHpUHhBpEjbgQKBgQDSnSQpFoQd/MThnUdu
AzSZ0WEXE1cNWsBf0T64NlJpySo4KOAtyythSjIuytiBmHLndS0JPaWV42bkIFEG
WlLTdyCaY5MPVtbUCPBJZZeUB3eo44S46Mp0uxxaMGC3wLR2ke2aHTlvQa+yaE4W
g8ad+t6wlS1jC9WUUsxqIE4f+wKBgQDBQZahY+CP0MDG2q/YJOGpqrft5VxpVPtD
z8IsG10MjHL/2HK8nw8EJ+AaXINM54mcxLkb0attZZUIf2Hfs8Yi/dF1g4hbahT6
1MzWBnTYCHYVQt5KAQLH5GJKVJaUtevZBKN6FQ+aohLiOKBc6J0OppL1queN6K7g
Tv7D5gWPwQKBgCrki+++QSvmRaZ5JIn4JydIaBCOBMWYfONGtxJHJeObb3i+gmFx
JiWLOcsjzpIeHRCcYY6nOmjbRiIhnr6/eGzOrxoiO1n9YoUOSPl5sjQYjTsdEvOh
nVHGpZCMl7X0jgwzzgL7/q104DZiXbziG3ojFGU8DGFGkLnDXxQh/icvAoGAPWKp
BxCjlur3IPL74gstBuisTcuKBAczXMHUapAyiTbfnHbTUyiu62IDJDx4lGgDZSFz
rut1qWUX5sAXhagj6p929f3WxTq3+Ui4287nNGvTnkNEOnuBt57KvdOKlSgIB0Ia
7z9bWoHav7K+9WQJ50pv6crkjEX5rlRJRk59O8ECgYEAuipnpFp3k05ZUl1W8bVd
kPzrL9/rxFviaapUi8ZwE4CPEEopXRO6nJSen6QjKkxM3uRBybTa1u1cc2e4AMBV
yIbP4SVlkIAOoR0jk4e9skCgN0JWjqt36kbbM9GWAAz97Gw25vqxtPFCj0EUahVo
T78NlclGYfEsc1Qvj/fc7Ws=
-----END PRIVATE KEY-----`;

// Create a properly formatted private key
let privateKey = defaultPrivateKey;

// Handle private key in a way that preserves line breaks correctly
const escapedKey = privateKey.replace(/\n/g, '\\n');
const encodedKey = Buffer.from(privateKey).toString('base64');

// Create updated env content with proper key formats
envConfig.FIREBASE_PRIVATE_KEY = privateKey; // Version with actual line breaks
envConfig.FIREBASE_PRIVATE_KEY_ESCAPED = escapedKey; // Version with escaped \n
envConfig.FIREBASE_PRIVATE_KEY_BASE64 = encodedKey; // Base64 encoded version
envConfig.FIREBASE_CLIENT_EMAIL = envConfig.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com';
envConfig.NEXT_PUBLIC_USE_REAL_FIREBASE = 'false'; // Force use of mock objects in GitHub Pages

// Add a flag for GitHub Pages builds
envConfig.GITHUB_PAGES = 'true';

// Log the key formats for debugging
console.log('Created 3 private key formats:');
console.log('1. Standard format (with actual line breaks)');
console.log(`2. Escaped format: ${escapedKey.substring(0, 50)}...`);
console.log(`3. Base64 format: ${encodedKey.substring(0, 50)}...`);

// Create new .env content
let newEnvContent = '';
for (const key in envConfig) {
  // Special handling for multiline private key
  if (key === 'FIREBASE_PRIVATE_KEY') {
    newEnvContent += `${key}="${escapedKey}"\n`;
  } else {
    newEnvContent += `${key}=${envConfig[key]}\n`;
  }
}

// Write updated .env file
fs.writeFileSync(envPath, newEnvContent);
console.log(`.env.local file updated with correctly formatted Firebase keys`);

// Also generate a build-time temporary key file for GitHub Pages
const tempKeyPath = path.join(process.cwd(), '.env.github-pages');
fs.writeFileSync(tempKeyPath, `FIREBASE_PRIVATE_KEY="${escapedKey}"
FIREBASE_PRIVATE_KEY_BASE64=${encodedKey}
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=variance-test-4b441
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=variance-test-4b441.firebasestorage.app
GITHUB_PAGES=true
NEXT_PUBLIC_USE_REAL_FIREBASE=false
`);

console.log('Created .env.github-pages file for GitHub Pages build');
console.log('GitHub Pages key fix completed successfully');