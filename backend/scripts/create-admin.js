const readline = require('readline');
const bcrypt = require('bcryptjs');
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
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
        return;
      }

      password += char;
    };

    stdin.on('data', onData);
  });
}

async function main() {
  try {
    console.log('\n=== Smart Fox VTU Admin Setup ===\n');

    const name = await ask('Admin name: ');
    const email = (await ask('Admin email: ')).toLowerCase();
    const password = await askHidden('Admin password: ');

    if (!name || !email || !password) {
      throw new Error('Name, email and password are required.');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [existing] = await pool.execute(
      'SELECT id FROM admins WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      throw new Error('An admin with this email already exists.');
    }

    const [result] = await pool.execute(
      `INSERT INTO admins
        (name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'super_admin', 'active')`,
      [name, email, passwordHash]
    );

    console.log('\nAdmin created successfully.');
    console.log(`ID: ${result.insertId}`);
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log('Role: super_admin');
    console.log('Status: active\n');

    await pool.end();
  } catch (error) {
    console.error('\nFailed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
