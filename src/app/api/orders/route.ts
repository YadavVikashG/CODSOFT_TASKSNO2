import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { createOrder, getOrders, getRestaurants } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json([]);

  const filters = user.role === 'restaurant'
    ? user.restaurantId ? { restaurantId: user.restaurantId } : null
    : user.role === 'user' ? { customerId: user.id }
      : user.role === 'admin' ? {}
        : null;
  if (!filters) return NextResponse.json([]);

  try {
    return NextResponse.json(await getOrders(filters));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load orders.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'user') {
    return NextResponse.json({ error: 'Sign in with a customer account to place an order.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const restaurantId = String(body.restaurantId || '').trim();
    const requestedItems = Array.isArray(body.items) ? body.items : [];
    if (!restaurantId || !requestedItems.length) {
      return NextResponse.json({ error: 'Restaurant and cart items are required.' }, { status: 400 });
    }

    const restaurant = (await getRestaurants()).find((row) => row.id === restaurantId);
    if (!restaurant) return NextResponse.json({ error: 'Restaurant is unavailable.' }, { status: 404 });
    if (!restaurant.offersDelivery) return NextResponse.json({ error: 'This restaurant is not accepting delivery orders.' }, { status: 400 });

    const items: Array<{ id: string; quantity: number }> = requestedItems.map((item: { id?: unknown; quantity?: unknown }) => ({
      id: String(item.id || ''),
      quantity: Number(item.quantity),
    }));
    if (items.some((item: { id: string; quantity: number }) => !item.id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
      return NextResponse.json({ error: 'Your cart contains an invalid item or quantity.' }, { status: 400 });
    }

    const order = await createOrder({
      customerId: user.id,
      customerName: user.name,
      restaurantName: restaurant.name,
      restaurantId,
      items,
      deliveryFee: restaurant.fee,
      serviceFee: 2.5,
      status: 'Preparing',
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to place your order.' },
      { status: error instanceof Error && (error.message.includes('stock') || error.message.includes('unavailable')) ? 409 : 500 },
    );
  }
}
