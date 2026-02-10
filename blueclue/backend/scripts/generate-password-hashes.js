// ============================================================================
// Generate Bcrypt Password Hashes for Technician Accounts
// ============================================================================
// Run this script to generate the correct bcrypt hashes for auth_setup.sql

import bcrypt from 'bcrypt';

const password = 'admin123';
const saltRounds = 10;

console.log('Generating bcrypt hashes for password:', password);
console.log('Salt rounds:', saltRounds);
console.log('\n-----------------------------------\n');

// Generate 3 different hashes (even for same password, hashes are unique)
const hash1 = bcrypt.hashSync(password, saltRounds);
const hash2 = bcrypt.hashSync(password, saltRounds);
const hash3 = bcrypt.hashSync(password, saltRounds);

console.log('Technician: tnewc');
console.log('Hash:', hash1);
console.log('\nTechnician: cmcgo');
console.log('Hash:', hash2);
console.log('\nTechnician: jwill');
console.log('Hash:', hash3);

console.log('\n-----------------------------------');
console.log('Copy these hashes into auth_setup.sql');
console.log('-----------------------------------\n');

// Verify the hashes work
console.log('Verification:');
console.log('Hash 1 valid:', bcrypt.compareSync(password, hash1));
console.log('Hash 2 valid:', bcrypt.compareSync(password, hash2));
console.log('Hash 3 valid:', bcrypt.compareSync(password, hash3));
