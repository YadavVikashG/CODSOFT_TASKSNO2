import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { pool } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'user') {
    return NextResponse.json({ error: 'Sign in with a customer account to rate restaurants.' }, { status: 403 });
  }
  if (!pool) {
    return NextResponse.json({ error: 'A configured database is required to save restaurant ratings.' }, { status: 503 });
  }

  try {
    const { restaurantId } = await params;
    const body = await request.json();
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be a whole number from 1 to 5.' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const restaurant = await client.query(
        'SELECT id FROM restaurants WHERE id = $1 FOR UPDATE',
        [restaurantId],
      );
      if (!restaurant.rows[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Restaurant was not found.' }, { status: 404 });
      }

      await client.query(
        `INSERT INTO restaurant_reviews (restaurant_id, user_id, rating)
         VALUES ($1, $2, $3)
         ON CONFLICT (restaurant_id, user_id)
         DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()`,
        [restaurantId, user.id, rating],
      );
      const { rows: [aggregate] } = await client.query<{ rating: number; reviews: number }>(
        `SELECT COALESCE(AVG(rating), 0)::numeric(3,2) AS rating, count(*)::integer AS reviews
         FROM restaurant_reviews
         WHERE restaurant_id = $1`,
        [restaurantId],
      );
      await client.query(
        'UPDATE restaurants SET rating = $2, reviews = $3 WHERE id = $1',
        [restaurantId, aggregate.rating, aggregate.reviews],
      );
      await client.query('COMMIT');
      return NextResponse.json({
        success: true,
        restaurantId,
        rating: Number(aggregate.rating),
        reviews: Number(aggregate.reviews),
        myRating: rating,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save restaurant rating.' },
      { status: 500 },
    );
  }
}