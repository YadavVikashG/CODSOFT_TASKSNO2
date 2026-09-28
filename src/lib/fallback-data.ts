export type Restaurant = {
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

export type MenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  spicy?: boolean;
  veg?: boolean;
  popular?: boolean;
  image: string;
};

export const restaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'Saffron Street',
    cuisine: 'North Indian',
    rating: 4.8,
    reviews: 2140,
    deliveryTime: '25-35 min',
    fee: 2.99,
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
    tag: 'Super Saver',
    featured: true,
  },
  {
    id: 'r2',
    name: 'Green Bowl Co.',
    cuisine: 'Healthy • Vegan',
    rating: 4.7,
    reviews: 1320,
    deliveryTime: '20-30 min',
    fee: 1.99,
    image:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80',
    tag: 'Top Rated',
    featured: true,
  },
  {
    id: 'r3',
    name: 'Fire & Stone',
    cuisine: 'Italian • Pizza',
    rating: 4.9,
    reviews: 3400,
    deliveryTime: '30-40 min',
    fee: 3.49,
    image:
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80',
    tag: 'Trending',
    featured: true,
  },
  {
    id: 'r4',
    name: 'Bamboo Wok',
    cuisine: 'Chinese • Asian',
    rating: 4.6,
    reviews: 980,
    deliveryTime: '22-32 min',
    fee: 2.49,
    image:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80',
    tag: 'New',
    featured: false,
  },
];

export const menuByRestaurant: Record<string, MenuItem[]> = {
  r1: [
    {
      id: 'm1',
      restaurantId: 'r1',
      name: 'Butter Chicken Bowl',
      description: 'Creamy tomato gravy, charred chicken, basmati rice.',
      price: 18.9,
      spicy: true,
      popular: true,
      image:
        'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm2',
      restaurantId: 'r1',
      name: 'Paneer Tikka Masala',
      description: 'Soft cottage cheese in rich tikka masala sauce.',
      price: 16.5,
      veg: true,
      popular: true,
      image:
        'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm3',
      restaurantId: 'r1',
      name: 'Garlic Naan Basket',
      description: 'Freshly baked naan brushed with garlic butter.',
      price: 7.5,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    },
  ],
  r2: [
    {
      id: 'm4',
      restaurantId: 'r2',
      name: 'Quinoa Power Salad',
      description: 'Cucumber, greens, avocado, herbs, and tahini dressing.',
      price: 14.9,
      veg: true,
      popular: true,
      image:
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm5',
      restaurantId: 'r2',
      name: 'Hummus Protein Wrap',
      description: 'High-protein wrap packed with veggies and roasted chickpeas.',
      price: 13.5,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm6',
      restaurantId: 'r2',
      name: 'Citrus Smoothie Bowl',
      description: 'Tropical fruits, granola, chia, and coconut flakes.',
      price: 9.8,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80',
    },
  ],
  r3: [
    {
      id: 'm7',
      restaurantId: 'r3',
      name: 'Margherita Supreme',
      description: 'Fresh basil, mozzarella, and tomato sauce on stone-baked crust.',
      price: 21.5,
      popular: true,
      image:
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm8',
      restaurantId: 'r3',
      name: 'Truffle Mushroom Pasta',
      description: 'Creamy parmesan sauce with roasted mushrooms and herbs.',
      price: 19.9,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm9',
      restaurantId: 'r3',
      name: 'Garlic Parmesan Fries',
      description: 'Crispy fries tossed in garlic butter and parmesan.',
      price: 8.4,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1576106445241-1174b4b0597a?auto=format&fit=crop&w=900&q=80',
    },
  ],
  r4: [
    {
      id: 'm10',
      restaurantId: 'r4',
      name: 'Crispy Chilli Chicken',
      description: 'Wok-tossed chicken with sweet chilli glaze and sesame.',
      price: 17.2,
      spicy: true,
      popular: true,
      image:
        'https://images.unsplash.com/photo-1604908813254-6310c7a8319a?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm11',
      restaurantId: 'r4',
      name: 'Veg Dumplings',
      description: 'Steamed dumplings filled with garden greens and mushrooms.',
      price: 12.6,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'm12',
      restaurantId: 'r4',
      name: 'Classic Fried Rice',
      description: 'Aromatic rice with vegetables and soy wok seasoning.',
      price: 15.3,
      veg: true,
      image:
        'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    },
  ],
};
