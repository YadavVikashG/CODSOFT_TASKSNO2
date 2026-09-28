import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';
import { pool } from '@/lib/db';

export type UserRole = 'user' | 'admin' | 'restaurant' | 'delivery';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  address: string;
  passwordHash: string;
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  address: string | null;
  password_hash: string;
};

const users = new Map<string, AuthUser>();
const demoSalt = 'zestmarket-demo-account';
const demoUser: AuthUser = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@zestmarket.com',
  role: 'user',
  phone: '+1 (555) 012-3456',
  address: '123 Market Street, New York, NY',
  passwordHash: `scrypt$${demoSalt}$${scryptSync('demo123', demoSalt, 64).toString('hex')}`,
};
users.set(demoUser.email, demoUser);

function ensureAuthStorageConfigured() {
  if (!pool && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be configured to use authentication in production.');
  }
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone || '',
    address: row.address || '',
    passwordHash: row.password_hash,
  };
}

function deriveKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await deriveKey(password, salt)).toString('hex')}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, storedKey] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !storedKey) return false;

  const expected = Buffer.from(storedKey, 'hex');
  const actual = await deriveKey(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    address: user.address,
  };
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  ensureAuthStorageConfigured();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (name.length < 2) throw new Error('Name must be at least 2 characters long.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
  if (input.password.length < 6) throw new Error('Password must be at least 6 characters long.');

  const passwordHash = await hashPassword(input.password);
  if (pool) {
    try {
      const { rows } = await pool.query<UserRow>(
        `INSERT INTO users (full_name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, full_name, email, role, phone, address, password_hash`,
        [name, email, passwordHash],
      );
      return mapUser(rows[0]);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new Error('An account already exists for this email. Please log in instead.');
      }
      throw error;
    }
  }

  if (users.has(email)) throw new Error('An account already exists for this email. Please log in instead.');

  const user: AuthUser = {
    id: `user-${randomBytes(12).toString('hex')}`,
    name,
    email,
    role: 'user',
    phone: '',
    address: '',
    passwordHash,
  };
  users.set(email, user);
  return user;
}

export async function authenticateUser(input: { email: string; password: string }) {
  ensureAuthStorageConfigured();
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) throw new Error('Email and password are required.');

  let user: AuthUser | undefined;
  if (pool) {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, full_name, email, role, phone, address, password_hash FROM users WHERE email = $1`,
      [email],
    );
    if (rows[0]) user = mapUser(rows[0]);
  } else {
    user = users.get(email);
  }

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error('Email or password is incorrect.');
  }
  return user;
}

export async function getUserById(id: string) {
  ensureAuthStorageConfigured();
  if (pool) {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, full_name, email, role, phone, address, password_hash FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  return [...users.values()].find((user) => user.id === id) || null;
}
