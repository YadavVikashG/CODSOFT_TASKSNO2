CREATE EXTENSION IF NOT EXISTS postgis;

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
  featured BOOLEAN DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  offers_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  offers_dine_in BOOLEAN NOT NULL DEFAULT TRUE,
  location geography(Point, 4326)
);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS offers_delivery BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS offers_dine_in BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

CREATE OR REPLACE FUNCTION sync_restaurant_location() RETURNS TRIGGER AS $$
BEGIN
  NEW.location := CASE
    WHEN NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography
    ELSE NULL
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restaurant_location_sync ON restaurants;
CREATE TRIGGER restaurant_location_sync
  BEFORE INSERT OR UPDATE OF latitude, longitude ON restaurants
  FOR EACH ROW EXECUTE FUNCTION sync_restaurant_location();

UPDATE restaurants
SET latitude = latitude
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants (rating DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_search ON restaurants USING GIN (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(cuisine, '') || ' ' || coalesce(tag, ''))
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
CREATE INDEX IF NOT EXISTS idx_menu_items_search ON menu_items USING GIN (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_food_code ON orders(food_code);
