/**
 * Environment setup for Firebase credentials
 * 
 * This script ensures proper environment variables are set for Firebase
 * without modifying any code files directly.
 */
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Firebase environment variables...');

// Default private key for testing purposes only
const privateKey = `-----BEGIN PRIVATE KEY-----
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

// Create a Base64 encoded version of the key
const base64Key = Buffer.from(privateKey).toString('base64');

// Check if .env.local exists, if not create it with the default values
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('Creating .env.local with default Firebase credentials');
  
  const envContent = `# Firebase configuration with default values
NEXT_PUBLIC_FIREBASE_PROJECT_ID=variance-test-4b441
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=variance-test-4b441.firebasestorage.app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY_BASE64=${base64Key}
`;

  fs.writeFileSync(envPath, envContent);
  console.log('Created .env.local with default values');
} else {
  console.log('.env.local already exists, keeping existing values');
  
  // Check if the environment file has the necessary variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  let updated = false;
  let newContent = envContent;
  
  if (!envContent.includes('FIREBASE_PRIVATE_KEY') && !envContent.includes('FIREBASE_PRIVATE_KEY_BASE64')) {
    console.log('Adding missing FIREBASE_PRIVATE_KEY_BASE64 to .env.local');
    newContent += `\n# Added by setup script\nFIREBASE_PRIVATE_KEY_BASE64=${base64Key}\n`;
    updated = true;
  }
  
  if (!envContent.includes('FIREBASE_CLIENT_EMAIL')) {
    console.log('Adding missing FIREBASE_CLIENT_EMAIL to .env.local');
    newContent += `\n# Added by setup script\nFIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com\n`;
    updated = true;
  }
  
  if (updated) {
    fs.writeFileSync(envPath, newContent);
    console.log('Updated .env.local with missing variables');
  }
}

// Set the environment variables for the current process too
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'variance-test-4b441';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'variance-test-4b441.firebasestorage.app';
process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com';

// Set the private key environment variable if not already set
if (!process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY_BASE64) {
  process.env.FIREBASE_PRIVATE_KEY_BASE64 = base64Key;
  console.log('Set FIREBASE_PRIVATE_KEY_BASE64 environment variable for current process');
}

console.log(`
✅ Firebase environment setup completed successfully!

The environment variables needed for Firebase are now available:
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY_BASE64
`);