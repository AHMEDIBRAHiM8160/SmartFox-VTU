const readline = require('readline');
const { pool } = require('../src/config/db');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    let password = '';

    const onData = (char) => {
      if (char === '\u0003') {
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        process.exit(1);
      }

      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password);
        return;
      }

      if (char === '\u007f') {
        password = password.slice(0, -1);
        return;
      }

      password += char;
    };

    stdin.on('data', onData);
  });
}

async function main() {
  try {
    const email = (await ask('Admin email: ')).toLowerCase();
    const password = await askHidden('Admin password: ');

    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role, status FROM admins WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length) {
      throw new Error('Admin not found.');
    }

    const admin = rows[0];

    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      throw new Error('Invalid password.');
    }

    if (admin.status !== 'active') {
      throw new Error('Admin account is not active.');
    }

    console.log('\nAdmin credentials are valid.');
    console.log(`ID: ${admin.id}`);
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Status: ${admin.status}\n`);

    await pool.end();
  } catch (error) {
    console.error('\nLogin test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
