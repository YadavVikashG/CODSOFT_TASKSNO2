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
  offersDelivery: boolean;
  offersDineIn: boolean;
};

type MenuItem = {
  id: string;
  restaurantId: string;
  code?: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  discountPercent: number;
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
  status: 'Preparing' | 'Ready for pickup' | 'Picked Up' | 'Out for delivery' | 'Delivered';
  time: string;
};

type DeliveryJob = Order & { assignedToMe: boolean };

type UserRole = 'user' | 'admin' | 'restaurant' | 'delivery';

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  address: string;
  restaurantId: string | null;
  isOnDuty: boolean;
};

function discountedPrice(item: Pick<MenuItem, 'price' | 'discountPercent'>) {
  return Math.round(item.price * (1 - item.discountPercent / 100) * 100) / 100;
}

export function RestaurantApp() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'delivery' | 'dine-in'>('all');
  const [dietaryPreference, setDietaryPreference] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [minimumRating, setMinimumRating] = useState('0');
  const [radiusKm, setRadiusKm] = useState('10');
  const [searchLocation, setSearchLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState('Loading delicious options...');
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryJobs, setDeliveryJobs] = useState<DeliveryJob[]>([]);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [reservationMessage, setReservationMessage] = useState('');
  const [restaurantDraft, setRestaurantDraft] = useState({
    name: '',
    description: '',
    price: '12.50',
    stockQuantity: '0',
    discountPercent: '0',
    category: 'Main Course',
    image: '',
  });
  const [editingMenuItemId, setEditingMenuItemId] = useState('');
  const [inventoryDraft, setInventoryDraft] = useState({ price: '', stockQuantity: '', discountPercent: '' });
  const [reservationForm, setReservationForm] = useState({
    name: '',
    date: '',
    time: '',
    guests: '2 Guests',
    tableType: 'Window',
  });

  const restaurantDashboardId = user?.role === 'restaurant'
    ? user.restaurantId || ''
    : selectedRestaurantId;

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await fetch('/api/orders');
        const data = await response.json();
        setOrders(data);
      } catch {
        setOrders([]);
      }
    };

    void loadOrders();
    void fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null))
      .finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (user?.role !== 'delivery') return;
    void fetch('/api/delivery/orders')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load delivery orders.');
        setDeliveryJobs(data);
      })
      .catch((error) => setDeliveryMessage(error instanceof Error ? error.message : 'Unable to load delivery orders.'));
  }, [user?.role]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: search,
          mode: searchMode,
          dietary: dietaryPreference,
          minRating: minimumRating,
        });
        if (searchLocation) {
          params.set('latitude', String(searchLocation.latitude));
          params.set('longitude', String(searchLocation.longitude));
          params.set('radiusKm', radiusKm);
        }

        const response = await fetch(`/api/restaurants?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to search restaurants.');
        const results = await response.json();
        setRestaurants(results);
        setSelectedRestaurantId((current) =>
          results.some((restaurant: Restaurant) => restaurant.id === current)
            ? current
            : results[0]?.id || '',
        );
        setStatus('');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('Unable to search restaurants right now.');
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, searchMode, dietaryPreference, minimumRating, radiusKm, searchLocation]);

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

  const filteredRestaurants = restaurants;

  const handleUseSearchLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is unavailable in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSearchLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationMessage('Using your current location.');
      },
      () => setLocationMessage('Location permission was denied.'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const subtotal = cart.reduce((sum, item) =>
    sum + discountedPrice(item) * item.quantity,
  0);
  const deliveryFee = cart.length > 0
    ? restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)?.fee ?? 0
    : 0;
  const serviceFee = cart.length > 0 ? 2.5 : 0;
  const total = subtotal + deliveryFee + serviceFee;

  const handleAddToCart = (item: MenuItem) => {
    if (!user || user.role !== 'user') {
      alert('Sign in with a customer account to order food.');
      return;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      const quantity = existing?.quantity ?? 0;
      if (quantity >= item.stockQuantity) {
        alert(`Only ${item.stockQuantity} ${item.name} available.`);
        return current;
      }
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

  const handleDutyToggle = async () => {
    if (!user || user.role !== 'delivery') return;
    try {
      const response = await fetch('/api/delivery/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnDuty: !user.isOnDuty }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update duty status.');
      setUser((current) => current ? { ...current, isOnDuty: data.isOnDuty } : current);
      setDeliveryMessage('');
    } catch (error) {
      setDeliveryMessage(error instanceof Error ? error.message : 'Unable to update duty status.');
    }
  };

  const handleDeliveryAction = async (job: DeliveryJob, action: 'accept' | 'picked-up' | 'delivered') => {
    try {
      const response = await fetch(`/api/delivery/orders/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update delivery.');
      const updated = await fetch('/api/delivery/orders').then((result) => result.json());
      setDeliveryJobs(updated);
      setDeliveryMessage('Delivery updated.');
    } catch (error) {
      setDeliveryMessage(error instanceof Error ? error.message : 'Unable to update delivery.');
    }
  };

  const handleStatusUpdate = async (orderId: string, nextStatus: Order['status']) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update order.');
      setOrders((current) => current.map((order) => order.id === orderId ? data.order : order));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update order.');
    }
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
    const stockQuantity = Number(restaurantDraft.stockQuantity);
    const discountPercent = Number(restaurantDraft.discountPercent);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      alert('Stock must be a whole number greater than or equal to zero.');
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      alert('Festival discount must be between 0 and 100 percent.');
      return;
    }

    const shortName = (selectedRestaurant?.name ?? user?.name ?? 'FOOD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    const code = `${shortName}-${String(Date.now()).slice(-6)}`;
    const image = restaurantDraft.image;

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
          veg: restaurantDraft.category !== 'Non Veg',
          stockQuantity,
          discountPercent,
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
        stockQuantity,
        discountPercent,
        veg: restaurantDraft.category !== 'Non Veg',
        popular: false,
        image: data.item?.image || '',
      };

      setMenu((current) => [newItem, ...current]);
      setRestaurantDraft({
        name: '',
        description: '',
        price: '12.50',
        stockQuantity: '0',
        discountPercent: '0',
        category: 'Main Course',
        image: '',
      });
      alert(`Food uploaded successfully. Unique code: ${code}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to upload food item.');
    }
  };

  const handleSaveInventory = async () => {
    const price = Number(inventoryDraft.price);
    const stockQuantity = Number(inventoryDraft.stockQuantity);
    const discountPercent = Number(inventoryDraft.discountPercent);
    if (!editingMenuItemId || !Number.isFinite(price) || price <= 0) {
      alert('Enter a price greater than zero.');
      return;
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      alert('Stock must be a whole number greater than or equal to zero.');
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      alert('Festival discount must be between 0 and 100 percent.');
      return;
    }

    try {
      const response = await fetch(`/api/menu/items/${editingMenuItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, stockQuantity, discountPercent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update menu item.');
      setMenu((current) => current.map((item) => item.id === editingMenuItemId ? data.item : item));
      setEditingMenuItemId('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update menu item.');
    }
  };

  const handleDeleteMenuItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete ${item.name} from your menu?`)) return;

    try {
      const response = await fetch(`/api/menu/items/${item.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete menu item.');
      setMenu((current) => current.filter((entry) => entry.id !== item.id));
      if (editingMenuItemId === item.id) setEditingMenuItemId('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to delete menu item.');
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
            id: item.id,
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
      const updatedMenu = await fetch(`/api/menu/${selectedRestaurantId}`).then((result) => result.json());
      setMenu(updatedMenu);
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
  const isConsumer = !user || user.role === 'user';

  if (!sessionReady) {
    return <main className="grid min-h-screen place-items-center bg-[#fffaf5] text-sm text-zinc-600">Loading your workspace…</main>;
  }

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
              {(!user || user.role === 'user') && (
                <>
                  <a href="#featured" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Discover</a>
                  <a href="#restaurants" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Menu</a>
                  <a href="#checkout" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Basket</a>
                  <a href="#reservations" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Reservations</a>
                </>
              )}
              {user?.role === 'restaurant' && (
                <>
                  <a href="#merchant-orders" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Orders</a>
                  <a href="#merchant-menu" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Menu</a>
                </>
              )}
              {user?.role === 'admin' && (
                <>
                  <a href="#admin-overview" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Overview</a>
                  <a href="#admin-orders" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Orders</a>
                  <a href="#admin-restaurants" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Restaurants</a>
                </>
              )}
              {user?.role === 'delivery' && (
                <a href="#delivery-jobs" className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Pickup board</a>
              )}
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

        {user?.role === 'user' && (
          <div className="mb-7 border-b border-zinc-200 pb-5">
            <p className="text-sm font-semibold text-orange-700">Customer account</p>
            <h1 className="mt-1 text-2xl font-black">Welcome back, {user.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
          </div>
        )}

        {user?.role === 'admin' && (
          <section id="admin-overview" className="mb-8">
            <p className="text-sm font-semibold uppercase text-orange-700">Platform administration</p>
            <h1 className="mt-1 text-3xl font-black">Operations overview</h1>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Restaurants', value: restaurantMetrics.restaurantCount },
                { label: 'Recorded orders', value: orders.length },
                { label: 'Customers with orders', value: new Set(orders.map((order) => order.customer)).size },
                { label: 'Recorded order totals', value: `$${orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}` },
              ].map((metric) => (
                <div key={metric.label} className="border-l-2 border-orange-500 bg-white px-5 py-4">
                  <p className="text-sm text-zinc-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-black text-zinc-900">{metric.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {user?.role === 'restaurant' && (
          <section className="mb-8 border-b border-zinc-200 pb-6">
            <p className="text-sm font-semibold uppercase text-emerald-700">Restaurant workspace</p>
            <h1 className="mt-1 text-3xl font-black">{selectedRestaurant?.name || 'Your restaurant'}</h1>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Your menu items', value: menu.length },
                { label: 'Orders to prepare', value: restaurantOrders.filter((order) => order.status === 'Preparing').length },
                { label: 'Recorded order totals', value: `$${restaurantOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}` },
              ].map((metric) => (
                <div key={metric.label} className="border-l-2 border-emerald-600 bg-white px-5 py-4">
                  <p className="text-sm text-zinc-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-black text-zinc-900">{metric.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {user?.role === 'delivery' && (
          <section id="delivery-jobs" className="mb-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <p className="text-sm font-semibold uppercase text-sky-700">Delivery workspace</p>
                <h1 className="mt-1 text-3xl font-black">Pickup board</h1>
                <p className="mt-1 text-sm text-zinc-500">Signed in as {user.name} · {user.email}</p>
              </div>
              <button
                type="button"
                aria-pressed={user.isOnDuty}
                onClick={handleDutyToggle}
                className={`rounded-lg px-4 py-3 text-sm font-bold text-white ${user.isOnDuty ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-zinc-700 hover:bg-zinc-800'}`}
              >
                {user.isOnDuty ? 'On duty · Go off duty' : 'Off duty · Go on duty'}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-5 text-sm text-zinc-600">
              <span>{deliveryJobs.filter((job) => !job.assignedToMe).length} pickups available</span>
              <span>{deliveryJobs.filter((job) => job.assignedToMe).length} assigned to you</span>
            </div>
            {deliveryMessage && <p className="mb-4 text-sm text-sky-800" role="status">{deliveryMessage}</p>}

            {deliveryJobs.length === 0 ? (
              <p className="border border-dashed border-zinc-300 bg-white px-5 py-10 text-sm text-zinc-600">
                {user.isOnDuty ? 'No pickups are ready right now.' : 'Go on duty to see available pickups.'}
              </p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {deliveryJobs.map((job) => (
                  <article key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                    <div>
                      <p className="font-semibold">{job.restaurant} · {job.item}</p>
                      <p className="mt-1 text-sm text-zinc-500">Customer: {job.customer} · {job.time}</p>
                      <p className="mt-1 text-sm text-zinc-600">Order total ${job.total.toFixed(2)} · {job.status}</p>
                    </div>
                    {!job.assignedToMe ? (
                      <button
                        type="button"
                        disabled={!user.isOnDuty}
                        onClick={() => handleDeliveryAction(job, 'accept')}
                        className="rounded bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        Accept pickup
                      </button>
                    ) : job.status === 'Ready for pickup' ? (
                      <button type="button" onClick={() => handleDeliveryAction(job, 'picked-up')} className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                        Mark picked up
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleDeliveryAction(job, 'delivered')} className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
                        Mark delivered
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {(!user || user.role === 'user') && (
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
                <a href="#featured" className="rounded-full bg-orange-500 px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400">
                  Search Now
                </a>
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
                    <h2 className="mt-1 text-2xl font-black">{selectedRestaurant?.name ?? 'Select a restaurant'}</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    {selectedRestaurant?.deliveryTime ?? 'No ETA available'}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-zinc-600">
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-3">
                    <span>Cuisine</span>
                    <span className="font-semibold text-zinc-900">{selectedRestaurant?.cuisine ?? 'Not set'}</span>
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
        )}

        {user?.role === 'admin' && (
          <section id="admin-orders" className="mb-10 border-b border-zinc-200 pb-8">
            <h2 className="mb-4 text-2xl font-black">All orders</h2>
            {orders.length === 0 ? (
              <p className="bg-white px-5 py-8 text-sm text-zinc-600">No orders have been placed.</p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {orders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="font-semibold">{order.item}</p>
                      <p className="mt-1 text-sm text-zinc-500">{order.customer} · {order.restaurant} · {order.time}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-600">${order.total.toFixed(2)} · {order.status}</span>
                      <select
                        aria-label={`Update status for order ${order.id}`}
                        value={order.status}
                        onChange={(event) => handleStatusUpdate(order.id, event.target.value as Order['status'])}
                        className="rounded border border-zinc-200 bg-white px-2 py-2 text-sm"
                      >
                        <option>Preparing</option>
                        <option>Ready for pickup</option>
                        <option>Picked Up</option>
                        <option>Out for delivery</option>
                        <option>Delivered</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {user?.role === 'admin' && (
          <section id="admin-restaurants" className="mb-10 border-b border-zinc-200 pb-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold uppercase text-orange-700">Directory</p>
                <h2 className="mt-1 text-2xl font-black">Partner restaurants</h2>
              </div>
              <span className="text-sm text-zinc-500">{restaurants.length} records</span>
            </div>
            {restaurants.length === 0 ? (
              <p className="bg-white px-5 py-8 text-sm text-zinc-600">No restaurant records are available.</p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {restaurants.map((restaurant) => (
                  <div key={restaurant.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="font-semibold">{restaurant.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{restaurant.cuisine} · {restaurant.deliveryTime}</p>
                    </div>
                    <span className="text-sm text-zinc-600">{restaurant.rating.toFixed(1)} rating · {restaurant.reviews} reviews</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {user?.role === 'restaurant' && (
          <section id="merchant-orders" className="mb-10 border-b border-zinc-200 pb-8">
            <h2 className="mb-4 text-2xl font-black">Incoming orders</h2>
            {restaurantOrders.length === 0 ? (
              <p className="bg-white px-5 py-8 text-sm text-zinc-600">No orders for your restaurant yet.</p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {restaurantOrders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="font-semibold">{order.item}</p>
                      <p className="mt-1 text-sm text-zinc-500">{order.customer} · {order.time}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-600">${order.total.toFixed(2)} · {order.status}</span>
                      {order.status === 'Preparing' && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, 'Ready for pickup')}
                          className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                        >
                          Mark ready
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
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

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Starting stock</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={restaurantDraft.stockQuantity}
                  onChange={(event) => setRestaurantDraft((current) => ({ ...current, stockQuantity: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Festival discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={restaurantDraft.discountPercent}
                  onChange={(event) => setRestaurantDraft((current) => ({ ...current, discountPercent: event.target.value }))}
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

        {user?.role === 'restaurant' && (
          <section id="merchant-menu" className="mb-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase text-emerald-700">Published menu</p>
                <h2 className="mt-1 text-2xl font-black">Your dishes</h2>
              </div>
              <span className="text-sm text-zinc-500">{menu.length} items</span>
            </div>
            {menu.length === 0 ? (
              <p className="bg-white px-5 py-8 text-sm text-zinc-600">Your menu is empty. Add a dish above to publish it to customers.</p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {menu.map((item) => {
                  const isEditing = editingMenuItemId === item.id;
                  const salePrice = Math.round(item.price * (1 - item.discountPercent / 100) * 100) / 100;
                  return (
                    <article key={item.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
                          <p className="mt-1 text-xs text-zinc-500">{item.veg ? 'Vegetarian' : 'Non-vegetarian'} · Code {item.code}</p>
                          <p className={`mt-1 text-sm font-semibold ${item.stockQuantity > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : 'Out of stock'}
                            {item.discountPercent > 0 && ` · ${item.discountPercent}% festival discount`}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            {item.discountPercent > 0 && <p className="text-sm text-zinc-500 line-through">${item.price.toFixed(2)}</p>}
                            <p className="font-bold">${salePrice.toFixed(2)}</p>
                          </div>
                          <button
                            type="button"
                            aria-expanded={isEditing}
                            onClick={() => {
                              setEditingMenuItemId(isEditing ? '' : item.id);
                              setInventoryDraft({
                                price: String(item.price),
                                stockQuantity: String(item.stockQuantity),
                                discountPercent: String(item.discountPercent),
                              });
                            }}
                            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-orange-400 hover:text-orange-700"
                          >
                            {isEditing ? 'Close' : 'Edit item'}
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-3">
                          <label className="grid gap-1 text-sm font-medium text-zinc-700">
                            Price
                            <input type="number" min="0.01" step="0.01" value={inventoryDraft.price} onChange={(event) => setInventoryDraft((current) => ({ ...current, price: event.target.value }))} className="rounded border border-zinc-300 px-3 py-2" />
                          </label>
                          <label className="grid gap-1 text-sm font-medium text-zinc-700">
                            Stock quantity
                            <input type="number" min="0" step="1" value={inventoryDraft.stockQuantity} onChange={(event) => setInventoryDraft((current) => ({ ...current, stockQuantity: event.target.value }))} className="rounded border border-zinc-300 px-3 py-2" />
                          </label>
                          <label className="grid gap-1 text-sm font-medium text-zinc-700">
                            Festival discount (%)
                            <input type="number" min="0" max="100" step="1" value={inventoryDraft.discountPercent} onChange={(event) => setInventoryDraft((current) => ({ ...current, discountPercent: event.target.value }))} className="rounded border border-zinc-300 px-3 py-2" />
                          </label>
                          <div className="flex flex-wrap gap-2 sm:col-span-3">
                            <button type="button" onClick={handleSaveInventory} className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">Save changes</button>
                            <button type="button" onClick={() => handleDeleteMenuItem(item)} className="rounded border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Delete item</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
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

        {isConsumer && (
        <div id="featured" className="mb-10">
          <div className="mb-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Discover</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Restaurants near you</h2>
              </div>
              <span className="text-sm text-zinc-500">{filteredRestaurants.length} places</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="inline-flex rounded-full bg-zinc-100 p-1" aria-label="Service mode" role="group">
                {([
                  ['all', 'All'],
                  ['delivery', 'Delivery'],
                  ['dine-in', 'Dine-in'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={searchMode === value}
                    onClick={() => setSearchMode(value)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${searchMode === value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
                <span>Diet</span>
                <select
                  aria-label="Dietary preference"
                  value={dietaryPreference}
                  onChange={(event) => setDietaryPreference(event.target.value as typeof dietaryPreference)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-800 outline-none focus:border-orange-400"
                >
                  <option value="all">Any</option>
                  <option value="veg">Vegetarian</option>
                  <option value="non-veg">Non-vegetarian</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
                <span>Rating</span>
                <select
                  aria-label="Minimum rating"
                  value={minimumRating}
                  onChange={(event) => setMinimumRating(event.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-800 outline-none focus:border-orange-400"
                >
                  <option value="0">Any</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleUseSearchLocation}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-orange-300 hover:text-orange-700"
              >
                {searchLocation ? 'Location set' : 'Use my location'}
              </button>

              <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
                <span>Within</span>
                <select
                  aria-label="Search radius in kilometers"
                  disabled={!searchLocation}
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(event.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-800 outline-none focus:border-orange-400 disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="25">25 km</option>
                  <option value="50">50 km</option>
                </select>
              </label>
              {locationMessage && <span className="text-xs text-zinc-500" role="status">{locationMessage}</span>}
            </div>
          </div>

          {filteredRestaurants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-zinc-600">
              No restaurants match these filters. Try a wider search.
            </p>
          ) : (
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
                <div className="relative grid h-44 place-items-center overflow-hidden bg-zinc-100">
                  {restaurant.image ? (
                    <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="text-sm text-zinc-500">Photo not provided</span>
                  )}
                  {restaurant.tag && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-orange-700">{restaurant.tag}</span>}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{restaurant.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{restaurant.cuisine}</p>
                    </div>
                    <div className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-bold text-zinc-700">
                      {restaurant.reviews > 0 ? `★ ${restaurant.rating}` : 'Not rated'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-zinc-600">
                    <span>{restaurant.deliveryTime}</span>
                    <span>{restaurant.reviews.toLocaleString()} reviews</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <span className="font-semibold text-zinc-800">{restaurant.offersDelivery ? `Delivery · $${restaurant.fee.toFixed(2)}` : 'Dine-in'}</span>
                    <span className="text-orange-600">View menu</span>
                  </div>
                </div>
              </button>
              ))}
            </div>
          )}
        </div>
        )}

        {isConsumer && (
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

            {menu.length === 0 ? (
              <p className="border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-600">
                This restaurant has not published any dishes yet.
              </p>
            ) : (
            <div className="grid gap-4">
              {menu.map((item) => (
                <article key={item.id} className="flex flex-col gap-4 rounded-[26px] border border-zinc-200 p-3 sm:flex-row">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-28 w-full rounded-[20px] object-cover sm:w-36" />
                  ) : (
                    <div className="grid h-28 w-full place-items-center rounded-[20px] bg-zinc-100 text-xs text-zinc-500 sm:w-36">No photo</div>
                  )}
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
                        {item.discountPercent > 0 ? (
                          <>
                            <p className="text-sm text-zinc-500 line-through">${item.price.toFixed(2)}</p>
                            <p className="text-xl font-black text-rose-700">${discountedPrice(item).toFixed(2)}</p>
                            <p className="text-xs font-semibold text-rose-700">{item.discountPercent}% festival offer</p>
                          </>
                        ) : (
                          <p className="text-xl font-black text-zinc-900">${item.price.toFixed(2)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${item.stockQuantity > 0 ? 'text-zinc-500' : 'font-semibold text-rose-700'}`}>
                        {item.stockQuantity > 0 ? `${item.stockQuantity} available` : 'Out of stock'}
                      </span>
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={item.stockQuantity === 0 || (cart.find((entry) => entry.id === item.id)?.quantity ?? 0) >= item.stockQuantity}
                        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        {item.stockQuantity === 0 ? 'Unavailable' : (cart.find((entry) => entry.id === item.id)?.quantity ?? 0) >= item.stockQuantity ? 'Stock in basket' : 'Add to cart'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            )}
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
                    <p className="font-black text-zinc-900">${(discountedPrice(item) * item.quantity).toFixed(2)}</p>
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
        )}

        {isConsumer && (
        <section id="reservations" className="mt-10 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
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
        )}
      </section>

    </main>
  );
}
