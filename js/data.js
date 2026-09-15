/**
 * GrossHub - Baseline Data & Configuration
 * 24+ curated local grocery products, categories, coupons, and initial seed data for Agartala, Tripura.
 */

const DEFAULT_SHOP_CONFIG = {
  shopName: "GrossHub",
  tagline: "Agartala's Favorite Local Grocery Express",
  taglineSub: "Fresh Essentials Delivered in 30-45 Minutes",
  address: "Bhattapukur, Agartala, Tripura - 799003",
  phone1: "9862272399",
  phone2: "6009430922",
  whatsappNumber: "919862272399",
  whatsappFallback: "916009430922",
  openingHours: "8:00 AM - 10:00 PM",
  deliveryCharge: 30,
  freeDeliveryThreshold: 499,
  currency: "₹",
  adminPassword: "grosshub123",
  upiId: "9862272399@upi",
  serviceStatus: "open", // 'open' or 'closed'
  estimatedDeliveryTime: "30-45 mins",
  storeLocation: {
    name: "Bhattapukur, Agartala",
    address: "Bhattapukur, Agartala, Tripura - 799003",
    lat: 23.8188,
    lng: 91.2725
  },
  distanceTiers: [
    { id: "tier_1", maxKm: 2, fee: 15, label: "0 - 2 km (Local)", desc: "Bhattapukur, Badharghat, Arundhutinagar" },
    { id: "tier_2", maxKm: 5, fee: 30, label: "2 - 5 km (City Core)", desc: "Melarmath, Banamalipur, Ramnagar, Math Chowmuhani" },
    { id: "tier_3", maxKm: 8, fee: 50, label: "5 - 8 km (Extended City)", desc: "Kunjaban, GB Hospital, Indranagar, Amtali" },
    { id: "tier_4", maxKm: 12, fee: 75, label: "8 - 12 km (Suburbs)", desc: "Khayerpur, Ranirbazar, New Capital Complex" },
    { id: "tier_5", maxKm: 999, fee: 100, label: "12+ km (Outskirts)", desc: "Jirania, Sekerkote, Airport Zone" }
  ]
};

const CATEGORIES = [
  { id: "all", name: "All Items", icon: "🛒" },
  { id: "rice-atta", name: "Rice & Atta", icon: "🌾" },
  { id: "dal-pulses", name: "Dal & Pulses", icon: "🥣" },
  { id: "oils-ghee", name: "Cooking Oils & Ghee", icon: "🫗" },
  { id: "spices-masala", name: "Spices & Masalas", icon: "🌶️" },
  { id: "dairy-breakfast", name: "Dairy & Breakfast", icon: "🥛" },
  { id: "tea-snacks", name: "Tea & Snacks", icon: "☕" },
  { id: "cleaning-home", name: "Cleaning & Home", icon: "🧼" },
  { id: "fresh-produce", name: "Fresh Produce", icon: "🥬" }
];

const DEFAULT_COUPONS = [
  {
    code: "WELCOME50",
    description: "₹50 OFF on orders above ₹399",
    type: "flat",
    discount: 50,
    minOrder: 399
  },
  {
    code: "GROSS10",
    description: "10% OFF up to ₹100",
    type: "percentage",
    discount: 10,
    maxDiscount: 100,
    minOrder: 299
  },
  {
    code: "FREEDEL",
    description: "Free Delivery on any order",
    type: "free_delivery",
    discount: 30,
    minOrder: 199
  }
];

const DEFAULT_PRODUCTS = [
  // Rice & Atta
  {
    id: 1,
    name: "Premium Miniket Rice",
    category: "rice-atta",
    categoryName: "Rice & Atta",
    unit: "1 kg pack",
    price: 58,
    mrp: 68,
    emoji: "🍚",
    badge: "Bestseller",
    description: "Silky, long-grain Miniket rice. Perfect for daily family meals.",
    inStock: true,
    stockQty: 85
  },
  {
    id: 2,
    name: "Gobindobhog Aromatic Rice",
    category: "rice-atta",
    categoryName: "Rice & Atta",
    unit: "1 kg pack",
    price: 115,
    mrp: 135,
    emoji: "🌾",
    badge: "Festive Special",
    description: "Fragrant short-grain Gobindobhog rice, ideal for payesh and khichuri.",
    inStock: true,
    stockQty: 40
  },
  {
    id: 3,
    name: "Chakki Fresh Whole Wheat Atta",
    category: "rice-atta",
    categoryName: "Rice & Atta",
    unit: "5 kg bag",
    price: 215,
    mrp: 245,
    emoji: "🌾",
    badge: "Value Pack",
    description: "100% whole wheat stone ground flour for soft, fluffy rotis.",
    inStock: true,
    stockQty: 30
  },
  {
    id: 4,
    name: "Suji (Semolina / Rawa)",
    category: "rice-atta",
    categoryName: "Rice & Atta",
    unit: "500g pack",
    price: 38,
    mrp: 45,
    emoji: "🥣",
    badge: "",
    description: "Crispy grain suji for sweet halwa, upma, and breakfast snacks.",
    inStock: true,
    stockQty: 50
  },

  // Dal & Pulses
  {
    id: 5,
    name: "Yellow Toor Dal (Arhar)",
    category: "dal-pulses",
    categoryName: "Dal & Pulses",
    unit: "1 kg pack",
    price: 142,
    mrp: 165,
    emoji: "🥣",
    badge: "Essential",
    description: "Unpolished, protein-rich Arhar dal. Rich flavor and quick cooking.",
    inStock: true,
    stockQty: 60
  },
  {
    id: 6,
    name: "Red Masoor Dal (Split)",
    category: "dal-pulses",
    categoryName: "Dal & Pulses",
    unit: "1 kg pack",
    price: 98,
    mrp: 115,
    emoji: "🍲",
    badge: "Popular",
    description: "Quick cooking Masoor dal, high in dietary fiber and essential iron.",
    inStock: true,
    stockQty: 75
  },
  {
    id: 7,
    name: "Yellow Moong Dal (Dhuli)",
    category: "dal-pulses",
    categoryName: "Dal & Pulses",
    unit: "1 kg pack",
    price: 125,
    mrp: 145,
    emoji: "🥣",
    badge: "",
    description: "Easily digestible, high-protein yellow moong lentils.",
    inStock: true,
    stockQty: 45
  },
  {
    id: 8,
    name: "Kabuli Chana (Big Chickpeas)",
    category: "dal-pulses",
    categoryName: "Dal & Pulses",
    unit: "500g pack",
    price: 78,
    mrp: 90,
    emoji: "🧆",
    badge: "",
    description: "Large bold grain chickpeas, delicious for Chana Masala and curries.",
    inStock: true,
    stockQty: 35
  },

  // Cooking Oils & Ghee
  {
    id: 9,
    name: "Pure Kachi Ghani Mustard Oil",
    category: "oils-ghee",
    categoryName: "Cooking Oils & Ghee",
    unit: "1 Liter bottle",
    price: 154,
    mrp: 175,
    emoji: "🫗",
    badge: "Agartala Favorite",
    description: "Authentic cold-pressed pungent mustard oil for traditional Bengali & local dishes.",
    inStock: true,
    stockQty: 90
  },
  {
    id: 10,
    name: "Refined Sunflower Cooking Oil",
    category: "oils-ghee",
    categoryName: "Cooking Oils & Ghee",
    unit: "1 Liter pouch",
    price: 142,
    mrp: 160,
    emoji: "🌻",
    badge: "Light & Hearty",
    description: "Fortified with Vitamins A & D, low absorb sunflower oil for frying.",
    inStock: true,
    stockQty: 55
  },
  {
    id: 11,
    name: "Pure Danedar Cow Ghee",
    category: "oils-ghee",
    categoryName: "Cooking Oils & Ghee",
    unit: "500 ml jar",
    price: 325,
    mrp: 360,
    emoji: "🧈",
    badge: "Pure Ghee",
    description: "Golden granular aromatic cow ghee made with traditional churning.",
    inStock: true,
    stockQty: 25
  },

  // Spices & Masalas
  {
    id: 12,
    name: "Pure Turmeric Powder (Haldi)",
    category: "spices-masala",
    categoryName: "Spices & Masalas",
    unit: "200g pack",
    price: 48,
    mrp: 58,
    emoji: "🟡",
    badge: "100% Pure",
    description: "High-curcumin golden turmeric ground from select Salem fingers.",
    inStock: true,
    stockQty: 70
  },
  {
    id: 13,
    name: "Kashmiri Red Chilli Powder",
    category: "spices-masala",
    categoryName: "Spices & Masalas",
    unit: "200g pack",
    price: 65,
    mrp: 78,
    emoji: "🌶️",
    badge: "Rich Color",
    description: "Imparts natural vibrant red hue with mild, pleasant heat to curries.",
    inStock: true,
    stockQty: 60
  },
  {
    id: 14,
    name: "Panch Phoron (Bengali 5-Spice Blend)",
    category: "spices-masala",
    categoryName: "Spices & Masalas",
    unit: "100g pack",
    price: 32,
    mrp: 40,
    emoji: "🌿",
    badge: "Local Special",
    description: "Classic blend of cumin, brown mustard, fenugreek, nigella, and fennel seeds.",
    inStock: true,
    stockQty: 40
  },
  {
    id: 15,
    name: "Iodized Crystal Table Salt",
    category: "spices-masala",
    categoryName: "Spices & Masalas",
    unit: "1 kg packet",
    price: 24,
    mrp: 28,
    emoji: "🧂",
    badge: "Daily Need",
    description: "Vacuum evaporated iodized table salt for healthy daily consumption.",
    inStock: true,
    stockQty: 120
  },

  // Dairy & Breakfast
  {
    id: 16,
    name: "Fresh Toned Milk Pouch",
    category: "dairy-breakfast",
    categoryName: "Dairy & Breakfast",
    unit: "500 ml pouch",
    price: 32,
    mrp: 32,
    emoji: "🥛",
    badge: "Fresh Today",
    description: "Pasteurized, homogenized toned milk delivered cold and fresh every morning.",
    inStock: true,
    stockQty: 60
  },
  {
    id: 17,
    name: "Fresh Paneer (Cottage Cheese)",
    category: "dairy-breakfast",
    categoryName: "Dairy & Breakfast",
    unit: "200g block",
    price: 85,
    mrp: 95,
    emoji: "🧀",
    badge: "Rich & Soft",
    description: "Velvety fresh malai paneer, perfect for curry, matar paneer, or tikka.",
    inStock: true,
    stockQty: 30
  },
  {
    id: 18,
    name: "Farm Fresh Brown Eggs",
    category: "dairy-breakfast",
    categoryName: "Dairy & Breakfast",
    unit: "Tray of 6 eggs",
    price: 48,
    mrp: 55,
    emoji: "🥚",
    badge: "Protein Rich",
    description: "Naturally enriched farm-fresh brown eggs with golden yolks.",
    inStock: true,
    stockQty: 50
  },
  {
    id: 19,
    name: "Rolled Oats Breakfast Cereal",
    category: "dairy-breakfast",
    categoryName: "Dairy & Breakfast",
    unit: "500g pouch",
    price: 95,
    mrp: 110,
    emoji: "🥣",
    badge: "Healthy Choice",
    description: "100% whole grain rolled oats rich in soluble beta-glucan fiber.",
    inStock: true,
    stockQty: 35
  },

  // Tea & Snacks
  {
    id: 20,
    name: "Tripura Gold Strong CTC Tea",
    category: "tea-snacks",
    categoryName: "Tea & Snacks",
    unit: "250g box",
    price: 130,
    mrp: 150,
    emoji: "☕",
    badge: "Tripura Heritage",
    description: "Directly sourced rich, robust CTC blend from Tripura's lush tea gardens.",
    inStock: true,
    stockQty: 65
  },
  {
    id: 21,
    name: "Crispy Marie Light Biscuits Combo",
    category: "tea-snacks",
    categoryName: "Tea & Snacks",
    unit: "Combo of 2 (300g)",
    price: 45,
    mrp: 55,
    emoji: "🍪",
    badge: "Tea Time",
    description: "Crispy, baked tea biscuits packed with essential vitamins.",
    inStock: true,
    stockQty: 80
  },
  {
    id: 22,
    name: "Salted Roasted Peanuts (Moongfali)",
    category: "tea-snacks",
    categoryName: "Tea & Snacks",
    unit: "200g pouch",
    price: 40,
    mrp: 50,
    emoji: "🥜",
    badge: "Crispy",
    description: "Lightly salted crunchy roasted peanuts. Zero trans fat.",
    inStock: true,
    stockQty: 45
  },

  // Cleaning & Home
  {
    id: 23,
    name: "Lemon Fresh Dishwash Gel & Scrubber",
    category: "cleaning-home",
    categoryName: "Cleaning & Home",
    unit: "500 ml bottle",
    price: 95,
    mrp: 115,
    emoji: "🧼",
    badge: "Tough on Grease",
    description: "Concentrated lime dish gel with anti-bacterial active degreasers.",
    inStock: true,
    stockQty: 45
  },
  {
    id: 24,
    name: "Advanced Laundry Detergent Powder",
    category: "cleaning-home",
    categoryName: "Cleaning & Home",
    unit: "1 kg value pack",
    price: 118,
    mrp: 140,
    emoji: "🫧",
    badge: "Bright Whites",
    description: "Powerful enzyme stain remover suitable for machine and bucket wash.",
    inStock: true,
    stockQty: 50
  },

  // Fresh Produce
  {
    id: 25,
    name: "Fresh Local Potatoes (Jyoti)",
    category: "fresh-produce",
    categoryName: "Fresh Produce",
    unit: "1 kg net",
    price: 28,
    mrp: 35,
    emoji: "🥔",
    badge: "Farm Fresh",
    description: "Clean, firm fresh local potatoes. Daily kitchen essential.",
    inStock: true,
    stockQty: 100
  },
  {
    id: 26,
    name: "Fresh Red Onions (Nashik)",
    category: "fresh-produce",
    categoryName: "Fresh Produce",
    unit: "1 kg net",
    price: 36,
    mrp: 45,
    emoji: "🧅",
    badge: "Fresh Batch",
    description: "Crisp, pungent red onions, hand-sorted for uniform size and freshness.",
    inStock: true,
    stockQty: 80
  },
  {
    id: 27,
    name: "Fresh Country Ginger (Ada)",
    category: "fresh-produce",
    categoryName: "Fresh Produce",
    unit: "250g pack",
    price: 35,
    mrp: 42,
    emoji: "🫚",
    badge: "Aromatic",
    description: "Fragrant, spicy hill ginger freshly harvested from local Tripura farms.",
    inStock: true,
    stockQty: 40
  }
];

// Seed sample orders for immediate Admin, Rider & Order Tracking demonstration
const INITIAL_SEED_ORDERS = [
  {
    id: "GH-8102",
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: "out_for_delivery", // pending | confirmed | preparing | out_for_delivery | delivered | cancelled
    customer: {
      name: "Bikram Debbarma",
      phone: "9862272399",
      address: "Lane 4, Near Kali Temple, Bhattapukur, Agartala",
      notes: "Call when you reach the gate."
    },
    deliverySlot: "Instant Delivery (30-45 mins)",
    paymentMethod: "Cash on Delivery",
    paymentStatus: "Pending COD Collection",
    rider: "Rider Bikash",
    riderPhone: "9862272399",
    items: [
      { id: 1, name: "Premium Miniket Rice", price: 58, qty: 2, subtotal: 116 },
      { id: 9, name: "Pure Kachi Ghani Mustard Oil", price: 154, qty: 1, subtotal: 154 },
      { id: 20, name: "Tripura Gold Strong CTC Tea", price: 130, qty: 1, subtotal: 130 }
    ],
    summary: {
      itemCount: 4,
      subtotal: 400,
      deliveryCharge: 30,
      couponDiscount: 0,
      couponCode: "",
      grandTotal: 430
    },
    statusHistory: [
      { status: "placed", time: new Date(Date.now() - 25 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) },
      { status: "confirmed", time: new Date(Date.now() - 20 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) },
      { status: "preparing", time: new Date(Date.now() - 15 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) },
      { status: "out_for_delivery", time: new Date(Date.now() - 5 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
    ]
  },
  {
    id: "GH-8098",
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    status: "delivered",
    customer: {
      name: "Soma Roy Chowdhury",
      phone: "6009430922",
      address: "Apt 2B, Green View Residency, Ramnagar, Agartala",
      notes: "Ring the doorbell twice."
    },
    deliverySlot: "Morning Slot",
    paymentMethod: "Instant UPI (Paid)",
    paymentStatus: "Paid",
    rider: "Rider Rahul",
    riderPhone: "6009430922",
    items: [
      { id: 5, name: "Yellow Toor Dal (Arhar)", price: 142, qty: 2, subtotal: 284 },
      { id: 11, name: "Pure Danedar Cow Ghee", price: 325, qty: 1, subtotal: 325 }
    ],
    summary: {
      itemCount: 3,
      subtotal: 609,
      deliveryCharge: 0,
      couponDiscount: 50,
      couponCode: "WELCOME50",
      grandTotal: 559
    },
    statusHistory: [
      { status: "placed", time: "09:30 AM" },
      { status: "confirmed", time: "09:35 AM" },
      { status: "preparing", time: "09:42 AM" },
      { status: "out_for_delivery", time: "10:05 AM" },
      { status: "delivered", time: "10:28 AM" }
    ]
  }
];
