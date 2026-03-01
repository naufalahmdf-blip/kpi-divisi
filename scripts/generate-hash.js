// Run with: node scripts/generate-hash.js <password>
// Used to generate bcrypt hashes for seed data
const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'admin123';
const hash = bcrypt.hashSync(password, 10);
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
