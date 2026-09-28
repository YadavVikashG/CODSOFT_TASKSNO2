import { NextResponse } from 'next/server';
import { mockOrders, type OrderStatus } from '@/lib/mock-orders';
import { createOrder, getOrders } from '@/lib/db';

export async function GET() {
  try {
    const dbOrders = await getOrders();
    return NextResponse.json(dbOrders.length ? dbOrders : mockOrders);
  } catch {
    return NextResponse.json(mockOrders);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const customer = String(body.customer || 'Guest').trim();
  const restaurant = String(body.restaurant || 'Selected restaurant').trim();
  const restaurantId = String(body.restaurantId || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const total = Number(body.total || 0);
  const allowedStatuses: OrderStatus[] = ['Preparing', 'Ready for pickup', 'Out for delivery', 'Delivered'];
  const rawStatus = String(body.status || 'Preparing');
  const status: OrderStatus = allowedStatuses.includes(rawStatus as OrderStatus)
    ? (rawStatus as OrderStatus)
    : 'Preparing';

  if (!items.length) {
    return NextResponse.json({ error: 'Cart cannot be empty.' }, { status: 400 });
  }

  const firstItem = items[0];
  const order = await createOrder({
    customerName: customer,
    restaurantName: restaurant,
    restaurantId,
    itemName: String(firstItem?.name || 'Dish'),
    foodCode: String(firstItem?.foodCode || 'FOOD-UNKNOWN'),
    total,
    status,
  });

  if (Array.isArray(mockOrders)) {
    mockOrders.unshift({
      id: order.id,
      customer: order.customer,
      restaurant: order.restaurant,
      item: order.item,
      total: Number(order.total),
      status: order.status as OrderStatus,
      time: order.time,
    });
  }

  return NextResponse.json({ success: true, order });
}
