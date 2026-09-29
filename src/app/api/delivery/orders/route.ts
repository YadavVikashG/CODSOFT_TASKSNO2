import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { getDeliveryJobs } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'A delivery account is required.' }, { status: 403 });
  }

  try {
    return NextResponse.json(await getDeliveryJobs(user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load delivery orders.' },
      { status: 500 },
    );
  }
}