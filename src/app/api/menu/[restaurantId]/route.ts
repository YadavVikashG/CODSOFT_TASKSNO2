import { NextResponse } from 'next/server';
import { getMenuByRestaurantId } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const menu = await getMenuByRestaurantId(restaurantId);
  return NextResponse.json(menu);
}
