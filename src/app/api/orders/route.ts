import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { createOrder, createOrders, getOrders, getRestaurants } from '@/lib/db';

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
  if (!user || !['user', 'restaurant'].includes(user.role)) {
    return NextResponse.json({ error: 'Sign in with a customer or restaurant account to place an order.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const source = body.source === 'walk-in' ? 'walk-in' : 'online';
    const requestedItems = Array.isArray(body.items) ? body.items : [];

    if (source === 'online') {
      if (user.role !== 'user') {
        return NextResponse.json({ error: 'Only customer accounts can place delivery orders.' }, { status: 403 });
      }
      if (!requestedItems.length) {
        return NextResponse.json({ error: 'Cart items are required.' }, { status: 400 });
      }

      const items = requestedItems.map((entry: unknown) => {
        const item = typeof entry === 'object' && entry !== null
          ? entry as { id?: unknown; restaurantId?: unknown; quantity?: unknown }
          : {};
        return {
          id: String(item.id || '').trim(),
          restaurantId: String(item.restaurantId || '').trim(),
          quantity: Number(item.quantity),
        };
      });
      if (items.some((item: { id: string; restaurantId: string; quantity: number }) =>
        !item.id || !item.restaurantId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
        return NextResponse.json({ error: 'Your cart contains an invalid item or quantity.' }, { status: 400 });
      }

      const groupedItems = new Map<string, Array<{ id: string; quantity: number }>>();
      for (const item of items) {
        const group = groupedItems.get(item.restaurantId) || [];
        group.push({ id: item.id, quantity: item.quantity });
        groupedItems.set(item.restaurantId, group);
      }

      const restaurants = await getRestaurants();
      const groups = [...groupedItems].map(([restaurantId, groupItems]) => {
        const restaurant = restaurants.find((entry) => entry.id === restaurantId);
        if (!restaurant) throw new Error('A restaurant in your cart is unavailable.');
        if (!restaurant.offersDelivery) throw new Error(`${restaurant.name} is not accepting delivery orders.`);
        return {
          restaurantId,
          restaurantName: restaurant.name,
          items: groupItems,
          deliveryFee: restaurant.fee,
          serviceFee: 2.5,
          status: 'Preparing',
        };
      });

      const orders = await createOrders({
        customerId: user.id,
        customerName: user.name,
        groups,
      });
      return NextResponse.json({ success: true, orders }, { status: 201 });
    }

    const restaurantId = user.role === 'restaurant'
      ? user.restaurantId || ''
      : String(body.restaurantId || '').trim();
    if (!restaurantId || !requestedItems.length) {
      return NextResponse.json({ error: 'Restaurant and cart items are required.' }, { status: 400 });
    }
    if (source === 'walk-in' && user.role !== 'restaurant') {
      return NextResponse.json({ error: 'Only a restaurant owner can record an in-person sale.' }, { status: 403 });
    }
    const restaurant = (await getRestaurants()).find((row) => row.id === restaurantId);
    if (!restaurant) return NextResponse.json({ error: 'Restaurant is unavailable.' }, { status: 404 });
    if (source === 'walk-in' && !restaurant.offersDineIn) {
      return NextResponse.json({ error: 'This restaurant is not accepting dine-in orders.' }, { status: 400 });
    }

    const items: Array<{ id: string; quantity: number }> = requestedItems.map((item: { id?: unknown; quantity?: unknown }) => ({
      id: String(item.id || ''),
      quantity: Number(item.quantity),
    }));
    if (items.some((item: { id: string; quantity: number }) => !item.id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
      return NextResponse.json({ error: 'Your cart contains an invalid item or quantity.' }, { status: 400 });
    }

    const order = await createOrder({
      customerId: user.id,
      customerName: source === 'walk-in'
        ? String(body.customerName || 'Walk-in guest').trim().slice(0, 150) || 'Walk-in guest'
        : user.name,
      restaurantName: restaurant.name,
      restaurantId,
      items,
      deliveryFee: source === 'walk-in' ? 0 : restaurant.fee,
      serviceFee: source === 'walk-in' ? 0 : 2.5,
      status: source === 'walk-in' ? 'Dine-in' : 'Preparing',
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to place your order.' },
      { status: error instanceof Error && (error.message.includes('stock') || error.message.includes('unavailable')) ? 409 : 500 },
    );
  }
}
