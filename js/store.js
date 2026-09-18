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
    ADMIN_PWD: 'grosshub_admin_password',
    RIDER_SESSION: 'grosshub_rider_session',
    RIDER_PIN: 'grosshub_rider_pin',
    CUSTOMER_SESSION: 'grosshub_customer_session'
  },

  // 1. Store Configuration
  getConfig() {
    try {
      const saved = localStorage.getItem(this.KEYS.CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SHOP_CONFIG,
          ...parsed,
          storeLocation: parsed.storeLocation || DEFAULT_SHOP_CONFIG.storeLocation,
          distanceTiers: (parsed.distanceTiers && parsed.distanceTiers.length) ? parsed.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers,
          riderPin: parsed.riderPin || DEFAULT_SHOP_CONFIG.riderPin,
          riders: (parsed.riders && parsed.riders.length) ? parsed.riders : DEFAULT_SHOP_CONFIG.riders
        };
      }
    } catch (e) {
      console.error('Error reading config:', e);
    }
    return { ...DEFAULT_SHOP_CONFIG };
  },

  // Distance-based delivery fee calculation
  calculateDeliveryFee(distanceKm = 1.5, subtotal = 0, coupon = null) {
    const config = this.getConfig();
    const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
    const threshold = config.freeDeliveryThreshold || 499;

    const km = Math.max(0.1, Number(distanceKm) || 1.5);
    let matchedTier = tiers[0];
    for (const tier of tiers) {
      if (km <= tier.maxKm) {
        matchedTier = tier;
        break;
      }
      matchedTier = tier;
    }

    const originalFee = Number(matchedTier.fee) || 0;
    let finalFee = originalFee;
    let isFree = false;
    let isDiscounted = false;
    let discountAmount = 0;

    if (coupon && coupon.type === 'free_delivery') {
      finalFee = 0;
      isFree = true;
      discountAmount = originalFee;
    } else if (subtotal >= threshold) {
      if (km <= 5) {
        finalFee = 0;
        isFree = true;
        discountAmount = originalFee;
      } else {
        discountAmount = Math.min(originalFee, 30);
        finalFee = Math.max(0, originalFee - discountAmount);
        isDiscounted = true;
      }
    }

    return {
      fee: finalFee,
      originalFee,
      isFree: finalFee === 0,
      isDiscounted,
      discountAmount,
      distanceKm: km,
      tier: matchedTier,
      tierLabel: matchedTier.label
    };
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defaultMap = new Map(DEFAULT_PRODUCTS.map(p => [p.id, p]));
          let updatedNeeded = false;
          const updated = parsed.map(p => {
            const def = defaultMap.get(p.id);
            if (def && def.image && (!p.image || p.image !== def.image)) {
              updatedNeeded = true;
              return { ...p, image: def.image };
            }
            return p;
          });
          if (updatedNeeded) {
            localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(updated));
          }
          return updated;
        }
        return parsed;
      }
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
      image: productData.image || '',
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
      deliveryDistanceKm: orderPayload.deliveryDistanceKm !== undefined ? orderPayload.deliveryDistanceKm : 1.5,
      deliveryDistanceLabel: orderPayload.deliveryDistanceLabel || '0 - 2 km (Local)',
      paymentMethod: orderPayload.paymentMethod || 'Cash on Delivery',
      paymentStatus: (orderPayload.paymentMethod && orderPayload.paymentMethod.includes('UPI')) ? 'Paid Online' : 'Pending COD Collection',
      rider: 'Pending Assignment',
      riderPhone: '',
      items: orderPayload.items || [],
      summary: {
        itemCount: orderPayload.items.reduce((acc, item) => acc + item.qty, 0),
        subtotal: orderPayload.subtotal,
        deliveryCharge: orderPayload.deliveryCharge,
        deliveryDistanceKm: orderPayload.deliveryDistanceKm !== undefined ? orderPayload.deliveryDistanceKm : 1.5,
        deliveryDistanceLabel: orderPayload.deliveryDistanceLabel || '0 - 2 km (Local)',
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const products = this.getProducts();
          const pMap = new Map(products.map(p => [p.id, p]));
          return parsed.map(item => {
            if (!item.image) {
              const p = pMap.get(item.id);
              if (p && p.image) return { ...item, image: p.image };
            }
            return item;
          });
        }
        return parsed;
      }
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
  },

  // 8. Rider Authentication & Session
  getRiderPin() {
    return localStorage.getItem(this.KEYS.RIDER_PIN) || this.getConfig().riderPin || "1234";
  },

  setRiderPin(pin) {
    if (pin && String(pin).trim().length >= 4) {
      localStorage.setItem(this.KEYS.RIDER_PIN, String(pin).trim());
      return true;
    }
    return false;
  },

  getRiderPassword() {
    return localStorage.getItem("grosshub_rider_password") || this.getConfig().riderPassword || this.getRiderPin() || "rider123";
  },

  setRiderPassword(pwd) {
    if (pwd && String(pwd).trim().length >= 4) {
      localStorage.setItem("grosshub_rider_password", String(pwd).trim());
      return true;
    }
    return false;
  },

  getRiders() {
    return this.getConfig().riders || DEFAULT_SHOP_CONFIG.riders;
  },

  getRiderSession() {
    try {
      const s = localStorage.getItem(this.KEYS.RIDER_SESSION);
      if (s) return JSON.parse(s);
    } catch(e) {}
    return null;
  },

  setRiderSession(rider) {
    localStorage.setItem(this.KEYS.RIDER_SESSION, JSON.stringify(rider));
  },

  clearRiderSession() {
    localStorage.removeItem(this.KEYS.RIDER_SESSION);
  },

  // 9. Customer Authentication & Session (Session-only: automatically cleared when customer leaves site)
  getCustomerSession() {
    try {
      // Purge any legacy persistent localStorage session
      if (localStorage.getItem(this.KEYS.CUSTOMER_SESSION)) {
        localStorage.removeItem(this.KEYS.CUSTOMER_SESSION);
      }
      const s = sessionStorage.getItem(this.KEYS.CUSTOMER_SESSION);
      if (s) return JSON.parse(s);
    } catch(e) {}
    return null;
  },

  setCustomerSession(customer) {
    try {
      sessionStorage.setItem(this.KEYS.CUSTOMER_SESSION, JSON.stringify(customer));
    } catch(e) {}
    this.saveCustomer(customer);
  },

  clearCustomerSession() {
    try {
      sessionStorage.removeItem(this.KEYS.CUSTOMER_SESSION);
      localStorage.removeItem(this.KEYS.CUSTOMER_SESSION);
    } catch(e) {}
  },

  // 10. Admin Authentication Status
  isAdminLoggedIn() {
    try {
      return sessionStorage.getItem("grosshub_admin_logged_in") === "true";
    } catch(e) {
      return false;
    }
  },

  // Customer alias helper
  setCustomer(customer) {
    this.saveCustomer(customer);
  },

  // 11. Multi-Portal Session Inactivity & Outside-Portal Guard (5-minute timeout)
  SessionGuard: {
    TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes = 300,000 ms
    _guards: {},

    // Register and initialize guard for a portal ('admin', 'rider', 'customer')
    init(portal, options = {}) {
      const KEY_LEFT = `grosshub_${portal}_left_time`;
      const KEY_ACTIVE = `grosshub_${portal}_last_active`;

      const guard = {
        portal,
        isAuth: options.isAuth || (() => false),
        onTimeout: options.onTimeout || (() => {}),
        KEY_LEFT,
        KEY_ACTIVE
      };
      this._guards[portal] = guard;

      const recordActive = () => {
        try {
          if (guard.isAuth()) {
            const now = Date.now();
            localStorage.setItem(KEY_ACTIVE, String(now));
            localStorage.removeItem(KEY_LEFT);
          }
        } catch(e) {}
      };

      const recordLeave = () => {
        try {
          if (guard.isAuth()) {
            // Only set left_time if not already set
            if (!localStorage.getItem(KEY_LEFT)) {
              localStorage.setItem(KEY_LEFT, String(Date.now()));
            }
          }
        } catch(e) {}
      };

      const checkTimeout = () => {
        try {
          if (!guard.isAuth()) {
            return false;
          }

          const now = Date.now();
          const leftStr = localStorage.getItem(KEY_LEFT);
          const activeStr = localStorage.getItem(KEY_ACTIVE);

          let timedOut = false;
          let reason = '';

          if (leftStr) {
            const leftTime = parseInt(leftStr, 10);
            if (leftTime && (now - leftTime >= this.TIMEOUT_MS)) {
              timedOut = true;
              reason = 'outside';
            }
          }

          if (!timedOut && activeStr) {
            const lastActive = parseInt(activeStr, 10);
            if (lastActive && (now - lastActive >= this.TIMEOUT_MS)) {
              timedOut = true;
              reason = 'idle';
            }
          }

          if (timedOut) {
            localStorage.removeItem(KEY_LEFT);
            localStorage.removeItem(KEY_ACTIVE);
            console.warn(`[GrossHub SessionGuard] Portal '${portal}' session timed out (${reason}). Requiring re-login.`);
            try {
              guard.onTimeout(reason);
            } catch(err) {
              console.error(`[GrossHub SessionGuard] onTimeout error in ${portal}:`, err);
            }
            return true;
          } else {
            // Still active and visible: reset leave time and refresh active stamp
            if (document.visibilityState === 'visible') {
              localStorage.removeItem(KEY_LEFT);
              localStorage.setItem(KEY_ACTIVE, String(now));
            }
            return false;
          }
        } catch(e) {
          console.error('[GrossHub SessionGuard] Error checking timeout:', e);
          return false;
        }
      };

      guard.checkTimeout = checkTimeout;
      guard.recordActive = recordActive;
      guard.recordLeave = recordLeave;

      // Activity tracking: resets timer when user interacts with portal
      const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
      let lastRecorded = 0;
      const throttledActive = () => {
        const now = Date.now();
        if (now - lastRecorded > 3000) { // throttle write to every 3s
          lastRecorded = now;
          recordActive();
        }
      };

      events.forEach(evt => {
        window.addEventListener(evt, throttledActive, { passive: true });
      });

      // Tab visibility changes (switching tabs, minimizing browser, phone screen lock)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          recordLeave();
        } else if (document.visibilityState === 'visible') {
          checkTimeout();
        }
      });

      // Window blur & focus (switching apps or desktop windows)
      window.addEventListener('blur', () => {
        recordLeave();
      });

      window.addEventListener('focus', () => {
        checkTimeout();
      });

      // Page hide (tab close or navigating away)
      window.addEventListener('pagehide', () => {
        recordLeave();
      });

      // Periodic check interval (runs every 5 seconds)
      setInterval(() => {
        checkTimeout();
      }, 5000);

      // Perform initial check on initialization
      const didTimeout = checkTimeout();
      if (!didTimeout && guard.isAuth()) {
        recordActive();
      }

      return guard;
    },

    // Manually trigger check for a portal
    check(portal) {
      if (portal && this._guards[portal]) {
        return this._guards[portal].checkTimeout();
      }
      return false;
    },

    // Clear tracking timestamps upon manual logout
    clear(portal) {
      try {
        localStorage.removeItem(`grosshub_${portal}_left_time`);
        localStorage.removeItem(`grosshub_${portal}_last_active`);
      } catch(e) {}
    },

    // Stamp active timestamp upon successful login
    recordLogin(portal) {
      try {
        localStorage.removeItem(`grosshub_${portal}_left_time`);
        localStorage.setItem(`grosshub_${portal}_last_active`, String(Date.now()));
      } catch(e) {}
    }
  }
};
