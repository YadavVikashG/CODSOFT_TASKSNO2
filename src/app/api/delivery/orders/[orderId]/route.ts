import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { transitionDeliveryOrder } from '@/lib/db';

const actions = ['accept', 'picked-up', 'delivered'] as const;
type DeliveryAction = typeof actions[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'A delivery account is required.' }, { status: 403 });
  }

  try {
    const { orderId } = await params;
    const body = await request.json();
    const action = String(body.action || '') as DeliveryAction;
    if (!actions.includes(action)) {
      return NextResponse.json({ error: 'Choose accept, picked-up, or delivered.' }, { status: 400 });
    }

    const order = await transitionDeliveryOrder(user.id, orderId, action);
    return NextResponse.json({ success: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update delivery.';
    return NextResponse.json(
      { error: message },
      { status: message === 'Go on duty before accepting a pickup.' ? 409 : 409 },
    );
  }
}