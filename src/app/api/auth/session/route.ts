import { NextResponse } from 'next/server';
import { expiredSessionCookie, getSessionTokenFromRequest, verifySessionToken } from '@/lib/auth-session';
import { getUserById, publicUser } from '@/lib/auth-store';

export async function GET(request: Request) {
  const session = verifySessionToken(getSessionTokenFromRequest(request));
  if (!session) return NextResponse.json({ user: null });

  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ user: null }, { headers: { 'Set-Cookie': expiredSessionCookie() } });
  return NextResponse.json({ user: publicUser(user) });
}

export async function DELETE() {
  return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': expiredSessionCookie() } });
}