import { NextResponse } from 'next/server';
import { createMenuItem } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = String(body.restaurantId || '').trim();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const price = Number(body.price || 0);
    const image = String(body.image || '').trim();
    const code = String(body.code || '').trim();

    if (!restaurantId || !name || !description || !price || price <= 0) {
      return NextResponse.json({ error: 'Restaurant, name, description, and valid price are required.' }, { status: 400 });
    }

    const item = await createMenuItem({
      restaurantId,
      name,
      description,
      price,
      image,
      code,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create menu item.' },
      { status: 500 },
    );
  }
}
