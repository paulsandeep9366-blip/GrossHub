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

  // Initialize Admin & Rider modules
  if (typeof AdminPanel !== 'undefined') AdminPanel.init();
  if (typeof RiderPanel !== 'undefined') RiderPanel.init();

  // Auto-fill customer details in checkout if available
  const savedCust = Store.getCustomer();
  if (savedCust) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    set('checkoutName', savedCust.name);
    set('checkoutPhone', savedCust.phone);
    set('checkoutAddress', savedCust.address);
    set('checkoutLandmark', savedCust.landmark);
  }
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

  // Free delivery progress meter
  const threshold = config.freeDeliveryThreshold || 499;
  const standardFee = config.deliveryCharge || 30;
  const isFreeDelivery = subtotal >= threshold || (activeCoupon && activeCoupon.type === 'free_delivery');
  const deliveryCharge = isFreeDelivery ? 0 : standardFee;
  const amountNeededForFree = Math.max(0, threshold - subtotal);
  const percentFilled = Math.min(100, Math.round((subtotal / threshold) * 100));

  const progressFill = document.getElementById('freeDeliveryProgressFill');
  const progressText = document.getElementById('freeDeliveryProgressText');

  if (progressFill) progressFill.style.width = `${percentFilled}%`;
  if (progressText) {
    if (isFreeDelivery) {
      progressText.innerHTML = `🎉 <strong>FREE Delivery Unlocked!</strong> You saved ₹${standardFee}.`;
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

// 7. WhatsApp Order Dispatch (Phase 2)
function proceedToWhatsAppOrder(chosenNumber = null) {
  const cart = Store.getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty! Please add some groceries first.', 'warning');
    return;
  }

  const config = Store.getConfig();
  const totals = updateCartBadgeAndDrawer();

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
      notes: 'Ordered via WhatsApp Direct'
    },
    deliverySlot: selectedDeliverySlot,
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
  const deliveryText = totals.deliveryCharge === 0 ? 'FREE' : `₹${totals.deliveryCharge}`;
  const couponText = totals.couponDiscount > 0 ? `\n🏷️ *Promo Code:* ${activeCoupon.code} (-₹${totals.couponDiscount})` : '';

  const message = 
`🛒 *NEW GROCERY ORDER — GROSSHUB*
*Order ID:* ${order.id}
*Store:* Bhattapukur, Agartala

👤 *Customer Details:*
• *Name:* ${customerName}
• *Phone:* ${customerPhone}
• *Delivery Address:* ${customerAddress}
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
  const totals = updateCartBadgeAndDrawer();

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
  const totals = updateCartBadgeAndDrawer();

  // Create order
  const order = Store.createOrder({
    customer: { name, phone: cleanPhone, address, landmark, notes },
    deliverySlot: slot,
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
