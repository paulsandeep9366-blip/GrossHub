/**
 * GrossHub - Firebase Firestore Sync Engine
 * Provides real-time bidirectional sync for Orders, Products, and Shop Config
 * across the Customer, Admin, and Rider portals.
 *
 * Architecture:
 *  - LocalStorage remains the primary cache (instant reads, offline support)
 *  - Firestore is the source of truth for shared/cross-device data
 *  - All writes go to LocalStorage first, then async push to Firestore
 *  - Real-time listeners propagate remote changes back to LocalStorage & UI
 */

const FirebaseSync = {
  _db: null,
  _isReady: false,
  _ordersListener: null,
  _productsListener: null,
  _configListener: null,
  _onOrdersChangeCallbacks: [],
  _onProductsChangeCallbacks: [],
  _onConfigChangeCallbacks: [],
  _onStatusChangeCallbacks: [],

  COLLECTIONS: {
    ORDERS: 'orders',
    PRODUCTS: 'products',
    CONFIG: 'config',
  },
  CONFIG_DOC_ID: 'shop_config',

  // ─── Initialization ────────────────────────────────────────────────
  init() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('[FirebaseSync] Firebase SDK not loaded yet.');
        return false;
      }
      let app = null;
      if (firebase.apps && firebase.apps.length > 0) {
        app = firebase.app();
      } else {
        const cfg = (typeof Store !== 'undefined' && Store.getFirebaseConfig)
          ? Store.getFirebaseConfig()
          : (typeof DEFAULT_SHOP_CONFIG !== 'undefined' ? DEFAULT_SHOP_CONFIG.firebaseConfig : null);
        if (cfg && cfg.apiKey && cfg.projectId) {
          app = firebase.initializeApp(cfg);
          console.log('[FirebaseSync] Firebase App initialized with projectId:', cfg.projectId);
        } else {
          console.warn('[FirebaseSync] No valid Firebase configuration found.');
          return false;
        }
      }
      if (!app) return false;
      if (typeof firebase.firestore !== 'function') {
        console.warn('[FirebaseSync] Firestore SDK not loaded.');
        return false;
      }
      this._db = firebase.firestore();
      this._isReady = true;
      console.log('[FirebaseSync] Firestore ready ✓');
      this._notifyStatusChange(true);
      return true;
    } catch (e) {
      console.warn('[FirebaseSync] Init error:', e);
      this._notifyStatusChange(false);
      return false;
    }
  },

  isReady() {
    if (this._isReady && this._db) return true;
    return this.init();
  },

  db() {
    if (!this.isReady()) return null;
    return this._db;
  },

  _notifyProductsChange(products) {
    this._onProductsChangeCallbacks.forEach(cb => { try { cb(products); } catch (e) {} });
  },
  _notifyConfigChange(config) {
    this._onConfigChangeCallbacks.forEach(cb => { try { cb(config); } catch (e) {} });
  },
  _notifyOrdersChange(orders) {
    this._onOrdersChangeCallbacks.forEach(cb => { try { cb(orders); } catch (e) {} });
  },
  _notifyStatusChange(isOnline) {
    this._onStatusChangeCallbacks.forEach(cb => { try { cb(isOnline); } catch (e) {} });
  },
  onStatusChange(cb) {
    if (typeof cb === 'function') {
      this._onStatusChangeCallbacks.push(cb);
      cb(this._isReady && !!this._db);
    }
  },

  // ─── Orders ────────────────────────────────────────────────────────
  async saveOrder(order) {
    const db = this.db();
    if (!db || !order || !order.id) return false;
    try {
      await db.collection(this.COLLECTIONS.ORDERS).doc(order.id).set(order, { merge: true });
      console.log('[FirebaseSync] Order saved:', order.id);
      return true;
    } catch (e) {
      console.error('[FirebaseSync] saveOrder error:', e);
      return false;
    }
  },

  async updateOrder(orderId, updates) {
    const db = this.db();
    if (!db || !orderId || !updates) return false;
    try {
      await db.collection(this.COLLECTIONS.ORDERS).doc(orderId).update(updates);
      console.log('[FirebaseSync] Order updated:', orderId);
      return true;
    } catch (e) {
      try {
        const order = typeof Store !== 'undefined' ? Store.getOrder(orderId) : null;
        if (order) await this.saveOrder({ ...order, ...updates });
      } catch (e2) {}
      return false;
    }
  },

  async deleteOrder(orderId) {
    const db = this.db();
    if (!db || !orderId) return false;
    try {
      await db.collection(this.COLLECTIONS.ORDERS).doc(String(orderId)).delete();
      console.log('[FirebaseSync] Order deleted:', orderId);
      return true;
    } catch (e) {
      console.error('[FirebaseSync] deleteOrder error:', e);
      return false;
    }
  },

  async deleteAllOrders() {
    const db = this.db();
    if (!db) return false;
    try {
      const snapshot = await db.collection(this.COLLECTIONS.ORDERS).get();
      if (snapshot.empty) return true;
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('[FirebaseSync] All orders deleted from Firestore.');
      return true;
    } catch (e) {
      console.error('[FirebaseSync] deleteAllOrders error:', e);
      return false;
    }
  },

  async fetchOrders() {
    const db = this.db();
    if (!db) return null;
    try {
      const snapshot = await db.collection(this.COLLECTIONS.ORDERS).orderBy('createdAt', 'desc').get();
      const orders = [];
      snapshot.forEach(doc => orders.push(doc.data()));
      return orders;
    } catch (e) {
      console.error('[FirebaseSync] fetchOrders error:', e);
      return null;
    }
  },

  startOrdersListener() {
    const db = this.db();
    if (!db || this._ordersListener) return;
    try {
      this._ordersListener = db.collection(this.COLLECTIONS.ORDERS)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
          // processed snapshot immediately
          const orders = [];
          snapshot.forEach(doc => orders.push(doc.data()));
          if (typeof Store !== 'undefined') {
            try { localStorage.setItem(Store.KEYS.ORDERS, JSON.stringify(orders)); } catch (e) {}
          }
          this._onOrdersChangeCallbacks.forEach(cb => { try { cb(orders); } catch (e) {} });
          console.log('[FirebaseSync] Orders synced:', orders.length);
        }, (err) => console.error('[FirebaseSync] Orders listener error:', err));
      console.log('[FirebaseSync] Orders listener started ✓');
    } catch (e) {
      console.error('[FirebaseSync] startOrdersListener error:', e);
    }
  },

  stopOrdersListener() {
    if (this._ordersListener) { this._ordersListener(); this._ordersListener = null; }
  },

  onOrdersChange(cb) {
    if (typeof cb === 'function') {
      this._onOrdersChangeCallbacks.push(cb);
      if (typeof Store !== 'undefined' && Store.getOrders) {
        try {
          const ords = Store.getOrders();
          if (ords && ords.length) cb(ords);
        } catch (e) {}
      }
    }
  },

  // ─── Products ──────────────────────────────────────────────────────
  async saveProducts(products) {
    const db = this.db();
    if (!db || !Array.isArray(products)) return false;
    try {
      const batch = db.batch();
      products.forEach(p => {
        const ref = db.collection(this.COLLECTIONS.PRODUCTS).doc(String(p.id));
        batch.set(ref, p, { merge: true });
      });
      await batch.commit();
      console.log('[FirebaseSync] Products saved:', products.length);
      return true;
    } catch (e) {
      console.error('[FirebaseSync] saveProducts error:', e);
      return false;
    }
  },

  async saveProduct(product) {
    const db = this.db();
    if (!db || !product || !product.id) return false;
    try {
      await db.collection(this.COLLECTIONS.PRODUCTS).doc(String(product.id)).set(product, { merge: true });
      console.log('[FirebaseSync] Product saved:', product.id);
      return true;
    } catch (e) {
      console.error('[FirebaseSync] saveProduct error:', e);
      return false;
    }
  },

  async deleteProduct(productId) {
    const db = this.db();
    if (!db || !productId) return false;
    try {
      await db.collection(this.COLLECTIONS.PRODUCTS).doc(String(productId)).delete();
      console.log('[FirebaseSync] Product deleted:', productId);
      return true;
    } catch (e) {
      console.error('[FirebaseSync] deleteProduct error:', e);
      return false;
    }
  },

  async fetchProducts() {
    const db = this.db();
    if (!db) return null;
    try {
      const snapshot = await db.collection(this.COLLECTIONS.PRODUCTS).get();
      const products = [];
      snapshot.forEach(doc => products.push(doc.data()));
      return products.sort((a, b) => (a.id || 0) - (b.id || 0));
    } catch (e) {
      console.error('[FirebaseSync] fetchProducts error:', e);
      return null;
    }
  },

  startProductsListener() {
    const db = this.db();
    if (!db || this._productsListener) return;
    try {
      this._productsListener = db.collection(this.COLLECTIONS.PRODUCTS)
        .onSnapshot((snapshot) => {
          // processed snapshot immediately
          const products = [];
          snapshot.forEach(doc => products.push(doc.data()));
          products.sort((a, b) => (a.id || 0) - (b.id || 0));
          if (typeof Store !== 'undefined') {
            try { localStorage.setItem(Store.KEYS.PRODUCTS, JSON.stringify(products)); } catch (e) {}
          }
          this._onProductsChangeCallbacks.forEach(cb => { try { cb(products); } catch (e) {} });
          console.log('[FirebaseSync] Products synced:', products.length);
        }, (err) => console.error('[FirebaseSync] Products listener error:', err));
      console.log('[FirebaseSync] Products listener started ✓');
    } catch (e) {
      console.error('[FirebaseSync] startProductsListener error:', e);
    }
  },

  stopProductsListener() {
    if (this._productsListener) { this._productsListener(); this._productsListener = null; }
  },

  onProductsChange(cb) {
    if (typeof cb === 'function') {
      this._onProductsChangeCallbacks.push(cb);
      if (typeof Store !== 'undefined' && Store.getProducts) {
        try {
          const prods = Store.getProducts();
          if (prods && prods.length) cb(prods);
        } catch (e) {}
      }
    }
  },

  // ─── Config ────────────────────────────────────────────────────────
  async saveConfig(config) {
    const db = this.db();
    if (!db || !config) return false;
    try {
      await db.collection(this.COLLECTIONS.CONFIG).doc(this.CONFIG_DOC_ID).set(config, { merge: true });
      console.log('[FirebaseSync] Config saved.');
      return true;
    } catch (e) {
      console.error('[FirebaseSync] saveConfig error:', e);
      return false;
    }
  },

  async fetchConfig() {
    const db = this.db();
    if (!db) return null;
    try {
      const doc = await db.collection(this.COLLECTIONS.CONFIG).doc(this.CONFIG_DOC_ID).get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.error('[FirebaseSync] fetchConfig error:', e);
      return null;
    }
  },

  startConfigListener() {
    const db = this.db();
    if (!db || this._configListener) return;
    try {
      this._configListener = db.collection(this.COLLECTIONS.CONFIG)
        .doc(this.CONFIG_DOC_ID)
        .onSnapshot((doc) => {
          if (!doc.exists) return;
          const config = doc.data();
          if (typeof Store !== 'undefined') {
            try {
              const defaults = typeof DEFAULT_SHOP_CONFIG !== 'undefined' ? DEFAULT_SHOP_CONFIG : {};
              localStorage.setItem(Store.KEYS.CONFIG, JSON.stringify({ ...defaults, ...config }));
            } catch (e) {}
          }
          this._onConfigChangeCallbacks.forEach(cb => { try { cb(config); } catch (e) {} });
          console.log('[FirebaseSync] Config synced.');
        }, (err) => console.error('[FirebaseSync] Config listener error:', err));
      console.log('[FirebaseSync] Config listener started ✓');
    } catch (e) {
      console.error('[FirebaseSync] startConfigListener error:', e);
    }
  },

  stopConfigListener() {
    if (this._configListener) { this._configListener(); this._configListener = null; }
  },

  onConfigChange(cb) {
    if (typeof cb === 'function') {
      this._onConfigChangeCallbacks.push(cb);
      if (typeof Store !== 'undefined' && Store.getConfig) {
        try {
          const cfg = Store.getConfig();
          if (cfg) cb(cfg);
        } catch (e) {}
      }
    }
  },

  // ─── Hydration ─────────────────────────────────────────────────────
  async hydrate() {
    if (!this.isReady()) return;
    try {
      // Orders
      const fsOrders = await this.fetchOrders();
      if (fsOrders && fsOrders.length > 0 && typeof Store !== 'undefined') {
        const localOrders = Store.getOrders();
        const map = new Map();
        fsOrders.forEach(o => map.set(o.id, o));
        localOrders.forEach(o => { if (!map.has(o.id)) map.set(o.id, o); });
        const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        localStorage.setItem(Store.KEYS.ORDERS, JSON.stringify(merged));
        console.log('[FirebaseSync] Orders hydrated:', merged.length);
        this._notifyOrdersChange(merged);
      }
      // Products: overlay Firestore cloud data onto baseline catalog
      const fsProducts = await this.fetchProducts();
      if (fsProducts && fsProducts.length > 0 && typeof Store !== 'undefined') {
        const localProducts = Store.getProducts();
        const map = new Map();
        if (typeof DEFAULT_PRODUCTS !== 'undefined' && Array.isArray(DEFAULT_PRODUCTS)) {
          DEFAULT_PRODUCTS.forEach(p => map.set(Number(p.id), { ...p }));
        }
        if (Array.isArray(localProducts)) {
          localProducts.forEach(p => map.set(Number(p.id), { ...p }));
        }
        fsProducts.forEach(p => map.set(Number(p.id), { ...p }));
        const merged = Array.from(map.values()).sort((a, b) => (a.id || 0) - (b.id || 0));
        localStorage.setItem(Store.KEYS.PRODUCTS, JSON.stringify(merged));
        console.log('[FirebaseSync] Products hydrated:', merged.length);
        this._notifyProductsChange(merged);
      }
      // Config
      const fsConfig = await this.fetchConfig();
      if (fsConfig && typeof Store !== 'undefined') {
        const defaults = typeof DEFAULT_SHOP_CONFIG !== 'undefined' ? DEFAULT_SHOP_CONFIG : {};
        const mergedConfig = { ...defaults, ...fsConfig };
        localStorage.setItem(Store.KEYS.CONFIG, JSON.stringify(mergedConfig));
        console.log('[FirebaseSync] Config hydrated.');
        this._notifyConfigChange(mergedConfig);
      }
    } catch (e) {
      console.warn('[FirebaseSync] Hydration error (non-fatal):', e);
    }
  },

  async start(options = {}) {
    if (!this.isReady()) {
      console.warn('[FirebaseSync] Cannot start — Firestore not ready.');
      return false;
    }
    if (options.onOrdersChange) this.onOrdersChange(options.onOrdersChange);
    if (options.onProductsChange) this.onProductsChange(options.onProductsChange);
    if (options.onConfigChange) this.onConfigChange(options.onConfigChange);
    await this.hydrate();
    this.startOrdersListener();
    this.startProductsListener();
    this.startConfigListener();
    console.log('[FirebaseSync] ✅ All real-time listeners active.');
    return true;
  },

  stop() {
    this.stopOrdersListener();
    this.stopProductsListener();
    this.stopConfigListener();
    console.log('[FirebaseSync] All listeners stopped.');
  },

  // ─── Admin Seed Helpers ────────────────────────────────────────────
  async seedProducts() {
    if (typeof DEFAULT_PRODUCTS === 'undefined') return false;
    return await this.saveProducts(DEFAULT_PRODUCTS);
  },

  async seedConfig() {
    if (typeof DEFAULT_SHOP_CONFIG === 'undefined') return false;
    return await this.saveConfig(DEFAULT_SHOP_CONFIG);
  },

  async seedOrders() {
    if (typeof Store === 'undefined') return false;
    const orders = Store.getOrders();
    if (!orders || !orders.length) return false;
    for (const order of orders) { await this.saveOrder(order); }
    return true;
  }
};

// ─── Auto-Bootstrap ────────────────────────────────────────────────────────────
// Automatically initialize Firebase and start real-time Firestore sync
(function autoStartFirebaseSync() {
  let attempts = 0;
  const maxAttempts = 30;

  function tryStart() {
    attempts++;
    if (
      typeof firebase !== 'undefined' &&
      typeof firebase.firestore === 'function' &&
      (typeof Store !== 'undefined' || typeof DEFAULT_SHOP_CONFIG !== 'undefined')
    ) {
      if (FirebaseSync.init() && FirebaseSync.isReady()) {
        FirebaseSync.start();
        return;
      }
    }
    if (attempts < maxAttempts) {
      setTimeout(tryStart, 200);
    } else {
      console.warn('[FirebaseSync] Firebase unavailable after timeout — running in LocalStorage-only mode.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryStart, 100));
  } else {
    setTimeout(tryStart, 100);
  }
})();
