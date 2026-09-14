/**
 * GrossHub - Store Engine & LocalStorage State Manager
 * Handles persistent storage for products, orders, settings, active cart and customer session.
 */

const Store = {
  // Key names
  KEYS: {
    CONFIG: 'grosshub_settings',
    PRODUCTS: 'grosshub_products',
    ORDERS: 'grosshub_orders',
    CART: 'grosshub_cart',
    COUPONS: 'grosshub_coupons',
    CUSTOMER: 'grosshub_customer',
    ADMIN_PWD: 'grosshub_admin_password'
  },

  // 1. Store Configuration
  getConfig() {
    try {
      const saved = localStorage.getItem(this.KEYS.CONFIG);
      if (saved) return { ...DEFAULT_SHOP_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error reading config:', e);
    }
    return { ...DEFAULT_SHOP_CONFIG };
  },

  saveConfig(newConfig) {
    const merged = { ...this.getConfig(), ...newConfig };
    localStorage.setItem(this.KEYS.CONFIG, JSON.stringify(merged));
    return merged;
  },

  // 2. Product Catalog
  getProducts() {
    try {
      const saved = localStorage.getItem(this.KEYS.PRODUCTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading products:', e);
    }
    // Initialize with default catalog
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    return [...DEFAULT_PRODUCTS];
  },

  saveProducts(products) {
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
    return products;
  },

  addProduct(productData) {
    const products = this.getProducts();
    const newId = products.length ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;
    const newProduct = {
      id: newId,
      name: productData.name || 'Unnamed Product',
      category: productData.category || 'rice-atta',
      categoryName: productData.categoryName || 'General',
      unit: productData.unit || '1 unit',
      price: Number(productData.price) || 0,
      mrp: Number(productData.mrp) || Number(productData.price) || 0,
      emoji: productData.emoji || '🛒',
      badge: productData.badge || '',
      description: productData.description || '',
      inStock: productData.inStock !== false,
      stockQty: Number(productData.stockQty) || 20
    };
    products.unshift(newProduct);
    this.saveProducts(products);
    return newProduct;
  },

  updateProduct(id, updates) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === Number(id));
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      this.saveProducts(products);
      return products[index];
    }
    return null;
  },

  deleteProduct(id) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== Number(id));
    this.saveProducts(products);
    return true;
  },

  toggleProductStock(id) {
    const products = this.getProducts();
    const product = products.find(p => p.id === Number(id));
    if (product) {
      product.inStock = !product.inStock;
      this.saveProducts(products);
      return product;
    }
    return null;
  },

  // 3. Orders Management
  getOrders() {
    try {
      const saved = localStorage.getItem(this.KEYS.ORDERS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading orders:', e);
    }
    // Seed initial orders if empty
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(INITIAL_SEED_ORDERS));
    return [...INITIAL_SEED_ORDERS];
  },

  saveOrders(orders) {
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    return orders;
  },

  getOrder(orderId) {
    const orders = this.getOrders();
    const cleanId = String(orderId).trim().toUpperCase();
    return orders.find(o => o.id.toUpperCase() === cleanId) || null;
  },

  getOrdersByPhone(phone) {
    const orders = this.getOrders();
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    return orders.filter(o => {
      const oPhone = String(o.customer?.phone || '').replace(/\D/g, '').slice(-10);
      return oPhone === cleanPhone;
    });
  },

  createOrder(orderPayload) {
    const orders = this.getOrders();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `GH-${randomSuffix}`;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newOrder = {
      id: orderId,
      createdAt: now.toISOString(),
      status: 'placed', // placed -> confirmed -> preparing -> out_for_delivery -> delivered -> cancelled
      customer: {
        name: orderPayload.customer.name || 'Guest Customer',
        phone: orderPayload.customer.phone || '',
        address: orderPayload.customer.address || '',
        landmark: orderPayload.customer.landmark || '',
        notes: orderPayload.customer.notes || ''
      },
      deliverySlot: orderPayload.deliverySlot || 'Instant Delivery (30-45 mins)',
      paymentMethod: orderPayload.paymentMethod || 'Cash on Delivery',
      paymentStatus: orderPayload.paymentMethod.includes('UPI') ? 'Paid Online' : 'Pending COD Collection',
      rider: 'Pending Assignment',
      riderPhone: '',
      items: orderPayload.items || [],
      summary: {
        itemCount: orderPayload.items.reduce((acc, item) => acc + item.qty, 0),
        subtotal: orderPayload.subtotal,
        deliveryCharge: orderPayload.deliveryCharge,
        couponDiscount: orderPayload.couponDiscount || 0,
        couponCode: orderPayload.couponCode || '',
        grandTotal: orderPayload.grandTotal
      },
      statusHistory: [
        { status: 'placed', time: timeFormatted, note: 'Order placed by customer' }
      ]
    };

    orders.unshift(newOrder);
    this.saveOrders(orders);

    // Save customer info for easy auto-fill
    this.saveCustomer(newOrder.customer);

    return newOrder;
  },

  updateOrderStatus(orderId, newStatus, riderInfo = null, note = '') {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = newStatus;
    if (riderInfo) {
      if (riderInfo.rider) order.rider = riderInfo.rider;
      if (riderInfo.riderPhone) order.riderPhone = riderInfo.riderPhone;
    }

    if (newStatus === 'delivered' && order.paymentStatus.includes('Pending')) {
      order.paymentStatus = 'Cash Collected by Rider';
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    order.statusHistory.push({
      status: newStatus,
      time: timeFormatted,
      note: note || `Status updated to ${newStatus}`
    });

    this.saveOrders(orders);
    return order;
  },

  // 4. Active Cart State
  getCart() {
    try {
      const saved = localStorage.getItem(this.KEYS.CART);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading cart:', e);
    }
    return [];
  },

  saveCart(cart) {
    localStorage.setItem(this.KEYS.CART, JSON.stringify(cart));
    return cart;
  },

  clearCart() {
    localStorage.removeItem(this.KEYS.CART);
    return [];
  },

  // 5. Coupons
  getCoupons() {
    return DEFAULT_COUPONS;
  },

  validateCoupon(code, subtotal) {
    if (!code) return { valid: false, message: 'Please enter a coupon code.' };
    const cleanCode = String(code).trim().toUpperCase();
    const coupon = DEFAULT_COUPONS.find(c => c.code === cleanCode);

    if (!coupon) {
      return { valid: false, message: 'Invalid promo code. Try WELCOME50, GROSS10, or FREEDEL.' };
    }

    if (subtotal < coupon.minOrder) {
      return {
        valid: false,
        message: `Min order for ${coupon.code} is ₹${coupon.minOrder} (Add ₹${coupon.minOrder - subtotal} more).`
      };
    }

    let discount = 0;
    if (coupon.type === 'flat') {
      discount = coupon.discount;
    } else if (coupon.type === 'percentage') {
      discount = Math.min(Math.round((subtotal * coupon.discount) / 100), coupon.maxDiscount || 100);
    } else if (coupon.type === 'free_delivery') {
      discount = coupon.discount; // ₹30 delivery discount
    }

    return {
      valid: true,
      coupon,
      discount,
      message: `Coupon ${coupon.code} applied! Saved ₹${discount}`
    };
  },

  // 6. Customer Session Cache
  getCustomer() {
    try {
      const saved = localStorage.getItem(this.KEYS.CUSTOMER);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  },

  saveCustomer(customer) {
    localStorage.setItem(this.KEYS.CUSTOMER, JSON.stringify(customer));
  },

  // 7. Admin Auth
  getAdminPassword() {
    return localStorage.getItem(this.KEYS.ADMIN_PWD) || DEFAULT_SHOP_CONFIG.adminPassword;
  },

  setAdminPassword(newPwd) {
    if (newPwd && newPwd.trim().length >= 4) {
      localStorage.setItem(this.KEYS.ADMIN_PWD, newPwd.trim());
      return true;
    }
    return false;
  }
};
