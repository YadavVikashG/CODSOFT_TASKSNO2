import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { deleteMenuItemForRestaurant, updateMenuItemForRestaurant } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'restaurant' || !user.restaurantId) {
    return NextResponse.json({ error: 'A linked restaurant account is required.' }, { status: 403 });
  }

  try {
    const { itemId } = await params;
    const body = await request.json();
    const price = Number(body.price);
    const stockQuantity = Number(body.stockQuantity);
    const discountPercent = Number(body.discountPercent);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Enter a price greater than zero.' }, { status: 400 });
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ error: 'Stock must be a whole number greater than or equal to zero.' }, { status: 400 });
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json({ error: 'Festival discount must be between 0 and 100 percent.' }, { status: 400 });
    }

    const item = await updateMenuItemForRestaurant({
      id: itemId,
      restaurantId: user.restaurantId,
      price,
      stockQuantity,
      discountPercent,
    });
    if (!item) return NextResponse.json({ error: 'Menu item not found.' }, { status: 404 });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update menu item.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'restaurant' || !user.restaurantId) {
    return NextResponse.json({ error: 'A linked restaurant account is required.' }, { status: 403 });
  }

  try {
    const { itemId } = await params;
    const deleted = await deleteMenuItemForRestaurant(itemId, user.restaurantId);
    if (!deleted) return NextResponse.json({ error: 'Menu item not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete menu item.' },
      { status: 500 },
    );
  }
}