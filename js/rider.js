/**
 * GrossHub - Delivery Operations & Rider Panel (Phase 7)
 * Streamlined mobile-friendly dashboard for delivery partners to view assigned orders,
 * call customers, open directions in Google Maps, and confirm order completion.
 */

const RiderPanel = {
  isAuthenticated: false,
  activeRider: "Rider Bikash",
  activeTab: "active", // "active" or "completed"

  init() {
    this.checkSession();
    this.setupEventListeners();
  },

  checkSession() {
    const isAdmin = (sessionStorage.getItem("grosshub_admin_logged_in") === "true");
    const adminBar = document.getElementById("riderAdminBar");
    if (adminBar) adminBar.style.display = isAdmin ? "flex" : "none";

    const adminQuickAccess = document.getElementById("adminRiderQuickAccess");
    if (adminQuickAccess) adminQuickAccess.style.display = isAdmin ? "block" : "none";

    const session = Store.getRiderSession();
    if (session && session.name) {
      this.isAuthenticated = true;
      this.activeRider = session.name;
      this.showDashboard();
    } else if (isAdmin) {
      // Auto-unlock in Admin Supervisor mode
      this.enterAsAdmin();
    } else {
      this.showLogin();
    }
  },

  enterAsAdmin() {
    this.isAuthenticated = true;
    this.activeRider = "🏪 Fleet Supervisor (Admin)";
    this.showDashboard();
    showToast("Entered Rider Portal with Admin Privileges.", "success");
  },

  showDashboard() {
    const loginView = document.getElementById("riderLoginView");
    const dashView = document.getElementById("riderDashboardView");
    const badge = document.getElementById("riderActiveBadge");
    const logoutBtn = document.getElementById("btnRiderLogout");

    if (loginView) loginView.style.display = "none";
    if (dashView) dashView.style.display = "block";
    if (badge) badge.textContent = this.activeRider;
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    this.renderOrders();
  },

  showLogin() {
    const loginView = document.getElementById("riderLoginView");
    const dashView = document.getElementById("riderDashboardView");
    const logoutBtn = document.getElementById("btnRiderLogout");

    if (loginView) loginView.style.display = "block";
    if (dashView) dashView.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
  },

  handleLogin(name, pin) {
    const correctPin = Store.getRiderPin();
    if (String(pin).trim() === String(correctPin).trim()) {
      this.isAuthenticated = true;
      this.activeRider = name;
      Store.setRiderSession({ name, loginTime: new Date().toISOString() });
      const errEl = document.getElementById("riderLoginError");
      if (errEl) errEl.style.display = "none";
      const pinInput = document.getElementById("riderPinInput");
      if (pinInput) pinInput.value = "";
      this.showDashboard();
      showToast(`Welcome back, ${name}! 🛵`, "success");
    } else {
      const errEl = document.getElementById("riderLoginError");
      if (errEl) {
        errEl.style.display = "block";
        errEl.textContent = "Incorrect Security PIN. Default is 1234.";
      }
      showToast("Incorrect Security PIN.", "error");
    }
  },

  handleLogout() {
    this.isAuthenticated = false;
    Store.clearRiderSession();
    this.showLogin();
    showToast("Logged out of Rider Portal.", "info");
  },

  setupEventListeners() {
    const loginForm = document.getElementById("riderLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const select = document.getElementById("riderLoginSelect");
        const pinInput = document.getElementById("riderPinInput");
        this.handleLogin(select?.value || "Rider Bikash", pinInput?.value || "");
      });
    }

    const riderSelect = document.getElementById("riderSelectProfile");
    if (riderSelect) {
      riderSelect.addEventListener("change", (e) => {
        this.activeRider = e.target.value;
        Store.setRiderSession({ name: e.target.value, loginTime: new Date().toISOString() });
        const badge = document.getElementById("riderActiveBadge");
        if (badge) badge.textContent = this.activeRider;
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
    const isAdmin = (this.activeRider && this.activeRider.includes("Admin"));
    const filtered = allOrders.filter(order => {
      // If Admin supervisor, view all fleet orders
      if (isAdmin) {
        if (this.activeTab === 'active') {
          return order.status !== 'delivered' && order.status !== 'cancelled';
        } else {
          return order.status === 'delivered';
        }
      }

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
              ${order.deliveryDistanceLabel ? `<div style="font-size:0.8rem; color:#047857; margin-top:2px;">🛵 Distance: <strong>${escapeHTML(order.deliveryDistanceLabel)}</strong>${order.deliveryDistanceKm ? ` (~${order.deliveryDistanceKm} km)` : ''}</div>` : ''}
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
