// Generate bcrypt hash for admin password
import bcrypt from 'bcrypt';

const password = 'BlueClue2026!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUpdate SQL:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@blueclue.com';`);
  process.exit(0);
});
