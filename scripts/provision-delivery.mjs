import { randomBytes, scrypt } from 'node:crypto';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const { loadEnvConfig } = require('@next/env');
const scryptAsync = promisify(scrypt);

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal to enter the password securely.');
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();

    const finish = (error) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };

    input.on('data', onData);
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const email = String(rawEmail || '').trim().toLowerCase();
  const fullName = nameParts.join(' ').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2) {
    throw new Error('Usage: node --env-file=.env.local scripts/provision-delivery.mjs <email> "Driver Name"');
  }

  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  const password = await readHidden(`Set password for ${email}: `);
  if (password.length < 6) throw new Error('Password must be at least 6 characters long.');
  const passwordHash = await hashPassword(password);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_on_duty)
       VALUES ($1, $2, $3, 'delivery', FALSE)`,
      [fullName, email, passwordHash],
    );
    console.log(`Delivery account created. Sign in at /login with ${email}.`);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new Error(`An account already exists for ${email}.`);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unable to create delivery account.');
  process.exitCode = 1;
});