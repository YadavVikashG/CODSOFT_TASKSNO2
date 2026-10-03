import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { pool } from '@/lib/db';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function databaseRequired() {
  return NextResponse.json({ error: 'Reservations require a configured database.' }, { status: 503 });
}

export async function GET(request: Request) {
  if (!pool) return databaseRequired();

  const user = await getAuthenticatedUser(request);
  const params = new URL(request.url).searchParams;
  const restaurantId = params.get('restaurantId')?.trim() || '';
  const date = params.get('date') || '';
  const time = params.get('time') || '';
  const duration = Number(params.get('duration') || 60);
  if (!restaurantId) {
    return NextResponse.json({ error: 'A restaurant is required.' }, { status: 400 });
  }
  if (params.get('capacity') === 'true') {
    if (!user || user.role !== 'restaurant' || user.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Restaurant owner access is required.' }, { status: 403 });
    }
    const { rows } = await pool.query<{ seat_count: number }>(
      'SELECT count(*)::integer AS seat_count FROM restaurant_seats WHERE restaurant_id = $1 AND active = TRUE',
      [restaurantId],
    );
    return NextResponse.json({ seatCount: Number(rows[0].seat_count) });
  }
  if (!validDate(date) || !validTime(time) || !Number.isInteger(duration) || duration < 30 || duration > 240) {
    return NextResponse.json({ error: 'Restaurant, date, time, and a valid duration are required.' }, { status: 400 });
  }

  try {
    const { rows: seatRows } = await pool.query<{ seat_number: number; available: boolean }>(
      `SELECT s.seat_number,
              NOT EXISTS (
                SELECT 1
                FROM reservation_seats rs
                JOIN reservations r ON r.id = rs.reservation_id
                WHERE rs.restaurant_id = s.restaurant_id
                  AND rs.seat_number = s.seat_number
                  AND r.status IN ('booked', 'checked-in')
                  AND (r.reservation_date + r.reservation_time)
                    < ($2::date + $3::time + $4::integer * INTERVAL '1 minute')
                  AND (r.reservation_date + r.reservation_time
                    + r.duration_minutes * INTERVAL '1 minute') > ($2::date + $3::time)
              ) AS available
       FROM restaurant_seats s
       WHERE s.restaurant_id = $1 AND s.active = TRUE
       ORDER BY s.seat_number`,
      [restaurantId, date, time, duration],
    );

    let reservations: Array<Record<string, unknown>> = [];
    if (user?.role === 'restaurant' && user.restaurantId === restaurantId) {
      const { rows } = await pool.query(
        `SELECT r.id, r.customer_name, r.reservation_date,
          to_char(r.reservation_time, 'HH24:MI') AS reservation_time,
          r.guests, r.duration_minutes, r.table_type, r.source,
          CASE WHEN (r.reservation_date + r.reservation_time
            + r.duration_minutes * INTERVAL '1 minute') <= NOW()
            THEN 'completed' ELSE r.status END AS status,
                COALESCE(array_agg(rs.seat_number ORDER BY rs.seat_number)
                  FILTER (WHERE rs.seat_number IS NOT NULL), '{}') AS seats
         FROM reservations r
         LEFT JOIN reservation_seats rs ON rs.reservation_id = r.id
         WHERE r.restaurant_id = $1 AND r.reservation_date = $2
           AND r.status IN ('booked', 'checked-in')
         GROUP BY r.id
         ORDER BY r.reservation_time`,
        [restaurantId, date],
      );
      reservations = rows;
    }

    return NextResponse.json({
      seats: seatRows.map((seat) => ({ number: seat.seat_number, available: seat.available })),
      availableCount: seatRows.filter((seat) => seat.available).length,
      totalCount: seatRows.length,
      reservations,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load table availability.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!pool) return databaseRequired();

  const user = await getAuthenticatedUser(request);
  try {
    const body = await request.json();
    const restaurantId = String(body.restaurantId || '').trim();
    const name = String(body.name || user?.name || '').trim();
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    const guests = Number(body.guests);
    const duration = Number(body.duration || 60);
    const source = body.source === 'walk-in' ? 'walk-in' : 'online';
    const tableType = String(body.tableType || 'Standard').trim();
    const requestedSeats: number[] = Array.isArray(body.seats)
      ? body.seats.map((seat: unknown) => Number(seat))
      : [];

    if (!restaurantId || !name || name.length > 150 || !validDate(date) || !validTime(time)
      || !Number.isInteger(guests) || guests < 1 || guests > 20
      || !Number.isInteger(duration) || duration < 30 || duration > 240
      || !tableType || tableType.length > 80
      || requestedSeats.some((seat) => !Number.isInteger(seat) || seat < 1)
      || (requestedSeats.length > 0 && requestedSeats.length !== guests)) {
      return NextResponse.json({ error: 'Enter a valid guest name, date, time, party size, duration, and seat selection.' }, { status: 400 });
    }

    if (source === 'walk-in') {
      if (!user || user.role !== 'restaurant' || user.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Only this restaurant owner can record a walk-in.' }, { status: 403 });
      }
    } else if (user && user.role !== 'user') {
      return NextResponse.json({ error: 'A customer account is required to book online.' }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const restaurantResult = await client.query(
        'SELECT id FROM restaurants WHERE id = $1 AND offers_dine_in = TRUE FOR UPDATE',
        [restaurantId],
      );
      if (!restaurantResult.rows[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Restaurant is unavailable for dine-in.' }, { status: 404 });
      }
      const slotResult = await client.query<{ is_future: boolean }>(
        `SELECT ($1::date + $2::time) >= date_trunc('minute', NOW()) AS is_future`,
        [date, time],
      );
      if (!slotResult.rows[0]?.is_future) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Choose a future arrival time.' }, { status: 400 });
      }

      const { rows: seatRows } = await client.query<{ seat_number: number }>(
        `SELECT s.seat_number
         FROM restaurant_seats s
         WHERE s.restaurant_id = $1 AND s.active = TRUE
           AND NOT EXISTS (
             SELECT 1
             FROM reservation_seats rs
             JOIN reservations r ON r.id = rs.reservation_id
             WHERE rs.restaurant_id = s.restaurant_id
               AND rs.seat_number = s.seat_number
               AND r.status IN ('booked', 'checked-in')
               AND (r.reservation_date + r.reservation_time)
                 < ($2::date + $3::time + $4::integer * INTERVAL '1 minute')
               AND (r.reservation_date + r.reservation_time
                 + r.duration_minutes * INTERVAL '1 minute') > ($2::date + $3::time)
           )
         ORDER BY s.seat_number
         FOR UPDATE OF s`,
        [restaurantId, date, time, duration],
      );
      const availableSeats = seatRows.map((seat) => Number(seat.seat_number));
      const chosenSeats = requestedSeats.length ? requestedSeats : availableSeats.slice(0, guests);
      if (chosenSeats.length !== guests || chosenSeats.some((seat) => !availableSeats.includes(seat))) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Those seats are no longer available. Refresh availability and choose again.' }, { status: 409 });
      }

      const { rows } = await client.query(
        `INSERT INTO reservations
          (restaurant_id, customer_user_id, customer_name, reservation_date,
           reservation_time, guests, table_type, duration_minutes, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, customer_name, reservation_date, reservation_time,
                   guests, table_type, duration_minutes, source, status`,
        [restaurantId, user?.role === 'user' ? user.id : null, name, date, time, guests, tableType, duration, source],
      );
      const reservation = rows[0];
      await client.query(
        `INSERT INTO reservation_seats (reservation_id, restaurant_id, seat_number)
         SELECT $1, $2, unnest($3::integer[])`,
        [reservation.id, restaurantId, chosenSeats],
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, reservation: { ...reservation, seats: chosenSeats } }, { status: 201 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to reserve a table.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!pool) return databaseRequired();

  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'restaurant' || !user.restaurantId) {
    return NextResponse.json({ error: 'Restaurant owner access is required.' }, { status: 403 });
  }

  const body = await request.json();
  const seatCount = Number(body.seatCount);
  if (!Number.isInteger(seatCount) || seatCount < 0 || seatCount > 300) {
    return NextResponse.json({ error: 'Seat count must be a whole number from 0 to 300.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM restaurants WHERE id = $1 FOR UPDATE', [user.restaurantId]);
    const bookedSeats = await client.query(
      `SELECT 1
       FROM reservation_seats rs
       JOIN reservations r ON r.id = rs.reservation_id
       WHERE rs.restaurant_id = $1 AND rs.seat_number > $2
         AND r.status IN ('booked', 'checked-in')
         AND (r.reservation_date + r.reservation_time
           + r.duration_minutes * INTERVAL '1 minute') > NOW()
       LIMIT 1`,
      [user.restaurantId, seatCount],
    );
    if (bookedSeats.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Some seats above this count have upcoming bookings. Move or cancel them before reducing capacity.' }, { status: 409 });
    }

    await client.query(
      `INSERT INTO restaurant_seats (restaurant_id, seat_number, active)
       SELECT $1, number, TRUE FROM generate_series(1, $2::integer) AS number
       ON CONFLICT (restaurant_id, seat_number) DO UPDATE SET active = TRUE`,
      [user.restaurantId, seatCount],
    );
    await client.query(
      'UPDATE restaurant_seats SET active = (seat_number <= $2) WHERE restaurant_id = $1',
      [user.restaurantId, seatCount],
    );
    await client.query('COMMIT');
    return NextResponse.json({ success: true, seatCount });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update seating capacity.' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}