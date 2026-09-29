import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { setDeliveryDuty } from '@/lib/db';

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'A delivery account is required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body.isOnDuty !== 'boolean') {
      return NextResponse.json({ error: 'Choose on-duty or off-duty.' }, { status: 400 });
    }

    const updated = await setDeliveryDuty(user.id, body.isOnDuty);
    if (!updated) return NextResponse.json({ error: 'Delivery account not found.' }, { status: 404 });
    return NextResponse.json({ success: true, isOnDuty: body.isOnDuty });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update duty status.' },
      { status: 500 },
    );
  }
}