import { Pool } from 'pg';
import { menuByRestaurant, restaurants, type Restaurant as FallbackRestaurant } from '@/lib/fallback-data';
import { mockOrders } from '@/lib/mock-orders';

export type RestaurantRow = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  delivery_time: string;
  delivery_fee: number;
  image: string;
  tag: string;
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
  spicy: boolean;
  veg: boolean;
  popular: boolean;
  image: string;
  code: string;
};

export type OrderRow = {
  id: string;
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
  if (!pool) {
    return restaurants;
  }

  try {
    const { rows } = await pool.query(
            `SELECT id, name, cuisine, rating, reviews, delivery_time, delivery_fee, image, tag, featured,
              latitude, longitude, offers_delivery, offers_dine_in
       FROM restaurants
       ORDER BY featured DESC, rating DESC, name ASC`
    );

    if (rows.length === 0) {
      return restaurants;
    }

    return rows.map((row: RestaurantRow) => ({
      id: row.id,
      name: row.name,
      cuisine: row.cuisine,
      rating: Number(row.rating),
      reviews: Number(row.reviews),
      deliveryTime: row.delivery_time,
      fee: Number(row.delivery_fee),
      image: row.image,
      tag: row.tag,
      featured: Boolean(row.featured),
      latitude: row.latitude,
      longitude: row.longitude,
      offersDelivery: Boolean(row.offers_delivery),
      offersDineIn: Boolean(row.offers_dine_in),
    }));
  } catch {
    return restaurants;
  }
}

function matchesFallbackRestaurant(restaurant: FallbackRestaurant, filters: RestaurantSearchFilters) {
  const query = filters.query?.trim().toLocaleLowerCase();
  if (query) {
    const menuItems = menuByRestaurant[restaurant.id] ?? [];
    const hasMatch = [restaurant.name, restaurant.cuisine, restaurant.tag, ...menuItems.flatMap((item) => [item.name, item.description])]
      .some((value) => value.toLocaleLowerCase().includes(query));
    if (!hasMatch) return false;
  }

  if (filters.mode === 'delivery' && !restaurant.offersDelivery) return false;
  if (filters.mode === 'dine-in' && !restaurant.offersDineIn) return false;
  if ((filters.minRating ?? 0) > restaurant.rating) return false;

  if (filters.dietary && filters.dietary !== 'all') {
    const menuItems = menuByRestaurant[restaurant.id] ?? [];
    if (!menuItems.some((item) => filters.dietary === 'veg' ? item.veg === true : item.veg !== true)) {
      return false;
    }
  }

  if (filters.radiusKm && filters.latitude !== undefined && filters.longitude !== undefined) {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = radians(restaurant.latitude - filters.latitude);
    const longitudeDelta = radians(restaurant.longitude - filters.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(filters.latitude)) * Math.cos(radians(restaurant.latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    if (distanceKm > filters.radiusKm) return false;
  }

  return true;
}

export async function searchRestaurants(filters: RestaurantSearchFilters = {}) {
  const normalized = {
    ...filters,
    query: filters.query?.trim() ?? '',
    minRating: Math.max(0, Math.min(5, filters.minRating ?? 0)),
  };

  if (!pool) return restaurants.filter((restaurant) => matchesFallbackRestaurant(restaurant, normalized));

  try {
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

    if (rows.length === 0) {
      const { rows: countRows } = await pool.query<{ has_restaurants: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM restaurants) AS has_restaurants',
      );
      if (!countRows[0].has_restaurants) {
        return restaurants.filter((restaurant) => matchesFallbackRestaurant(restaurant, normalized));
      }
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      cuisine: row.cuisine,
      rating: Number(row.rating),
      reviews: Number(row.reviews),
      deliveryTime: row.delivery_time,
      fee: Number(row.delivery_fee),
      image: row.image,
      tag: row.tag,
      featured: Boolean(row.featured),
      latitude: row.latitude,
      longitude: row.longitude,
      offersDelivery: Boolean(row.offers_delivery),
      offersDineIn: Boolean(row.offers_dine_in),
    }));
  } catch {
    return restaurants.filter((restaurant) => matchesFallbackRestaurant(restaurant, normalized));
  }
}

export async function getMenuByRestaurantId(restaurantId: string) {
  if (!pool) {
    return menuByRestaurant[restaurantId] ?? [];
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, restaurant_id, name, description, price, spicy, veg, popular, image, code
       FROM menu_items
       WHERE restaurant_id = $1
       ORDER BY popular DESC, name ASC`,
      [restaurantId]
    );

    if (rows.length === 0) {
      return menuByRestaurant[restaurantId] ?? [];
    }

    return rows.map((row: MenuItemRow) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      code: row.code,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      spicy: Boolean(row.spicy),
      veg: Boolean(row.veg),
      popular: Boolean(row.popular),
      image: row.image,
    }));
  } catch {
    return menuByRestaurant[restaurantId] ?? [];
  }
}

export async function createMenuItem(data: {
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  code?: string;
}) {
  if (!pool) {
    const item = {
      id: `menu-${Date.now()}`,
      restaurantId: data.restaurantId,
      code: data.code || `FALLBACK-${Date.now()}`,
      name: data.name,
      description: data.description,
      price: data.price,
      image: data.image || '',
      spicy: false,
      veg: true,
      popular: true,
    };
    const restaurantEntry = menuByRestaurant[data.restaurantId] ?? [];
    menuByRestaurant[data.restaurantId] = [item, ...restaurantEntry];
    return item;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, spicy, veg, popular, image, code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, restaurant_id, name, description, price, spicy, veg, popular, image, code`,
      [
        data.restaurantId,
        data.name,
        data.description,
        data.price,
        false,
        true,
        true,
        data.image || '',
        data.code || `MENU-${Date.now()}`,
      ]
    );

    return rows[0];
  } catch {
    const item = {
      id: `menu-${Date.now()}`,
      restaurantId: data.restaurantId,
      code: data.code || `FALLBACK-${Date.now()}`,
      name: data.name,
      description: data.description,
      price: data.price,
      image: data.image || '',
      spicy: false,
      veg: true,
      popular: true,
    };
    const restaurantEntry = menuByRestaurant[data.restaurantId] ?? [];
    menuByRestaurant[data.restaurantId] = [item, ...restaurantEntry];
    return item;
  }
}

export async function getOrders() {
  if (!pool) {
    return mockOrders.map((order) => ({
      id: order.id,
      customer: order.customer,
      restaurant: order.restaurant,
      restaurantId: '',
      item: order.item,
      foodCode: 'FOOD-UNKNOWN',
      total: Number(order.total),
      status: order.status,
      time: order.time,
    }));
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at
       FROM orders
      ORDER BY created_at DESC`
    );

    return rows.map((row: OrderRow) => ({
      id: row.id,
      customer: row.customer_name,
      restaurant: row.restaurant_name,
      restaurantId: row.restaurant_id ?? '',
      item: row.item_name,
      foodCode: row.food_code ?? 'FOOD-UNKNOWN',
      total: Number(row.total),
      status: row.status,
      time: row.created_at ? 'Just now' : 'Just now',
    }));
  } catch {
    return mockOrders.map((order) => ({
      id: order.id,
      customer: order.customer,
      restaurant: order.restaurant,
      restaurantId: '',
      item: order.item,
      foodCode: 'FOOD-UNKNOWN',
      total: Number(order.total),
      status: order.status,
      time: order.time,
    }));
  }
}

export async function createOrder(data: {
  customerName: string;
  restaurantName: string;
  restaurantId?: string;
  itemName: string;
  foodCode?: string;
  total: number;
  status?: string;
}) {
  if (!pool) {
    return {
      id: `ORD-${Date.now()}`,
      customer: data.customerName,
      restaurant: data.restaurantName,
      restaurantId: data.restaurantId ?? '',
      item: data.itemName,
      foodCode: data.foodCode ?? 'FOOD-UNKNOWN',
      total: data.total,
      status: data.status ?? 'Preparing',
      time: 'Just now',
    };
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at`,
      [
        data.customerName,
        data.restaurantName,
        data.restaurantId || null,
        data.itemName,
        data.foodCode || 'FOOD-UNKNOWN',
        data.total,
        data.status ?? 'Preparing',
      ]
    );

    const row = rows[0];
    return {
      id: row.id,
      customer: row.customer_name,
      restaurant: row.restaurant_name,
      restaurantId: row.restaurant_id ?? '',
      item: row.item_name,
      foodCode: row.food_code ?? 'FOOD-UNKNOWN',
      total: Number(row.total),
      status: row.status,
      time: 'Just now',
    };
  } catch {
    return {
      id: `ORD-${Date.now()}`,
      customer: data.customerName,
      restaurant: data.restaurantName,
      restaurantId: data.restaurantId ?? '',
      item: data.itemName,
      foodCode: data.foodCode ?? 'FOOD-UNKNOWN',
      total: data.total,
      status: data.status ?? 'Preparing',
      time: 'Just now',
    };
  }
}

export async function updateOrderStatusById(orderId: string, status: string) {
  if (!pool) {
    return { id: orderId, status };
  }

  try {
    const { rows } = await pool.query(
      `UPDATE orders
       SET status = $2
       WHERE id = $1
       RETURNING id, customer_name, restaurant_name, restaurant_id, item_name, food_code, total, status, created_at`,
      [orderId, status]
    );

    if (!rows[0]) {
      throw new Error('Order not found.');
    }

    const row = rows[0];
    return {
      id: row.id,
      customer: row.customer_name,
      restaurant: row.restaurant_name,
      restaurantId: row.restaurant_id ?? '',
      item: row.item_name,
      foodCode: row.food_code ?? 'FOOD-UNKNOWN',
      total: Number(row.total),
      status: row.status,
      time: 'Updated',
    };
  } catch {
    return { id: orderId, status };
  }
}

export async function pingDatabase() {
  if (!pool) {
    return { ok: false, message: 'PostgreSQL not configured. Using in-memory fallback data.' };
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
