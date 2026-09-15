/**
 * GrossHub - Live Order Tracking & Customer Order History
 * Implements 5-stage tracking timeline, instant lookup by ID or Phone,
 * and 1-click Reorder functionality.
 */

const Tracking = {
  STAGES: [
    { key: 'placed', label: 'Order Placed', desc: 'Order received & logged', icon: '📝' },
    { key: 'confirmed', label: 'Order Confirmed', desc: 'Verified by store manager', icon: '✅' },
    { key: 'preparing', label: 'Packing Items', desc: 'Being packed at Bhattapukur hub', icon: '📦' },
    { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Rider is on the way to you', icon: '🛵' },
    { key: 'delivered', label: 'Delivered', desc: 'Delivered to your address', icon: '🎉' }
  ],

  STAGE_RANKS: {
    'placed': 1,
    'confirmed': 2,
    'preparing': 3,
    'out_for_delivery': 4,
    'delivered': 5,
    'cancelled': -1
  },

  // Search and display order
  trackOrder(query) {
    if (!query || !query.trim()) {
      showToast('Please enter an Order ID (e.g., GH-8102) or 10-digit Phone Number.', 'error');
      return;
    }

    const clean = query.trim();
    let order = null;

    if (clean.toUpperCase().startsWith('GH-') || clean.length <= 7) {
      order = Store.getOrder(clean);
    } else {
      const orders = Store.getOrdersByPhone(clean);
      if (orders.length > 0) {
        order = orders[0]; // Most recent order
      }
    }

    const container = document.getElementById('trackingResultCard');
    const emptyState = document.getElementById('trackingEmptyState');

    if (!order) {
      if (container) container.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
          <div class="tracking-not-found">
            <span class="tnf-icon">🔍</span>
            <h4>No Order Found</h4>
            <p>We couldn't find any orders matching "<strong>${escapeHTML(clean)}</strong>". Please double check your order ID or phone number.</p>
          </div>
        `;
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (container) {
      container.style.display = 'block';
      this.renderOrderTracking(order, container);
    }
  },

  renderOrderTracking(order, container) {
    const isCancelled = order.status === 'cancelled';
    const currentRank = this.STAGE_RANKS[order.status] || 1;

    let stepsHTML = '';
    if (isCancelled) {
      stepsHTML = `
        <div class="cancelled-banner">
          <span class="cb-icon">❌</span>
          <div>
            <strong>This order has been cancelled</strong>
            <p>Please contact our support at 9862272399 or place a new order.</p>
          </div>
        </div>
      `;
    } else {
      stepsHTML = `
        <div class="tracking-stepper">
          ${this.STAGES.map((st, idx) => {
            const stepNum = idx + 1;
            const isCompleted = currentRank > stepNum;
            const isActive = currentRank === stepNum;
            const statusClass = isCompleted ? 'completed' : (isActive ? 'active pulse' : 'upcoming');
            
            // Find timestamp if recorded
            const histItem = (order.statusHistory || []).find(h => h.status === st.key);
            const timeStr = histItem ? histItem.time : '';

            return `
              <div class="stepper-step ${statusClass}">
                <div class="stepper-node">
                  <span class="stepper-icon">${isCompleted ? '✓' : st.icon}</span>
                </div>
                <div class="stepper-info">
                  <div class="stepper-title">${st.label} ${timeStr ? `<span class="stepper-time">${timeStr}</span>` : ''}</div>
                  <div class="stepper-desc">${st.desc}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Items list
    const itemsHTML = (order.items || []).map(item => `
      <div class="track-item-row">
        <span class="ti-name">${escapeHTML(item.name)} <span class="ti-qty">× ${item.qty}</span></span>
        <span class="ti-price">₹${item.subtotal || item.price * item.qty}</span>
      </div>
    `).join('');

    // Rider info if assigned
    const riderHTML = (order.rider && order.rider !== 'Pending Assignment') ? `
      <div class="track-rider-card">
        <div class="rider-avatar">🛵</div>
        <div class="rider-details">
          <div class="rider-title">Delivery Partner</div>
          <div class="rider-name"><strong>${escapeHTML(order.rider)}</strong></div>
          <div class="rider-eta">ETA: 15-25 mins • Bhattapukur Route</div>
        </div>
        ${order.riderPhone ? `<a href="tel:${order.riderPhone}" class="btn-call-rider">📞 Call</a>` : ''}
      </div>
    ` : `
      <div class="track-rider-pending">
        <span>⏱️ Estimated Delivery: <strong>${order.deliverySlot || '30-45 mins'}</strong></span>
      </div>
    `;

    // Cancellation button if still in initial stages
    const canCancel = (order.status === 'placed' || order.status === 'confirmed');
    const cancelBtnHTML = canCancel ? `
      <button class="btn-cancel-order" onclick="Tracking.handleCancelOrder('${order.id}')">
        Cancel Order
      </button>
    ` : '';

    container.innerHTML = `
      <div class="tracking-card-header">
        <div>
          <span class="track-badge ${order.status}">${formatStatusLabel(order.status)}</span>
          <h3 class="track-order-id">${order.id}</h3>
          <span class="track-date">Placed on ${new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="track-total-box">
          <span class="tt-label">Total Amount</span>
          <span class="tt-amount">₹${order.summary?.grandTotal || 0}</span>
          <span class="tt-mode">${order.paymentMethod}</span>
        </div>
      </div>

      ${stepsHTML}

      ${riderHTML}

      <div class="track-delivery-address">
        <div class="address-header">📍 Delivery Address</div>
        <div class="address-body">
          <strong>${escapeHTML(order.customer?.name || '')}</strong> (${order.customer?.phone || ''})<br>
          ${escapeHTML(order.customer?.address || '')}
          ${order.deliveryDistanceLabel ? `<br><span class="text-muted">🛵 Distance Zone: <strong>${escapeHTML(order.deliveryDistanceLabel)}</strong>${order.deliveryDistanceKm ? ` (~${order.deliveryDistanceKm} km)` : ''}</span>` : ''}
          ${order.customer?.notes ? `<br><em>Note: ${escapeHTML(order.customer.notes)}</em>` : ''}
        </div>
      </div>

      <div class="track-items-box">
        <div class="address-header">🛒 Order Items (${order.summary?.itemCount || (order.items || []).length})</div>
        <div class="track-items-list">${itemsHTML}</div>
        <div class="track-summary-totals">
          <div class="row"><span>Item Subtotal:</span> <span>₹${order.summary?.subtotal || 0}</span></div>
          <div class="row"><span>Delivery Fee:</span> <span>${order.summary?.deliveryCharge === 0 ? '<strong class="text-success">FREE</strong>' : `₹${order.summary?.deliveryCharge}`}${order.deliveryDistanceKm ? ` <small class="text-muted">(${order.deliveryDistanceKm} km)</small>` : ''}</span></div>
          ${order.summary?.couponDiscount ? `<div class="row text-success"><span>Promo (${order.summary.couponCode}):</span> <span>-₹${order.summary.couponDiscount}</span></div>` : ''}
          <div class="row grand-total"><span>Final Total:</span> <span>₹${order.summary?.grandTotal || 0}</span></div>
        </div>
      </div>

      <div class="track-actions-footer">
        <button class="btn-secondary" onclick="Tracking.reorderItems('${order.id}')">
          🔁 Reorder These Items
        </button>
        <button class="btn-whatsapp-track" onclick="Tracking.contactSupportForOrder('${order.id}')">
          💬 WhatsApp Support
        </button>
        ${cancelBtnHTML}
      </div>
    `;
  },

  handleCancelOrder(orderId) {
    if (confirm(`Are you sure you want to cancel Order ${orderId}?`)) {
      const reason = prompt('Please let us know the reason for cancellation:') || 'Customer requested cancellation';
      Store.updateOrderStatus(orderId, 'cancelled', null, `Cancelled: ${reason}`);
      showToast(`Order ${orderId} has been cancelled.`, 'info');
      this.trackOrder(orderId);
    }
  },

  // 1-Click Reorder: adds all items of this order to current cart
  reorderItems(orderId) {
    const order = Store.getOrder(orderId);
    if (!order || !order.items) return;

    let addedCount = 0;
    const currentCart = Store.getCart();

    order.items.forEach(pastItem => {
      const existing = currentCart.find(c => c.id === pastItem.id);
      if (existing) {
        existing.qty += pastItem.qty;
      } else {
        // Verify product still exists in catalog
        const product = Store.getProducts().find(p => p.id === pastItem.id);
        if (product && product.inStock) {
          currentCart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            emoji: product.emoji,
            qty: pastItem.qty
          });
        }
      }
      addedCount++;
    });

    Store.saveCart(currentCart);
    if (typeof updateCartBadgeAndDrawer === 'function') {
      updateCartBadgeAndDrawer();
    }
    showToast(`Items from ${orderId} re-added to your cart! 🛒`, 'success');
    closeModal('trackingModal');
    openCartDrawer();
  },

  contactSupportForOrder(orderId) {
    const config = Store.getConfig();
    const phone = config.phone1 || '9862272399';
    const text = encodeURIComponent(`Hello GrossHub, I need help regarding my Order *${orderId}*.`);
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  },

  // Render order history list in customer portal
  renderCustomerHistory(phone) {
    const container = document.getElementById('customerOrderHistoryList');
    if (!container) return;

    if (!phone) {
      container.innerHTML = `<p class="text-muted">Enter your phone number above to view your previous orders.</p>`;
      return;
    }

    const orders = Store.getOrdersByPhone(phone);
    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-history-box">
          <span>📦</span>
          <p>No orders found for <strong>${phone}</strong> yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(o => `
      <div class="history-order-card">
        <div class="hoc-header">
          <div>
            <strong>${o.id}</strong>
            <span class="track-badge ${o.status}">${formatStatusLabel(o.status)}</span>
          </div>
          <span class="hoc-date">${new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div class="hoc-items">
          ${(o.items || []).map(i => `${escapeHTML(i.name)} (${i.qty})`).join(', ')}
        </div>
        <div class="hoc-footer">
          <span class="hoc-price">₹${o.summary?.grandTotal || 0}</span>
          <div class="hoc-actions">
            <button class="btn-xs" onclick="Tracking.trackOrder('${o.id}'); openModal('trackingModal');">Track</button>
            <button class="btn-xs btn-primary-outline" onclick="Tracking.reorderItems('${o.id}')">Reorder</button>
          </div>
        </div>
      </div>
    `).join('');
  }
};

function formatStatusLabel(status) {
  const map = {
    'placed': 'Placed',
    'confirmed': 'Confirmed',
    'preparing': 'Packing',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled'
  };
  return map[status] || status;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
