import { Pool } from 'pg';

export type RestaurantRow = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  delivery_time: string;
  delivery_fee: number;
  image: string | null;
  tag: string | null;
  featured: boolean;
  latitude: number | null;
  longitude: number | null;
  offers_delivery: boolean;
  offers_dine_in: boolean;
};

export type RestaurantSearchFilters = {
  query?: string;
  mode?: 'all' | 'delivery' | 'dine-in';
  dietary?: 'all' | 'veg' | 'non-veg';
  minRating?: number;
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
};

export type MenuItemRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  discount_percent: number;
  spicy: boolean;
  veg: boolean;
  popular: boolean;
  image: string | null;
  code: string;
};

export type OrderRow = {
  id: string;
  customer_user_id: string | null;
  driver_user_id: string | null;
  customer_name: string;
  restaurant_name: string;
  restaurant_id: string | null;
  item_name: string;
  food_code: string | null;
  total: number;
  status: string;
  created_at: Date;
};

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

export async function getRestaurants() {
  if (!pool) return [];

  const { rows } = await pool.query(
    `SELECT id, name, cuisine, rating, reviews, delivery_time, delivery_fee, image, tag, featured,
            latitude, longitude, offers_delivery, offers_dine_in
       FROM restaurants
       ORDER BY featured DESC, rating DESC, name ASC`
  );

  return rows.map((row: RestaurantRow) => ({
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    deliveryTime: row.delivery_time,
    fee: Number(row.delivery_fee),
    image: row.image ?? '',
    tag: row.tag ?? '',
    featured: Boolean(row.featured),
    latitude: row.latitude,
    longitude: row.longitude,
    offersDelivery: Boolean(row.offers_delivery),
    offersDineIn: Boolean(row.offers_dine_in),
  }));
}

export async function searchRestaurants(filters: RestaurantSearchFilters = {}) {
  const normalized = {
    ...filters,
    query: filters.query?.trim() ?? '',
    minRating: Math.max(0, Math.min(5, filters.minRating ?? 0)),
  };

  if (!pool) return [];

  const { rows } = await pool.query<RestaurantRow>(
      `SELECT r.id, r.name, r.cuisine, r.rating, r.reviews, r.delivery_time, r.delivery_fee,
              r.image, r.tag, r.featured, r.latitude, r.longitude,
              r.offers_delivery, r.offers_dine_in
       FROM restaurants r
       WHERE ($1 = '' OR
         to_tsvector('simple', coalesce(r.name, '') || ' ' || coalesce(r.cuisine, '') || ' ' || coalesce(r.tag, ''))
           @@ websearch_to_tsquery('simple', $1) OR
         EXISTS (
           SELECT 1 FROM menu_items m
           WHERE m.restaurant_id = r.id
             AND to_tsvector('simple', coalesce(m.name, '') || ' ' || coalesce(m.description, ''))
               @@ websearch_to_tsquery('simple', $1)
         )
       )
       AND ($2 = 'all' OR ($2 = 'delivery' AND r.offers_delivery) OR ($2 = 'dine-in' AND r.offers_dine_in))
       AND coalesce(r.rating, 0) >= $3
       AND ($4 = 'all' OR EXISTS (
         SELECT 1 FROM menu_items m
         WHERE m.restaurant_id = r.id AND m.veg = ($4 = 'veg')
       ))
       AND ($5::double precision IS NULL OR (
         r.location IS NOT NULL AND ST_DWithin(
           r.location,
           ST_SetSRID(ST_MakePoint($6::double precision, $7::double precision), 4326)::geography,
           $5::double precision * 1000
         )
       ))
       ORDER BY
         CASE WHEN $5::double precision IS NOT NULL THEN ST_Distance(
           r.location,
           ST_SetSRID(ST_MakePoint($6::double precision, $7::double precision), 4326)::geography
         ) END ASC NULLS LAST,
         r.featured DESC, r.rating DESC, r.name ASC`,
      [
        normalized.query,
        filters.mode ?? 'all',
        normalized.minRating,
        filters.dietary ?? 'all',
        filters.radiusKm ?? null,
        filters.longitude ?? null,
        filters.latitude ?? null,
      ],
    );

  return rows.map((row) => ({
      id: row.id,
      name: row.name,
      cuisine: row.cuisine,
      rating: Number(row.rating),
      reviews: Number(row.reviews),
      deliveryTime: row.delivery_time,
      fee: Number(row.delivery_fee),
      image: row.image ?? '',
      tag: row.tag ?? '',
      featured: Boolean(row.featured),
      latitude: row.latitude,
      longitude: row.longitude,
      offersDelivery: Boolean(row.offers_delivery),
      offersDineIn: Boolean(row.offers_dine_in),
  }));
}

export async function getMenuByRestaurantId(restaurantId: string) {
  if (!pool) return [];

  const { rows } = await pool.query(
      `SELECT id, restaurant_id, name, description, price, stock_quantity, discount_percent, spicy, veg, popular, image, code
       FROM menu_items
       WHERE restaurant_id = $1
       ORDER BY popular DESC, name ASC`,
      [restaurantId]
    );

  return rows.map((row: MenuItemRow) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      code: row.code,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      stockQuantity: Number(row.stock_quantity),
      discountPercent: Number(row.discount_percent),
      spicy: Boolean(row.spicy),
      veg: Boolean(row.veg),
      popular: Boolean(row.popular),
      image: row.image ?? '',
  }));
}

export async function createMenuItem(data: {
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  code?: string;
  veg?: boolean;
  spicy?: boolean;
  stockQuantity: number;
  discountPercent: number;
}) {
  if (!pool) throw new Error('PostgreSQL must be configured to save menu items.');

  const { rows } = await pool.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, stock_quantity, discount_percent, spicy, veg, popular, image, code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, restaurant_id, name, description, price, stock_quantity, discount_percent, spicy, veg, popular, image, code`,
      [
        data.restaurantId,
        data.name,
        data.description,
        data.price,
        data.stockQuantity,
        data.discountPercent,
        data.spicy ?? false,
        data.veg ?? false,
        false,
        data.image || '',
        data.code || `MENU-${Date.now()}`,
      ]
  );

  return rows[0];
}

export async function updateMenuItemForRestaurant(data: {
  id: string;
  restaurantId: string;
  price: number;
  stockQuantity: number;
  discountPercent: number;
}) {
  if (!pool) throw new Error('PostgreSQL must be configured to update menu items.');

  const { rows } = await pool.query(
    `UPDATE menu_items
     SET price = $3, stock_quantity = $4, discount_percent = $5
     WHERE id = $1 AND restaurant_id = $2
     RETURNING id, restaurant_id, name, description, price, stock_quantity, discount_percent, spicy, veg, popular, image, code`,
    [data.id, data.restaurantId, data.price, data.stockQuantity, data.discountPercent],
  );

  if (!rows[0]) return null;
  const row = rows[0] as MenuItemRow;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stockQuantity: Number(row.stock_quantity),
    discountPercent: Number(row.discount_percent),
    spicy: Boolean(row.spicy),
    veg: Boolean(row.veg),
    popular: Boolean(row.popular),
    image: row.image ?? '',
  };
}

export async function deleteMenuItemForRestaurant(id: string, restaurantId: string) {
  if (!pool) throw new Error('PostgreSQL must be configured to delete menu items.');
  const { rowCount } = await pool.query(
    'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2',
    [id, restaurantId],
  );
  return (rowCount ?? 0) > 0;
}

function orderTime(createdAt: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function mapOrder(row: OrderRow) {
  return {
    id: row.id,
    customer: row.customer_name,
    restaurant: row.restaurant_name,
    restaurantId: row.restaurant_id ?? '',
    item: row.item_name,
    foodCode: row.food_code ?? '',
    total: Number(row.total),
    status: row.status,
    time: orderTime(row.created_at),
  };
}

export async function getOrders(filters: { customerId?: string; restaurantId?: string } = {}) {
  if (!pool) return [];

  const conditions: string[] = [];
  const values: string[] = [];
  if (filters.customerId) {
    values.push(filters.customerId);
    conditions.push(`customer_user_id = $${values.length}`);
  }
  if (filters.restaurantId) {
    values.push(filters.restaurantId);
    conditions.push(`restaurant_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<OrderRow>(
    `SELECT id, customer_user_id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at
     FROM orders ${where}
     ORDER BY created_at DESC`,
    values,
  );

  return rows.map(mapOrder);
}

export async function getDeliveryJobs(driverId: string) {
  if (!pool) return [];
  const { rows } = await pool.query<OrderRow>(
    `SELECT id, customer_user_id, driver_user_id, customer_name, restaurant_name, restaurant_id,
            item_name, food_code, total, status, created_at
     FROM orders
     WHERE (status = 'Ready for pickup' AND driver_user_id IS NULL)
        OR (driver_user_id = $1 AND status IN ('Ready for pickup', 'Picked Up'))
     ORDER BY created_at ASC`,
    [driverId],
  );

  return rows.map((row) => ({ ...mapOrder(row), assignedToMe: row.driver_user_id === driverId }));
}

export async function setDeliveryDuty(driverId: string, isOnDuty: boolean) {
  if (!pool) throw new Error('PostgreSQL must be configured to update driver status.');
  const { rowCount } = await pool.query(
    "UPDATE users SET is_on_duty = $2 WHERE id = $1 AND role = 'delivery'",
    [driverId, isOnDuty],
  );
  return (rowCount ?? 0) > 0;
}

export async function transitionDeliveryOrder(
  driverId: string,
  orderId: string,
  action: 'accept' | 'picked-up' | 'delivered',
) {
  if (!pool) throw new Error('PostgreSQL must be configured to update deliveries.');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    if (action === 'accept') {
      const driver = await client.query<{ is_on_duty: boolean }>(
        "SELECT is_on_duty FROM users WHERE id = $1 AND role = 'delivery' FOR UPDATE",
        [driverId],
      );
      if (!driver.rows[0]?.is_on_duty) throw new Error('Go on duty before accepting a pickup.');
    }

    const nextState = action === 'picked-up' ? 'Picked Up' : action === 'delivered' ? 'Delivered' : 'Ready for pickup';
    const { rows } = action === 'accept'
      ? await client.query<OrderRow>(
        `UPDATE orders SET driver_user_id = $1
         WHERE id = $2 AND status = 'Ready for pickup' AND driver_user_id IS NULL
         RETURNING id, customer_user_id, driver_user_id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at`,
        [driverId, orderId],
      )
      : await client.query<OrderRow>(
        `UPDATE orders SET status = $3
         WHERE id = $1 AND driver_user_id = $2
           AND (($3 = 'Picked Up' AND status = 'Ready for pickup')
             OR ($3 = 'Delivered' AND status = 'Picked Up'))
         RETURNING id, customer_user_id, driver_user_id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at`,
        [orderId, driverId, nextState],
      );

    if (!rows[0]) throw new Error('This delivery is no longer available for that action.');
    await client.query('COMMIT');
    return { ...mapOrder(rows[0]), assignedToMe: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createOrder(data: {
  customerId: string;
  customerName: string;
  restaurantName: string;
  restaurantId: string;
  items: Array<{ id: string; quantity: number }>;
  deliveryFee: number;
  serviceFee: number;
  status?: string;
}) {
  if (!pool) throw new Error('PostgreSQL must be configured to save orders.');

  const quantities = new Map<string, number>();
  for (const line of data.items) {
    if (!line.id || !Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Your cart contains an invalid item or quantity.');
    }
    quantities.set(line.id, (quantities.get(line.id) ?? 0) + line.quantity);
  }
  if (quantities.size === 0) throw new Error('Cart cannot be empty.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query<MenuItemRow>(
      `SELECT id, restaurant_id, name, description, price, stock_quantity, discount_percent,
              spicy, veg, popular, image, code
       FROM menu_items
       WHERE restaurant_id = $1 AND id = ANY($2::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [data.restaurantId, [...quantities.keys()]],
    );
    if (items.length !== quantities.size) throw new Error('Your cart contains an unavailable item.');

    const lines = items.map((item) => {
      const quantity = quantities.get(item.id)!;
      if (Number(item.stock_quantity) < quantity) {
        throw new Error(`${item.name} has only ${item.stock_quantity} left in stock.`);
      }
      return {
        item,
        quantity,
        lineTotal: Math.round(Number(item.price) * (1 - Number(item.discount_percent) / 100) * 100) / 100 * quantity,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const total = Math.round((subtotal + data.deliveryFee + data.serviceFee) * 100) / 100;

    for (const { item, quantity } of lines) {
      await client.query(
        'UPDATE menu_items SET stock_quantity = stock_quantity - $2 WHERE id = $1',
        [item.id, quantity],
      );
    }

    const itemName = lines.map(({ item, quantity }) => `${item.name} x${quantity}`).join(', ').slice(0, 150);
    const foodCode = lines.map(({ item }) => item.code).join(',').slice(0, 80);
    const { rows } = await client.query(
      `INSERT INTO orders (customer_user_id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, customer_user_id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at`,
      [data.customerId, data.customerName, data.restaurantName, data.restaurantId, itemName, foodCode, total, data.status ?? 'Preparing'],
    );
    await client.query('COMMIT');

    const row = rows[0];
    return {
      id: row.id,
      customer: row.customer_name,
      restaurant: row.restaurant_name,
      restaurantId: row.restaurant_id ?? '',
      item: row.item_name,
      foodCode: row.food_code ?? '',
      total: Number(row.total),
      status: row.status,
      time: orderTime(row.created_at),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderStatusById(orderId: string, status: string, restaurantId?: string) {
  if (!pool) throw new Error('PostgreSQL must be configured to update orders.');

  const values: string[] = [orderId, status];
  const restaurantCondition = restaurantId ? ' AND restaurant_id = $3' : '';
  if (restaurantId) values.push(restaurantId);
  const { rows } = await pool.query(
        `UPDATE orders
       SET status = $2
       WHERE id = $1${restaurantCondition}
         RETURNING id, customer_user_id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at`,
      values,
  );

  if (!rows[0]) throw new Error('Order not found.');

  const row = rows[0];
  return {
    id: row.id,
    customer: row.customer_name,
    restaurant: row.restaurant_name,
    restaurantId: row.restaurant_id ?? '',
    item: row.item_name,
    foodCode: row.food_code ?? '',
    total: Number(row.total),
    status: row.status,
    time: 'Updated',
  };
}

export async function pingDatabase() {
  if (!pool) {
    return { ok: false, message: 'PostgreSQL is not configured.' };
  }

  try {
    await pool.query('SELECT 1');
    return { ok: true, message: 'PostgreSQL connected successfully.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Database connection failed.',
    };
  }
}
