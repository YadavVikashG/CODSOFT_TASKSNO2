import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { createMenuItem } from '@/lib/db';

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'restaurant' || !user.restaurantId) {
    return NextResponse.json({ error: 'A linked restaurant account is required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const restaurantId = user.restaurantId;
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const price = Number(body.price || 0);
    const stockQuantity = Number(body.stockQuantity);
    const discountPercent = Number(body.discountPercent || 0);
    const image = String(body.image || '').trim();
    const code = String(body.code || '').trim();

    if (!restaurantId || !name || !description || !price || price <= 0) {
      return NextResponse.json({ error: 'Restaurant, name, description, and valid price are required.' }, { status: 400 });
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ error: 'Stock must be a whole number greater than or equal to zero.' }, { status: 400 });
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json({ error: 'Festival discount must be between 0 and 100 percent.' }, { status: 400 });
    }

    const item = await createMenuItem({
      restaurantId,
      name,
      description,
      price,
      image,
      code,
      veg: Boolean(body.veg),
      spicy: Boolean(body.spicy),
      stockQuantity,
      discountPercent,
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create menu item.' },
      { status: 500 },
    );
  }
}
