import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { pool, searchRestaurants } from '@/lib/db';

function optionalNumber(value: string | null) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const modeValue = params.get('mode');
  const dietaryValue = params.get('dietary');
  const latitude = optionalNumber(params.get('latitude'));
  const longitude = optionalNumber(params.get('longitude'));
  const radiusKm = optionalNumber(params.get('radiusKm'));
  const hasValidLocation = latitude !== undefined && longitude !== undefined
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

  const restaurants = await searchRestaurants({
    query: params.get('q') || '',
    mode: modeValue === 'delivery' || modeValue === 'dine-in' ? modeValue : 'all',
    dietary: dietaryValue === 'veg' || dietaryValue === 'non-veg' ? dietaryValue : 'all',
    minRating: Math.max(0, Math.min(5, optionalNumber(params.get('minRating')) ?? 0)),
    radiusKm: hasValidLocation && radiusKm !== undefined
      ? Math.max(1, Math.min(100, radiusKm))
      : undefined,
    latitude: hasValidLocation ? latitude : undefined,
    longitude: hasValidLocation ? longitude : undefined,
  });

  const user = await getAuthenticatedUser(request);
  if (!pool || user?.role !== 'user' || restaurants.length === 0) {
    return NextResponse.json(restaurants);
  }

  const { rows } = await pool.query<{ restaurant_id: string; rating: number }>(
    `SELECT restaurant_id, rating
     FROM restaurant_reviews
     WHERE user_id = $1 AND restaurant_id = ANY($2::uuid[])`,
    [user.id, restaurants.map((restaurant) => restaurant.id)],
  );
  const userRatings = new Map(rows.map((row) => [row.restaurant_id, Number(row.rating)]));
  return NextResponse.json(restaurants.map((restaurant) => ({
    ...restaurant,
    myRating: userRatings.get(restaurant.id) ?? 0,
  })));
}
