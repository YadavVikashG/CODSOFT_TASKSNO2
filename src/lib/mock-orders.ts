export type OrderStatus = 'Preparing' | 'Ready for pickup' | 'Out for delivery' | 'Delivered';

export type MockOrder = {
  id: string;
  customer: string;
  restaurant: string;
  item: string;
  total: number;
  status: OrderStatus;
  time: string;
  table?: string;
};

export const mockOrders: MockOrder[] = [
  {
    id: 'ORD-1042',
    customer: 'Ava Thompson',
    restaurant: 'Saffron Street',
    item: 'Butter Chicken Bowl',
    total: 18.9,
    status: 'Preparing',
    time: '12 min ago',
  },
  {
    id: 'ORD-1043',
    customer: 'Lucas Chen',
    restaurant: 'Fire & Stone',
    item: 'Margherita Supreme',
    total: 21.5,
    status: 'Out for delivery',
    time: '8 min ago',
  },
  {
    id: 'ORD-1044',
    customer: 'Mila Patel',
    restaurant: 'Green Bowl Co.',
    item: 'Quinoa Power Salad',
    total: 14.9,
    status: 'Ready for pickup',
    time: '5 min ago',
  },
  {
    id: 'ORD-1045',
    customer: 'Noah Garcia',
    restaurant: 'Bamboo Wok',
    item: 'Crispy Chilli Chicken',
    total: 17.2,
    status: 'Delivered',
    time: '2 min ago',
  },
];
