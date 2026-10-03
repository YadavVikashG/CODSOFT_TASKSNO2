import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { pool } from '@/lib/db';

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'restaurant' || !user.restaurantId) {
    return NextResponse.json({ error: 'Restaurant owner access is required.' }, { status: 403 });
  }
  if (!pool) {
    return NextResponse.json({ error: 'A configured database is required to save restaurant location.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
      || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 });
    }

    const { rows } = await pool.query<{ latitude: number; longitude: number }>(
      `UPDATE restaurants
       SET latitude = $2, longitude = $3
       WHERE id = $1
       RETURNING latitude, longitude`,
      [user.restaurantId, latitude, longitude],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Restaurant profile was not found.' }, { status: 404 });

    return NextResponse.json({
      success: true,
      latitude: Number(rows[0].latitude),
      longitude: Number(rows[0].longitude),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save restaurant location.' },
      { status: 500 },
    );
  }
}