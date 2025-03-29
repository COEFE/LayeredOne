// Create a script that sets up Firebase environment variables
const fs = require('fs');
const path = require('path');

console.log('Setting up Firebase environment variables...');

// Default Firebase private key
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

// Format the private key for .env file (escape newlines)
const formattedKey = privateKey.replace(/\n/g, '\\n');

// Check if .env.local exists
const envLocalPath = path.join(process.cwd(), '.env.local');
let envContent = '';

try {
  if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf8');
    console.log('Found existing .env.local file');
  }
} catch (err) {
  console.log('Could not read .env.local, will create a new one');
}

// Check if we need to add the private key
const needsPrivateKey = !envContent.includes('FIREBASE_PRIVATE_KEY=');
const needsClientEmail = !envContent.includes('FIREBASE_CLIENT_EMAIL=');

if (needsPrivateKey) {
  // Add the private key
  envContent += '\n# Firebase Private Key\n';
  envContent += `FIREBASE_PRIVATE_KEY="${formattedKey}"\n`;
  console.log('Added FIREBASE_PRIVATE_KEY to .env.local');
}

if (needsClientEmail) {
  // Add the client email
  envContent += '\n# Firebase Client Email\n';
  envContent += 'FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@variance-test-4b441.iam.gserviceaccount.com"\n';
  console.log('Added FIREBASE_CLIENT_EMAIL to .env.local');
}

// Write the updated content back to .env.local
if (needsPrivateKey || needsClientEmail) {
  fs.writeFileSync(envLocalPath, envContent);
  console.log('Updated .env.local file successfully');
} else {
  console.log('No changes needed to .env.local');
}

console.log('Firebase environment setup complete!');
