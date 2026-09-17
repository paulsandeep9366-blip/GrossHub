/**
 * GrossHub - Main Storefront Application Logic (Phases 1, 2, 5 & 6)
 * Handles catalog browsing, live search, cart drawer, dual WhatsApp & web checkout,
 * UPI QR payment flow, and modal controllers.
 */

let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'featured';
let activeCoupon = null; // { code, discount, ... }
let selectedPaymentMethod = 'Cash on Delivery';
let selectedDeliverySlot = 'Instant Delivery (30-45 mins)';
let selectedDistanceKm = 1.5;
let selectedDistanceTierId = 'tier_1';

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  renderStoreHeaderInfo();
  renderCategoryPills();
  renderProducts();
  updateCartBadgeAndDrawer();
  setupStoreListeners();

  // Verify customer authentication and control store window access
  checkStoreAccess();
});

// 1. Store Header & Status
function renderStoreHeaderInfo() {
  const config = Store.getConfig();

  // Shop Name & Taglines
  document.querySelectorAll('.store-name-text').forEach(el => el.textContent = config.shopName);
  document.querySelectorAll('.store-tagline-text').forEach(el => el.textContent = config.tagline);
  document.querySelectorAll('.store-address-text').forEach(el => el.textContent = config.address);

  // Phone Call Links
  const phone1El = document.getElementById('headerPhone1');
  const phone2El = document.getElementById('headerPhone2');
  if (phone1El) {
    phone1El.textContent = `+91 ${config.phone1}`;
    phone1El.href = `tel:${config.phone1}`;
  }
  if (phone2El) {
    phone2El.textContent = `+91 ${config.phone2}`;
    phone2El.href = `tel:${config.phone2}`;
  }

  // Store Hours / Open Status Indicator
  const statusBadge = document.getElementById('storeStatusBadge');
  if (statusBadge) {
    const isExplicitlyOpen = config.serviceStatus !== 'closed';
    // Check operating hours: 8:00 AM - 10:00 PM (8 to 22)
    const now = new Date();
    const currentHour = now.getHours();
    const isWithinHours = (currentHour >= 8 && currentHour < 22);
    const isOpen = isExplicitlyOpen && isWithinHours;

    if (isOpen) {
      statusBadge.className = 'status-pill open';
      statusBadge.innerHTML = `<span class="dot"></span> Open Now • Delivery in ${config.estimatedDeliveryTime || '30-45 mins'}`;
    } else {
      statusBadge.className = 'status-pill closed';
      statusBadge.innerHTML = `<span class="dot"></span> Store Closed • Opens at 8:00 AM`;
    }
  }

  // Free delivery banner ticker
  const tickerThreshold = document.getElementById('bannerFreeThreshold');
  if (tickerThreshold) tickerThreshold.textContent = `₹${config.freeDeliveryThreshold}`;
}

// 2. Category Pills Navigation
function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  if (!container) return;

  const products = Store.getProducts();

  container.innerHTML = CATEGORIES.map(cat => {
    const count = cat.id === 'all' 
      ? products.length 
      : products.filter(p => p.category === cat.id).length;

    const isActive = (cat.id === activeCategory);

    return `
      <button class="cat-pill ${isActive ? 'active' : ''}" onclick="selectCategory('${cat.id}')">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-title">${cat.name}</span>
        <span class="cat-count">${count}</span>
      </button>
    `;
  }).join('');
}

function selectCategory(catId) {
  activeCategory = catId;
  renderCategoryPills();
  renderProducts();

  // Scroll category pill into view smoothly
  const activeBtn = document.querySelector(`.cat-pill.active`);
  if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// 3. Product Catalog Grid
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const countEl = document.getElementById('displayedProductsCount');
  if (!grid) return;

  let products = Store.getProducts();

  // Filter Category
  if (activeCategory !== 'all') {
    products = products.filter(p => p.category === activeCategory);
  }

  // Search Filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.categoryName || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }

  // Sorting
  if (currentSort === 'price-low') {
    products.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-high') {
    products.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'discount') {
    products.sort((a, b) => {
      const discA = a.mrp > a.price ? ((a.mrp - a.price) / a.mrp) : 0;
      const discB = b.mrp > b.price ? ((b.mrp - b.price) / b.mrp) : 0;
      return discB - discA;
    });
  }

  if (countEl) countEl.textContent = `${products.length} Products`;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="no-products-found">
        <span class="np-icon">🥬</span>
        <h3>No matching groceries found</h3>
        <p>Try searching for something else or browse another category.</p>
        <button class="btn-secondary" onclick="resetFilters()">View All Products</button>
      </div>
    `;
    return;
  }

  const cart = Store.getCart();

  grid.innerHTML = products.map(product => {
    const inCartItem = cart.find(c => c.id === product.id);
    const cartQty = inCartItem ? inCartItem.qty : 0;
    const hasDiscount = (product.mrp && product.mrp > product.price);
    const discountPercent = hasDiscount ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

    let buttonActionHTML = '';
    if (!product.inStock) {
      buttonActionHTML = `<button class="btn-add-cart disabled" disabled>Out of Stock</button>`;
    } else if (cartQty > 0) {
      buttonActionHTML = `
        <div class="qty-stepper inline-stepper">
          <button class="btn-step" onclick="changeProductQty(${product.id}, -1)">−</button>
          <span class="qty-num">${cartQty}</span>
          <button class="btn-step" onclick="changeProductQty(${product.id}, 1)">+</button>
        </div>
      `;
    } else {
      buttonActionHTML = `
        <button class="btn-add-cart" onclick="addProductToCart(${product.id})">
          <span class="plus-icon">+</span> Add
        </button>
      `;
    }

    return `
      <div class="product-card ${!product.inStock ? 'out-of-stock' : ''}" data-id="${product.id}">
        <div class="card-visual">
          <span class="product-emoji">${product.emoji || '🛒'}</span>
          ${product.badge ? `<span class="product-badge">${escapeHTML(product.badge)}</span>` : ''}
          ${hasDiscount ? `<span class="discount-badge">${discountPercent}% OFF</span>` : ''}
        </div>
        <div class="card-body">
          <span class="card-cat">${escapeHTML(product.categoryName || 'Grocery')}</span>
          <h3 class="card-title">${escapeHTML(product.name)}</h3>
          <div class="card-unit">${escapeHTML(product.unit)}</div>
          
          <div class="card-footer">
            <div class="price-box">
              <span class="current-price">₹${product.price}</span>
              ${hasDiscount ? `<span class="original-price"><del>₹${product.mrp}</del></span>` : ''}
            </div>
            <div class="card-actions">
              ${buttonActionHTML}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function resetFilters() {
  activeCategory = 'all';
  searchQuery = '';
  const searchInput = document.getElementById('storeSearchInput');
  if (searchInput) searchInput.value = '';
  renderCategoryPills();
  renderProducts();
}

// 4. Cart Operations
function addProductToCart(productId) {
  const products = Store.getProducts();
  const product = products.find(p => p.id === productId);
  if (!product || !product.inStock) return;

  const cart = Store.getCart();
  const existing = cart.find(c => c.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp || product.price,
      unit: product.unit,
      emoji: product.emoji,
      qty: 1
    });
  }

  Store.saveCart(cart);
  updateCartBadgeAndDrawer();
  renderProducts();
  showToast(`Added ${product.name} to cart! 🛍️`, 'success');
}

function changeProductQty(productId, delta) {
  let cart = Store.getCart();
  const index = cart.findIndex(c => c.id === productId);
  if (index === -1) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  Store.saveCart(cart);
  updateCartBadgeAndDrawer();
  renderProducts();
}

function removeCartItem(productId) {
  let cart = Store.getCart();
  cart = cart.filter(c => c.id !== productId);
  Store.saveCart(cart);
  updateCartBadgeAndDrawer();
  renderProducts();
  showToast('Item removed from cart', 'info');
}

// 5. Cart Drawer & Calculation Engine
function updateCartBadgeAndDrawer() {
  const cart = Store.getCart();
  const config = Store.getConfig();

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Floating button & header badge
  document.querySelectorAll('.cart-count-badge').forEach(badge => {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'inline-flex' : 'none';
  });

  const floatSubtotalEl = document.getElementById('floatingCartSubtotal');
  if (floatSubtotalEl) {
    floatSubtotalEl.textContent = `₹${subtotal}`;
  }

  const floatingBar = document.getElementById('floatingCartBar');
  if (floatingBar) {
    floatingBar.classList.toggle('visible', totalItems > 0);
  }

  // Render Drawer contents
  const drawerItems = document.getElementById('cartDrawerItems');
  const emptyState = document.getElementById('cartDrawerEmpty');
  const footerEl = document.getElementById('cartDrawerFooter');

  if (totalItems === 0) {
    if (drawerItems) drawerItems.style.display = 'none';
    if (footerEl) footerEl.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    activeCoupon = null;
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (drawerItems) drawerItems.style.display = 'block';
  if (footerEl) footerEl.style.display = 'block';

  // Distance-aware free delivery progress meter
  const threshold = config.freeDeliveryThreshold || 499;
  const feeInfo = Store.calculateDeliveryFee(selectedDistanceKm, subtotal, activeCoupon);
  const deliveryCharge = feeInfo.fee;
  const amountNeededForFree = Math.max(0, threshold - subtotal);
  const percentFilled = Math.min(100, Math.round((subtotal / threshold) * 100));

  const progressFill = document.getElementById('freeDeliveryProgressFill');
  const progressText = document.getElementById('freeDeliveryProgressText');

  if (progressFill) progressFill.style.width = `${percentFilled}%`;
  if (progressText) {
    if (feeInfo.isFree) {
      progressText.innerHTML = `🎉 <strong>FREE Delivery Unlocked!</strong> You saved ₹${feeInfo.originalFee}.`;
    } else if (feeInfo.isDiscounted) {
      progressText.innerHTML = `🎉 <strong>₹${feeInfo.discountAmount} Distance Subsidy Applied!</strong> (Orders over ₹${threshold})`;
    } else {
      progressText.innerHTML = `Add <strong>₹${amountNeededForFree}</strong> more to unlock <strong>FREE Delivery!</strong>`;
    }
  }

  // Items List in Drawer
  if (drawerItems) {
    drawerItems.innerHTML = cart.map(item => `
      <div class="cart-item-row" data-id="${item.id}">
        <div class="cir-emoji">${item.emoji || '🛒'}</div>
        <div class="cir-details">
          <div class="cir-title">${escapeHTML(item.name)}</div>
          <div class="cir-unit">${escapeHTML(item.unit || '')}</div>
          <div class="cir-price">₹${item.price} <small class="text-muted">× ${item.qty}</small> = <strong>₹${item.price * item.qty}</strong></div>
        </div>
        <div class="cir-controls">
          <div class="qty-stepper">
            <button class="btn-step" onclick="changeProductQty(${item.id}, -1)">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="btn-step" onclick="changeProductQty(${item.id}, 1)">+</button>
          </div>
          <button class="btn-item-remove" onclick="removeCartItem(${item.id})" title="Remove item">✕</button>
        </div>
      </div>
    `).join('');
  }

  // Calculate Coupon Discount
  let couponDiscount = 0;
  if (activeCoupon) {
    const valResult = Store.validateCoupon(activeCoupon.code, subtotal);
    if (valResult.valid) {
      couponDiscount = valResult.discount;
    } else {
      showToast(valResult.message, 'warning');
      activeCoupon = null;
    }
  }

  // Update Coupon Display in UI
  const appliedCouponBox = document.getElementById('appliedCouponBox');
  const appliedCouponText = document.getElementById('appliedCouponText');
  const couponInputRow = document.getElementById('couponInputRow');

  if (activeCoupon && appliedCouponBox && appliedCouponText && couponInputRow) {
    couponInputRow.style.display = 'none';
    appliedCouponBox.style.display = 'flex';
    appliedCouponText.textContent = `${activeCoupon.code} applied (-₹${couponDiscount})`;
  } else if (appliedCouponBox && couponInputRow) {
    appliedCouponBox.style.display = 'none';
    couponInputRow.style.display = 'flex';
  }

  // Grand Total Calculation
  const grandTotal = Math.max(0, subtotal + deliveryCharge - couponDiscount);

  // Set bill summary elements
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('drawerSubtotal', `₹${subtotal}`);
  setTxt('drawerDeliveryFee', deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`);
  setTxt('drawerDiscount', `-₹${couponDiscount}`);
  setTxt('drawerGrandTotal', `₹${grandTotal}`);

  const discRow = document.getElementById('drawerDiscountRow');
  if (discRow) discRow.style.display = couponDiscount > 0 ? 'flex' : 'none';

  return { subtotal, deliveryCharge, couponDiscount, grandTotal, totalItems };
}

// 6. Coupon Application
function applyCoupon() {
  const input = document.getElementById('couponCodeInput');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  const cart = Store.getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const result = Store.validateCoupon(code, subtotal);
  if (result.valid) {
    activeCoupon = result.coupon;
    input.value = '';
    showToast(result.message, 'success');
    updateCartBadgeAndDrawer();
  } else {
    showToast(result.message, 'error');
  }
}

function removeCoupon() {
  activeCoupon = null;
  showToast('Coupon removed', 'info');
  updateCartBadgeAndDrawer();
}

// Distance Engine & GPS Calculation (Agartala, Bhattapukur)
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

function handleAutoDetectLocation() {
  const btn = document.getElementById('btnGpsDetect');
  const icon = document.getElementById('gpsDetectIcon');
  const text = document.getElementById('gpsDetectText');
  const msgEl = document.getElementById('gpsStatusMessage');

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'warning');
    return;
  }

  if (btn) btn.classList.add('loading');
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = 'Detecting...';
  if (msgEl) {
    msgEl.className = 'gps-status-msg';
    msgEl.style.display = 'flex';
    msgEl.innerHTML = '<span>📡</span> <span>Accessing your location in Agartala...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (btn) btn.classList.remove('loading');
      if (icon) icon.textContent = '✅';
      if (text) text.textContent = 'Detected!';

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const config = Store.getConfig();
      const storeLoc = config.storeLocation || DEFAULT_SHOP_CONFIG.storeLocation;
      const storeLat = (storeLoc && storeLoc.lat) ? storeLoc.lat : 23.8188;
      const storeLng = (storeLoc && storeLoc.lng) ? storeLoc.lng : 91.2725;

      const distanceKm = calculateHaversineDistanceKm(storeLat, storeLng, userLat, userLng);
      selectedDistanceKm = distanceKm;

      const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
      let matched = tiers[0];
      for (const t of tiers) {
        if (distanceKm <= t.maxKm) {
          matched = t;
          break;
        }
        matched = t;
      }
      selectedDistanceTierId = matched.id;

      if (msgEl) {
        msgEl.className = 'gps-status-msg';
        msgEl.style.display = 'flex';
        msgEl.innerHTML = `<span>📍</span> <span><strong>${distanceKm} km</strong> from GrossHub Hub (${storeLoc.name || 'Bhattapukur'}). Tier: <strong>${matched.label}</strong></span>`;
      }

      showToast(`Location detected: ~${distanceKm} km from Bhattapukur store! 🛵`, 'success');
      renderDistanceTierCards();
      updateCheckoutTotals();
    },
    (err) => {
      if (btn) btn.classList.remove('loading');
      if (icon) icon.textContent = '🎯';
      if (text) text.textContent = 'Auto-Detect (GPS)';
      if (msgEl) {
        msgEl.className = 'gps-status-msg error';
        msgEl.style.display = 'flex';
        let errMsg = 'Location access denied or unavailable.';
        if (err.code === 1) errMsg = 'Location permission denied. Please tap your distance zone below.';
        msgEl.innerHTML = `<span>⚠️</span> <span>${errMsg}</span>`;
      }
      showToast('Could not get GPS location. Please choose your distance zone below.', 'info');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function renderDistanceTierCards() {
  const container = document.getElementById('distanceTiersContainer');
  if (!container) return;

  const config = Store.getConfig();
  const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
  const cart = Store.getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  container.innerHTML = tiers.map(tier => {
    const isSelected = (tier.id === selectedDistanceTierId);
    const approxKm = tier.maxKm === 999 ? 15 : (tier.maxKm - 0.5);
    const feeInfo = Store.calculateDeliveryFee(approxKm, subtotal, activeCoupon);
    const displayFee = feeInfo.isFree ? 'FREE' : `₹${tier.fee}`;

    return `
      <div class="distance-tier-card ${isSelected ? 'selected' : ''}" 
           onclick="selectDistanceTier('${tier.id}', ${approxKm})">
        <div class="dtc-left">
          <div class="dtc-radio-dot"></div>
          <div>
            <div class="dtc-info-title">${escapeHTML(tier.label)}</div>
            <div class="dtc-info-desc">${escapeHTML(tier.desc)}</div>
          </div>
        </div>
        <div class="dtc-fee-badge ${feeInfo.isFree ? 'free' : ''}">
          ${displayFee}
        </div>
      </div>
    `;
  }).join('');
}

function selectDistanceTier(tierId, approxKm) {
  selectedDistanceTierId = tierId;
  selectedDistanceKm = approxKm;
  const hiddenInput = document.getElementById('checkoutSelectedDistance');
  if (hiddenInput) hiddenInput.value = approxKm;
  renderDistanceTierCards();
  updateCheckoutTotals();
  updateCartBadgeAndDrawer();
}

function updateCheckoutTotals() {
  const cart = Store.getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const feeInfo = Store.calculateDeliveryFee(selectedDistanceKm, subtotal, activeCoupon);

  let couponDiscount = 0;
  if (activeCoupon) {
    const valResult = Store.validateCoupon(activeCoupon.code, subtotal);
    if (valResult.valid) couponDiscount = valResult.discount;
  }

  const grandTotal = Math.max(0, subtotal + feeInfo.fee - couponDiscount);

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('checkoutSubtotal', `₹${subtotal}`);
  setTxt('checkoutDelivery', feeInfo.isFree ? 'FREE' : `₹${feeInfo.fee}`);
  setTxt('checkoutDiscount', `-₹${couponDiscount}`);
  setTxt('checkoutGrandTotal', `₹${grandTotal}`);

  const discRow = document.getElementById('checkoutDiscountRow');
  if (discRow) discRow.style.display = couponDiscount > 0 ? 'flex' : 'none';

  return { subtotal, deliveryCharge: feeInfo.fee, couponDiscount, grandTotal, feeInfo };
}

// 7. WhatsApp Order Dispatch (Phase 2)
function proceedToWhatsAppOrder(chosenNumber = null) {
  const cart = Store.getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty! Please add some groceries first.', 'warning');
    return;
  }

  const config = Store.getConfig();
  const totals = updateCheckoutTotals();
  const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
  const matchedTier = tiers.find(t => t.id === selectedDistanceTierId) || tiers[0];

  // If customer details not filled, ask or prefill
  const savedCust = Store.getCustomer() || {};
  const customerName = savedCust.name || prompt('Please enter your full name:') || 'Customer';
  const customerPhone = savedCust.phone || prompt('Please enter your 10-digit phone number:') || '';
  const customerAddress = savedCust.address || prompt('Please enter your delivery address in Agartala:') || 'Bhattapukur, Agartala';

  // Choose phone number (primary: 9862272399 or fallback 6009430922)
  const targetNumber = chosenNumber || config.whatsappNumber || '919862272399';

  // Create persistent order locally so nothing is lost even if WhatsApp closes
  const order = Store.createOrder({
    customer: {
      name: customerName,
      phone: customerPhone,
      address: customerAddress,
      distanceKm: selectedDistanceKm,
      distanceTierId: selectedDistanceTierId,
      notes: 'Ordered via WhatsApp Direct'
    },
    deliverySlot: selectedDeliverySlot,
    deliveryDistanceKm: selectedDistanceKm,
    deliveryDistanceLabel: matchedTier.label,
    paymentMethod: 'WhatsApp Order (Cash on Delivery)',
    items: cart,
    subtotal: totals.subtotal,
    deliveryCharge: totals.deliveryCharge,
    couponDiscount: totals.couponDiscount,
    couponCode: activeCoupon ? activeCoupon.code : '',
    grandTotal: totals.grandTotal
  });

  // Build clean formatted message
  const itemsText = cart.map(i => `• ${i.name} × ${i.qty} (${i.unit}) — ₹${i.price * i.qty}`).join('\n');
  const deliveryText = totals.deliveryCharge === 0 ? 'FREE' : `₹${totals.deliveryCharge} (${matchedTier.label})`;
  const couponText = totals.couponDiscount > 0 ? `\n🏷️ *Promo Code:* ${activeCoupon.code} (-₹${totals.couponDiscount})` : '';

  const message = 
`🛒 *NEW GROCERY ORDER — GROSSHUB*
*Order ID:* ${order.id}
*Store Base:* Bhattapukur, Agartala

👤 *Customer Details:*
• *Name:* ${customerName}
• *Phone:* ${customerPhone}
• *Delivery Address:* ${customerAddress}
• *Distance Zone:* ${matchedTier.label} (~${selectedDistanceKm} km)
• *Preferred Slot:* ${selectedDeliverySlot}

📦 *Items Ordered:*
${itemsText}

-------------------------------
💰 *Subtotal:* ₹${totals.subtotal}
🚚 *Delivery Fee:* ${deliveryText}${couponText}
⭐ *TOTAL PAYABLE:* ₹${totals.grandTotal}
💵 *Payment Mode:* Cash on Delivery
-------------------------------
Please confirm this order and dispatch. Thank you!`;

  const encoded = encodeURIComponent(message);
  const waUrl = `https://wa.me/${targetNumber}?text=${encoded}`;

  // Clear cart and show notification
  Store.clearCart();
  updateCartBadgeAndDrawer();
  closeCartDrawer();

  // Open WhatsApp in new window
  window.open(waUrl, '_blank');
  showToast(`Order ${order.id} generated! Opening WhatsApp... 🚀`, 'success');

  // Also display the order confirmation modal for customer convenience
  showOrderConfirmationModal(order);
}

// 8. Web Checkout Modal & UPI QR Engine (Phase 1 & 6)
function openCheckoutModal() {
  const cart = Store.getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty. Please add items before checking out.', 'warning');
    return;
  }

  closeCartDrawer();
  renderDistanceTierCards();
  const totals = updateCheckoutTotals();

  const sumItems = document.getElementById('checkoutSummaryItems');
  if (sumItems) {
    sumItems.innerHTML = cart.map(i => `
      <div class="c-sum-row">
        <span>${escapeHTML(i.name)} × ${i.qty}</span>
        <strong>₹${i.price * i.qty}</strong>
      </div>
    `).join('');
  }

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('checkoutSubtotal', `₹${totals.subtotal}`);
  setTxt('checkoutDelivery', totals.deliveryCharge === 0 ? 'FREE' : `₹${totals.deliveryCharge}`);
  setTxt('checkoutDiscount', `-₹${totals.couponDiscount}`);
  setTxt('checkoutGrandTotal', `₹${totals.grandTotal}`);

  const discRow = document.getElementById('checkoutDiscountRow');
  if (discRow) discRow.style.display = totals.couponDiscount > 0 ? 'flex' : 'none';

  // Setup payment view
  selectPaymentOption('Cash on Delivery');

  openModal('checkoutModal');
}

function selectPaymentOption(option) {
  selectedPaymentMethod = option;

  document.querySelectorAll('.payment-option-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.method === option);
  });

  const upiBox = document.getElementById('upiPaymentDetailsBox');
  if (upiBox) {
    if (option === 'Instant UPI') {
      upiBox.style.display = 'block';
      generateUPIQRCode();
    } else {
      upiBox.style.display = 'none';
    }
  }
}

function generateUPIQRCode() {
  const config = Store.getConfig();
  const totals = updateCartBadgeAndDrawer();
  const upiId = config.upiId || '9862272399@upi';
  const shopName = config.shopName || 'GrossHub';
  const amount = totals.grandTotal;

  // Standard UPI URI specification
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('GrossHub Order')}`;

  const qrContainer = document.getElementById('upiQrCodeImage');
  const deepLinkBtn = document.getElementById('btnPayUpiDeepLink');
  const upiIdDisplay = document.getElementById('upiIdDisplay');

  if (qrContainer) {
    // Generate high-resolution SVG QR code via lightweight QR API or direct vector generator
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
    qrContainer.src = qrUrl;
  }

  if (deepLinkBtn) deepLinkBtn.href = upiUri;
  if (upiIdDisplay) upiIdDisplay.textContent = upiId;
}

function handleCheckoutSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('checkoutName').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();
  const address = document.getElementById('checkoutAddress').value.trim();
  const landmark = document.getElementById('checkoutLandmark').value.trim();
  const notes = document.getElementById('checkoutNotes').value.trim();
  const slot = document.getElementById('checkoutSlotSelect').value;

  if (!name || !phone || !address) {
    showToast('Please fill in your name, phone number, and delivery address.', 'error');
    return;
  }

  // Validate 10-digit Indian phone
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  const cart = Store.getCart();
  const totals = updateCheckoutTotals();
  const config = Store.getConfig();
  const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
  const matchedTier = tiers.find(t => t.id === selectedDistanceTierId) || tiers[0];

  // Create order
  const order = Store.createOrder({
    customer: { 
      name, 
      phone: cleanPhone, 
      address, 
      landmark, 
      notes,
      distanceKm: selectedDistanceKm,
      distanceTierId: selectedDistanceTierId
    },
    deliverySlot: slot,
    deliveryDistanceKm: selectedDistanceKm,
    deliveryDistanceLabel: matchedTier.label,
    paymentMethod: selectedPaymentMethod,
    items: cart,
    subtotal: totals.subtotal,
    deliveryCharge: totals.deliveryCharge,
    couponDiscount: totals.couponDiscount,
    couponCode: activeCoupon ? activeCoupon.code : '',
    grandTotal: totals.grandTotal
  });

  // Clear cart
  Store.clearCart();
  activeCoupon = null;
  updateCartBadgeAndDrawer();
  closeModal('checkoutModal');

  // Seamless customer account session linkage
  const currentSession = Store.getCustomerSession();
  if (!currentSession) {
    Store.setCustomerSession({
      name: name,
      phone: cleanPhone,
      address: address,
      landmark: landmark,
      verifiedAt: new Date().toISOString()
    });
    updateStorefrontCustomerUI();
  }

  // Show Confirmation Modal
  showOrderConfirmationModal(order);
  showToast(`Order ${order.id} placed successfully! 🎉`, 'success');
}

// 9. Order Confirmation Screen (Phase 1 & 12)
function showOrderConfirmationModal(order) {
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('confirmOrderId', order.id);
  setTxt('confirmOrderTotal', `₹${order.summary?.grandTotal || 0}`);
  setTxt('confirmCustomerName', order.customer?.name || '');
  setTxt('confirmCustomerPhone', order.customer?.phone || '');
  setTxt('confirmCustomerAddress', order.customer?.address || '');
  setTxt('confirmDeliverySlot', order.deliverySlot || '');
  setTxt('confirmPaymentMethod', order.paymentMethod || '');

  const itemsListEl = document.getElementById('confirmItemsList');
  if (itemsListEl) {
    itemsListEl.innerHTML = (order.items || []).map(i => `
      <div class="confirm-item-row">
        <span>${escapeHTML(i.name)} × ${i.qty}</span>
        <strong>₹${i.price * i.qty}</strong>
      </div>
    `).join('');
  }

  // Setup buttons
  const trackBtn = document.getElementById('btnTrackConfirmedOrder');
  if (trackBtn) {
    trackBtn.onclick = () => {
      closeModal('orderSuccessModal');
      Tracking.trackOrder(order.id);
      openModal('trackingModal');
    };
  }

  const sendWaBtn = document.getElementById('btnSendReceiptWhatsApp');
  if (sendWaBtn) {
    sendWaBtn.onclick = () => {
      const config = Store.getConfig();
      const text = encodeURIComponent(`Hi GrossHub! My Order *${order.id}* for ₹${order.summary?.grandTotal} has been placed. Please confirm delivery to ${order.customer?.address}.`);
      window.open(`https://wa.me/91${config.phone1}?text=${text}`, '_blank');
    };
  }

  openModal('orderSuccessModal');
}

// 10. Event Listeners & Modals
function setupStoreListeners() {
  // Live search input
  const searchInput = document.getElementById('storeSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('storeSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });
  }

  // Checkout slot
  const slotSelect = document.getElementById('checkoutSlotSelect');
  if (slotSelect) {
    slotSelect.addEventListener('change', (e) => {
      selectedDeliverySlot = e.target.value;
    });
  }

  // Checkout form submit
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  }

  // Customer phone lookup
  const custPhoneInput = document.getElementById('custPortalPhoneInput');
  if (custPhoneInput) {
    custPhoneInput.addEventListener('change', (e) => {
      Tracking.renderCustomerHistory(e.target.value);
    });
  }

  // Tracking search
  const trackInput = document.getElementById('trackingSearchInput');
  const trackBtn = document.getElementById('btnDoTracking');
  if (trackBtn && trackInput) {
    trackBtn.addEventListener('click', () => {
      Tracking.trackOrder(trackInput.value);
    });
    trackInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') Tracking.trackOrder(trackInput.value);
    });
  }
}

// Drawer & Modal helpers
function openCartDrawer() {
  updateCartBadgeAndDrawer();
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartDrawerBackdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartDrawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Global Toast Notification
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-pill ${type}`;
  
  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: '💡'
  };

  toast.innerHTML = `
    <span class="t-icon">${iconMap[type] || '💡'}</span>
    <span class="t-msg">${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}


// =======================================================
// UNIFIED CUSTOMER AUTHENTICATION & ACCOUNT PORTAL
// =======================================================

function updateStorefrontCustomerUI() {
  const session = Store.getCustomerSession();
  const headerAccountLabel = document.getElementById("headerAccountLabel");
  const topNavCustomerLink = document.getElementById("topNavCustomerLink");

  if (session && session.name) {
    const firstName = session.name.split(" ")[0];
    if (headerAccountLabel) headerAccountLabel.textContent = firstName;
    if (topNavCustomerLink) topNavCustomerLink.innerHTML = `👤 Hi, ${escapeHTML(firstName)}`;
  } else {
    if (headerAccountLabel) headerAccountLabel.textContent = "Sign In";
    if (topNavCustomerLink) topNavCustomerLink.innerHTML = `👤 Sign In / Account`;
  }
}

function handleAccountClick() {
  const session = Store.getCustomerSession();
  if (session && session.phone) {
    openCustomerAccountModal();
  } else {
    // Pre-fill phone/name if user had previously entered anything
    const saved = Store.getCustomer();
    const nameInput = document.getElementById("storeCustNameInput");
    const phoneInput = document.getElementById("storeCustPhoneInput");
    if (nameInput && saved?.name && !nameInput.value) nameInput.value = saved.name;
    if (phoneInput && saved?.phone && !phoneInput.value) phoneInput.value = saved.phone;

    // Reset OTP step state
    const otpSection = document.getElementById("storeCustomerOtpSection");
    const phoneForm = document.getElementById("storeCustomerPhoneForm");
    const otpInput = document.getElementById("storeCustOtpInput");
    const otpErr = document.getElementById("storeCustOtpError");
    if (otpSection) otpSection.style.display = "none";
    if (phoneForm) phoneForm.style.display = "block";
    if (otpInput) otpInput.value = "";
    if (otpErr) { otpErr.style.display = "none"; otpErr.textContent = ""; }

    openModal("customerAuthModal");
  }
}

function handleSendCustomerOtp(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById("storeCustNameInput");
  const phoneInput = document.getElementById("storeCustPhoneInput");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, "") : "";

  if (!name) {
    showToast("Please enter your full name.", "error");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!phone || phone.length < 10) {
    showToast("Please enter a valid 10-digit mobile number.", "error");
    if (phoneInput) phoneInput.focus();
    return;
  }

  const targetPhoneEl = document.getElementById("storeOtpTargetPhone");
  if (targetPhoneEl) targetPhoneEl.textContent = `+91 ${phone}`;

  const otpSection = document.getElementById("storeCustomerOtpSection");
  const phoneForm = document.getElementById("storeCustomerPhoneForm");
  if (otpSection) otpSection.style.display = "block";
  if (phoneForm) phoneForm.style.display = "none";

  const otpInput = document.getElementById("storeCustOtpInput");
  if (otpInput) {
    otpInput.value = "";
    otpInput.focus();
  }

  showToast(`Demo OTP: 1234 sent to +91 ${phone}! Click Auto-Fill Code.`, "info");
}

function handleStoreCustOtpInput(input) {
  if (input && input.value.trim().length === 4) {
    verifyCustomerOtp();
  }
}

function autoFillCustomerOtp() {
  const otpInput = document.getElementById("storeCustOtpInput");
  const otpErr = document.getElementById("storeCustOtpError");
  if (otpInput) {
    otpInput.value = "1234";
  }
  if (otpErr) {
    otpErr.style.display = "none";
    otpErr.textContent = "";
  }
  // Auto-verify and enter immediately
  verifyCustomerOtp();
}

function verifyCustomerOtp() {
  const otpInput = document.getElementById("storeCustOtpInput");
  const otpErr = document.getElementById("storeCustOtpError");
  const nameInput = document.getElementById("storeCustNameInput");
  const phoneInput = document.getElementById("storeCustPhoneInput");

  const otp = otpInput ? otpInput.value.trim() : "";
  const name = nameInput ? nameInput.value.trim() : "Valued Customer";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, "") : "";

  if (otp !== "1234") {
    if (otpErr) {
      otpErr.textContent = "Invalid OTP. Please enter 1234 (Demo OTP) or click Auto-Fill Code.";
      otpErr.style.display = "block";
    }
    showToast("Incorrect verification code. Please enter 1234.", "error");
    return;
  }

  if (otpErr) otpErr.style.display = "none";

  const session = {
    name: name,
    phone: phone,
    verifiedAt: new Date().toISOString()
  };

  Store.setCustomerSession(session);
  Store.setCustomer({ name, phone });

  updateStorefrontCustomerUI();
  closeModal("customerAuthModal");

  // Pre-fill checkout fields if present
  const chkName = document.getElementById("checkoutName");
  const chkPhone = document.getElementById("checkoutPhone");
  if (chkName && !chkName.value) chkName.value = name;
  if (chkPhone && !chkPhone.value) chkPhone.value = phone;

  showToast(`Welcome, ${name}! Signed in successfully.`, "success");

  // Open the unified account modal immediately
  openCustomerAccountModal();
}

function openCustomerAccountModal() {
  const session = Store.getCustomerSession();
  if (!session) {
    handleAccountClick();
    return;
  }

  const nameEl = document.getElementById("unifiedCustName");
  const metaEl = document.getElementById("unifiedCustMeta");
  if (nameEl) nameEl.textContent = session.name || "Valued Customer";
  if (metaEl) metaEl.textContent = `+91 ${session.phone || ""} • Verified Customer • Agartala`;

  renderUnifiedCustomerOrders(session.phone);
  openModal("customerAccountModal");
}

function renderUnifiedCustomerOrders(phone) {
  const container = document.getElementById("unifiedOrderHistoryList");
  const countBadge = document.getElementById("unifiedOrderCountBadge");
  if (!container) return;

  if (!phone) {
    container.innerHTML = `<p style="color:var(--slate-500); text-align:center; padding:20px;">No phone number associated with account.</p>`;
    return;
  }

  const orders = Store.getOrdersByPhone(phone) || [];
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (countBadge) {
    countBadge.textContent = `${orders.length} Order${orders.length === 1 ? "" : "s"}`;
  }

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 16px; background: var(--slate-50); border-radius: var(--radius-lg); border: 1px dashed var(--slate-300);">
        <div style="font-size: 2.8rem; margin-bottom: 8px;">🛍️</div>
        <h4 style="margin: 0 0 6px 0; font-size: 1.1rem; color: var(--slate-800);">No orders placed yet</h4>
        <p style="color: var(--slate-500); font-size: 0.88rem; max-width: 360px; margin: 0 auto 16px auto;">
          Explore our fresh local vegetables, dairy, pantry staples, and get fast delivery in Agartala!
        </p>
        <button type="button" class="btn-hero-primary" style="padding: 10px 20px; cursor: pointer;" onclick="closeModal('customerAccountModal'); const ps = document.getElementById('productsSection'); if (ps) ps.scrollIntoView({behavior:'smooth'});">
          Explore Groceries ➔
        </button>
      </div>
    `;
    return;
  }

  const statusMap = {
    "placed": { label: "Order Placed", color: "#3b82f6", bg: "#eff6ff" },
    "confirmed": { label: "Confirmed", color: "#8b5cf6", bg: "#f5f3ff" },
    "preparing": { label: "Packing Items", color: "#f59e0b", bg: "#fffbeb" },
    "out_for_delivery": { label: "Out for Delivery 🛵", color: "#0ea5e9", bg: "#f0f9ff" },
    "delivered": { label: "Delivered 🎉", color: "#10b981", bg: "#ecfdf5" },
    "cancelled": { label: "Cancelled", color: "#ef4444", bg: "#fef2f2" }
  };

  container.innerHTML = orders.map(order => {
    const st = statusMap[order.status] || { label: order.status, color: "#64748b", bg: "#f8fafc" };
    const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const itemsSummary = (order.items || []).map(i => `${escapeHTML(i.name)} × ${i.qty}`).join(", ");

    return `
      <div class="history-order-card" style="background:var(--white); border:1px solid var(--slate-200); border-radius:var(--radius-md); padding:16px; margin-bottom:14px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:700; font-size:1.02rem; color:var(--slate-800);">${escapeHTML(order.id)}</div>
            <div style="font-size:0.8rem; color:var(--slate-500);">${dateFormatted}</div>
          </div>
          <span style="font-size:0.8rem; font-weight:600; padding:4px 10px; border-radius:20px; background:${st.bg}; color:${st.color}; border:1px solid ${st.color}33;">
            ${st.label}
          </span>
        </div>

        <div style="font-size:0.88rem; color:var(--slate-600); margin-bottom:12px; line-height:1.4; background:var(--slate-50); padding:10px 12px; border-radius:var(--radius-sm);">
          <strong>Items:</strong> ${itemsSummary || "Standard grocery package"}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--slate-100); padding-top:10px;">
          <div style="font-size:0.95rem;">
            Total: <strong style="color:var(--emerald-700); font-size:1.1rem;">₹${order.summary?.grandTotal || order.grandTotal || 0}</strong>
            <span style="font-size:0.75rem; color:var(--slate-500); margin-left:6px;">(${escapeHTML(order.paymentMethod ? order.paymentMethod.toUpperCase() : "COD")})</span>
          </div>

          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-xs btn-outline" style="padding:6px 12px; cursor:pointer;" onclick="closeModal('customerAccountModal'); openModal('trackingModal'); Tracking.trackOrder('${order.id}');">
              📍 Track Live
            </button>
            <button type="button" class="btn-xs btn-hero-primary" style="padding:6px 12px; cursor:pointer;" onclick="reorderCustomerOrder('${order.id}')">
              🔁 Reorder
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function reorderCustomerOrder(orderId) {
  if (typeof Tracking !== "undefined" && Tracking.reorderItems) {
    Tracking.reorderItems(orderId);
    updateCartBadgeAndDrawer();
    closeModal("customerAccountModal");
    openCartDrawer();
  } else {
    showToast("Reorder service unavailable.", "error");
  }
}

// =======================================================
// STORE ENTRANCE GATE & AUTHENTICATION ACCESS CONTROL
// =======================================================

function checkStoreAccess() {
  const session = Store.getCustomerSession();
  const gate = document.getElementById("storeLoginGate");
  const storeWin = document.getElementById("storeWindow");

  if (session && session.phone) {
    if (gate) gate.style.display = "none";
    if (storeWin) storeWin.style.display = "block";
    updateStorefrontCustomerUI();

    // Auto-fill customer details in checkout if available
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    set("checkoutName", session.name);
    set("checkoutPhone", session.phone);
    set("checkoutAddress", session.address);
    set("checkoutLandmark", session.landmark);
    if (session.distanceKm) {
      selectedDistanceKm = Number(session.distanceKm) || 1.5;
    }
    if (session.distanceTierId) {
      selectedDistanceTierId = session.distanceTierId;
    }

    // Auto open account modal if requested via URL (?view=account or #account)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("view") === "account" || window.location.hash === "#account") {
      setTimeout(() => {
        handleAccountClick();
      }, 150);
    }
  } else {
    // Lock store window and display login entrance gate
    if (gate) gate.style.display = "flex";
    if (storeWin) storeWin.style.display = "none";

    // Pre-populate fields if saved previously
    const saved = Store.getCustomer();
    const gateName = document.getElementById("gateNameInput");
    const gatePhone = document.getElementById("gatePhoneInput");
    if (gateName && saved?.name && !gateName.value) gateName.value = saved.name;
    if (gatePhone && saved?.phone && !gatePhone.value) gatePhone.value = saved.phone;
  }
}

function handleGateSendOtp(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById("gateNameInput");
  const phoneInput = document.getElementById("gatePhoneInput");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, "") : "";

  if (!name) {
    showToast("Please enter your full name.", "error");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!phone || phone.length < 10) {
    showToast("Please enter a valid 10-digit mobile number.", "error");
    if (phoneInput) phoneInput.focus();
    return;
  }

  const targetEl = document.getElementById("gateTargetPhone");
  if (targetEl) targetEl.textContent = `+91 ${phone}`;

  const otpSection = document.getElementById("gateOtpSection");
  const phoneForm = document.getElementById("gatePhoneForm");
  if (otpSection) otpSection.style.display = "block";
  if (phoneForm) phoneForm.style.display = "none";

  const otpInput = document.getElementById("gateOtpInput");
  if (otpInput) {
    otpInput.value = "";
    otpInput.focus();
  }

  showToast(`Demo OTP: 1234 sent to +91 ${phone}! Click Auto-Fill Code.`, "info");
}

function handleGateOtpInput(input) {
  if (input && input.value.trim().length === 4) {
    verifyGateOtp();
  }
}

function autoFillGateOtp() {
  const otpInput = document.getElementById("gateOtpInput");
  const otpErr = document.getElementById("gateOtpError");
  if (otpInput) {
    otpInput.value = "1234";
  }
  if (otpErr) {
    otpErr.style.display = "none";
    otpErr.textContent = "";
  }
  // Auto-verify and enter immediately
  verifyGateOtp();
}

function backToGatePhoneStep() {
  const otpSection = document.getElementById("gateOtpSection");
  const phoneForm = document.getElementById("gatePhoneForm");
  const otpErr = document.getElementById("gateOtpError");
  if (otpSection) otpSection.style.display = "none";
  if (phoneForm) phoneForm.style.display = "block";
  if (otpErr) {
    otpErr.style.display = "none";
    otpErr.textContent = "";
  }
}

function verifyGateOtp() {
  const otpInput = document.getElementById("gateOtpInput");
  const otpErr = document.getElementById("gateOtpError");
  const nameInput = document.getElementById("gateNameInput");
  const phoneInput = document.getElementById("gatePhoneInput");

  const otp = otpInput ? otpInput.value.trim() : "";
  const name = nameInput ? nameInput.value.trim() : "Valued Customer";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, "") : "";

  if (otp !== "1234") {
    if (otpErr) {
      otpErr.textContent = "Invalid OTP. Please enter 1234 (Demo OTP) or click Auto-Fill Code.";
      otpErr.style.display = "block";
    }
    showToast("Incorrect verification code. Please enter 1234.", "error");
    return;
  }

  if (otpErr) otpErr.style.display = "none";

  const session = {
    name: name,
    phone: phone,
    verifiedAt: new Date().toISOString()
  };

  Store.setCustomerSession(session);
  Store.setCustomer({ name, phone });

  // Unlock store window
  checkStoreAccess();

  showToast(`Welcome to GrossHub, ${name}! Store unlocked. 🎉`, "success");
}

function handleCustomerLogout() {
  Store.clearCustomerSession();
  closeModal("customerAccountModal");
  closeModal("customerAuthModal");
  checkStoreAccess();
  backToGatePhoneStep();
  showToast("You have been signed out. Please sign in to enter the store.", "info");
}
