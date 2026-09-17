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
      <div class="track-item-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${item.image ? `<img src="${escapeHTML(item.image)}" style="width:28px; height:28px; border-radius:4px; object-fit:cover;" onerror="this.style.display='none';">` : ''}
          <span class="ti-name">${escapeHTML(item.name)} <span class="ti-qty">× ${item.qty}</span></span>
        </div>
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

      <div class="track-actions-footer" style="flex-wrap: wrap; gap: 8px;">
        <button class="btn-hero-primary" onclick="CustomerInvoice.openCustomerInvoiceModal('${order.id}')" title="Download Official Tax Invoice PDF">
          🧾 Download PDF Bill
        </button>
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
            image: product.image || '',
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


// Customer Tax Invoice & Bill PDF Generator
const CustomerInvoice = {
  openCustomerInvoiceModal(orderId) {
    if (!orderId) {
      showToast('Order ID is missing.', 'warning');
      return;
    }

    const order = Store.getOrder(orderId);
    if (!order) {
      showToast('Order details not found.', 'warning');
      return;
    }

    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const orderTime = new Date(order.createdAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const isPaid = order.paymentMethod !== 'COD';
    const items = order.items || [];

    const html = `
      <div class="invoice-paper" id="customerInvoiceDoc">
        <!-- Top Invoice Header -->
        <div class="inv-header">
          <div class="inv-brand">
            <h2>🥬 GrossHub</h2>
            <p><strong>GrossHub Quick Commerce Private Limited</strong></p>
            <p>Fulfillment Hub: Bhattapukur, Agartala, Tripura West - 799003</p>
            <p>GSTIN: <strong>16AABCG1234F1Z0</strong> • FSSAI Lic: <strong>21623001000452</strong></p>
            <p>Helpline: <strong>+91 98622 72399</strong> • Email: support@grosshub.in</p>
          </div>
          <div class="inv-meta">
            <div class="inv-badge-title">TAX INVOICE & BILL</div>
            <p style="margin-top: 6px;"><strong>Invoice No:</strong> INV-${order.id}</p>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Date:</strong> ${orderDate}</p>
            <p><strong>Time:</strong> ${orderTime}</p>
            <p><strong>Delivery Slot:</strong> ${escapeHTML(order.deliverySlot || 'Express 30-45 mins')}</p>
            <div style="margin-top: 8px;">
              <span class="inv-stamp" style="${isPaid ? 'border-color: #16a34a; color: #15803d;' : 'border-color: #d97706; color: #b45309;'}">
                ${isPaid ? 'PAID VIA ONLINE UPI' : 'CASH ON DELIVERY (DUE ON ARRIVAL)'}
              </span>
            </div>
          </div>
        </div>

        <!-- Customer & Delivery Details Grid -->
        <div class="inv-grid-2">
          <div>
            <div class="inv-block-title">Delivered To:</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a;">${escapeHTML(order.customer?.name || 'Customer')}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;">📞 +91 ${escapeHTML(order.customer?.phone || 'N/A')}</div>
            <div style="font-size: 0.83rem; color: #475569; margin-top: 3px; line-height: 1.4;">
              📍 ${escapeHTML(order.customer?.address || 'Agartala, Tripura')}
              ${order.customer?.landmark ? `<br><small><strong>Landmark:</strong> ${escapeHTML(order.customer.landmark)}</small>` : ''}
              ${order.customer?.notes ? `<br><small><strong>Note:</strong> ${escapeHTML(order.customer.notes)}</small>` : ''}
            </div>
          </div>
          <div>
            <div class="inv-block-title">Delivery & Dispatch Details:</div>
            <div style="font-size: 0.85rem; color: #334155;"><strong>Fulfillment Hub:</strong> Bhattapukur Main Store, Agartala</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Assigned Rider:</strong> ${escapeHTML(order.rider || 'GrossHub Fleet Partner')}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Rider Contact:</strong> ${order.riderPhone ? `📞 ${order.riderPhone}` : 'Assigned on Dispatch'}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Delivery Distance:</strong> ${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km (${order.deliveryDistanceLabel || 'Calculated'})` : 'Standard City Delivery Zone'}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Current Status:</strong> <span style="text-transform: capitalize; font-weight: 700; color: #064e3b;">${order.status.replace('_', ' ')}</span></div>
          </div>
        </div>

        <!-- Itemized Products Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width: 38px;">#</th>
              <th>Item Description</th>
              <th style="width: 80px;">Unit</th>
              <th class="num" style="width: 75px;">MRP</th>
              <th class="num" style="width: 75px;">Rate</th>
              <th class="num" style="width: 50px;">Qty</th>
              <th class="num" style="width: 90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const itemTotal = (it.price || 0) * (it.qty || 1);
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${escapeHTML(it.name)}</strong></td>
                  <td>${escapeHTML(it.unit || '1 pc')}</td>
                  <td class="num text-muted"><del>₹${it.mrp || it.price}</del></td>
                  <td class="num">₹${it.price}</td>
                  <td class="num"><strong>${it.qty}</strong></td>
                  <td class="num"><strong>₹${itemTotal}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Totals Summary Box -->
        <div class="inv-totals-box">
          <table class="inv-totals-table">
            <tr>
              <td>Items Subtotal (${order.summary?.itemCount || items.length} items):</td>
              <td class="num">₹${order.summary?.subtotal || 0}</td>
            </tr>
            <tr>
              <td>Delivery Charge (${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km` : 'Standard'}):</td>
              <td class="num">${(order.summary?.deliveryCharge === 0) ? '<strong style="color:#16a34a;">FREE</strong>' : `₹${order.summary?.deliveryCharge || 0}`}</td>
            </tr>
            ${order.summary?.handlingCharge ? `
            <tr>
              <td>Handling & Packaging Fee:</td>
              <td class="num">₹${order.summary.handlingCharge}</td>
            </tr>` : ''}
            ${(order.summary?.couponDiscount || 0) > 0 ? `
            <tr style="color: #16a34a; font-weight: 600;">
              <td>Discount Applied (${escapeHTML(order.couponCode || order.summary?.couponCode || 'PROMO')}):</td>
              <td class="num">-₹${order.summary.couponDiscount}</td>
            </tr>` : ''}
            <tr class="grand-total">
              <td>Total Bill Amount:</td>
              <td class="num">₹${order.summary?.grandTotal || 0}</td>
            </tr>
            <tr>
              <td style="font-size:0.8rem; color:#64748b;">Payment Mode:</td>
              <td class="num" style="font-size:0.82rem; font-weight:700;">${escapeHTML(order.paymentMethod || 'COD')}</td>
            </tr>
          </table>
        </div>

        <!-- Customer Protection, Guarantee & Terms Footer -->
        <div class="inv-footer">
          <div>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Fresh Guarantee & Terms:</p>
            <p style="margin: 2px 0;">1. All fresh produce & dairy are guaranteed fresh. 100% replacement if reported within 2 hours of delivery.</p>
            <p style="margin: 0;">2. Computer-generated tax invoice issued by GrossHub Quick Commerce. No signature required.</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Fulfillment Centre</p>
            <div style="font-family: monospace; font-size: 0.78rem; color: #64748b; margin: 3px 0;">[VERIFIED-CUSTOMER-INVOICE]</div>
            <p style="margin: 0; font-size: 0.72rem; color: #64748b;">Bhattapukur, Agartala - 799003</p>
          </div>
        </div>
      </div>
    `;

    const titleEl = document.getElementById('customerModalInvoiceTitle');
    if (titleEl) titleEl.textContent = `Tax Invoice & Bill — ${order.id}`;

    const container = document.getElementById('customerInvoicePrintContainer');
    if (container) container.innerHTML = html;

    if (typeof openModal === 'function') {
      openModal('customerInvoiceModal');
    }
  },

  downloadPDF() {
    window.print();
  }
};

window.CustomerInvoice = CustomerInvoice;
