import { createHmac, timingSafeEqual } from 'node:crypto';
import { getUserById } from '@/lib/auth-store';

export const sessionCookieName = 'zestmarket_session';
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

type SessionPayload = { userId: string; expiresAt: number };

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be configured in production.');
  return 'local-development-session-secret-change-before-deploying';
}

function sign(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds,
  } satisfies SessionPayload)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionPayload;
    if (session.expiresAt <= Math.floor(Date.now() / 1000) || typeof session.userId !== 'string') return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`;
}

export function expiredSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function getSessionTokenFromRequest(request: Request) {
  const cookies = request.headers.get('cookie')?.split(';') || [];
  const value = cookies.find((cookie) => cookie.trim().startsWith(`${sessionCookieName}=`));
  return value?.trim().slice(sessionCookieName.length + 1);
}

export async function getAuthenticatedUser(request: Request) {
  const session = verifySessionToken(getSessionTokenFromRequest(request));
  return session ? getUserById(session.userId) : null;
}