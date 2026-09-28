import { NextResponse } from 'next/server';
import { publicUser, registerUser } from '@/lib/auth-store';
import { createSessionToken, sessionCookie } from '@/lib/auth-session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const user = await registerUser({
      name,
      email,
      password,
    });

    const response = NextResponse.json({ success: true, user: publicUser(user) });
    response.headers.set('Set-Cookie', sessionCookie(createSessionToken(user.id)));
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed.' },
      { status: 400 },
    );
  }
}
