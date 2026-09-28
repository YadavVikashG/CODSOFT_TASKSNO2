import { Pool } from 'pg';
import { menuByRestaurant, restaurants } from '@/lib/fallback-data';
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
      `SELECT id, name, cuisine, rating, reviews, delivery_time, delivery_fee, image, tag, featured
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
    }));
  } catch {
    return restaurants;
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
