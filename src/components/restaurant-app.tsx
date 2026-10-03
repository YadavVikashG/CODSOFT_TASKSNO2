'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

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
  latitude: number | null;
  longitude: number | null;
  myRating?: number;
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
  status: 'Preparing' | 'Ready for pickup' | 'Picked Up' | 'Out for delivery' | 'Delivered' | 'Dine-in';
  time: string;
};

type DeliveryJob = Order & { assignedToMe: boolean };

type Reservation = {
  id: string;
  customer_name: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  duration_minutes: number;
  source: 'online' | 'walk-in';
  status: string;
  seats: number[];
};

type ReservationAvailability = {
  seats: Array<{ number: number; available: boolean }>;
  availableCount: number;
  totalCount: number;
  reservations: Reservation[];
};

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
  const pathname = usePathname();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [catalogRestaurants, setCatalogRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [catalogMenu, setCatalogMenu] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [menuRestaurantSearch, setMenuRestaurantSearch] = useState('');
  const [menuRestaurantFilter, setMenuRestaurantFilter] = useState('all');
  const [searchMode, setSearchMode] = useState<'all' | 'delivery' | 'dine-in'>('all');
  const [dietaryPreference, setDietaryPreference] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [minimumRating, setMinimumRating] = useState('0');
  const [radiusKm, setRadiusKm] = useState('10');
  const [searchLocation, setSearchLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [walkInCart, setWalkInCart] = useState<CartItem[]>([]);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [printedOrder, setPrintedOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState('Loading delicious options...');
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryJobs, setDeliveryJobs] = useState<DeliveryJob[]>([]);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [reservationMessage, setReservationMessage] = useState('');
  const [reservationRestaurantSearch, setReservationRestaurantSearch] = useState('');
  const [reservationSelectedRestaurantId, setReservationSelectedRestaurantId] = useState('');
  const [reservationSearchResults, setReservationSearchResults] = useState<Restaurant[]>([]);
  const [restaurantLocationMessage, setRestaurantLocationMessage] = useState('');
  const [restaurantRatingMessages, setRestaurantRatingMessages] = useState<Record<string, string>>({});
  const [savingRatingRestaurantId, setSavingRatingRestaurantId] = useState('');
  const [reservationAvailability, setReservationAvailability] = useState<ReservationAvailability | null>(null);
  const [selectedSeatNumbers, setSelectedSeatNumbers] = useState<number[]>([]);
  const [seatCapacity, setSeatCapacity] = useState('');
  const [seatCapacityMessage, setSeatCapacityMessage] = useState('');
  const [reservationReceipt, setReservationReceipt] = useState<{
    id: string;
    name: string;
    date: string;
    time: string;
    guests: number;
    duration: number;
    seats: number[];
  } | null>(null);
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
  const [menuSearchDraft, setMenuSearchDraft] = useState('');
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [orderSearchDraft, setOrderSearchDraft] = useState('');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [inventoryDraft, setInventoryDraft] = useState({ price: '', stockQuantity: '', discountPercent: '' });
  const [reservationForm, setReservationForm] = useState({
    name: '',
    date: '',
    time: '',
    guests: '2',
    duration: '60',
    tableType: 'Window',
  });

  const restaurantDashboardId = user?.role === 'restaurant'
    ? user.restaurantId || ''
    : selectedRestaurantId;
  const reservationRestaurantId = user?.role === 'restaurant'
    ? restaurantDashboardId
    : reservationSelectedRestaurantId || reservationSearchResults[0]?.id || '';
  const reservationRestaurant = reservationSearchResults.find((restaurant) => restaurant.id === reservationRestaurantId)
    ?? restaurants.find((restaurant) => restaurant.id === reservationRestaurantId);
  const matchingReservationRestaurants = reservationSearchResults;
  const merchantView = user?.role === 'restaurant' && pathname.startsWith('/restaurant/')
    ? pathname.split('/')[2]
    : '';
  const showMerchantOrders = !merchantView || merchantView === 'orders';
  const showMerchantMenu = !merchantView || merchantView === 'menu';
  const showMerchantSeating = !merchantView || merchantView === 'seating';
  const customerRoutes = ['discover', 'menu', 'reservations', 'order-history'];
  const customerView = customerRoutes.includes(pathname.slice(1)) ? pathname.slice(1) : '';
  const isConsumer = user?.role === 'user';
  const showCustomerDiscover = !customerView || customerView === 'discover';
  const showCustomerMenu = !customerView || customerView === 'menu';
  const showCustomerReservations = !customerView || customerView === 'reservations';
  const showCustomerHistory = !customerView || customerView === 'order-history';
  const filteredMenu = menu.filter((item) =>
    `${item.name} ${item.description} ${item.code || ''}`.toLowerCase().includes(menuSearchTerm.toLowerCase()),
  );
  const visibleCatalogMenu = catalogMenu.filter((item) => {
    const restaurant = catalogRestaurants.find((entry) => entry.id === item.restaurantId);
    const matchesRestaurant = menuRestaurantFilter === 'all' || item.restaurantId === menuRestaurantFilter;
    const matchesSearch = !search.trim() || `${item.name} ${item.description} ${item.code || ''} ${restaurant?.name || ''} ${restaurant?.cuisine || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matchesRestaurant && matchesSearch;
  });

  useEffect(() => {
    if (!sessionReady || !customerView || isConsumer) return;
    router.replace('/login');
  }, [sessionReady, customerView, isConsumer, router]);

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
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: reservationRestaurantSearch, mode: 'dine-in' });
        const response = await fetch(`/api/restaurants?${params}`, { signal: controller.signal });
        const data: Restaurant[] = await response.json();
        if (!response.ok) throw new Error('Unable to search dine-in restaurants.');
        setReservationSearchResults(data);
        setReservationSelectedRestaurantId((current) =>
          data.some((restaurant) => restaurant.id === current) ? current : data[0]?.id || '',
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!controller.signal.aborted) setReservationSearchResults([]);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reservationRestaurantSearch]);

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

  useEffect(() => {
    if (user?.role !== 'user' || pathname !== '/menu') return;
    const controller = new AbortController();
    const loadCatalog = async () => {
      try {
        const restaurantResponse = await fetch('/api/restaurants?mode=all&dietary=all&minRating=0', { signal: controller.signal });
        if (!restaurantResponse.ok) throw new Error('Unable to load restaurants.');
        const allRestaurants: Restaurant[] = await restaurantResponse.json();
        if (controller.signal.aborted) return;
        setCatalogRestaurants(allRestaurants);
        const menus = await Promise.all(allRestaurants.map(async (restaurant) => {
          const restaurantId = restaurant.id;
          const response = await fetch(`/api/menu/${restaurantId}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Unable to load restaurant menu.');
          return response.json() as Promise<MenuItem[]>;
        }));
        if (!controller.signal.aborted) setCatalogMenu(menus.flat());
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setCatalogRestaurants([]);
          setCatalogMenu([]);
        }
      }
    };

    void loadCatalog();
    return () => controller.abort();
  }, [pathname, user?.role]);

  useEffect(() => {
    if (user?.role !== 'restaurant' || !restaurantDashboardId) return;
    const controller = new AbortController();
    void fetch(`/api/reservations?restaurantId=${restaurantDashboardId}&capacity=true`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load seat capacity.');
        setSeatCapacity((current) => current || String(data.seatCount));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSeatCapacityMessage(error instanceof Error ? error.message : 'Unable to load seat capacity.');
      });
    return () => controller.abort();
  }, [user?.role, restaurantDashboardId]);

  useEffect(() => {
    if (!reservationRestaurantId || !reservationForm.date || !reservationForm.time) return;

    let active = true;
    const controller = new AbortController();
    const loadAvailability = async () => {
      try {
        const params = new URLSearchParams({
          restaurantId: reservationRestaurantId,
          date: reservationForm.date,
          time: reservationForm.time,
          duration: reservationForm.duration,
        });
        const response = await fetch(`/api/reservations?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load seat availability.');
        if (!active) return;
        setReservationAvailability(data);
        if (user?.role === 'restaurant') {
          setSeatCapacity((current) => current || String(data.totalCount));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (active) setReservationAvailability(null);
      }
    };

    void loadAvailability();
    const interval = window.setInterval(loadAvailability, 12000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [reservationRestaurantId, reservationForm.date, reservationForm.time, reservationForm.duration, user?.role]);

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

  const handleSetRestaurantLocation = () => {
    if (!navigator.geolocation) {
      setRestaurantLocationMessage('Location is unavailable in this browser.');
      return;
    }
    setRestaurantLocationMessage('Requesting this device’s location…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch('/api/restaurants/location', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to save restaurant location.');
        setRestaurants((current) => current.map((restaurant) => restaurant.id === restaurantDashboardId
          ? { ...restaurant, latitude: data.latitude, longitude: data.longitude }
          : restaurant));
        setRestaurantLocationMessage(`Restaurant location saved (${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}).`);
      } catch (error) {
        setRestaurantLocationMessage(error instanceof Error ? error.message : 'Unable to save restaurant location.');
      }
    }, () => setRestaurantLocationMessage('Location permission was denied or unavailable.'), {
      enableHighAccuracy: true,
      timeout: 12000,
    });
  };

  const handleRateRestaurant = async (restaurantId: string, rating: number) => {
    setSavingRatingRestaurantId(restaurantId);
    setRestaurantRatingMessages((current) => ({ ...current, [restaurantId]: '' }));
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your rating.');
      const updateRating = (restaurant: Restaurant) => restaurant.id === restaurantId
        ? { ...restaurant, rating: data.rating, reviews: data.reviews, myRating: data.myRating }
        : restaurant;
      setRestaurants((current) => current.map(updateRating));
      setCatalogRestaurants((current) => current.map(updateRating));
      setRestaurantRatingMessages((current) => ({ ...current, [restaurantId]: 'Rating saved.' }));
    } catch (error) {
      setRestaurantRatingMessages((current) => ({
        ...current,
        [restaurantId]: error instanceof Error ? error.message : 'Unable to save your rating.',
      }));
    } finally {
      setSavingRatingRestaurantId('');
    }
  };

  const subtotal = cart.reduce((sum, item) =>
    sum + discountedPrice(item) * item.quantity,
  0);
  const cartRestaurantIds = [...new Set(cart.map((item) => item.restaurantId))];
  const deliveryFee = cartRestaurantIds.reduce((sum, restaurantId) =>
    sum + (catalogRestaurants.find((restaurant) => restaurant.id === restaurantId)?.fee
      ?? restaurants.find((restaurant) => restaurant.id === restaurantId)?.fee
      ?? 0),
  0);
  const serviceFee = cartRestaurantIds.length * 2.5;
  const total = subtotal + deliveryFee + serviceFee;
  const walkInTotal = walkInCart.reduce((sum, item) => sum + discountedPrice(item) * item.quantity, 0);

  const handleAddToCart = (item: MenuItem) => {
    if (!user || user.role !== 'user') {
      alert('Sign in with a customer account to order food.');
      return;
    }
    setSelectedRestaurantId(item.restaurantId);

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

  const handleAddToWalkInCart = (item: MenuItem) => {
    setWalkInCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if ((existing?.quantity ?? 0) >= item.stockQuantity) return current;
      if (existing) {
        return current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry);
      }
      return [...current, { ...item, quantity: 1 }];
    });
  };

  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === restaurantDashboardId)
      ?? catalogRestaurants.find((restaurant) => restaurant.id === restaurantDashboardId)
      ?? restaurants[0]
      ?? catalogRestaurants[0];

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
  const filteredRestaurantOrders = restaurantOrders.filter((order) =>
    `${order.customer} ${order.item} ${order.foodCode || ''} ${order.status} ${order.id}`
      .toLowerCase()
      .includes(orderSearchTerm.toLowerCase()),
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
          items: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            restaurantId: item.restaurantId,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to place your order.');
      }

      setOrders((current) => [...data.orders, ...current]);
      setCart([]);
      const updatedMenus = await Promise.all(catalogRestaurants.map(async (restaurant) => {
        const result = await fetch(`/api/menu/${restaurant.id}`);
        return result.json() as Promise<MenuItem[]>;
      }));
      const refreshedCatalog = updatedMenus.flat();
      setCatalogMenu(refreshedCatalog);
      setMenu(refreshedCatalog.filter((item) => item.restaurantId === selectedRestaurantId));
      setCheckoutMessage(`Order placed with ${data.orders.length} restaurant${data.orders.length === 1 ? '' : 's'}.`);
      setTimeout(() => setCheckoutMessage(''), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to place your order.');
    }
  };

  const handleWalkInSale = async () => {
    if (!walkInCart.length || user?.role !== 'restaurant') return;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'walk-in',
          customerName: walkInCustomerName,
          items: walkInCart.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to record in-person sale.');
      setOrders((current) => [data.order, ...current]);
      setPrintedOrder(data.order);
      setWalkInCart([]);
      setWalkInCustomerName('');
      const updatedMenu = await fetch(`/api/menu/${restaurantDashboardId}`).then((result) => result.json());
      setMenu(updatedMenu);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to record in-person sale.');
    }
  };

  const handleReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: reservationRestaurantId,
          name: reservationForm.name || user?.name || 'Guest',
          date: reservationForm.date,
          time: reservationForm.time,
          guests: Number(reservationForm.guests),
          duration: Number(reservationForm.duration),
          seats: selectedSeatNumbers,
          tableType: reservationForm.tableType,
          source: user?.role === 'restaurant' ? 'walk-in' : 'online',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to reserve a table.');
      }

      const booked = data.reservation;
      const seats = (booked.seats as number[]).map(Number);
      setPrintedOrder(null);
      setReservationReceipt({
        id: booked.id,
        name: booked.customer_name,
        date: String(booked.reservation_date).slice(0, 10),
        time: String(booked.reservation_time).slice(0, 5),
        guests: Number(booked.guests),
        duration: Number(booked.duration_minutes),
        seats,
      });
      setReservationMessage(`Seats ${seats.join(', ')} confirmed for ${reservationForm.date} at ${reservationForm.time}.`);
      setSelectedSeatNumbers([]);
      const params = new URLSearchParams({
        restaurantId: reservationRestaurantId,
        date: reservationForm.date,
        time: reservationForm.time,
        duration: reservationForm.duration,
      });
      const availabilityResponse = await fetch(`/api/reservations?${params}`);
      if (availabilityResponse.ok) setReservationAvailability(await availabilityResponse.json());
    } catch (error) {
      setReservationMessage(error instanceof Error ? error.message : 'Unable to reserve a table.');
    }
  };

  const handleSeatCapacityUpdate = async () => {
    try {
      const response = await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCount: Number(seatCapacity) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update seating capacity.');
      setSeatCapacity(String(data.seatCount));
      setSeatCapacityMessage(`Seating capacity updated to ${data.seatCount} seats.`);
      setReservationMessage('');
    } catch (error) {
      setSeatCapacityMessage(error instanceof Error ? error.message : 'Unable to update seating capacity.');
    }
  };

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
              {user?.role === 'user' && (
                <>
                  <Link href="/discover" aria-current={customerView === 'discover' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Discover</Link>
                  <Link href="/menu" aria-current={customerView === 'menu' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Menu</Link>
                  <Link href="/reservations" aria-current={customerView === 'reservations' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Reservations</Link>
                  <Link href="/order-history" aria-current={customerView === 'order-history' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Order history</Link>
                </>
              )}
              {user?.role === 'restaurant' && (
                <>
                  <Link href="/restaurant/orders" aria-current={merchantView === 'orders' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Orders</Link>
                  <Link href="/restaurant/menu" aria-current={merchantView === 'menu' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Menu</Link>
                  <Link href="/restaurant/seating" aria-current={merchantView === 'seating' ? 'page' : undefined} className="rounded-full px-3 py-2 hover:bg-orange-50 hover:text-orange-700">Seating</Link>
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
                    <div className="flex flex-wrap gap-2">
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
                      <button type="button" onClick={() => setPrintedOrder(job)} className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-100">
                        Print ticket
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {isConsumer && showCustomerDiscover && (
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

        {user?.role === 'restaurant' && showMerchantOrders && (
          <section id="merchant-orders" className="mb-10 border-b border-zinc-200 pb-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-black">Incoming orders</h2>
              <span className="text-sm text-zinc-500">{filteredRestaurantOrders.length} of {restaurantOrders.length} orders</span>
            </div>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setOrderSearchTerm(orderSearchDraft.trim());
              }}
              className="mb-4 flex max-w-xl gap-2"
            >
              <input
                value={orderSearchDraft}
                onChange={(event) => setOrderSearchDraft(event.target.value)}
                placeholder="Search guest, item, code, status, or order ID"
                aria-label="Search incoming orders"
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-700"
              />
              <button type="submit" className="rounded bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">Search</button>
              {orderSearchTerm && (
                <button type="button" onClick={() => { setOrderSearchDraft(''); setOrderSearchTerm(''); }} className="rounded border border-zinc-300 px-3 py-2.5 text-sm font-semibold hover:bg-zinc-100">Clear</button>
              )}
            </form>
            {restaurantOrders.length === 0 ? (
              <p className="bg-white px-5 py-8 text-sm text-zinc-600">No orders for your restaurant yet.</p>
            ) : filteredRestaurantOrders.length === 0 ? (
              <p className="border border-dashed border-zinc-300 bg-white px-5 py-8 text-sm text-zinc-600">No incoming orders match this search.</p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {filteredRestaurantOrders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="font-semibold">{order.item}</p>
                      <p className="mt-1 text-sm text-zinc-500">{order.customer} · {order.time}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-600">${order.total.toFixed(2)} · {order.status}</span>
                      <button type="button" onClick={() => setPrintedOrder(order)} className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-100">
                        Print ticket
                      </button>
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

        {user?.role === 'restaurant' && showMerchantOrders && (
          <section id="walk-in-pos" className="mb-10 border-b border-zinc-200 pb-8">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase text-emerald-800">In-person sales</p>
              <h2 className="mt-1 text-2xl font-black">Walk-in checkout</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white">
                {menu.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-zinc-600">Add menu items before recording a sale.</p>
                ) : menu.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-zinc-600">${discountedPrice(item).toFixed(2)} · {item.stockQuantity} in stock</p>
                    </div>
                    <button
                      type="button"
                      disabled={item.stockQuantity === 0 || (walkInCart.find((line) => line.id === item.id)?.quantity ?? 0) >= item.stockQuantity}
                      onClick={() => handleAddToWalkInCart(item)}
                      className="rounded border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-y border-zinc-200 px-4 py-4">
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Guest name
                  <input
                    value={walkInCustomerName}
                    onChange={(event) => setWalkInCustomerName(event.target.value)}
                    placeholder="Walk-in guest"
                    className="rounded border border-zinc-300 px-3 py-2.5"
                  />
                </label>
                <div className="mt-4 divide-y divide-zinc-200">
                  {walkInCart.length === 0 ? (
                    <p className="py-5 text-sm text-zinc-600">No items in this sale.</p>
                  ) : walkInCart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-zinc-600">${(discountedPrice(item) * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => setWalkInCart((current) => current.flatMap((line) => line.id !== item.id ? [line] : line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : []))} className="h-8 w-8 border border-zinc-300 font-bold">−</button>
                        <span className="w-5 text-center">{item.quantity}</span>
                        <button type="button" aria-label={`Add one ${item.name}`} disabled={item.quantity >= item.stockQuantity} onClick={() => handleAddToWalkInCart(item)} className="h-8 w-8 border border-zinc-300 font-bold disabled:text-zinc-300">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-zinc-300 pt-3 font-bold">
                  <span>Total</span><span>${walkInTotal.toFixed(2)}</span>
                </div>
                <button type="button" disabled={walkInCart.length === 0} onClick={handleWalkInSale} className="mt-4 w-full rounded bg-emerald-800 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400">
                  Record sale & print receipt
                </button>
              </div>
            </div>
          </section>
        )}

        {user?.role === 'restaurant' && showMerchantMenu && (
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

        {user?.role === 'restaurant' && showMerchantMenu && (
          <section id="merchant-menu" className="mb-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase text-emerald-700">Published menu</p>
                <h2 className="mt-1 text-2xl font-black">Your dishes</h2>
              </div>
              <span className="text-sm text-zinc-500">{filteredMenu.length} of {menu.length} items</span>
            </div>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setMenuSearchTerm(menuSearchDraft.trim());
              }}
              className="mb-4 flex max-w-xl gap-2"
            >
              <input
                value={menuSearchDraft}
                onChange={(event) => setMenuSearchDraft(event.target.value)}
                placeholder="Search dishes, descriptions, or codes"
                aria-label="Search published menu"
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-700"
              />
              <button type="submit" className="rounded bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">Search</button>
              {menuSearchTerm && (
                <button type="button" onClick={() => { setMenuSearchDraft(''); setMenuSearchTerm(''); }} className="rounded border border-zinc-300 px-3 py-2.5 text-sm font-semibold hover:bg-zinc-100">Clear</button>
              )}
            </form>
            {menu.length === 0 ? (
              <p className="bg-white px-5 py-8 text-sm text-zinc-600">Your menu is empty. Add a dish above to publish it to customers.</p>
            ) : filteredMenu.length === 0 ? (
              <p className="border border-dashed border-zinc-300 bg-white px-5 py-8 text-sm text-zinc-600">No published dishes match this search.</p>
            ) : (
              <div className="divide-y divide-zinc-200 bg-white">
                {filteredMenu.map((item) => {
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

        {user?.role === 'user' && showCustomerHistory && (
          <div className="mb-10 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Order history</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Your recent orders</h2>
              </div>
            </div>

            {userOrderHistory.length === 0 ? (
              <p className="border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-600">Your order history is empty.</p>
            ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            </div>}
          </div>
        )}

        {isConsumer && showCustomerDiscover && (
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
              <article
                key={restaurant.id}
                className={`overflow-hidden rounded-[26px] border bg-white shadow-sm ${
                  selectedRestaurantId === restaurant.id
                    ? 'border-orange-300 ring-2 ring-orange-200'
                    : 'border-zinc-200'
                }`}
              >
                <button type="button" onClick={() => setSelectedRestaurantId(restaurant.id)} aria-label={`View menu for ${restaurant.name}`} className="group block w-full text-left">
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
                        {restaurant.reviews > 0 ? `★ ${restaurant.rating.toFixed(1)}` : 'Not rated'}
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
                {user?.role === 'user' && (
                  <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-700">{restaurant.myRating ? `Your rating: ${restaurant.myRating}/5` : 'Rate this restaurant'}</p>
                      {restaurantRatingMessages[restaurant.id] && <p className="mt-1 text-xs text-emerald-800" role="status">{restaurantRatingMessages[restaurant.id]}</p>}
                    </div>
                    <div role="group" aria-label={`Rate ${restaurant.name}`} className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          aria-label={`Rate ${rating} out of 5 stars`}
                          aria-pressed={restaurant.myRating === rating}
                          disabled={savingRatingRestaurantId === restaurant.id}
                          onClick={() => void handleRateRestaurant(restaurant.id, rating)}
                          className={`h-9 w-8 text-lg disabled:cursor-wait ${rating <= (restaurant.myRating || 0) ? 'text-amber-600' : 'text-zinc-400'} hover:text-amber-700`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
              ))}
            </div>
          )}
        </div>
        )}

        {isConsumer && showCustomerMenu && (
        <div id="restaurants" className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Menu</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  All available food
                </h2>
              </div>
              <div className="rounded-full bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
                {selectedRestaurant?.deliveryTime ?? '20-30 min'}
              </div>
            </div>

            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(menuRestaurantSearch.trim());
              }}
              className="mb-4 flex flex-wrap gap-2"
            >
              <input
                value={menuRestaurantSearch}
                onChange={(event) => setMenuRestaurantSearch(event.target.value)}
                placeholder="Search restaurants, cuisine, or dishes"
                aria-label="Search restaurants and dishes"
                className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2.5 outline-none focus:border-orange-500"
              />
              <button type="submit" className="rounded bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">Search</button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setMenuRestaurantSearch(''); }} className="rounded border border-zinc-300 px-3 py-2.5 text-sm font-semibold hover:bg-zinc-100">Clear</button>
              )}
            </form>

            <label className="mb-5 grid gap-1 text-sm font-semibold text-zinc-700">
              Filter by restaurant
              <select value={menuRestaurantFilter} onChange={(event) => setMenuRestaurantFilter(event.target.value)} className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5">
                <option value="all">All restaurants</option>
                {catalogRestaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
            </label>

            {status && <p className="mb-4 text-sm text-zinc-500">{status}</p>}

            {visibleCatalogMenu.length === 0 ? (
              <p className="border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-600">
                {catalogMenu.length === 0 ? 'No published dishes are available yet.' : 'No dishes match this search and restaurant filter.'}
              </p>
            ) : (
            <div className="grid gap-4">
              {visibleCatalogMenu.map((item) => {
                const restaurant = catalogRestaurants.find((entry) => entry.id === item.restaurantId);
                const basketQuantity = cart.find((entry) => entry.id === item.id)?.quantity ?? 0;
                return <article key={item.id} className="flex flex-col gap-4 rounded-[26px] border border-zinc-200 p-3 sm:flex-row">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-28 w-full rounded-[20px] object-cover sm:w-36" />
                  ) : (
                    <div className="grid h-28 w-full place-items-center rounded-[20px] bg-zinc-100 text-xs text-zinc-500 sm:w-36">No photo</div>
                  )}
                  <div className="flex flex-1 flex-col justify-between gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase text-orange-700">{restaurant?.name || 'Restaurant'}</p>
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
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        disabled={item.stockQuantity === 0 || basketQuantity >= item.stockQuantity}
                        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        {item.stockQuantity === 0 ? 'Unavailable' : basketQuantity >= item.stockQuantity ? 'Stock in basket' : 'Add to cart'}
                      </button>
                    </div>
                  </div>
                </article>;
              })}
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
                      <p className="text-xs font-semibold text-orange-700">{catalogRestaurants.find((restaurant) => restaurant.id === item.restaurantId)?.name || 'Restaurant'}</p>
                      <p className="text-xs text-zinc-500">Qty {item.quantity} • {item.code || `FOOD-${item.id}`}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-zinc-900">${(discountedPrice(item) * item.quantity).toFixed(2)}</p>
                      <button type="button" onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.name} from basket`} className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100">Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartRestaurantIds.length > 1 && (
              <p className="mt-4 border-l-2 border-orange-500 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                Your checkout will create orders with {cartRestaurantIds.length} restaurants.
              </p>
            )}

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

        {((isConsumer && showCustomerReservations) || (user?.role === 'restaurant' && showMerchantSeating)) && (
          <section id="reservations" className="mt-10 border-y border-zinc-200 bg-white px-5 py-6 sm:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-orange-700">{user?.role === 'restaurant' ? 'Seating & walk-ins' : 'Reservations'}</p>
                <h2 className="mt-1 text-2xl font-black">{user?.role === 'restaurant' ? 'Table book' : 'Book a table'}</h2>
                <p className="mt-1 text-sm text-zinc-600">{reservationRestaurant?.name || 'Choose a restaurant'}</p>
              </div>
              {reservationAvailability && reservationForm.date && reservationForm.time && (
                <p className="text-sm font-semibold text-emerald-800" aria-live="polite">
                  {reservationAvailability.availableCount} of {reservationAvailability.totalCount} seats available
                </p>
              )}
            </div>

            {isConsumer && (
              <div className="mb-6 border-b border-zinc-200 pb-5">
                <label className="grid max-w-xl gap-1 text-sm font-semibold text-zinc-700">
                  Search dine-in restaurants
                  <input
                    value={reservationRestaurantSearch}
                    onChange={(event) => setReservationRestaurantSearch(event.target.value)}
                    placeholder="Restaurant name or cuisine"
                    className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-orange-500"
                  />
                </label>
                {matchingReservationRestaurants.length > 0 ? (
                  <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    {matchingReservationRestaurants.map((restaurant) => {
                      const selected = restaurant.id === reservationRestaurantId;
                      return (
                        <button
                          key={restaurant.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setReservationSelectedRestaurantId(restaurant.id);
                            setSelectedSeatNumbers([]);
                            setReservationAvailability(null);
                            setReservationMessage('');
                          }}
                          className={`border px-3 py-2 text-left ${selected ? 'border-emerald-700 bg-emerald-50' : 'border-zinc-300 bg-white hover:border-orange-500'}`}
                        >
                          <span className="block text-sm font-semibold">{restaurant.name}</span>
                          <span className="text-xs text-zinc-600">{restaurant.cuisine}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600">No dine-in restaurants match that search.</p>
                )}
              </div>
            )}

            {user?.role === 'restaurant' && (
              <div className="mb-6 grid gap-5 border-b border-zinc-200 pb-5 md:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); void handleSeatCapacityUpdate(); }} className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                    Active seats
                    <input
                      type="number"
                      min="0"
                      max="300"
                      required
                      value={seatCapacity}
                      onChange={(event) => setSeatCapacity(event.target.value)}
                      className="w-32 rounded border border-zinc-300 bg-white px-3 py-2"
                    />
                  </label>
                  <button type="submit" className="rounded bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-700">
                    Update seats
                  </button>
                  {seatCapacityMessage && <p className="w-full text-sm text-zinc-700" role="status">{seatCapacityMessage}</p>}
                </form>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleSetRestaurantLocation} className="rounded border border-zinc-400 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100">
                    Use this device&apos;s location
                  </button>
                  <p className="text-sm text-zinc-600" role="status">
                    {restaurantLocationMessage || (selectedRestaurant?.latitude != null && selectedRestaurant.longitude != null
                      ? `Saved: ${selectedRestaurant.latitude.toFixed(5)}, ${selectedRestaurant.longitude.toFixed(5)}`
                      : 'Location not set')}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleReservation} className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Guest name
                <input
                  required
                  maxLength={150}
                  value={reservationForm.name}
                  onChange={(event) => setReservationForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={user?.role === 'restaurant' ? 'Walk-in guest' : 'Your name'}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-orange-500"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Date
                <input
                  type="date"
                  required
                  value={reservationForm.date}
                  onChange={(event) => {
                    setSelectedSeatNumbers([]);
                    setReservationForm((current) => ({ ...current, date: event.target.value }));
                  }}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-orange-500"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Arrival time
                <input
                  type="time"
                  required
                  value={reservationForm.time}
                  onChange={(event) => {
                    setSelectedSeatNumbers([]);
                    setReservationForm((current) => ({ ...current, time: event.target.value }));
                  }}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-orange-500"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Party size
                <select
                  value={reservationForm.guests}
                  onChange={(event) => {
                    setSelectedSeatNumbers([]);
                    setReservationForm((current) => ({ ...current, guests: event.target.value }));
                  }}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5"
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Seating duration
                <select
                  value={reservationForm.duration}
                  onChange={(event) => {
                    setSelectedSeatNumbers([]);
                    setReservationForm((current) => ({ ...current, duration: event.target.value }));
                  }}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5"
                >
                  <option value="60">1 hour</option>
                  <option value="90">1 hour 30 minutes</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Seating area
                <select
                  value={reservationForm.tableType}
                  onChange={(event) => setReservationForm((current) => ({ ...current, tableType: event.target.value }))}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2.5"
                >
                  <option>Standard</option>
                  <option>Window</option>
                  <option>Patio</option>
                  <option>Booth</option>
                  <option>Private</option>
                </select>
              </label>

              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-800">Choose {reservationForm.guests} seats</p>
                  {reservationForm.date && reservationForm.time && (
                    <span className="text-xs text-zinc-500">Live availability · refreshes every 12 seconds</span>
                  )}
                </div>
                {!reservationRestaurantId ? (
                  <p className="border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-600">Search for and choose a dine-in restaurant first.</p>
                ) : !reservationForm.date || !reservationForm.time ? (
                  <p className="border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-600">Choose a date and time to see the seat map.</p>
                ) : !reservationAvailability ? (
                  <p className="border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-600">Loading seat availability…</p>
                ) : reservationAvailability.seats.length === 0 ? (
                  <p className="border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-600">No seats are configured for this restaurant yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
                    {reservationAvailability.seats.map((seat) => {
                      const selected = selectedSeatNumbers.includes(seat.number);
                      return (
                        <button
                          key={seat.number}
                          type="button"
                          disabled={!seat.available && !selected}
                          aria-pressed={selected}
                          onClick={() => setSelectedSeatNumbers((current) => selected
                            ? current.filter((number) => number !== seat.number)
                            : current.length < Number(reservationForm.guests) ? [...current, seat.number] : current)}
                          className={`min-h-16 border px-2 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed ${selected
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : seat.available
                              ? 'border-zinc-300 bg-white text-zinc-800 hover:border-emerald-600'
                              : 'border-rose-200 bg-rose-50 text-rose-800'}`}
                        >
                          <span className="block text-sm">Seat {seat.number}</span>
                          <span>{selected ? 'Selected' : seat.available ? 'Available' : 'Booked'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={!reservationRestaurantId || selectedSeatNumbers.length !== Number(reservationForm.guests)}
                  className="w-full rounded bg-zinc-900 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {user?.role === 'restaurant' ? 'Record walk-in' : 'Confirm reservation'}
                </button>
                {reservationMessage && <p className="text-sm font-medium text-emerald-800" role="status">{reservationMessage}</p>}
              </div>
            </form>

            {user?.role === 'restaurant' && reservationAvailability?.reservations.length ? (
              <div className="mt-8 border-t border-zinc-200 pt-5">
                <h3 className="mb-3 text-lg font-bold">Bookings for {reservationForm.date}</h3>
                <div className="divide-y divide-zinc-200">
                  {reservationAvailability.reservations.map((reservation) => (
                    <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold">{reservation.reservation_time.slice(0, 5)} · {reservation.customer_name}</p>
                        <p className="mt-1 text-zinc-600">Seats {reservation.seats.join(', ')} · {reservation.guests} guests · {reservation.duration_minutes} min · {reservation.source}</p>
                      </div>
                      <span className="text-xs font-semibold uppercase text-zinc-600">{reservation.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {reservationReceipt && !printedOrder && (
              <div className="reservation-print mt-6 border border-zinc-300 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-zinc-500">{user?.role === 'restaurant' ? 'Walk-in receipt' : 'Reservation receipt'}</p>
                    <h3 className="mt-1 text-xl font-black">{reservationRestaurant?.name}</h3>
                  </div>
                  <button type="button" onClick={() => { setPrintedOrder(null); window.print(); }} className="print:hidden rounded border border-zinc-400 px-3 py-2 text-sm font-semibold hover:bg-zinc-100">
                    Print receipt
                  </button>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p><strong>Booking:</strong> {reservationReceipt.id}</p>
                  <p><strong>Guest:</strong> {reservationReceipt.name}</p>
                  <p><strong>Date and time:</strong> {reservationReceipt.date} · {reservationReceipt.time}</p>
                  <p><strong>Seats:</strong> {reservationReceipt.seats.join(', ')}</p>
                  <p><strong>Party:</strong> {reservationReceipt.guests} guests</p>
                  <p><strong>Duration:</strong> {reservationReceipt.duration} minutes</p>
                </div>
              </div>
            )}
          </section>
        )}

        {printedOrder && (user?.role !== 'restaurant' || showMerchantOrders) && (
          <section className="order-print my-8 border border-zinc-300 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-zinc-500">{printedOrder.status === 'Dine-in' ? 'Walk-in receipt' : 'Delivery order ticket'}</p>
                <h2 className="mt-1 text-xl font-black">{printedOrder.restaurant}</h2>
              </div>
              <div className="print:hidden flex gap-2">
                <button type="button" onClick={() => window.print()} className="rounded border border-zinc-400 px-3 py-2 text-sm font-semibold hover:bg-zinc-100">Print ticket</button>
                <button type="button" onClick={() => setPrintedOrder(null)} aria-label="Close ticket" className="rounded border border-zinc-400 px-3 py-2 text-sm font-semibold hover:bg-zinc-100">Close</button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p><strong>Order:</strong> {printedOrder.id}</p>
              <p><strong>Guest:</strong> {printedOrder.customer}</p>
              <p><strong>Items:</strong> {printedOrder.item}</p>
              <p><strong>Food codes:</strong> {printedOrder.foodCode || '—'}</p>
              <p><strong>Total:</strong> ${printedOrder.total.toFixed(2)}</p>
              <p><strong>Status:</strong> {printedOrder.status}</p>
              <p><strong>Placed:</strong> {printedOrder.time}</p>
            </div>
          </section>
        )}
      </section>

    </main>
  );
}
