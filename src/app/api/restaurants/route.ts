import { NextResponse } from 'next/server';
import { searchRestaurants } from '@/lib/db';

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

  return NextResponse.json(restaurants);
}
