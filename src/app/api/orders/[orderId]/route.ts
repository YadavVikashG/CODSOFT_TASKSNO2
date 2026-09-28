import { NextResponse } from 'next/server';
import { updateOrderStatusById } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const status = String(body.status || 'Preparing').trim();

    const updated = await updateOrderStatusById(orderId, status);
    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update order.' },
      { status: 500 },
    );
  }
}
