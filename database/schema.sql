CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'restaurant', 'delivery')),
  phone VARCHAR(40),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  cuisine VARCHAR(150) NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  delivery_time VARCHAR(50) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  image TEXT,
  tag VARCHAR(80),
  featured BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  spicy BOOLEAN DEFAULT FALSE,
  veg BOOLEAN DEFAULT FALSE,
  popular BOOLEAN DEFAULT FALSE,
  image TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(150) NOT NULL,
  restaurant_name VARCHAR(150) NOT NULL,
  restaurant_id UUID NULL REFERENCES restaurants(id) ON DELETE SET NULL,
  item_name VARCHAR(150) NOT NULL,
  food_code VARCHAR(80) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(150) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guests INTEGER NOT NULL,
  table_type VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_food_code ON orders(food_code);
