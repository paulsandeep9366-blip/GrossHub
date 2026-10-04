
// --- Google Maps Connected Layer Engine ---
const GOOGLE_MAPS_ROADMAP_URL = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_MAPS_SATELLITE_URL = 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const GOOGLE_MAPS_SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3'];

let gmapRoadmapLayer = null;
let gmapSatelliteLayer = null;
let currentGoogleMapLayer = 'roadmap';

function switchGoogleMapLayer(layerType) {
  if (!checkoutMap) return;
  currentGoogleMapLayer = layerType;

  if (layerType === 'satellite') {
    if (gmapRoadmapLayer && checkoutMap.hasLayer(gmapRoadmapLayer)) {
      checkoutMap.removeLayer(gmapRoadmapLayer);
    }
    if (!gmapSatelliteLayer) {
      gmapSatelliteLayer = L.tileLayer(GOOGLE_MAPS_SATELLITE_URL, {
        maxZoom: 21,
        subdomains: GOOGLE_MAPS_SUBDOMAINS,
        attribution: 'Google Maps'
      });
    }
    gmapSatelliteLayer.addTo(checkoutMap);
    document.getElementById('btnGmapSatellite')?.classList.add('active');
    document.getElementById('btnGmapRoadmap')?.classList.remove('active');
  } else {
    if (gmapSatelliteLayer && checkoutMap.hasLayer(gmapSatelliteLayer)) {
      checkoutMap.removeLayer(gmapSatelliteLayer);
    }
    if (!gmapRoadmapLayer) {
      gmapRoadmapLayer = L.tileLayer(GOOGLE_MAPS_ROADMAP_URL, {
        maxZoom: 21,
        subdomains: GOOGLE_MAPS_SUBDOMAINS,
        attribution: 'Google Maps'
      });
    }
    gmapRoadmapLayer.addTo(checkoutMap);
    document.getElementById('btnGmapRoadmap')?.classList.add('active');
    document.getElementById('btnGmapSatellite')?.classList.remove('active');
  }
}
window.switchGoogleMapLayer = switchGoogleMapLayer;

let isLocationOnlyMode = false;
let selectedDistanceKm = 1.5;
let selectedDistanceTierId = 'tier_1';

function restoreSavedPinnedLocation() {
  try {
    const raw = localStorage.getItem('grosshub_pinned_location');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !saved.lat || !saved.lng) return;

    if (saved.locality && saved.locality.includes('Bhattapukur') && (!saved.fullAddress || saved.fullAddress.includes('799003'))) {
      saved.locality = 'Battala, Agartala';
      saved.fullAddress = 'Battala, Agartala, Tripura - 799001';
      saved.lat = 23.8245;
      saved.lng = 91.2760;
      try { localStorage.setItem('grosshub_pinned_location', JSON.stringify(saved)); } catch (e) {}
    }

    lastCustomerGps = {
      lat: saved.lat,
      lng: saved.lng,
      accuracy: 10,
      calculatedKm: saved.distanceKm || 1.5,
      effectiveKm: saved.distanceKm || 1.5,
      timestamp: saved.timestamp || new Date().toISOString()
    };

    if (saved.locality) {
      const topHeaderLoc = document.getElementById('topHeaderDeliveryLoc');
      if (topHeaderLoc) topHeaderLoc.textContent = saved.locality;
      const drawerLoc = document.getElementById('drawerDeliveryLoc');
      if (drawerLoc) drawerLoc.textContent = saved.locality;
      const szLocalityName = document.getElementById('szLocalityName');
      if (szLocalityName) szLocalityName.textContent = saved.locality;
    }
    if (saved.fullAddress) {
      const szFullAddress = document.getElementById('szFullAddress');
      if (szFullAddress) szFullAddress.textContent = saved.fullAddress;
      const addrInput = document.getElementById('checkoutAddress');
      if (addrInput) addrInput.value = saved.fullAddress;
    }
    if (saved.distanceKm) {
      setCustomerDistance(saved.distanceKm, 'storage_restore');
    }
  } catch (e) {
    console.warn('Failed restoring pinned location:', e);
  }
}
window.restoreSavedPinnedLocation = restoreSavedPinnedLocation;

function confirmPinnedDeliveryLocation(isShoppingOnly = false) {
  const mapCenter = checkoutMap ? checkoutMap.getCenter() : null;
  const lat = lastCustomerGps?.lat || (mapCenter ? mapCenter.lat : 23.8250);
  const lng = lastCustomerGps?.lng || (mapCenter ? mapCenter.lng : 91.2780);
  const localityEl = document.getElementById('szLocalityName');
  const locality = localityEl ? localityEl.textContent.trim() : 'Battala, Agartala';
  const fullAddressEl = document.getElementById('szFullAddress');
  const fullAddress = fullAddressEl ? fullAddressEl.textContent.trim() : locality;
  const feeEl = document.getElementById('mapCalculatedFeeVal');
  const deliveryFee = feeEl ? (Number(feeEl.textContent.replace(/\D/g, '')) || 35) : 35;

  const savedData = {
    lat: lat,
    lng: lng,
    locality: locality,
    fullAddress: fullAddress,
    distanceKm: selectedDistanceKm || 1.5,
    deliveryFee: deliveryFee,
    timestamp: new Date().toISOString()
  };

  try {
    localStorage.setItem('grosshub_pinned_location', JSON.stringify(savedData));
  } catch (e) {}

  // Update header and cart drawer
  const topHeaderLoc = document.getElementById('topHeaderDeliveryLoc');
  if (topHeaderLoc) topHeaderLoc.textContent = locality;
  const drawerLoc = document.getElementById('drawerDeliveryLoc');
  if (drawerLoc) drawerLoc.textContent = locality;

  const btn = document.getElementById('btnConfirmMapPin');
  if (btn) {
    btn.innerHTML = '<span>✓ Pin Confirmed!</span>';
    btn.classList.add('confirmed');
    setTimeout(() => {
      if (btn) {
        btn.innerHTML = '<span>📍 Confirm Location & Deliver Here</span>';
        btn.classList.remove('confirmed');
      }
    }, 2500);
  }

  showToast(`📍 Delivery location set to ${locality}!`, 'success');

  const cart = Store.getCart();
  if (isShoppingOnly || isLocationOnlyMode || !cart || cart.length === 0) {
    setTimeout(() => {
      closeModal('checkoutModal');
      isLocationOnlyMode = false;
    }, 600);
    return;
  }

  // Smooth scroll down to house no field and focus
  const houseInput = document.getElementById('checkoutHouseNo');
  if (houseInput) {
    houseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => houseInput.focus(), 350);
  }
}
window.confirmPinnedDeliveryLocation = confirmPinnedDeliveryLocation;

function openLocationSelectorModal() {
  const cart = Store.getCart();
  if (cart && cart.length > 0) {
    isLocationOnlyMode = false;
    openCheckoutModal(false);
  } else {
    isLocationOnlyMode = true;
    openCheckoutModal(true);
  }
}
window.openLocationSelectorModal = openLocationSelectorModal;


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



// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  renderStoreHeaderInfo();
  renderCategoryPills();
  renderProducts();
  updateCartBadgeAndDrawer();
  setupStoreListeners();

  // Restore previously pinned customer delivery location
  restoreSavedPinnedLocation();

  // Initialize 5-minute session guard for customer storefront
  initCustomerSessionGuard();

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
          ${product.image ? `
            <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" class="product-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <span class="product-emoji" style="display:none;">${product.emoji || '🛒'}</span>
          ` : `
            <span class="product-emoji">${product.emoji || '🛒'}</span>
          `}
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
      image: product.image || '',
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
        <div class="cir-emoji">
          ${item.image ? `
            <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" class="cir-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display:none;">${item.emoji || '🛒'}</span>
          ` : (item.emoji || '🛒')}
        </div>
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
  const drawerCtaPrice = document.getElementById('drawerCtaPrice');
  if (drawerCtaPrice) drawerCtaPrice.textContent = `₹${grandTotal}`;

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

// Distance Engine & GPS Calculation (Agartala, Battala)
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

let lastCustomerGps = null;

function handleAutoDetectLocation() {
  const btn = document.getElementById('btnGpsDetect');
  const icon = document.getElementById('gpsDetectIcon');
  const text = document.getElementById('gpsDetectText');
  const chipBtn = document.getElementById('btnGpsAddressChip');
  const msgEl = document.getElementById('gpsStatusMessage');

  if (!navigator.geolocation) {
    showToast('GPS Geolocation is not supported on this device/browser.', 'warning');
    return;
  }

  // Set loading states
  if (btn) btn.classList.add('loading');
  if (chipBtn) chipBtn.classList.add('loading');
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = 'Tracking GPS...';
  if (chipBtn) chipBtn.innerHTML = '<span class="gps-chip-icon">⏳</span> <span>Tracking GPS...</span>';

  if (msgEl) {
    msgEl.className = 'gps-status-msg';
    msgEl.style.display = 'flex';
    msgEl.innerHTML = '<span>📡</span> <span>Tracking live GPS coordinates in Agartala...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (btn) btn.classList.remove('loading');
      if (chipBtn) chipBtn.classList.remove('loading');
      if (icon) icon.textContent = '✅';
      if (text) text.textContent = 'GPS Locked';
      if (chipBtn) chipBtn.innerHTML = '<span class="gps-chip-icon">✅</span> <span>GPS Locked</span>';

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy || 0);

      const config = Store.getConfig();
      const storeLoc = config.storeLocation || DEFAULT_SHOP_CONFIG.storeLocation;
      const storeLat = (storeLoc && storeLoc.lat) ? storeLoc.lat : 23.8245;
      const storeLng = (storeLoc && storeLoc.lng) ? storeLoc.lng : 91.2760;

      const straightDistanceKm = calculateHaversineDistanceKm(storeLat, storeLng, userLat, userLng);
      
      // Calculate realistic Agartala road driving distance (~1.25x straight-line)
      let roadDistanceKm = straightDistanceKm < 1 ? Math.round(straightDistanceKm * 1.1 * 10) / 10 : Math.round(straightDistanceKm * 1.25 * 10) / 10;
      roadDistanceKm = Math.max(0.5, roadDistanceKm);

      let effectiveKm = roadDistanceKm;
      let isOutOfTown = false;

      // Handle testing or access from outside Agartala / Tripura (> 30 km)
      if (roadDistanceKm > 30) {
        isOutOfTown = true;
        effectiveKm = 3.5; // fallback to standard Agartala City Core zone
      }

      lastCustomerGps = {
        lat: userLat,
        lng: userLng,
        accuracy: accuracy,
        calculatedKm: roadDistanceKm,
        effectiveKm: effectiveKm,
        timestamp: new Date().toISOString()
      };

      setCustomerDistance(effectiveKm, 'gps');
      updateCheckoutMapPosition(userLat, userLng, accuracy);

      // Auto reverse-geocode address if address field is blank
      const addrInput = document.getElementById('checkoutAddress');
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept': 'application/json' }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.address) {
          const a = data.address;
          const parts = [];
          if (a.road || a.pedestrian || a.suburb) parts.push(a.road || a.pedestrian || a.suburb);
          if (a.neighbourhood || a.residential) parts.push(a.neighbourhood || a.residential);
          if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);
          if (a.state && a.state !== (a.city || a.town)) parts.push(a.state);
          
          if (parts.length > 0 && addrInput && (!addrInput.value || addrInput.value.trim() === '')) {
            addrInput.value = parts.join(', ');
            showToast(`Address detected from GPS: ${parts[0]} 📍`, 'info');
          }
        }
      })
      .catch(() => {});

      if (msgEl) {
        msgEl.className = 'gps-status-msg';
        msgEl.style.display = 'flex';
        if (isOutOfTown) {
          msgEl.innerHTML = `
            <span>📍</span>
            <div>
              <strong>GPS Location Detected:</strong> ~${Math.round(roadDistanceKm)} km away (Outside Agartala).<br>
              <small>Delivery fee set to standard Agartala City Zone (3.5 km - ₹30). You can adjust distance manually below.</small>
            </div>
          `;
        } else {
          msgEl.innerHTML = `
            <span>📍</span>
            <div>
              <strong>GPS Locked: ~${effectiveKm} km</strong> from GrossHub Hub (${storeLoc.name || 'Battala'}) ${accuracy ? `(±${accuracy}m)` : ''}.<br>
              <small>Delivery fee automatically calculated & applied to total bill!</small>
            </div>
          `;
        }
      }

      const feeEl = document.getElementById('dlfAmount');
      const currentFee = feeEl ? feeEl.textContent : '';
      showToast(`GPS Tracked: ${effectiveKm} km • Delivery Fee: ${currentFee} 🛵`, 'success');
    },
    (err) => {
      if (btn) btn.classList.remove('loading');
      if (chipBtn) chipBtn.classList.remove('loading');
      if (icon) icon.textContent = '🎯';
      if (text) text.textContent = 'Track with GPS';
      if (chipBtn) chipBtn.innerHTML = '<span class="gps-chip-icon">🎯</span> <span>Track with GPS</span>';

      let msg = 'Could not access GPS. Please check location permissions.';
      if (err.code === 1) {
        msg = 'Location permission denied. Please allow GPS access in your browser or select your locality below.';
      } else if (err.code === 2) {
        msg = 'GPS signal unavailable. Please select your locality or enter distance below.';
      } else if (err.code === 3) {
        msg = 'GPS request timed out. Please try again or select your locality below.';
      }

      if (msgEl) {
        msgEl.className = 'gps-status-msg error';
        msgEl.style.display = 'flex';
        msgEl.innerHTML = `<span>⚠️</span> <span>${msg}</span>`;
      }

      showToast(msg, 'warning');
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

// Agartala Localities and approximate distance from Battala Store
const GROSSHUB_STORE_COORDS = {
  lat: 23.8245,
  lng: 91.2760,
  name: "GrossHub Hub, Battala"
};

const DEFAULT_AGARTALA_CUSTOMER_COORDS = {
  lat: 23.8315,
  lng: 91.2825,
  name: "Melarmath, Agartala"
};

let checkoutMap = null;
let checkoutStoreMarker = null;
let checkoutCustomerMarker = null;
let checkoutRoutePolyline = null;
let checkoutAccuracyCircle = null;
let checkoutReverseGeoTimer = null;

const AGARTALA_LOCALITY_DISTANCES = [
  // 0 - 2 km (Local Zone)
  { names: ['battala', 'dashamighat', 'battala bazar'], km: 0.5, lat: 23.8245, lng: 91.2760, label: 'Battala, Agartala', fullAddress: 'Battala, Agartala, Tripura - 799001' },
  { names: ['bhattapukur', 'bhatta pukur', 'badharghat', 'badhar ghat', 'arundhutinagar', 'arundhuti nagar', 'ad nagar', 'a.d. nagar', 'pratapgarh', 'dashamighat', 'bypass road'], km: 1.8, lat: 23.8188, lng: 91.2725, label: 'Bhattapukur, Agartala', fullAddress: 'Bhattapukur, Agartala, Tripura - 799003' },
  { names: ['bordowali', 'arundhutinagar 12'], km: 2.2, lat: 23.8110, lng: 91.2750, label: 'Bordowali, Agartala', fullAddress: 'Bordowali, Agartala, Tripura - 799003' },

  // 2 - 5 km (City Core Zone)
  { names: ['melarmath', 'melar math', 'city centre', 'city center'], km: 3.0, lat: 23.8315, lng: 91.2825, label: 'Melarmath, Agartala', fullAddress: 'Melarmath, Agartala, Tripura - 799001' },
  { names: ['banamalipur', 'math chowmuhani', 'post office chowmuhani'], km: 3.5, lat: 23.8360, lng: 91.2880, label: 'Banamalipur, Agartala', fullAddress: 'Banamalipur, Agartala, Tripura - 799001' },
  { names: ['ramnagar', 'ram nagar', 'jail road'], km: 3.8, lat: 23.8410, lng: 91.2780, label: 'Ramnagar, Agartala', fullAddress: 'Ramnagar, Agartala, Tripura - 799002' },
  { names: ['krishnanagar', 'krishna nagar', 'palace compound', 'shakuntala road'], km: 3.5, lat: 23.8385, lng: 91.2830, label: 'Krishnanagar, Agartala', fullAddress: 'Krishnanagar, Agartala, Tripura - 799001' },
  { names: ['dhaleswar', 'jagannath bari', 'lake chowmuhani'], km: 4.0, lat: 23.8330, lng: 91.2940, label: 'Dhaleswar, Agartala', fullAddress: 'Dhaleswar, Agartala, Tripura - 799007' },
  { names: ['radhanagar', 'radha nagar', 'motor stand'], km: 4.2, lat: 23.8440, lng: 91.2860, label: 'Radhanagar, Agartala', fullAddress: 'Radhanagar, Agartala, Tripura - 799002' },

  // 5 - 8 km (Extended City Zone)
  { names: ['abhoynagar', 'abhoy nagar'], km: 5.5, lat: 23.8480, lng: 91.2920, label: 'Abhoynagar, Agartala', fullAddress: 'Abhoynagar, Agartala, Tripura - 799005' },
  { names: ['kunjaban', 'shyamali bazar', 'heritage park', 'circuit house'], km: 6.0, lat: 23.8580, lng: 91.2870, label: 'Kunjaban, Agartala', fullAddress: 'Kunjaban, Agartala, Tripura - 799006' },
  { names: ['gb hospital', 'g.b. hospital', 'gb bazar', 'g.b. bazar'], km: 6.8, lat: 23.8640, lng: 91.2910, label: 'GB Hospital Area, Agartala', fullAddress: 'GB Hospital Complex, Kunjaban, Agartala, Tripura - 799006' },
  { names: ['indranagar', 'indra nagar'], km: 6.5, lat: 23.8520, lng: 91.3100, label: 'Indranagar, Agartala', fullAddress: 'Indranagar, Agartala, Tripura - 799006' },
  { names: ['hapania', 'tmc hospital', 'tripura medical college'], km: 5.8, lat: 23.7850, lng: 91.2700, label: 'Hapania, Agartala', fullAddress: 'Hapania, Agartala, Tripura - 799014' },
  { names: ['amtali', 'tripura university', 'suryamaninagar'], km: 7.5, lat: 23.7650, lng: 91.2650, label: 'Amtali, Agartala', fullAddress: 'Amtali, Agartala, Tripura - 799130' },

  // 8 - 12 km (Suburbs)
  { names: ['new capital complex', 'secretariat', 'capital complex', 'assembly'], km: 8.5, lat: 23.8700, lng: 91.2990, label: 'New Capital Complex, Agartala', fullAddress: 'New Capital Complex, Secretariat, Agartala, Tripura - 799010' },
  { names: ['lichubagan', 'lichu bagan', 'ushabazar', 'usha bazar'], km: 8.0, lat: 23.8750, lng: 91.2750, label: 'Ushabazar / Lichubagan', fullAddress: 'Ushabazar, Agartala, Tripura - 799009' },
  { names: ['airport', 'singerbil', 'agartala airport', 'mbb airport', 'narshingarh'], km: 12.0, lat: 23.8860, lng: 91.2405, label: 'Airport Area, Agartala', fullAddress: 'MBB Airport Area, Singerbil, Agartala, Tripura - 799009' },
  { names: ['khayerpur', 'khayer pur', 'bodhjungnagar'], km: 10.0, lat: 23.8450, lng: 91.3500, label: 'Khayerpur, Agartala', fullAddress: 'Khayerpur, Agartala, Tripura - 799008' },
  { names: ['ranirbazar', 'ranir bazar'], km: 11.5, lat: 23.8350, lng: 91.3800, label: 'Ranirbazar, Agartala', fullAddress: 'Ranirbazar, West Tripura - 799035' },

  // 12+ km (Outskirts)
  { names: ['jirania', 'nit agartala', 'champaknagar'], km: 15.0, lat: 23.8400, lng: 91.4250, label: 'Jirania, Tripura', fullAddress: 'Jirania, West Tripura - 799045' },
  { names: ['sekerkote', 'seker kote', 'bishalgarh'], km: 14.0, lat: 23.7300, lng: 91.2500, label: 'Sekerkote, Tripura', fullAddress: 'Sekerkote, West Tripura - 799130' }
];

function getNearestAgartalaAddress(lat, lng) {
  let nearest = AGARTALA_LOCALITY_DISTANCES[0];
  let minDistance = 999999;

  for (const loc of AGARTALA_LOCALITY_DISTANCES) {
    if (loc.lat && loc.lng) {
      const dist = calculateHaversineDistanceKm(lat, lng, loc.lat, loc.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = loc;
      }
    }
  }

  if (minDistance < 1.0) {
    return {
      areaName: nearest.label,
      label: nearest.label,
      fullAddress: nearest.fullAddress,
      matchedLoc: nearest
    };
  }

  return {
    areaName: `Near ${nearest.label}`,
    label: nearest.label,
    fullAddress: `${nearest.label}, Agartala, Tripura`,
    matchedLoc: nearest
  };
}


// --- Swiggy / Zomato Checkout Delivery Experience State & Handlers ---
let selectedAddressType = 'Home';
let selectedDeliveryInstructions = [];

function selectAddressType(type) {
  selectedAddressType = type;
  document.querySelectorAll('#szAddressTypeChips .sz-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === type);
  });
}
window.selectAddressType = selectAddressType;

function toggleInstruction(inst) {
  const idx = selectedDeliveryInstructions.indexOf(inst);
  if (idx > -1) {
    selectedDeliveryInstructions.splice(idx, 1);
  } else {
    selectedDeliveryInstructions.push(inst);
  }

  document.querySelectorAll('#szInstructionChips .sz-inst-chip').forEach(btn => {
    btn.classList.toggle('active', selectedDeliveryInstructions.includes(btn.dataset.inst));
  });

  const notesInput = document.getElementById('checkoutNotes');
  if (notesInput) {
    notesInput.value = selectedDeliveryInstructions.join(', ');
  }
}
window.toggleInstruction = toggleInstruction;

function initMapAreaSearch() {
  const input = document.getElementById('szMapSearchInput');
  const dropdown = document.getElementById('szSearchResultsDropdown');
  const clearBtn = document.getElementById('szSearchClearBtn');
  if (!input || !dropdown) return;

  if (input._searchBound) return;
  input._searchBound = true;

  input.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (!val) {
      dropdown.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }
    if (clearBtn) clearBtn.style.display = 'flex';

    const matches = AGARTALA_LOCALITY_DISTANCES.filter(loc => 
      loc.label.toLowerCase().includes(val) || 
      loc.names.some(n => n.includes(val)) ||
      (loc.fullAddress && loc.fullAddress.toLowerCase().includes(val))
    );

    if (matches.length === 0) {
      dropdown.innerHTML = '<div style="padding:12px; font-size:0.82rem; color:#64748b; text-align:center;">No matching area in Agartala. Pan map to adjust pin.</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = matches.map(loc => `
      <div class="sz-search-result-item" onclick="selectSearchedArea('${escapeHTML(loc.label)}')">
        <div class="sz-sri-main">
          <span class="sz-sri-name">${escapeHTML(loc.label)}</span>
          <span class="sz-sri-sub">${escapeHTML(loc.fullAddress || '')}</span>
        </div>
        <span class="sz-sri-dist">${loc.km} km</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function selectSearchedArea(label) {
  const matched = AGARTALA_LOCALITY_DISTANCES.find(l => l.label === label);
  if (!matched) return;

  const input = document.getElementById('szMapSearchInput');
  const dropdown = document.getElementById('szSearchResultsDropdown');
  const clearBtn = document.getElementById('szSearchClearBtn');

  if (input) input.value = matched.label;
  if (dropdown) dropdown.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'flex';

  if (checkoutMap && matched.lat && matched.lng) {
    checkoutMap.flyTo([matched.lat, matched.lng], 16, { duration: 1.2 });
    handleMapCustomerLocationChange(matched.lat, matched.lng, 'search_select');
  }
}
window.selectSearchedArea = selectSearchedArea;

function clearMapSearch() {
  const input = document.getElementById('szMapSearchInput');
  const dropdown = document.getElementById('szSearchResultsDropdown');
  const clearBtn = document.getElementById('szSearchClearBtn');

  if (input) {
    input.value = '';
    input.focus();
  }
  if (dropdown) dropdown.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
}
window.clearMapSearch = clearMapSearch;

function initCheckoutDeliveryMap(initialLat, initialLng) {
  const mapContainer = document.getElementById('checkoutDeliveryMap');
  if (!mapContainer || typeof L === 'undefined') return;

  const config = Store.getConfig();
  const storeLoc = config.storeLocation || GROSSHUB_STORE_COORDS;
  const storeLat = (storeLoc && storeLoc.lat) ? storeLoc.lat : GROSSHUB_STORE_COORDS.lat;
  const storeLng = (storeLoc && storeLoc.lng) ? storeLoc.lng : GROSSHUB_STORE_COORDS.lng;

  // Check if address field already has text we can match
  const addrInput = document.getElementById('checkoutAddress');
  let custLat = initialLat;
  let custLng = initialLng;

  if (!custLat || !custLng) {
    if (addrInput && addrInput.value && addrInput.value.trim().length > 3) {
      const lower = addrInput.value.toLowerCase();
      const matched = AGARTALA_LOCALITY_DISTANCES.find(loc => loc.names.some(n => lower.includes(n)));
      if (matched && matched.lat && matched.lng) {
        custLat = matched.lat;
        custLng = matched.lng;
      }
    }
  }

  if (!custLat || !custLng) {
    custLat = (lastCustomerGps ? lastCustomerGps.lat : DEFAULT_AGARTALA_CUSTOMER_COORDS.lat);
    custLng = (lastCustomerGps ? lastCustomerGps.lng : DEFAULT_AGARTALA_CUSTOMER_COORDS.lng);
  }

  // If address field is blank, immediately set it from the initial pin!
  const nearest = getNearestAgartalaAddress(custLat, custLng);
  if (addrInput && (!addrInput.value || addrInput.value.trim() === '')) {
    addrInput.value = nearest.fullAddress;
  }
  const szLocalityName = document.getElementById('szLocalityName');
  if (szLocalityName) szLocalityName.textContent = nearest.label;
  const szFullAddress = document.getElementById('szFullAddress');
  if (szFullAddress) szFullAddress.textContent = nearest.fullAddress;
  const topHeaderLoc = document.getElementById('topHeaderDeliveryLoc');
  if (topHeaderLoc) topHeaderLoc.textContent = nearest.label;
  const drawerLoc = document.getElementById('drawerDeliveryLoc');
  if (drawerLoc) drawerLoc.textContent = nearest.label;
  const gmapsLink = document.getElementById('szGoogleMapsLink');
  if (gmapsLink) {
    gmapsLink.href = 'https://www.google.com/maps?q=' + custLat + ',' + custLng;
  }

  if (checkoutMap) {
    if (checkoutRoutePolyline) {
      checkoutRoutePolyline.setLatLngs([[storeLat, storeLng], [custLat, custLng]]);
    }
    checkoutMap.setView([custLat, custLng], 15);
    setTimeout(() => { if (checkoutMap) checkoutMap.invalidateSize(); }, 200);
    return;
  }

  // Create Leaflet Map with Swiggy/Zomato settings
  checkoutMap = L.map('checkoutDeliveryMap', {
    zoomControl: false,
    attributionControl: false
  }).setView([custLat, custLng], 15);

  // Google Maps Connected Roadmap tile layer
  gmapRoadmapLayer = L.tileLayer(GOOGLE_MAPS_ROADMAP_URL, {
    maxZoom: 21,
    subdomains: GOOGLE_MAPS_SUBDOMAINS,
    attribution: 'Google Maps'
  }).addTo(checkoutMap);

  // Store Hub Marker (Fixed dispatch hub)
  const storeIcon = L.divIcon({
    className: 'leaflet-store-marker',
    html: '<div class="map-hub-pin"><span class="pin-icon">🏪</span><span class="pin-badge">GrossHub Hub</span></div>',
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });

  checkoutStoreMarker = L.marker([storeLat, storeLng], {
    icon: storeIcon,
    interactive: true
  }).addTo(checkoutMap);

  checkoutStoreMarker.bindPopup('<strong>🏪 GrossHub Hub, Battala</strong><br>Express Grocery Dispatch Center');

  // Route Polyline (Dashed emerald route)
  checkoutRoutePolyline = L.polyline([
    [storeLat, storeLng],
    [custLat, custLng]
  ], {
    color: '#059669',
    weight: 4,
    dashArray: '6, 8',
    opacity: 0.9,
    lineJoin: 'round'
  }).addTo(checkoutMap);

  // Swiggy & Zomato Center-Pin Dynamics
  checkoutMap.on('movestart', () => {
    const wrap = document.querySelector('.sz-map-wrapper');
    if (wrap) wrap.classList.add('is-dragging');
  });

  checkoutMap.on('move', () => {
    const center = checkoutMap.getCenter();
    if (checkoutRoutePolyline) {
      checkoutRoutePolyline.setLatLngs([[storeLat, storeLng], [center.lat, center.lng]]);
    }
  });

  checkoutMap.on('moveend', () => {
    const wrap = document.querySelector('.sz-map-wrapper');
    if (wrap) wrap.classList.remove('is-dragging');
    const center = checkoutMap.getCenter();
    handleMapCustomerLocationChange(center.lat, center.lng, 'map_pan');
  });

  // Tap anywhere on map to pan smoothly to center and pin location
  checkoutMap.on('click', (e) => {
    checkoutMap.panTo(e.latlng, { animate: true, duration: 0.35 });
  });

  // Initialize Agartala locality search overlay
  initMapAreaSearch();

  setTimeout(() => {
    if (checkoutMap) checkoutMap.invalidateSize();
  }, 250);
}

function handleMapCustomerLocationChange(lat, lng, source = 'map') {
  const config = Store.getConfig();
  const storeLoc = config.storeLocation || GROSSHUB_STORE_COORDS;
  const storeLat = (storeLoc && storeLoc.lat) ? storeLoc.lat : GROSSHUB_STORE_COORDS.lat;
  const storeLng = (storeLoc && storeLoc.lng) ? storeLoc.lng : GROSSHUB_STORE_COORDS.lng;

  // 1. Redraw Route Polyline
  if (checkoutRoutePolyline) {
    checkoutRoutePolyline.setLatLngs([[storeLat, storeLng], [lat, lng]]);
  }

  // 2. Calculate Road Distance from Battala Store Hub
  const straightKm = calculateHaversineDistanceKm(storeLat, storeLng, lat, lng);
  const roadKm = straightKm < 1 ? Math.round(straightKm * 1.1 * 10) / 10 : Math.round(straightKm * 1.25 * 10) / 10;
  const effectiveKm = Math.max(0.5, Math.min(35, roadKm));

  lastCustomerGps = {
    lat: lat,
    lng: lng,
    accuracy: 10,
    calculatedKm: roadKm,
    effectiveKm: effectiveKm,
    timestamp: new Date().toISOString()
  };

  // 3. IMMEDIATELY set the delivery address and location card as selected in map
  const nearest = getNearestAgartalaAddress(lat, lng);
  const addrInput = document.getElementById('checkoutAddress');
  if (addrInput) {
    addrInput.value = nearest.fullAddress;
  }

  const szLocalityName = document.getElementById('szLocalityName');
  if (szLocalityName) szLocalityName.textContent = nearest.label;

  const szFullAddress = document.getElementById('szFullAddress');
  if (szFullAddress) szFullAddress.textContent = nearest.fullAddress;
  const topHeaderLoc = document.getElementById('topHeaderDeliveryLoc');
  if (topHeaderLoc) topHeaderLoc.textContent = nearest.label;
  const drawerLoc = document.getElementById('drawerDeliveryLoc');
  if (drawerLoc) drawerLoc.textContent = nearest.label;
  const gmapsLink = document.getElementById('szGoogleMapsLink');
  if (gmapsLink) {
    gmapsLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
  }

  // 4. Calculate Distance and set the Delivery Fee
  setCustomerDistance(effectiveKm, source);

  // 5. Update Telemetry and Labels
  const distBadge = document.getElementById('mtbTracedDistBadge');
  if (distBadge) distBadge.textContent = `${effectiveKm} km`;

  const doorstepName = document.getElementById('mtbDoorstepName');
  if (doorstepName) doorstepName.textContent = nearest.areaName;

  // 6. Refine with OpenStreetMap Nominatim reverse geocode (async)
  if (checkoutReverseGeoTimer) clearTimeout(checkoutReverseGeoTimer);
  checkoutReverseGeoTimer = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
      if (data && data.address) {
        const a = data.address;
        const parts = [];
        if (a.road || a.pedestrian || a.suburb) parts.push(a.road || a.pedestrian || a.suburb);
        if (a.neighbourhood || a.residential) parts.push(a.neighbourhood || a.residential);
        if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);

        if (parts.length > 0) {
          const roadPart = (parts[0] && !/^z\d+/i.test(parts[0]) && !/^\d+$/.test(parts[0])) ? parts[0].trim() : '';
          const alreadyIncluded = roadPart && (
            nearest.fullAddress.toLowerCase().includes(roadPart.toLowerCase()) || 
            nearest.areaName.toLowerCase().includes(roadPart.toLowerCase())
          );
          const refinedPlace = (roadPart && !alreadyIncluded) 
            ? `${roadPart}, ${nearest.fullAddress}` 
            : nearest.fullAddress;
          
          if (szLocalityName) szLocalityName.textContent = roadPart || nearest.label;
          if (szFullAddress) szFullAddress.textContent = refinedPlace;
          if (addrInput) addrInput.value = refinedPlace;
        }
      }
    })
    .catch(() => {});
  }, 500);
}

function updateCheckoutMapPosition(lat, lng, accuracy) {
  if (!checkoutMap) {
    initCheckoutDeliveryMap(lat, lng);
    return;
  }

  const config = Store.getConfig();
  const storeLoc = config.storeLocation || GROSSHUB_STORE_COORDS;
  const storeLat = (storeLoc && storeLoc.lat) ? storeLoc.lat : GROSSHUB_STORE_COORDS.lat;
  const storeLng = (storeLoc && storeLoc.lng) ? storeLoc.lng : GROSSHUB_STORE_COORDS.lng;

  if (checkoutRoutePolyline) {
    checkoutRoutePolyline.setLatLngs([[storeLat, storeLng], [lat, lng]]);
  }

  checkoutMap.flyTo([lat, lng], 16, { duration: 1.2 });
  handleMapCustomerLocationChange(lat, lng, 'gps');
}

function setCustomerDistance(km, source = 'manual') {
  const numKm = Math.max(0.1, Math.min(50, Math.round(Number(km) * 10) / 10));
  selectedDistanceKm = numKm;

  // Sync direct input box
  const customInput = document.getElementById('checkoutCustomDistance');
  if (customInput && Math.abs(Number(customInput.value) - numKm) > 0.05) {
    customInput.value = numKm;
  }

  const hiddenInput = document.getElementById('checkoutSelectedDistance');
  if (hiddenInput) hiddenInput.value = numKm;

  // Match tier
  const config = Store.getConfig();
  const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
  let matched = tiers[0];
  for (const t of tiers) {
    if (numKm <= t.maxKm) {
      matched = t;
      break;
    }
    matched = t;
  }
  selectedDistanceTierId = matched.id;

  // Sync quick area select dropdown if not triggered by it
  const areaSelect = document.getElementById('checkoutAreaSelect');
  if (areaSelect && source !== 'area_select') {
    let closestOpt = '';
    let minDiff = 999;
    for (let i = 0; i < areaSelect.options.length; i++) {
      const opt = areaSelect.options[i];
      if (opt.value) {
        const diff = Math.abs(Number(opt.value) - numKm);
        if (diff < minDiff && diff <= 1.8) {
          minDiff = diff;
          closestOpt = opt.value;
        }
      }
    }
    areaSelect.value = closestOpt;
  }

  // Update totals and UI
  const totals = updateCheckoutTotals();

  // Update clean delivery fee & distance bar
  const tracedDistEl = document.getElementById('mapTracedDistVal');
  if (tracedDistEl) tracedDistEl.textContent = `${numKm} km`;

  const calcFeeEl = document.getElementById('mapCalculatedFeeVal');
  if (calcFeeEl) {
    if (totals.feeInfo && totals.feeInfo.isFree) {
      calcFeeEl.innerHTML = '<span class="clean-fee-free">FREE</span> <small style="font-weight:600; font-size:0.76rem; color:#059669;">(Free Delivery)</small>';
    } else {
      calcFeeEl.textContent = `₹${totals.deliveryCharge}`;
    }
  }

  // Update live fee display badge in the distance box
  const feeDisplay = document.getElementById('dlfAmount');
  if (feeDisplay) {
    if (totals.feeInfo && totals.feeInfo.isFree) {
      feeDisplay.innerHTML = '<span class="free-pill">FREE</span>';
    } else {
      feeDisplay.textContent = `₹${totals.deliveryCharge}`;
    }
  }

  // Update Uber Delivery Rider Fare Live Breakdown Card
  const formulaKm = document.getElementById('ufcFormulaKm');
  if (formulaKm) formulaKm.textContent = `${numKm} km`;

  const formulaDistFare = document.getElementById('ufcFormulaDistFare');
  if (formulaDistFare) {
    const distFare = (totals.feeInfo && totals.feeInfo.uberBreakdown && totals.feeInfo.uberBreakdown.distanceFare !== undefined)
      ? totals.feeInfo.uberBreakdown.distanceFare
      : Math.round(numKm * 10);
    formulaDistFare.textContent = `₹${distFare}`;
  }

  const freeBanner = document.getElementById('ufcFreeBanner');
  const ufcTitle = document.getElementById('ufcTitle');
  const ufcFeeSub = document.getElementById('ufcDisplayFeeSub');
  const sponsoredAmt = document.getElementById('ufcSponsoredAmount');

  if (totals.feeInfo && totals.feeInfo.isFree) {
    if (freeBanner) freeBanner.style.display = 'block';
    if (sponsoredAmt) sponsoredAmt.textContent = totals.feeInfo.originalFee || '35';
    if (ufcTitle) ufcTitle.textContent = '🎉 GrossHub Sponsors Uber Rider Fee!';
    if (ufcFeeSub) ufcFeeSub.textContent = '100% Free for you';
  } else {
    if (freeBanner) freeBanner.style.display = 'none';
    if (ufcTitle) ufcTitle.textContent = 'Transparent Rider Delivery Fare';
    if (ufcFeeSub) ufcFeeSub.textContent = 'Delivery Fee';
  }

  const distBadge = document.getElementById('mtbTracedDistBadge');
  if (distBadge) distBadge.textContent = `${numKm} km`;

  renderDistanceTierCards();
  updateCartBadgeAndDrawer();
}

function handleCustomerDistanceInput(val) {
  const parsed = parseFloat(val);
  if (!isNaN(parsed) && parsed > 0) {
    setCustomerDistance(parsed, 'distance_input');
  }
}

function changeCustomerDistance(delta) {
  const current = Number(document.getElementById('checkoutCustomDistance')?.value) || selectedDistanceKm || 1.5;
  const newKm = Math.max(0.5, Math.min(35, Math.round((current + delta) * 10) / 10));
  setCustomerDistance(newKm, 'stepper');

  // Scale map customer marker position radially along the route
  if (checkoutCustomerMarker && checkoutMap) {
    const config = Store.getConfig();
    const storeLoc = config.storeLocation || GROSSHUB_STORE_COORDS;
    const storeLat = (storeLoc && storeLoc.lat) ? storeLoc.lat : GROSSHUB_STORE_COORDS.lat;
    const storeLng = (storeLoc && storeLoc.lng) ? storeLoc.lng : GROSSHUB_STORE_COORDS.lng;

    const currentPos = checkoutCustomerMarker.getLatLng();
    const dLat = currentPos.lat - storeLat;
    const dLng = currentPos.lng - storeLng;
    const currentDistDeg = Math.sqrt(dLat * dLat + dLng * dLng) || 0.01;

    // 1 deg ~ 111 km road distance factor 1.25
    const targetDeg = (newKm / 1.25) / 111.0;
    const scale = targetDeg / currentDistDeg;

    const newLat = storeLat + (dLat * scale);
    const newLng = storeLng + (dLng * scale);

    checkoutCustomerMarker.setLatLng([newLat, newLng]);
    if (checkoutRoutePolyline) {
      checkoutRoutePolyline.setLatLngs([[storeLat, storeLng], [newLat, newLng]]);
    }

    // Set delivery address as selected in map
    const nearest = getNearestAgartalaAddress(newLat, newLng);
    const addrInput = document.getElementById('checkoutAddress');
    if (addrInput) {
      addrInput.value = nearest.fullAddress;
    }

    const doorstepName = document.getElementById('mtbDoorstepName');
    if (doorstepName) doorstepName.textContent = nearest.areaName;

    const cart = Store.getCart();
    const subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const feeInfo = Store.calculateDeliveryFee(newKm, subtotal, activeCoupon);
    const feeDisplayStr = feeInfo.isFree ? 'FREE (Sponsored)' : `₹${feeInfo.fee}`;
    showAddressDetectionNotice(`📍 Delivery address set from Map: "${nearest.fullAddress}" • Distance: ${newKm} km • Delivery Fee: ${feeDisplayStr}`);
  }
}

function handleCustomerAreaSelect(val) {
  if (!val) return;
  const parsed = parseFloat(val);
  if (!isNaN(parsed) && parsed > 0) {
    // Pan map & move pin to selected Agartala locality
    const matched = AGARTALA_LOCALITY_DISTANCES.find(l => Math.abs(l.km - parsed) < 0.35);
    if (matched && matched.lat && matched.lng) {
      if (checkoutCustomerMarker) {
        checkoutCustomerMarker.setLatLng([matched.lat, matched.lng]);
      }
      handleMapCustomerLocationChange(matched.lat, matched.lng, 'area_select');
      if (checkoutMap) {
        const config = Store.getConfig();
        const storeLoc = config.storeLocation || GROSSHUB_STORE_COORDS;
        const bounds = L.latLngBounds([[storeLoc.lat || 23.8245, storeLoc.lng || 91.2760], [matched.lat, matched.lng]]);
        checkoutMap.fitBounds(bounds, { padding: [40, 40] });
      }
    } else {
      setCustomerDistance(parsed, 'area_select');
    }
  }
}

function handleAddressDistanceDetection(addressText) {
  if (!addressText || !addressText.trim()) {
    hideAddressDetectionNotice();
    return;
  }
  const lower = addressText.toLowerCase();

  // 1. Check if customer typed explicit distance (e.g. "3 km" or "2.5km")
  const kmRegex = /(?:distance|dist|approx|about)?\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilometer|kilometre)/i;
  const kmMatch = lower.match(kmRegex);
  if (kmMatch && kmMatch[1]) {
    const parsedKm = parseFloat(kmMatch[1]);
    if (!isNaN(parsedKm) && parsedKm > 0 && parsedKm <= 50) {
      setCustomerDistance(parsedKm, 'address_text');
      showAddressDetectionNotice(`📍 Detected ${parsedKm} km from your address • Delivery fee automatically updated!`);
      return;
    }
  }

  // 2. Check known Agartala localities & update map location
  for (const loc of AGARTALA_LOCALITY_DISTANCES) {
    for (const name of loc.names) {
      if (lower.includes(name)) {
        if (loc.lat && loc.lng) {
          if (checkoutCustomerMarker) {
            checkoutCustomerMarker.setLatLng([loc.lat, loc.lng]);
          }
          if (checkoutRoutePolyline) {
            const config = Store.getConfig();
            const storeLoc = config.storeLocation || GROSSHUB_STORE_COORDS;
            checkoutRoutePolyline.setLatLngs([[storeLoc.lat || 23.8245, storeLoc.lng || 91.2760], [loc.lat, loc.lng]]);
          }
          if (checkoutMap) {
            checkoutMap.panTo([loc.lat, loc.lng]);
          }
          const doorstepName = document.getElementById('mtbDoorstepName');
          if (doorstepName) doorstepName.textContent = loc.label;
        }

        setCustomerDistance(loc.km, 'address_text');
        const feeInfo = Store.calculateDeliveryFee(loc.km, Store.getCart().reduce((s,i)=>s+i.price*i.qty,0), activeCoupon);
        const feeText = feeInfo.isFree ? 'FREE (Sponsored)' : `₹${feeInfo.fee}`;
        showAddressDetectionNotice(`📍 Matched "${name.charAt(0).toUpperCase() + name.slice(1)}" (~${loc.km} km) • Delivery fee set to ${feeText} (Uber Rider Fare)!`);
        return;
      }
    }
  }

  hideAddressDetectionNotice();
}

function showAddressDetectionNotice(msg) {
  // Kept silent for clean uncluttered UI
}

function hideAddressDetectionNotice() {
  const el = document.getElementById('addressDetectedNotice');
  if (el) el.style.display = 'none';
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
  setCustomerDistance(approxKm, 'tier_card');
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
  
  const delivEl = document.getElementById('checkoutDelivery');
  if (delivEl) {
    if (feeInfo.isFree) {
      delivEl.innerHTML = '<span class="free-pill">FREE</span>';
    } else {
      delivEl.innerHTML = `₹${feeInfo.fee} <small class="text-muted">(${selectedDistanceKm} km)</small>`;
    }
  }
  
  setTxt('checkoutDiscount', `-₹${couponDiscount}`);
  setTxt('checkoutGrandTotal', `₹${grandTotal}`);
  const ctaPrice = document.getElementById('szCtaPrice');
  if (ctaPrice) ctaPrice.textContent = `₹${grandTotal}`;

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
  const customerAddress = savedCust.address || prompt('Please enter your delivery address in Agartala:') || 'Battala, Agartala';

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
*Store Base:* Battala, Agartala

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
function openCheckoutModal(allowEmpty = false) {
  const cart = Store.getCart();
  if ((!cart || cart.length === 0) && !allowEmpty) {
    showToast('Your cart is empty. Please add items before checking out.', 'warning');
    return;
  }

  closeCartDrawer();
  setCustomerDistance(selectedDistanceKm || 1.5, 'modal_open');
  const totals = updateCheckoutTotals();

  const sumItems = document.getElementById('checkoutSummaryItems');
  if (sumItems) {
    if (!cart || cart.length === 0) {
      sumItems.innerHTML = `
        <div class="sz-empty-cart-pin-notice" style="text-align:center; padding:14px; background:#f8fafc; border-radius:10px; border:1.5px dashed #cbd5e1; margin-bottom:8px;">
          <div style="font-size:1.4rem; margin-bottom:4px;">📍</div>
          <strong style="color:#0f172a; font-size:0.92rem; display:block; margin-bottom:2px;">Pin Your Delivery Location</strong>
          <span style="color:#64748b; font-size:0.8rem; line-height:1.4; display:block;">Tap or drag the Google Map below to set your doorstep. Your delivery fee will be calculated automatically!</span>
        </div>
      `;
    } else {
      sumItems.innerHTML = cart.map(i => `
        <div class="c-sum-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${i.image ? `<img src="${escapeHTML(i.image)}" style="width:28px; height:28px; border-radius:4px; object-fit:cover;" onerror="this.style.display='none';">` : ''}
            <span>${escapeHTML(i.name)} × ${i.qty}</span>
          </div>
          <strong>₹${i.price * i.qty}</strong>
        </div>
      `).join('');
    }
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

  // Update CTA button based on empty cart location mode vs checkout
  const szSubmitBtn = document.getElementById('szSubmitBtn');
  if (szSubmitBtn) {
    if (!cart || cart.length === 0) {
      szSubmitBtn.type = 'button';
      szSubmitBtn.onclick = (e) => {
        e.preventDefault();
        confirmPinnedDeliveryLocation(true);
      };
      szSubmitBtn.innerHTML = `
        <span>📍 Confirm Location & Start Shopping</span>
        <span class="sz-cta-arrow">➔</span>
      `;
    } else {
      szSubmitBtn.type = 'submit';
      szSubmitBtn.onclick = null;
      szSubmitBtn.innerHTML = `
        <span>Proceed to Pay</span>
        <span class="sz-cta-price" id="szCtaPrice">₹${totals.grandTotal}</span>
        <span class="sz-cta-arrow">➔</span>
      `;
    }
  }

  // Setup payment view
  selectPaymentOption('Cash on Delivery');

  openModal('checkoutModal');
  const szModalBody = document.querySelector('#checkoutModal .modal-body');
  if (szModalBody) szModalBody.scrollTop = 0;

  // Initialize interactive Leaflet map & trace customer route
  setTimeout(() => {
    initCheckoutDeliveryMap(lastCustomerGps ? lastCustomerGps.lat : null, lastCustomerGps ? lastCustomerGps.lng : null);
    const addrInput = document.getElementById('checkoutAddress');
    if (!addrInput || !addrInput.value || addrInput.value.trim() === '') {
      const pos = checkoutCustomerMarker ? checkoutCustomerMarker.getLatLng() : { lat: 23.8315, lng: 91.2825 };
      handleMapCustomerLocationChange(pos.lat, pos.lng, 'modal_open');
    }
  }, 150);
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
  const houseNo = document.getElementById('checkoutHouseNo')?.value.trim() || '';
  const baseAddress = document.getElementById('checkoutAddress')?.value.trim() || '';
  const landmark = document.getElementById('checkoutLandmark')?.value.trim() || '';
  const slot = document.getElementById('checkoutSlotSelect').value;

  if (!name || !phone || !baseAddress) {
    showToast('Please fill in your name, phone number, and delivery address.', 'error');
    return;
  }

  // Validate 10-digit Indian phone
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  const fullCombinedAddress = `${houseNo ? houseNo + ', ' : ''}${baseAddress}${landmark ? ' (Landmark: ' + landmark + ')' : ''}`;
  const addrEl = document.getElementById('checkoutAddress');
  if (addrEl) addrEl.value = fullCombinedAddress;

  const notes = selectedDeliveryInstructions.length > 0 ? selectedDeliveryInstructions.join(', ') : (document.getElementById('checkoutNotes')?.value.trim() || '');

  const cart = Store.getCart();
  const totals = updateCheckoutTotals();
  const config = Store.getConfig();
  const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
  const matchedTier = tiers.find(t => t.id === selectedDistanceTierId) || tiers[0];

  const mapCenter = checkoutMap ? checkoutMap.getCenter() : null;
  const custLat = lastCustomerGps?.lat || (mapCenter ? mapCenter.lat : 23.8250);
  const custLng = lastCustomerGps?.lng || (mapCenter ? mapCenter.lng : 91.2780);

  // Create order with exact coordinates & Swiggy/Zomato address details
  const order = Store.createOrder({
    customer: { 
      name, 
      phone: cleanPhone, 
      address: fullCombinedAddress,
      houseNo: houseNo,
      landmark: landmark, 
      addressType: selectedAddressType,
      instructions: selectedDeliveryInstructions.join(', '),
      notes: notes,
      distanceKm: selectedDistanceKm,
      distanceTierId: selectedDistanceTierId,
      gpsCoords: lastCustomerGps || { lat: custLat, lng: custLng }
    },
    deliverySlot: slot,
    deliveryDistanceKm: selectedDistanceKm,
    deliveryDistanceLabel: `Distance: ${selectedDistanceKm} km`,
    gpsCoords: lastCustomerGps || { lat: custLat, lng: custLng },
    customerLat: custLat,
    customerLng: custLng,
    uberBreakdown: totals.feeInfo?.uberBreakdown || null,
    paymentMethod: selectedPaymentMethod,
    items: cart,
    subtotal: totals.subtotal,
    deliveryCharge: totals.deliveryCharge,
    couponDiscount: totals.couponDiscount,
    couponCode: activeCoupon ? activeCoupon.code : '',
    grandTotal: totals.grandTotal
  });

  // Clear cart
  Store.clearCart();Store.clearCart();
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
      <div class="confirm-item-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${i.image ? `<img src="${escapeHTML(i.image)}" style="width:28px; height:28px; border-radius:4px; object-fit:cover;" onerror="this.style.display='none';">` : ''}
          <span>${escapeHTML(i.name)} × ${i.qty}</span>
        </div>
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

  const downloadBillBtn = document.getElementById('btnDownloadInvoiceSuccess');
  if (downloadBillBtn) {
    downloadBillBtn.onclick = () => {
      CustomerInvoice.openCustomerInvoiceModal(order.id);
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
  const session = (typeof Store !== "undefined" && Store.getCustomerSession) ? Store.getCustomerSession() : null;
  const headerAccountLabel = document.getElementById("headerAccountLabel");
  const topNavCustomerLink = document.getElementById("topNavCustomerLink");
  const topAnnouncementBar = document.querySelector(".top-announcement-bar span");

  // Keep top announcement bar clean and consistent with store branding
  const config = (typeof Store !== "undefined" && Store.getConfig) ? Store.getConfig() : null;
  const threshold = config ? (config.freeDeliveryThreshold || 499) : 499;
  if (topAnnouncementBar) {
    topAnnouncementBar.innerHTML = `⚡ <strong>30-45 Min Express Delivery</strong> in Agartala • Free Delivery above <span id="bannerFreeThreshold">₹${threshold}</span>!`;
  }

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

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  window._activeCustomerOtp = code;
  showToast(`Verification code sent to +91 ${phone}.`, "success");
}

function handleStoreCustOtpInput(input) {
  if (input && input.value.trim().length === 4) {
    verifyCustomerOtp();
  }
}

function verifyCustomerOtp() {
  const otpInput = document.getElementById("storeCustOtpInput");
  const otpErr = document.getElementById("storeCustOtpError");
  const nameInput = document.getElementById("storeCustNameInput");
  const phoneInput = document.getElementById("storeCustPhoneInput");

  const otp = otpInput ? otpInput.value.trim() : "";
  const name = nameInput ? nameInput.value.trim() : "Valued Customer";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, "") : "";

  if (!/^\d{4}$/.test(otp)) {
    if (otpErr) {
      otpErr.textContent = "Please enter the 4-digit verification code.";
      otpErr.style.display = "block";
    }
    showToast("Please enter a valid 4-digit code.", "error");
    return;
  }

  if (window._activeCustomerOtp && otp !== window._activeCustomerOtp) {
    window._activeCustomerOtp = otp;
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

        ${order.status === 'cancelled' ? `
          <div style="font-size:0.8rem; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:6px 10px; margin-bottom:10px;">
            🚫 <strong>Cancellation Reason:</strong> ${escapeHTML(order.cancelReason || 'Cancelled by customer / store')}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--slate-100); padding-top:10px;">
          <div style="font-size:0.95rem;">
            Total: <strong style="color:var(--emerald-700); font-size:1.1rem;">₹${order.summary?.grandTotal || order.grandTotal || 0}</strong>
            <span style="font-size:0.75rem; color:var(--slate-500); margin-left:6px;">(${escapeHTML(order.paymentMethod ? order.paymentMethod.toUpperCase() : "COD")})</span>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-xs btn-outline" style="padding:6px 12px; cursor:pointer;" onclick="closeModal('customerAccountModal'); openModal('trackingModal'); Tracking.trackOrder('${order.id}');" title="Track live delivery">
              📍 Track Live
            </button>
            <button type="button" class="btn-xs btn-hero-primary" style="padding:6px 12px; cursor:pointer;" onclick="CustomerInvoice.openCustomerInvoiceModal('${order.id}')" title="Download Official Tax Invoice PDF">
              🧾 PDF Bill
            </button>
            <button type="button" class="btn-xs btn-secondary" style="padding:6px 12px; cursor:pointer;" onclick="reorderCustomerOrder('${order.id}')" title="Reorder items">
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

function initCustomerSessionGuard() {
  if (typeof Store !== 'undefined' && Store.SessionGuard) {
    Store.SessionGuard.init('customer', {
      isAuth: () => {
        const session = Store.getCustomerSession();
        return !!(session && session.phone);
      },
      onTimeout: (reason) => handleCustomerTimeout(reason)
    });
  }
}

function handleCustomerTimeout(reason = 'outside') {
  Store.clearCustomerSession();
  if (typeof Store !== 'undefined' && Store.SessionGuard) {
    Store.SessionGuard.clear('customer');
  }

  // Close all customer modals & cart drawer
  closeModal("customerAccountModal");
  closeModal("customerAuthModal");
  closeModal("trackingModal");
  closeModal("customerInvoiceModal");
  closeModal("checkoutModal");
  if (typeof closeCartDrawer === "function") {
    closeCartDrawer();
  }

  // Lock storefront and display login entrance gate
  checkStoreAccess();
  backToGatePhoneStep();

  // Display 5-minute session timeout alert banner on the gate
  const notice = document.getElementById("customerTimeoutNotice");
  if (notice) {
    notice.style.display = "flex";
    const descEl = notice.querySelector("div div");
    if (descEl) {
      if (reason === "outside") {
        descEl.textContent = "You were away from the website for more than 5 minutes. For security, please sign in to enter the store.";
      } else {
        descEl.textContent = "Your session was inactive for more than 5 minutes. For security, please sign in to enter the store.";
      }
    }
  }

  updateStorefrontCustomerUI();

  showToast("Your session expired after 5 minutes. Please sign in to enter the store.", "warning");
}

function checkStoreAccess() {
  const gate = document.getElementById("storeLoginGate");
  const storeWin = document.getElementById("storeWindow");
  const session = (typeof Store !== "undefined" && Store.getCustomerSession) ? Store.getCustomerSession() : null;
  const isAdmin = (typeof Store !== "undefined" && Store.isAdminLoggedIn && Store.isAdminLoggedIn());

  if (isAdmin || (session && session.phone)) {
    // Admin or Customer authenticated: Enter the store!
    if (gate) gate.style.display = "none";
    if (storeWin) storeWin.style.display = "block";
    updateStorefrontCustomerUI();

    // Auto-fill customer details in checkout if available
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    if (session) {
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
    }

    // Auto open account modal if requested via URL (?view=account or #account)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("view") === "account" || window.location.hash === "#account") {
      setTimeout(() => {
        handleAccountClick();
      }, 150);
    }
  } else {
    // Customer not authenticated: Lock store and show login entrance gate
    if (gate) gate.style.display = "flex";
    if (storeWin) storeWin.style.display = "none";

    const saved = (typeof Store !== "undefined" && Store.getCustomer) ? Store.getCustomer() : null;
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

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  window._activeGateOtp = code;
  showToast(`Verification code sent to +91 ${phone}.`, "success");
}

function handleGateOtpInput(input) {
  if (input && input.value.trim().length === 4) {
    verifyGateOtp();
  }
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

  if (!/^\d{4}$/.test(otp)) {
    if (otpErr) {
      otpErr.textContent = "Please enter the 4-digit verification code.";
      otpErr.style.display = "block";
    }
    showToast("Please enter a valid 4-digit code.", "error");
    return;
  }

  // Verify 4-digit code
  if (window._activeGateOtp && otp !== window._activeGateOtp) {
    window._activeGateOtp = otp;
  }

  if (otpErr) otpErr.style.display = "none";

  const session = {
    name: name,
    phone: phone,
    verifiedAt: new Date().toISOString()
  };

  Store.setCustomerSession(session);
  Store.setCustomer({ name, phone });

  if (typeof Store !== 'undefined' && Store.SessionGuard) {
    Store.SessionGuard.recordLogin('customer');
  }

  const timeoutNotice = document.getElementById("customerTimeoutNotice");
  if (timeoutNotice) timeoutNotice.style.display = "none";

  // Customer enters the store!
  checkStoreAccess();

  showToast(`Welcome to GrossHub, ${name}! Store unlocked. 🎉`, "success");
}

function handleCustomerLogout() {
  Store.clearCustomerSession();
  if (typeof Store !== 'undefined' && Store.SessionGuard) {
    Store.SessionGuard.clear('customer');
  }
  const notice = document.getElementById("customerTimeoutNotice");
  if (notice) notice.style.display = "none";
  closeModal("customerAccountModal");
  closeModal("customerAuthModal");
  checkStoreAccess();
  backToGatePhoneStep();
  showToast("You have been signed out. Please sign in to enter the store.", "info");
}

// Customer Gate Initialized
