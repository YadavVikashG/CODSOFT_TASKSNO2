import { NextResponse } from 'next/server';
import { getRestaurants } from '@/lib/db';

export async function GET() {
  const restaurants = await getRestaurants();
  return NextResponse.json(restaurants);
}
