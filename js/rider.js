/**
 * GrossHub - Delivery Operations & Rider Panel (Phase 7)
 * Streamlined mobile-friendly dashboard for delivery partners to view assigned orders,
 * call customers, open directions in Google Maps, and confirm order completion.
 */

const RiderPanel = {
  activeRider: 'Rider Bikash',
  activeTab: 'active', // 'active' or 'completed'

  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const riderSelect = document.getElementById('riderSelectProfile');
    if (riderSelect) {
      riderSelect.addEventListener('change', (e) => {
        this.activeRider = e.target.value;
        this.renderOrders();
      });
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.rider-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this.renderOrders();
  },

  renderOrders() {
    const container = document.getElementById('riderOrdersContainer');
    if (!container) return;

    const allOrders = Store.getOrders();
    const filtered = allOrders.filter(order => {
      // Check rider match or unassigned
      const isAssigned = (order.rider === this.activeRider) || (!order.rider || order.rider === 'Pending Assignment');
      
      if (this.activeTab === 'active') {
        return isAssigned && (order.status === 'out_for_delivery' || order.status === 'preparing' || order.status === 'confirmed');
      } else {
        return order.rider === this.activeRider && order.status === 'delivered';
      }
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="rider-empty-state">
          <span class="res-icon">🛵</span>
          <h4>No ${this.activeTab === 'active' ? 'Active' : 'Completed'} Deliveries</h4>
          <p>There are currently no orders assigned to <strong>${this.activeRider}</strong> in this list.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => {
      const isPaid = order.paymentStatus.toLowerCase().includes('paid');
      const mapsQuery = encodeURIComponent(`${order.customer?.address || ''}, Agartala, Tripura`);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

      let actionButtons = '';
      if (order.status === 'confirmed' || order.status === 'preparing') {
        actionButtons = `
          <button class="btn-rider-action btn-pickup" onclick="RiderPanel.handlePickup('${order.id}')">
            📦 Accept & Pick Up Order
          </button>
        `;
      } else if (order.status === 'out_for_delivery') {
        actionButtons = `
          <button class="btn-rider-action btn-deliver" onclick="RiderPanel.handleDelivered('${order.id}')">
            ✅ Mark Delivered ${isPaid ? '(No Cash)' : `(Collect ₹${order.summary?.grandTotal || 0})`}
          </button>
        `;
      } else if (order.status === 'delivered') {
        actionButtons = `
          <div class="rider-completed-pill">
            ✓ Successfully Delivered at ${(order.statusHistory || []).find(h => h.status === 'delivered')?.time || 'today'}
          </div>
        `;
      }

      return `
        <div class="rider-order-card ${order.status}">
          <div class="roc-top">
            <div>
              <span class="track-badge ${order.status}">${formatStatusLabel(order.status)}</span>
              <strong class="roc-id">${order.id}</strong>
              <span class="roc-time">Slot: ${order.deliverySlot}</span>
            </div>
            <div class="roc-amount-box ${isPaid ? 'paid' : 'cod'}">
              <span class="amount-val">₹${order.summary?.grandTotal || 0}</span>
              <span class="amount-tag">${isPaid ? 'PAID ONLINE' : 'CASH ON DELIVERY'}</span>
            </div>
          </div>

          <div class="roc-customer-block">
            <div class="cust-info">
              <div class="cust-name">👤 ${escapeHTML(order.customer?.name || 'Customer')}</div>
              <div class="cust-addr">📍 ${escapeHTML(order.customer?.address || '')}</div>
              ${order.customer?.notes ? `<div class="cust-note">⚠️ Note: ${escapeHTML(order.customer.notes)}</div>` : ''}
            </div>
            <div class="cust-quick-actions">
              ${order.customer?.phone ? `
                <a href="tel:${order.customer.phone}" class="btn-rider-tool btn-call">
                  📞 Call
                </a>
              ` : ''}
              <a href="${mapsUrl}" target="_blank" class="btn-rider-tool btn-maps">
                🗺️ Maps
              </a>
            </div>
          </div>

          <div class="roc-items-summary">
            <strong>Order Items (${(order.items || []).length}):</strong>
            <ul>
              ${(order.items || []).map(i => `<li>${escapeHTML(i.name)} × <strong>${i.qty}</strong></li>`).join('')}
            </ul>
          </div>

          <div class="roc-footer-action">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');
  },

  handlePickup(orderId) {
    Store.updateOrderStatus(orderId, 'out_for_delivery', {
      rider: this.activeRider,
      riderPhone: Store.getConfig().phone1
    }, `Picked up by ${this.activeRider}`);
    showToast(`Order ${orderId} is now Out for Delivery! 🛵`, 'success');
    this.renderOrders();
    // Update admin view if open
    if (typeof AdminPanel !== 'undefined' && AdminPanel.renderOrders) {
      AdminPanel.renderOrders();
      AdminPanel.renderMetrics();
    }
  },

  handleDelivered(orderId) {
    const order = Store.getOrder(orderId);
    if (!order) return;

    const isCOD = !order.paymentStatus.toLowerCase().includes('paid');
    const msg = isCOD 
      ? `Confirm delivery for ${orderId}? Did you collect ₹${order.summary?.grandTotal} in Cash?`
      : `Confirm delivery for ${orderId}?`;

    if (confirm(msg)) {
      Store.updateOrderStatus(orderId, 'delivered', {
        rider: this.activeRider
      }, `Delivered by ${this.activeRider}`);
      showToast(`Order ${orderId} marked as Delivered! 🎉`, 'success');
      this.renderOrders();
      if (typeof AdminPanel !== 'undefined' && AdminPanel.renderOrders) {
        AdminPanel.renderOrders();
        AdminPanel.renderMetrics();
      }
    }
  }
};
