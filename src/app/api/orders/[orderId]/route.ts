import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { updateOrderStatusById } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user || (user.role !== 'admin' && user.role !== 'restaurant')) {
    return NextResponse.json({ error: 'Admin or restaurant access is required.' }, { status: 403 });
  }

  try {
    const { orderId } = await params;
    const body = await request.json();
    const status = String(body.status || 'Preparing').trim();
    const allowedStatuses = user.role === 'restaurant'
      ? ['Preparing', 'Ready for pickup']
      : ['Preparing', 'Ready for pickup', 'Picked Up', 'Out for delivery', 'Delivered'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid order status for this role.' }, { status: 400 });
    }

    const updated = await updateOrderStatusById(
      orderId,
      status,
      user.role === 'restaurant' ? user.restaurantId || undefined : undefined,
    );
    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update order.' },
      { status: error instanceof Error && error.message === 'Order not found.' ? 404 : 500 },
    );
  }
}
