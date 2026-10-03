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
  is_on_duty BOOLEAN NOT NULL DEFAULT FALSE,
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

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS restaurant_reviews (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_user_id ON restaurant_reviews (user_id);

INSERT INTO restaurants (name, cuisine, delivery_time, delivery_fee)
SELECT profile.name, 'Cuisine not set', 'Set by restaurant', 0
FROM (VALUES
  ('saffron@zestmarket.com', 'Saffron Street'),
  ('green@zestmarket.com', 'Green Bowl Co.'),
  ('fire@zestmarket.com', 'Fire & Stone'),
  ('bamboo@zestmarket.com', 'Bamboo Wok')
) AS profile(email, name)
WHERE EXISTS (
  SELECT 1 FROM users
  WHERE lower(email) = profile.email AND role = 'restaurant'
)
AND NOT EXISTS (
  SELECT 1 FROM restaurants WHERE lower(name) = lower(profile.name)
);

UPDATE users AS account
SET restaurant_id = restaurant.id
FROM (VALUES
  ('saffron@zestmarket.com', 'Saffron Street'),
  ('green@zestmarket.com', 'Green Bowl Co.'),
  ('fire@zestmarket.com', 'Fire & Stone'),
  ('bamboo@zestmarket.com', 'Bamboo Wok')
) AS profile(email, name)
JOIN restaurants AS restaurant ON lower(restaurant.name) = lower(profile.name)
WHERE lower(account.email) = profile.email
  AND account.role = 'restaurant'
  AND account.restaurant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_restaurant_id
  ON users (restaurant_id) WHERE restaurant_id IS NOT NULL;

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
  stock_quantity INTEGER NOT NULL DEFAULT 0
    CONSTRAINT menu_items_stock_quantity_nonnegative CHECK (stock_quantity >= 0),
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0
    CONSTRAINT menu_items_discount_percent_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
  spicy BOOLEAN DEFAULT FALSE,
  veg BOOLEAN DEFAULT FALSE,
  popular BOOLEAN DEFAULT FALSE,
  image TEXT
);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_stock_quantity_nonnegative') THEN
    ALTER TABLE menu_items ADD CONSTRAINT menu_items_stock_quantity_nonnegative CHECK (stock_quantity >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_discount_percent_range') THEN
    ALTER TABLE menu_items ADD CONSTRAINT menu_items_discount_percent_range CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(150) NOT NULL,
  restaurant_name VARCHAR(150) NOT NULL,
  restaurant_id UUID NULL REFERENCES restaurants(id) ON DELETE SET NULL,
  item_name VARCHAR(150) NOT NULL,
  food_code VARCHAR(80) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(150) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guests INTEGER NOT NULL,
  table_type VARCHAR(80) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  source VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'walk-in')),
  status VARCHAR(20) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'checked-in', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'online';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'booked';

CREATE TABLE IF NOT EXISTS restaurant_seats (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL CHECK (seat_number > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (restaurant_id, seat_number)
);

CREATE TABLE IF NOT EXISTS reservation_seats (
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  seat_number INTEGER NOT NULL,
  PRIMARY KEY (reservation_id, seat_number),
  FOREIGN KEY (restaurant_id, seat_number)
    REFERENCES restaurant_seats(restaurant_id, seat_number) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_slot
  ON reservations (restaurant_id, reservation_date, reservation_time)
  WHERE status IN ('booked', 'checked-in');
CREATE INDEX IF NOT EXISTS idx_reservation_seats_seat
  ON reservation_seats (restaurant_id, seat_number, reservation_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_search ON menu_items USING GIN (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id ON orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_user_id ON orders(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_user_id ON orders(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_food_code ON orders(food_code);
