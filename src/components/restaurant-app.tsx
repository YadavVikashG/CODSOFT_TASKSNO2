'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  fee: number;
  image: string;
  tag: string;
  featured: boolean;
};

type MenuItem = {
  id: string;
  restaurantId: string;
  code?: string;
  name: string;
  description: string;
  price: number;
  spicy?: boolean;
  veg?: boolean;
  popular?: boolean;
  image: string;
};

type CartItem = MenuItem & { quantity: number };

type Order = {
  id: string;
  customer: string;
  restaurant: string;
  restaurantId?: string;
  item: string;
  foodCode?: string;
  total: number;
  status: 'Preparing' | 'Ready for pickup' | 'Out for delivery' | 'Delivered';
  time: string;
};

type UserRole = 'user' | 'admin' | 'restaurant' | 'delivery';

const restaurantProfiles = [
  { id: 'r1', name: 'Saffron Street', email: 'saffron@zestmarket.com' },
  { id: 'r2', name: 'Green Bowl Co.', email: 'green@zestmarket.com' },
  { id: 'r3', name: 'Fire & Stone', email: 'fire@zestmarket.com' },
  { id: 'r4', name: 'Bamboo Wok', email: 'bamboo@zestmarket.com' },
] as const;

export function RestaurantApp() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState('Loading delicious options...');
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<{ name: string; email: string; role: UserRole; phone: string; address: string } | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [reservationMessage, setReservationMessage] = useState('');
  const [restaurantDraft, setRestaurantDraft] = useState({
    name: '',
    description: '',
    price: '12.50',
    category: 'Main Course',
    image: '',
  });
  const [reservationForm, setReservationForm] = useState({
    name: '',
    date: '',
    time: '',
    guests: '2 Guests',
    tableType: 'Window',
  });

  const restaurantDashboardId = user?.role === 'restaurant'
    ? restaurantProfiles.find((profile) => profile.email.toLowerCase() === user.email.toLowerCase())?.id ?? selectedRestaurantId
    : selectedRestaurantId;

  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const response = await fetch('/api/restaurants');
        const data = await response.json();
        setRestaurants(data);
        if (data.length > 0) setSelectedRestaurantId(data[0].id);
      } catch {
        setStatus('Unable to load restaurants right now.');
      }
    };

    const loadOrders = async () => {
      try {
        const response = await fetch('/api/orders');
        const data = await response.json();
        setOrders(data);
      } catch {
        setOrders([]);
      }
    };

    void loadRestaurants();
    void loadOrders();
    void fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!restaurantDashboardId) return;

    const loadMenu = async () => {
      try {
        const response = await fetch(`/api/menu/${restaurantDashboardId}`);
        const data = await response.json();
        setMenu(data);
        setStatus('');
      } catch {
        setStatus('Unable to load menu for this restaurant.');
      }
    };

    void loadMenu();
  }, [restaurantDashboardId]);

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return restaurants;

    return restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(query) || restaurant.cuisine.toLowerCase().includes(query),
    );
  }, [restaurants, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length > 0 ? 4.99 : 0;
  const serviceFee = cart.length > 0 ? 2.5 : 0;
  const total = subtotal + deliveryFee + serviceFee;

  const handleAddToCart = (item: MenuItem) => {
    if (!user || user.role !== 'user') {
      alert('Sign in with a customer account to order food.');
      return;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  };

  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === restaurantDashboardId) ?? restaurants[0];

  const restaurantMetrics = useMemo(() => {
    const averageRating = restaurants.length
      ? restaurants.reduce((sum, restaurant) => sum + restaurant.rating, 0) / restaurants.length
      : 0;

    return {
      restaurantCount: restaurants.length,
      menuCount: menu.length,
      orderCount: orders.length,
      averageRating,
    };
  }, [restaurants, menu, orders]);

  const restaurantOrders = orders.filter((order) =>
    order.restaurantId ? order.restaurantId === restaurantDashboardId : order.restaurant === selectedRestaurant?.name,
  );
  const userOrderHistory = user
    ? orders.filter((order) => order.customer.toLowerCase() === user.name.toLowerCase())
    : [];
  const deliveryMapQuery = encodeURIComponent(user?.address || selectedRestaurant?.name || 'restaurant');

  const handleRepeatOrder = (order: Order) => {
    const matchedItem = menu.find((item) => item.name.toLowerCase() === order.item.toLowerCase())
      ?? menu.find((item) => item.code?.toLowerCase() === (order.foodCode || '').toLowerCase());

    if (!matchedItem) {
      alert('That item is not available in the current menu anymore.');
      return;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.id === matchedItem.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === matchedItem.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, { ...matchedItem, quantity: 1 }];
    });

    setCheckoutMessage(`Added ${matchedItem.name} back to your basket.`);
    setTimeout(() => setCheckoutMessage(''), 2500);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    setUser(null);
  };

  const handleStatusUpdate = (orderId: string, nextStatus: Order['status']) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    );
  };

  const handleProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Image size should be less than 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRestaurantDraft((current) => ({
        ...current,
        image: typeof reader.result === 'string' ? reader.result : '',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRestaurantFoodUpload = async () => {
    if (!restaurantDashboardId || !restaurantDraft.name.trim() || !restaurantDraft.description.trim()) {
      alert('Please fill the food name and description.');
      return;
    }

    const value = Number(restaurantDraft.price);
    if (Number.isNaN(value) || value <= 0) {
      alert('Enter a valid price.');
      return;
    }

    const restaurantProfile = restaurantProfiles.find((profile) => profile.id === restaurantDashboardId);
    const shortName = (restaurantProfile?.name ?? 'REST').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    const code = `${shortName}-${String(Date.now()).slice(-6)}`;
    const image = restaurantDraft.image || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80';

    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurantDashboardId,
          name: restaurantDraft.name.trim(),
          description: restaurantDraft.description.trim(),
          price: value,
          image,
          code,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to upload food item.');
      }

      const newItem: MenuItem = {
        id: data.item?.id || `menu-${Date.now()}`,
        restaurantId: restaurantDashboardId,
        code: data.item?.code || code,
        name: restaurantDraft.name.trim(),
        description: restaurantDraft.description.trim(),
        price: value,
        veg: restaurantDraft.category !== 'Non Veg',
        popular: true,
        image: data.item?.image || image,
      };

      setMenu((current) => [newItem, ...current]);
      setRestaurantDraft({
        name: '',
        description: '',
        price: '12.50',
        category: 'Main Course',
        image: '',
      });
      alert(`Food uploaded successfully. Unique code: ${code}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to upload food item.');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your basket is empty. Add a dish first.');
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'user') {
      alert('Only customer accounts can place orders.');
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: user.name,
          restaurant: selectedRestaurant?.name ?? 'Selected restaurant',
          restaurantId: selectedRestaurant?.id ?? '',
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            foodCode: item.code || `FOOD-${item.id}`,
          })),
          total,
          status: 'Preparing',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to place your order.');
      }

      setOrders((current) => [data.order, ...current]);
      setCart([]);
      setCheckoutMessage('Order placed successfully! Kitchen has received it.');
      setTimeout(() => setCheckoutMessage(''), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to place your order.');
    }
  };

  const handleReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reservationForm.name || user?.name || 'Guest',
          date: reservationForm.date,
          time: reservationForm.time,
          guests: reservationForm.guests,
          tableType: reservationForm.tableType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to reserve a table.');
      }

      setReservationMessage(`Table reserved for ${reservationForm.guests} on ${reservationForm.date} at ${reservationForm.time}.`);
      setReservationForm({
        name: '',
        date: '',
        time: '',
        guests: '2 Guests',
        tableType: 'Window',
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to reserve a table.');
    }
  };

  const activeRole = user?.role ?? 'user';

  return (
    <main className="min-h-screen bg-[#fffaf5] text-zinc-900">
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-orange-100 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-xl font-black text-white shadow-md">
                Z
              </div>
              <div>
                <p className="text-xl font-black tracking-tight">ZestMarket</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Food delivery</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-600">
              <a href="#featured" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">
                Featured
              </a>
              <a href="#restaurants" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">
                Restaurants
              </a>
              <a href="#checkout" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">
                Checkout
              </a>
            </nav>

            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-700">Hi, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-orange-300 hover:text-orange-700"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a href="/login" className="rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-orange-50">
                  Sign in
                </a>
                <a href="/signup" className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:scale-[1.02]">
                  Create account
                </a>
              </div>
            )}
          </div>
        </header>

        {user && activeRole === 'user' && (
          <div className="mb-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">User profile</p>
              <h3 className="mt-2 text-2xl font-black">{user.name}</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p><span className="font-semibold text-zinc-800">Phone:</span> {user.phone}</p>
                <p><span className="font-semibold text-zinc-800">Address:</span> {user.address}</p>
                <p><span className="font-semibold text-zinc-800">Email:</span> {user.email}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Delivery map</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
                <iframe
                  title="Delivery map"
                  src={`https://www.google.com/maps?q=${deliveryMapQuery}&output=embed`}
                  className="h-52 w-full border-0"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}

        {user && activeRole !== 'user' && (
          <div className="mb-10 grid gap-5 lg:grid-cols-3">
            {activeRole === 'admin' && (
              <>
                <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Orders</p>
                  <p className="mt-3 text-4xl font-black text-violet-900">{orders.length}</p>
                  <p className="mt-2 text-sm text-violet-700">Live tracked orders</p>
                </div>
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Revenue</p>
                  <p className="mt-3 text-4xl font-black text-emerald-900">$12.4k</p>
                  <p className="mt-2 text-sm text-emerald-700">This week</p>
                </div>
                <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Customers</p>
                  <p className="mt-3 text-4xl font-black text-sky-900">8.5k</p>
                  <p className="mt-2 text-sm text-sky-700">Active users</p>
                </div>
              </>
            )}
            {activeRole === 'restaurant' && (
              <>
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Menu Items</p>
                  <p className="mt-3 text-4xl font-black text-emerald-900">28</p>
                  <p className="mt-2 text-sm text-emerald-700">Available this week</p>
                </div>
                <div className="rounded-[24px] border border-orange-200 bg-orange-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Pending</p>
                  <p className="mt-3 text-4xl font-black text-orange-900">{orders.filter((item) => item.status === 'Preparing').length}</p>
                  <p className="mt-2 text-sm text-orange-700">Orders to prepare</p>
                </div>
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Rating</p>
                  <p className="mt-3 text-4xl font-black text-amber-900">4.9</p>
                  <p className="mt-2 text-sm text-amber-700">Last 30 days</p>
                </div>
              </>
            )}
            {activeRole === 'delivery' && (
              <>
                <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Trips</p>
                  <p className="mt-3 text-4xl font-black text-sky-900">14</p>
                  <p className="mt-2 text-sm text-sky-700">Assigned today</p>
                </div>
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Completed</p>
                  <p className="mt-3 text-4xl font-black text-emerald-900">11</p>
                  <p className="mt-2 text-sm text-emerald-700">On-time deliveries</p>
                </div>
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Earnings</p>
                  <p className="mt-3 text-4xl font-black text-rose-900">$420</p>
                  <p className="mt-2 text-sm text-rose-700">Today</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mb-10 overflow-hidden rounded-[32px] bg-gradient-to-br from-zinc-900 via-zinc-800 to-orange-900 p-8 text-white shadow-xl shadow-orange-100 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <span className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-100">
                Fast delivery • Fresh taste
              </span>
              <h1 className="max-w-xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Order your favorites from the best local kitchens.
              </h1>
              <p className="mt-5 max-w-lg text-base text-zinc-200 sm:text-lg">
                Discover top-rated restaurants, save favorites, and enjoy delivery in minutes with a platform built for modern dining.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-4 py-3 text-zinc-500 shadow-md">
                  <span>📍</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search restaurants or cuisine"
                    className="w-full border-0 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
                  />
                </div>
                <button className="rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400">
                  Search Now
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-zinc-200">
                <div>
                  <span className="block text-3xl font-black text-white">{restaurantMetrics.restaurantCount}+</span>
                  Partner restaurants
                </div>
                <div>
                  <span className="block text-3xl font-black text-white">{restaurantMetrics.averageRating.toFixed(1)}/5</span>
                  Average rating
                </div>
                <div>
                  <span className="block text-3xl font-black text-white">{restaurantMetrics.menuCount}+</span>
                  Dishes available
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white/10 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur">
              <div className="rounded-[24px] bg-[#fffaf5] p-4 text-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Selected restaurant</p>
                    <h2 className="mt-1 text-2xl font-black">{selectedRestaurant?.name ?? 'Pick a place'}</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    {selectedRestaurant?.deliveryTime ?? '20-30 min'}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-zinc-600">
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-3">
                    <span>Cuisine</span>
                    <span className="font-semibold text-zinc-900">{selectedRestaurant?.cuisine ?? 'Local favorites'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-3">
                    <span>Delivery</span>
                    <span className="font-semibold text-zinc-900">${selectedRestaurant?.fee.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-3">
                    <span>Cart</span>
                    <span className="font-semibold text-zinc-900">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {user && activeRole !== 'user' && (
          <div className="mb-10 grid gap-5 lg:grid-cols-2">
            {(activeRole === 'admin' || activeRole === 'restaurant') && (
              <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Operations</p>
                    <h3 className="mt-2 text-2xl font-black">{activeRole === 'restaurant' ? 'My restaurant queue' : 'Order queue'}</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {(activeRole === 'restaurant' ? restaurantOrders : orders).slice(0, 4).map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 p-3">
                      <div>
                        <p className="font-bold">{order.customer}</p>
                        <p className="text-sm text-zinc-500">{order.item} • {order.foodCode || 'NO CODE'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-600">{order.status}</span>
                        <button
                          onClick={() => handleStatusUpdate(order.id, 'Ready for pickup')}
                          className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Pack
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeRole === 'delivery' && (
              <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Delivery map</p>
                    <h3 className="mt-2 text-2xl font-black">Active routes</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { id: 'DEL-102', customer: 'Ava Thompson', route: 'Downtown • 12 min away', status: 'Out for delivery' },
                    { id: 'DEL-108', customer: 'Lucas Chen', route: 'West End • 8 min away', status: 'Preparing' },
                  ].map((delivery) => (
                    <div key={delivery.id} className="rounded-2xl bg-zinc-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">{delivery.customer}</p>
                          <p className="text-sm text-zinc-500">{delivery.route}</p>
                        </div>
                        <button
                          onClick={() => handleStatusUpdate('ORD-1042', 'Delivered')}
                          className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Mark done
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Quick actions</p>
                  <h3 className="mt-2 text-2xl font-black">{activeRole === 'admin' ? 'Admin tools' : activeRole === 'restaurant' ? 'Restaurant controls' : 'Delivery controls'}</h3>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white">View reports</button>
                <button className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">Export data</button>
                <button className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Dispatch orders</button>
                <button className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">Resolve issues</button>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'restaurant' && (
          <div className="mb-10 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Restaurant panel</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Add a new dish</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Food name</label>
                <input
                  value={restaurantDraft.name}
                  onChange={(event) => setRestaurantDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Signature pasta"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={restaurantDraft.price}
                  onChange={(event) => setRestaurantDraft((current) => ({ ...current, price: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Description</label>
                <textarea
                  value={restaurantDraft.description}
                  onChange={(event) => setRestaurantDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="Describe the dish, ingredients, and flavor."
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Category</label>
                <select
                  value={restaurantDraft.category}
                  onChange={(event) => setRestaurantDraft((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
                >
                  <option>Main Course</option>
                  <option>Starter</option>
                  <option>Non Veg</option>
                  <option>Veg</option>
                  <option>Dessert</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Upload product image</label>
                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-3 md:flex-row md:items-center md:justify-between">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProductImageUpload}
                    className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                  />
                  {restaurantDraft.image && (
                    <img
                      src={restaurantDraft.image}
                      alt="Selected product preview"
                      className="h-20 w-20 rounded-2xl object-cover shadow-sm"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleRestaurantFoodUpload}
                  className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200"
                >
                  Upload food & generate code
                </button>
              </div>
            </div>
          </div>
        )}

        {user && activeRole === 'user' && userOrderHistory.length > 0 && (
          <div className="mb-10 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Order history</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Your recent orders</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {userOrderHistory.map((order) => (
                <div key={order.id} className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{order.id}</span>
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700">
                      {order.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight">{order.item}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{order.restaurant}</p>
                  <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                    <span>{order.time}</span>
                    <span className="font-black text-zinc-900">${order.total.toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRepeatOrder(order)}
                    className="mt-4 w-full rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700"
                  >
                    Repeat order
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {user && activeRole !== 'user' && restaurantOrders.length > 0 && (
          <div className="mb-10 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Restaurant history</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Your order history</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {restaurantOrders.map((order) => (
                <div key={order.id} className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{order.id}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                      {order.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight">{order.customer}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{order.item} • {order.foodCode || 'FOOD-UNKNOWN'}</p>
                  <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                    <span>{order.time}</span>
                    <span className="font-black text-zinc-900">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div id="featured" className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Popular</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Featured restaurants</h2>
            </div>
            <button className="rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50">
              View all
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredRestaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                onClick={() => setSelectedRestaurantId(restaurant.id)}
                className={`group overflow-hidden rounded-[26px] border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                  selectedRestaurantId === restaurant.id
                    ? 'border-orange-300 ring-2 ring-orange-200'
                    : 'border-zinc-200'
                }`}
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-orange-700">
                    {restaurant.tag}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{restaurant.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{restaurant.cuisine}</p>
                    </div>
                    <div className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                      ★ {restaurant.rating}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-zinc-600">
                    <span>{restaurant.deliveryTime}</span>
                    <span>{restaurant.reviews.toLocaleString()} reviews</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <span className="font-semibold text-zinc-800">Delivery • ${restaurant.fee.toFixed(2)}</span>
                    <span className="text-orange-600">View menu</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-10 rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Operations</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Kitchen dashboard</h2>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
              {orders.length} live orders
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{order.id}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      order.status === 'Preparing'
                        ? 'bg-amber-100 text-amber-700'
                        : order.status === 'Out for delivery'
                          ? 'bg-sky-100 text-sky-700'
                          : order.status === 'Ready for pickup'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight">{order.item}</h3>
                <p className="mt-2 text-sm text-zinc-600">{order.customer} • {order.restaurant}</p>
                <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                  <span>{order.time}</span>
                  <span className="font-black text-zinc-900">${order.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div id="restaurants" className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Menu</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  {selectedRestaurant?.name ?? 'Restaurant menu'}
                </h2>
              </div>
              <div className="rounded-full bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
                {selectedRestaurant?.deliveryTime ?? '20-30 min'}
              </div>
            </div>

            {status && <p className="mb-4 text-sm text-zinc-500">{status}</p>}

            <div className="grid gap-4">
              {menu.map((item) => (
                <article key={item.id} className="flex flex-col gap-4 rounded-[26px] border border-zinc-200 p-3 sm:flex-row">
                  <img src={item.image} alt={item.name} className="h-28 w-full rounded-[20px] object-cover sm:w-36" />
                  <div className="flex flex-1 flex-col justify-between gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
                          {item.popular && <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">Popular</span>}
                          {item.veg && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Veg</span>}
                          {item.spicy && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Spicy</span>}
                        </div>
                        <h3 className="text-xl font-black tracking-tight">{item.name}</h3>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">{item.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-zinc-900">${item.price.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Freshly prepared</span>
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside id="checkout" className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Basket</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Your order</h2>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
            </div>

            <div className="space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
                  Your basket is empty. Add a few dishes to get started.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 p-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-zinc-500">Qty {item.quantity} • {item.code || `FOOD-${item.id}`}</p>
                    </div>
                    <p className="font-black text-zinc-900">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 space-y-3 border-t border-zinc-200 pt-5 text-sm text-zinc-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service fee</span>
                <span>${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-black text-zinc-900">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {checkoutMessage && (
              <div className="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {checkoutMessage}
              </div>
            )}

            <button
              onClick={handleCheckout}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:scale-[1.01]"
            >
              Proceed to checkout
            </button>
          </aside>
        </div>

        <section className="mt-10 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Reservations</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Book a table</h2>
            </div>
          </div>

          <form onSubmit={handleReservation} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Guest name</label>
              <input
                value={reservationForm.name}
                onChange={(event) => setReservationForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Your name"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Date</label>
              <input
                type="date"
                value={reservationForm.date}
                onChange={(event) => setReservationForm((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Time</label>
              <input
                type="time"
                value={reservationForm.time}
                onChange={(event) => setReservationForm((current) => ({ ...current, time: event.target.value }))}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Guests</label>
              <select
                value={reservationForm.guests}
                onChange={(event) => setReservationForm((current) => ({ ...current, guests: event.target.value }))}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
              >
                <option>2 Guests</option>
                <option>4 Guests</option>
                <option>6 Guests</option>
                <option>8 Guests</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Table type</label>
              <select
                value={reservationForm.tableType}
                onChange={(event) => setReservationForm((current) => ({ ...current, tableType: event.target.value }))}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
              >
                <option>Window</option>
                <option>Patio</option>
                <option>Booth</option>
                <option>Private</option>
              </select>
            </div>

            <div className="md:col-span-2 flex flex-col gap-3">
              <button type="submit" className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600">
                Confirm reservation
              </button>
              {reservationMessage && (
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {reservationMessage}
                </div>
              )}
            </div>
          </form>
        </section>
      </section>

    </main>
  );
}
