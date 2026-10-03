/**
 * GrossHub - Merchant Admin Panel (Phases 4, 8 & 10)
 * Handles merchant authentication, real-time KPI metrics, order status workflow & rider assignment,
 * product inventory CRUD with stock toggling, shop settings, and CSV report export.
 */

const AdminPanel = {
  isAuthenticated: false,
  activeTab: 'overview',
  orderStatusFilter: 'all',
  searchQuery: '',
  editingProductId: null,
  currentInvoiceType: 'single', // 'single' | 'all_individual' | 'total_report' | 'customer_statement'
  currentInvoiceOrderId: null,
  currentInvoiceOrder: null,

  init() {
    this.checkSession();
    this.initSessionGuard();
    this.setupEventListeners();
  },

  initSessionGuard() {
    if (typeof Store !== 'undefined' && Store.SessionGuard) {
      Store.SessionGuard.init('admin', {
        isAuth: () => this.isAuthenticated || (sessionStorage.getItem('grosshub_admin_logged_in') === 'true'),
        onTimeout: (reason) => this.handleTimeout(reason)
      });
    }
  },

  handleTimeout(reason = 'outside') {
    this.isAuthenticated = false;
    sessionStorage.removeItem('grosshub_admin_logged_in');
    
    const dashView = document.getElementById('adminDashboardView');
    const loginView = document.getElementById('adminLoginView');
    if (dashView) dashView.style.display = 'none';
    if (loginView) loginView.style.display = 'block';

    const topLogout = document.getElementById('btnAdminTopLogout');
    if (topLogout) topLogout.style.display = 'none';

    const notice = document.getElementById('adminTimeoutNotice');
    if (notice) {
      notice.style.display = 'flex';
      const descEl = notice.querySelector('div div');
      if (descEl) {
        if (reason === 'outside') {
          descEl.textContent = 'You were away from the admin portal for more than 5 minutes. For security, please re-enter your password.';
        } else {
          descEl.textContent = 'Your session was idle for more than 5 minutes. For security, please re-enter your password.';
        }
      }
    }

    const pwdInput = document.getElementById('adminPasswordInput');
    if (pwdInput) pwdInput.value = '';

    showToast('Admin session timed out after 5 minutes. Please re-login.', 'warning');
  },

  checkSession() {
    const isAdmin = (sessionStorage.getItem('grosshub_admin_logged_in') === 'true');
    if (isAdmin) {
      this.isAuthenticated = true;
      this.showDashboard();
    } else {
      this.showLogin();
    }
  },

  setupEventListeners() {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    const orderFilter = document.getElementById('adminOrderFilter');
    if (orderFilter) {
      orderFilter.addEventListener('change', (e) => {
        this.orderStatusFilter = e.target.value;
        this.renderOrders();
      });
    }

    const searchInput = document.getElementById('adminOrderSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderOrders();
      });
    }

    const settingsForm = document.getElementById('adminSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveSettings();
      });
    }

    const productForm = document.getElementById('adminProductForm');
    if (productForm) {
      productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveProduct();
      });
    }
  },

  handleLogin() {
    const input = document.getElementById('adminPasswordInput');
    const errorEl = document.getElementById('adminLoginError');
    const pwd = input ? input.value.trim() : '';

    // Check if entered credentials belong to a rider
    const fleetPwd = (typeof Store !== 'undefined' && Store.getRiderPassword) ? Store.getRiderPassword() : (Store.getRiderPin ? Store.getRiderPin() : 'rider123');
    const riders = (typeof Store !== 'undefined' && Store.getRiders) ? Store.getRiders() : [];
    const isRiderPwd = (pwd === fleetPwd) || riders.some(r => r.password === pwd);

    if (isRiderPwd && pwd !== Store.getAdminPassword()) {
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.innerHTML = '🚫 <strong>Rider Access Denied:</strong> Rider accounts can only access the Rider Portal (rider.html).';
      }
      showToast('Riders can only access the Rider Portal.', 'error');
      return;
    }

    if (pwd === Store.getAdminPassword()) {
      this.isAuthenticated = true;
      sessionStorage.setItem('grosshub_admin_logged_in', 'true');
      if (typeof Store !== 'undefined' && Store.SessionGuard) {
        Store.SessionGuard.recordLogin('admin');
      }
      const timeoutNotice = document.getElementById('adminTimeoutNotice');
      if (timeoutNotice) timeoutNotice.style.display = 'none';
      if (input) input.value = '';
      if (errorEl) errorEl.style.display = 'none';
      this.showDashboard();
      showToast('Welcome to GrossHub Admin Control Center 🛡️', 'success');
    } else {
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'Invalid administrator password. Please try again.';
      }
    }
  },

  handleLogout() {
    this.isAuthenticated = false;
    sessionStorage.removeItem('grosshub_admin_logged_in');
    if (typeof Store !== 'undefined' && Store.SessionGuard) {
      Store.SessionGuard.clear('admin');
    }
    const dashView = document.getElementById('adminDashboardView');
    const loginView = document.getElementById('adminLoginView');
    if (dashView) dashView.style.display = 'none';
    if (loginView) loginView.style.display = 'block';
    const topLogout = document.getElementById('btnAdminTopLogout');
    if (topLogout) topLogout.style.display = 'none';
    const timeoutNotice = document.getElementById('adminTimeoutNotice');
    if (timeoutNotice) timeoutNotice.style.display = 'none';
    showToast('Logged out of Admin Portal', 'info');
  },

  showDashboard() {
    const loginView = document.getElementById('adminLoginView');
    const dashView = document.getElementById('adminDashboardView');
    if (loginView) loginView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
    const topLogout = document.getElementById('btnAdminTopLogout');
    if (topLogout) topLogout.style.display = 'inline-flex';

    this.renderMetrics();
    this.renderOrders();
    this.renderProducts();
    this.loadSettingsForm();
    this.switchTab('overview');
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.admin-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    const panels = ['overview', 'orders', 'products', 'riders', 'customers', 'settings', 'reports'];
    panels.forEach(p => {
      const panel = document.getElementById(`adminPanel-${p}`);
      if (panel) panel.style.display = (p === tabName ? 'block' : 'none');
    });

    if (tabName === 'overview') this.renderMetrics();
    if (tabName === 'orders') this.renderOrders();
    if (tabName === 'products') this.renderProducts();
    if (tabName === 'riders') this.renderRidersTab();
    if (tabName === 'customers') this.renderCustomersTab();
    if (tabName === 'settings') this.loadSettingsForm();
  },

  // 1. Metrics & Overview
  renderMetrics() {
    const orders = Store.getOrders();
    const products = Store.getProducts();

    const totalRevenue = orders.reduce((sum, o) => {
      return o.status !== 'cancelled' ? sum + (o.summary?.grandTotal || 0) : sum;
    }, 0);

    const pendingCount = orders.filter(o => o.status === 'placed' || o.status === 'confirmed' || o.status === 'preparing').length;
    const deliveredCount = orders.filter(o => o.status === 'delivered').length;
    const aov = orders.length > 0 ? Math.round(totalRevenue / Math.max(1, (orders.length - orders.filter(o=>o.status==='cancelled').length))) : 0;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('kpiRevenue', `₹${totalRevenue.toLocaleString('en-IN')}`);
    setVal('kpiOrders', orders.length);
    setVal('kpiPending', pendingCount);
    setVal('kpiDelivered', deliveredCount);
    setVal('kpiProducts', products.length);
    setVal('kpiAOV', `₹${aov}`);

    // Recent orders snippet in overview
    const recentContainer = document.getElementById('adminRecentOrdersSnippet');
    if (recentContainer) {
      const recent = orders.slice(0, 5);
      if (recent.length === 0) {
        recentContainer.innerHTML = `<p class="text-muted">No orders placed yet.</p>`;
      } else {
        recentContainer.innerHTML = recent.map(o => `
          <div class="snippet-order-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; gap:10px; flex-wrap:wrap;">
            <div>
              <strong>${o.id}</strong> • <span class="text-muted">${escapeHTML(o.customer?.name || 'Customer')}</span>
              <div style="font-size:0.75rem; color:#64748b;">${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
              ${o.status === 'cancelled' ? `
                <div style="font-size:0.75rem; color:#dc2626; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; padding:2px 6px; margin-top:4px; display:inline-block;">
                  🚫 <strong>Reason:</strong> ${escapeHTML(o.cancelReason || 'Customer requested cancellation')}
                </div>
              ` : ''}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="track-badge ${o.status}">${formatStatusLabel(o.status)}</span>
              <strong style="margin-right:4px;">₹${o.summary?.grandTotal || 0}</strong>
              <button class="btn-xs btn-hero-primary" onclick="AdminPanel.openOrderInvoiceModal('${o.id}')" title="View / Print PDF Bill for ${o.id}">
                🧾 PDF Bill
              </button>
              <button class="btn-xs" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;" onclick="AdminPanel.downloadOrderPDFDirect('${o.id}')" title="Direct Download PDF Bill">
                📥
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  },

  // 2. Orders Table & Actions
  renderOrders() {
    const container = document.getElementById('adminOrdersTableBody');
    if (!container) return;

    let orders = Store.getOrders();

    // Filter by status
    if (this.orderStatusFilter !== 'all') {
      orders = orders.filter(o => o.status === this.orderStatusFilter);
    }

    // Search query
    if (this.searchQuery) {
      const q = this.searchQuery;
      orders = orders.filter(o => 
        o.id.toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q) ||
        (o.rider || '').toLowerCase().includes(q)
      );
    }

    if (orders.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">No matching orders found.</td>
        </tr>
      `;
      return;
    }

    container.innerHTML = orders.map(order => `
      <tr class="${order.status === 'cancelled' ? 'row-cancelled' : ''}">
        <td>
          <strong>${order.id}</strong>
          ${order.status === 'cancelled' ? `<br><span class="badge-cancelled-pill">❌ CANCELLED</span>` : ''}
          <br><small class="text-muted">${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</small>
        </td>
        <td>
          <strong>${escapeHTML(order.customer?.name || 'Guest')}</strong><br>
          <small class="text-muted">${order.customer?.phone || 'No phone'}</small>
        </td>
        <td>
          <small class="addr-clamp" title="${escapeHTML(order.customer?.address || '')}">
            ${escapeHTML(order.customer?.address || 'Bhattapukur, Agartala')}
          </small>
          ${order.deliveryDistanceKm ? `<br><span style="font-size:0.75rem; color:#047857; font-weight:700;">🛵 ${order.deliveryDistanceKm} km</span>` : ''}
          ${(order.customerLat && order.customerLng) ? ` • <a href="https://www.google.com/maps?q=${order.customerLat},${order.customerLng}" target="_blank" style="font-size:0.72rem; color:#0284c7; font-weight:700; text-decoration:none;">📍 Map Pin</a>` : ''}
        </td>
        <td>
          <strong>₹${order.summary?.grandTotal || 0}</strong><br>
          <small class="text-muted">${order.paymentMethod}</small>
        </td>
        <td>
          <select class="admin-rider-select" onchange="AdminPanel.handleAssignRider('${order.id}', this.value)">
            <option value="Pending Assignment" ${order.rider === 'Pending Assignment' ? 'selected' : ''}>Unassigned</option>
            <option value="Rider Bikash" ${order.rider === 'Rider Bikash' ? 'selected' : ''}>Rider Bikash</option>
            <option value="Rider Rahul" ${order.rider === 'Rider Rahul' ? 'selected' : ''}>Rider Rahul</option>
            <option value="Rider Samir" ${order.rider === 'Rider Samir' ? 'selected' : ''}>Rider Samir</option>
          </select>
        </td>
        <td>
          <select class="admin-status-select ${order.status}" onchange="AdminPanel.handleChangeOrderStatus('${order.id}', this.value)">
            <option value="placed" ${order.status === 'placed' ? 'selected' : ''}>Placed</option>
            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
            <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
          ${order.status === 'cancelled' ? `
            <div class="admin-cancel-reason-pill">
              <div class="acrp-header">
                <span class="acrp-badge">🚫 Cancellation Reason</span>
              </div>
              <div class="acrp-body" title="${escapeHTML(order.cancelReason || 'Customer requested cancellation')}">
                <strong>${escapeHTML(order.cancelReason || 'Customer requested cancellation')}</strong>
              </div>
              ${order.cancelledBy ? `<div class="acrp-meta">By: ${escapeHTML(order.cancelledBy)}${order.cancelledAt ? ` • ${new Date(order.cancelledAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</div>` : ''}
              <button type="button" class="btn-acrp-edit" onclick="AdminPanel.openCancelReasonModal('${order.id}')" title="Edit cancellation reason">
                ✏️ Edit Reason
              </button>
            </div>
          ` : ''}
        </td>
        <td>
          <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
            <button class="btn-xs btn-hero-primary" onclick="AdminPanel.openOrderInvoiceModal('${order.id}')" title="Preview / Print Official PDF Bill for ${order.id}">
              🧾 Bill PDF
            </button>
            <button class="btn-xs" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; display:inline-flex; align-items:center; gap:3px;" onclick="AdminPanel.downloadOrderPDFDirect('${order.id}')" title="Direct Download PDF Bill file for ${order.id}">
              📥 Download
            </button>
            <button class="btn-xs btn-outline" onclick="AdminPanel.viewOrderDetails('${order.id}')" title="View full order details">
              👁️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  handleAssignRider(orderId, riderName) {
    Store.updateOrderStatus(orderId, Store.getOrder(orderId).status, {
      rider: riderName,
      riderPhone: riderName === 'Rider Bikash' ? '9862272399' : '6009430922'
    }, `Assigned to ${riderName}`);
    showToast(`Order ${orderId} assigned to ${riderName}`, 'info');
    this.renderOrders();
    if (typeof RiderPanel !== 'undefined' && RiderPanel.renderOrders) {
      RiderPanel.renderOrders();
    }
  },

  handleChangeOrderStatus(orderId, newStatus) {
    if (newStatus === 'cancelled') {
      this.openCancelReasonModal(orderId);
      return;
    }
    Store.updateOrderStatus(orderId, newStatus);
    showToast(`Order ${orderId} status updated to ${newStatus}`, 'success');
    this.renderMetrics();
    this.renderOrders();
    if (typeof RiderPanel !== 'undefined' && RiderPanel.renderOrders) {
      RiderPanel.renderOrders();
    }
  },

  openCancelReasonModal(orderId) {
    const order = Store.getOrder(orderId);
    if (!order) return;

    const modal = document.getElementById('adminCancelOrderModal');
    const targetInput = document.getElementById('cancelTargetOrderId');
    const displayLabel = document.getElementById('cancelTargetOrderDisplay');
    const reasonInput = document.getElementById('cancelReasonInput');
    const titleEl = document.getElementById('cancelModalTitle');

    if (targetInput) targetInput.value = order.id;
    if (displayLabel) displayLabel.textContent = `${order.id} (${order.customer?.name || 'Customer'})`;
    if (reasonInput) reasonInput.value = order.cancelReason || 'Customer requested cancellation (Ordered by mistake)';
    if (titleEl) {
      titleEl.textContent = order.status === 'cancelled' 
        ? `✏️ Edit Cancellation Reason — ${order.id}` 
        : `🚫 Cancel Order Delivery — ${order.id}`;
    }

    if (modal && typeof openModal === 'function') {
      openModal('adminCancelOrderModal');
      setTimeout(() => { if (reasonInput) reasonInput.focus(); }, 150);
    } else {
      const promptVal = prompt(`Enter cancellation reason for Order ${order.id}:`, order.cancelReason || 'Customer requested cancellation');
      if (promptVal !== null) {
        Store.cancelOrder(order.id, promptVal.trim() || 'Customer requested cancellation', 'Admin Dispatch');
        showToast(`Order ${order.id} cancelled. Reason: "${promptVal.trim()}"`, 'info');
        this.renderMetrics();
        this.renderOrders();
      } else {
        this.renderOrders();
      }
    }
  },

  closeCancelModal() {
    if (typeof closeModal === 'function') {
      closeModal('adminCancelOrderModal');
    }
    this.renderOrders();
  },

  setCancelReasonPreset(presetText) {
    const reasonInput = document.getElementById('cancelReasonInput');
    if (reasonInput) {
      reasonInput.value = presetText;
      reasonInput.focus();
    }
  },

  confirmCancelOrder() {
    const targetInput = document.getElementById('cancelTargetOrderId');
    const reasonInput = document.getElementById('cancelReasonInput');
    const orderId = targetInput ? targetInput.value : null;
    const reason = (reasonInput ? reasonInput.value.trim() : '') || 'Customer requested cancellation';

    if (!orderId) {
      showToast('No order selected for cancellation.', 'error');
      return;
    }

    Store.cancelOrder(orderId, reason, 'Admin Portal');
    showToast(`Order ${orderId} cancelled. Reason: "${reason}"`, 'success');
    
    if (typeof closeModal === 'function') {
      closeModal('adminCancelOrderModal');
    }

    this.renderMetrics();
    this.renderOrders();
    if (typeof RiderPanel !== 'undefined' && RiderPanel.renderOrders) {
      RiderPanel.renderOrders();
    }
  },

  viewOrderDetails(orderId) {
    this.openOrderInvoiceModal(orderId);
  },

  // 3. Product Inventory CRUD
  renderProducts() {
    const container = document.getElementById('adminProductsTableBody');
    if (!container) return;

    const products = Store.getProducts();

    container.innerHTML = products.map(p => {
      const discount = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
      const imgSrc = p.image || 'images/hero-basket.jpg';
      return `
        <tr>
          <td class="admin-table-img-col">
            <img src="${escapeHTML(imgSrc)}" class="admin-prod-img" alt="${escapeHTML(p.name)}" onerror="this.src='images/hero-basket.jpg';" loading="lazy">
          </td>
          <td>
            <div class="admin-prod-info-cell">
              <span class="admin-prod-name">${escapeHTML(p.name)}</span>
              ${p.badge ? `<div><span class="admin-badge-tag">${escapeHTML(p.badge)}</span></div>` : ''}
            </div>
          </td>
          <td><span class="cat-pill-small">${p.categoryName || p.category}</span></td>
          <td>${p.unit}</td>
          <td>
            <strong>₹${p.price}</strong> 
            ${p.mrp > p.price ? `<span class="text-muted"><del>₹${p.mrp}</del> (-${discount}%)</span>` : ''}
          </td>
          <td>
            <label class="switch">
              <input type="checkbox" ${p.inStock ? 'checked' : ''} onchange="AdminPanel.handleToggleStock(${p.id})">
              <span class="slider round"></span>
            </label>
            <small class="${p.inStock ? 'text-success' : 'text-danger'}">
              ${p.inStock ? 'In Stock' : 'Out of Stock'}
            </small>
          </td>
          <td>
            <button class="btn-xs btn-edit" onclick="AdminPanel.openProductEditModal(${p.id})">✏️ Edit</button>
            <button class="btn-xs btn-delete" onclick="AdminPanel.handleDeleteProduct(${p.id})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  handleToggleStock(productId) {
    const updated = Store.toggleProductStock(productId);
    if (updated) {
      showToast(`${updated.name} is now ${updated.inStock ? 'In Stock' : 'Out of Stock'}.`, 'info');
      this.renderProducts();
      // Update storefront catalog
      if (typeof renderProducts === 'function') renderProducts();
    }
  },

  openProductAddModal() {
    this.editingProductId = null;
    const form = document.getElementById('adminProductForm');
    if (form) form.reset();
    document.getElementById('modalProductTitle').textContent = 'Add New Grocery Product';
    document.getElementById('prodInStock').checked = true;

    // Reset image preview & input fields
    const preview = document.getElementById('prodImagePreview');
    if (preview) preview.src = 'images/hero-basket.jpg';
    const prodImgInput = document.getElementById('prodImage');
    if (prodImgInput) prodImgInput.value = '';
    const fileInput = document.getElementById('prodImageFile');
    if (fileInput) fileInput.value = '';

    openModal('adminProductModal');
  },

  openProductEditModal(id) {
    const product = Store.getProducts().find(p => p.id === Number(id));
    if (!product) return;

    this.editingProductId = id;
    document.getElementById('modalProductTitle').textContent = 'Edit Product';

    document.getElementById('prodName').value = product.name;
    document.getElementById('prodCategory').value = product.category;
    document.getElementById('prodUnit').value = product.unit;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodMrp').value = product.mrp || product.price;

    const prodImgInput = document.getElementById('prodImage');
    const imageVal = product.image || '';
    if (prodImgInput) prodImgInput.value = imageVal;

    const preview = document.getElementById('prodImagePreview');
    if (preview) {
      preview.src = imageVal || 'images/hero-basket.jpg';
    }

    const fileInput = document.getElementById('prodImageFile');
    if (fileInput) fileInput.value = '';

    const emojiInput = document.getElementById('prodEmoji');
    if (emojiInput) emojiInput.value = product.emoji || '🛒';

    document.getElementById('prodBadge').value = product.badge || '';
    document.getElementById('prodDesc').value = product.description || '';
    document.getElementById('prodInStock').checked = product.inStock !== false;

    openModal('adminProductModal');
  },

  handleImageFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast('Image file size is too large (max 3MB)', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const preview = document.getElementById('prodImagePreview');
      if (preview) preview.src = dataUrl;
      const imgInput = document.getElementById('prodImage');
      if (imgInput) imgInput.value = dataUrl;
      showToast('Custom image loaded! Click Save to apply.', 'success');
    };
    reader.readAsDataURL(file);
  },

  handleImageUrlInput(url) {
    const preview = document.getElementById('prodImagePreview');
    if (preview) {
      preview.src = (url && url.trim()) ? url.trim() : 'images/hero-basket.jpg';
    }
  },

  resetProductImage() {
    const preview = document.getElementById('prodImagePreview');
    if (preview) preview.src = 'images/hero-basket.jpg';
    const imgInput = document.getElementById('prodImage');
    if (imgInput) imgInput.value = '';
    const fileInput = document.getElementById('prodImageFile');
    if (fileInput) fileInput.value = '';
    showToast('Image reset to default placeholder', 'info');
  },

  handleSaveProduct() {
    const name = document.getElementById('prodName').value.trim();
    const category = document.getElementById('prodCategory').value;
    const unit = document.getElementById('prodUnit').value.trim();
    const price = Number(document.getElementById('prodPrice').value);
    const mrp = Number(document.getElementById('prodMrp').value) || price;
    const imageInput = document.getElementById('prodImage');
    const image = imageInput ? imageInput.value.trim() : '';
    const emoji = document.getElementById('prodEmoji').value.trim() || '🛒';
    const badge = document.getElementById('prodBadge').value.trim();
    const description = document.getElementById('prodDesc').value.trim();
    const inStock = document.getElementById('prodInStock').checked;

    const catObj = CATEGORIES.find(c => c.id === category);
    const categoryName = catObj ? catObj.name : 'Groceries';

    if (!name || isNaN(price) || price <= 0) {
      showToast('Please enter a valid product name and price.', 'error');
      return;
    }

    const finalImage = image || 'images/hero-basket.jpg';

    if (this.editingProductId) {
      Store.updateProduct(this.editingProductId, {
        name, category, categoryName, unit, price, mrp, image: finalImage, emoji, badge, description, inStock
      });
      showToast(`Updated "${name}" with custom image successfully!`, 'success');
    } else {
      Store.addProduct({
        name, category, categoryName, unit, price, mrp, image: finalImage, emoji, badge, description, inStock
      });
      showToast(`Added "${name}" with custom image to store catalog!`, 'success');
    }

    closeModal('adminProductModal');
    this.renderProducts();
    this.renderMetrics();
    if (typeof renderProducts === 'function') renderProducts();
  },

  handleDeleteProduct(id) {
    const product = Store.getProducts().find(p => p.id === Number(id));
    if (!product) return;

    if (confirm(`Are you sure you want to remove "${product.name}" from your catalog?`)) {
      Store.deleteProduct(id);
      showToast(`Removed "${product.name}".`, 'info');
      this.renderProducts();
      this.renderMetrics();
      if (typeof renderProducts === 'function') renderProducts();
    }
  },

  // 4. Store Settings
  loadSettingsForm() {
    const config = Store.getConfig();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    set('adminSetShopName', config.shopName);
    set('adminSetTagline', config.tagline);
    set('adminSetAddress', config.address);
    set('adminSetPhone1', config.phone1);
    set('adminSetPhone2', config.phone2);
    set('adminSetWhatsapp', config.whatsappNumber);
    set('adminSetDeliveryFee', config.deliveryCharge);
    set('adminSetFreeThreshold', config.freeDeliveryThreshold);
    set('adminSetUpiId', config.upiId);
    set('adminSetRiderPin', Store.getRiderPin());

    // Populate distance tier fee inputs
    const tiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
    tiers.forEach(tier => {
      set(`adminTierFee_${tier.id}`, tier.fee);
    });

    const statusToggle = document.getElementById('adminSetStoreStatus');
    if (statusToggle) {
      statusToggle.checked = config.serviceStatus !== 'closed';
    }
  },

  handleSaveSettings() {
    const get = id => document.getElementById(id)?.value.trim();

    const config = Store.getConfig();
    const currentTiers = (config.distanceTiers && config.distanceTiers.length) ? config.distanceTiers : DEFAULT_SHOP_CONFIG.distanceTiers;
    const updatedTiers = currentTiers.map(tier => {
      const val = document.getElementById(`adminTierFee_${tier.id}`)?.value;
      return {
        ...tier,
        fee: (val !== undefined && val !== '') ? (Number(val) || 0) : tier.fee
      };
    });

    const updated = {
      shopName: get('adminSetShopName') || 'GrossHub',
      tagline: get('adminSetTagline') || '',
      address: get('adminSetAddress') || '',
      phone1: get('adminSetPhone1') || '9862272399',
      phone2: get('adminSetPhone2') || '6009430922',
      whatsappNumber: get('adminSetWhatsapp') || '919862272399',
      deliveryCharge: Number(get('adminSetDeliveryFee')) || 30,
      freeDeliveryThreshold: Number(get('adminSetFreeThreshold')) || 499,
      upiId: get('adminSetUpiId') || '9862272399@upi',
      distanceTiers: updatedTiers,
      serviceStatus: document.getElementById('adminSetStoreStatus')?.checked ? 'open' : 'closed'
    };

    // Check if new rider PIN was entered
    const riderPinVal = document.getElementById('adminSetRiderPin')?.value.trim();
    if (riderPinVal && riderPinVal.length >= 4) {
      Store.setRiderPin(riderPinVal);
    }

    // Check if new password was entered
    const newPwd = document.getElementById('adminSetNewPassword')?.value.trim();
    if (newPwd) {
      if (newPwd.length < 4) {
        showToast('Password must be at least 4 characters long.', 'error');
        return;
      }
      Store.setAdminPassword(newPwd);
      document.getElementById('adminSetNewPassword').value = '';
    }

    Store.saveConfig(updated);
    showToast('Store settings updated successfully! 🚀', 'success');

    // Update storefront header & delivery meter
    if (typeof renderStoreHeaderInfo === 'function') renderStoreHeaderInfo();
    if (typeof updateCartBadgeAndDrawer === 'function') updateCartBadgeAndDrawer();
  },

  // 5. CSV Reports Export
  exportOrdersToCSV() {
    const orders = Store.getOrders();
    if (orders.length === 0) {
      showToast('No orders to export.', 'warning');
      return;
    }

    const headers = [
      'Order ID',
      'Date',
      'Time',
      'Customer Name',
      'Phone',
      'Delivery Address',
      'Items Count',
      'Items Breakdown',
      'Subtotal (INR)',
      'Delivery Fee (INR)',
      'Promo Discount (INR)',
      'Grand Total (INR)',
      'Payment Mode',
      'Status',
      'Cancellation Reason',
      'Assigned Rider'
    ];

    const rows = orders.map(o => {
      const dateStr = new Date(o.createdAt).toLocaleDateString('en-IN');
      const timeStr = new Date(o.createdAt).toLocaleTimeString('en-IN');
      const itemsList = (o.items || []).map(i => `${i.name} (x${i.qty})`).join('; ');

      return [
        `"${o.id}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${(o.customer?.name || '').replace(/"/g, '""')}"`,
        `"${o.customer?.phone || ''}"`,
        `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
        o.summary?.itemCount || (o.items || []).length,
        `"${itemsList.replace(/"/g, '""')}"`,
        o.summary?.subtotal || 0,
        o.summary?.deliveryCharge || 0,
        o.summary?.couponDiscount || 0,
        o.summary?.grandTotal || 0,
        `"${o.paymentMethod || 'COD'}"`,
        `"${o.status}"`,
        `"${(o.cancelReason || '').replace(/"/g, '""')}"`,
        `"${o.rider || 'Unassigned'}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GrossHub_Orders_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Orders exported to CSV! 📊', 'success');
  },

  // 6. Customer Bill & Order Tax Invoice PDF Generation (Admin Portal)
  // Generates official, retail GST-compliant tax invoices & bills for individual orders and batch printing
  generateOrderInvoiceHTML(order, isMulti = false) {
    if (!order) return "";

    const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const orderTime = new Date(order.createdAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const isPaid = order.paymentMethod !== "COD";
    const items = order.items || [];
    const gps = order.gpsCoords || order.customer?.gpsCoords;
    const invoiceNum = `INV-${order.id}`;

    return `
      <div class="invoice-paper" id="${isMulti ? "" : "grosshubInvoiceDoc"}" style="${isMulti ? "box-shadow:none; max-width:100%; margin:0 0 12px 0; border: 1px solid #cbd5e1;" : ""}">
        ${order.status === 'cancelled' ? `
          <!-- Cancellation Alert Banner -->
          <div class="inv-cancellation-banner">
            <div class="icb-title">🚫 ORDER & DELIVERY CANCELLED</div>
            <div class="icb-reason"><strong>Reason for Cancellation:</strong> ${escapeHTML(order.cancelReason || 'Customer requested cancellation')}</div>
            <div class="icb-time">Cancelled by: <strong>${escapeHTML(order.cancelledBy || 'Store Dispatch')}</strong>${order.cancelledAt ? ` • ${new Date(order.cancelledAt).toLocaleString('en-IN')}` : ''}</div>
          </div>
        ` : ''}
        <!-- Top Invoice Header -->
        <div class="inv-header">
          <div class="inv-brand">
            <h2>🥬 GrossHub</h2>
            <p><strong>GrossHub Quick Commerce Private Limited</strong> • Bhattapukur Hub, Agartala - 799003</p>
            <p>GSTIN: <strong>16AABCG1234F1Z0</strong> • FSSAI: <strong>21623001000452</strong> • Helpline: <strong>+91 98622 72399</strong></p>
          </div>
          <div class="inv-meta">
            <div class="inv-badge-title">TAX INVOICE & RETAIL BILL</div>
            <p style="margin-top: 2px;"><strong>Inv No:</strong> ${invoiceNum} • <strong>Order:</strong> ${order.id}</p>
            <p><strong>Date & Time:</strong> ${orderDate}, ${orderTime}</p>
            <p><strong>Slot:</strong> ${escapeHTML(order.deliverySlot || "Instant Express (30-45 mins)")}</p>
            <div style="margin-top: 3px;">
              <span class="inv-stamp" style="${order.status === 'cancelled' ? "border-color: #ef4444; color: #b91c1c;" : (isPaid ? "border-color: #16a34a; color: #15803d;" : "border-color: #d97706; color: #b45309;")}">
                ${order.status === 'cancelled' ? "ORDER CANCELLED (VOID)" : (isPaid ? "PAID ONLINE (UPI / QR)" : "PAYMENT DUE (CASH ON DELIVERY)")}
              </span>
            </div>
          </div>
        </div>

        <!-- Customer & Delivery Details Grid -->
        <div class="inv-grid-2">
          <div>
            <div class="inv-block-title">Customer & Destination:</div>
            <div style="font-size: 0.86rem; font-weight: 700; color: #0f172a;">${escapeHTML(order.customer?.name || "Customer")} • 📞 +91 ${escapeHTML(order.customer?.phone || "N/A")}</div>
            <div style="font-size: 0.74rem; color: #475569; margin-top: 2px; line-height: 1.3;">
              📍 ${escapeHTML(order.customer?.address || "Agartala, Tripura")}
              ${order.customer?.landmark ? ` • <small><strong>Landmark:</strong> ${escapeHTML(order.customer.landmark)}</small>` : ""}
              ${order.customer?.notes ? `<br><small><strong>Notes:</strong> ${escapeHTML(order.customer.notes)}</small>` : ""}
              ${gps ? `<br><small style="color: #047857; font-weight: 600;">🎯 <strong>GPS:</strong> ${gps.lat.toFixed(4)}° N, ${gps.lng.toFixed(4)}° E</small>` : ""}
            </div>
          </div>
          <div>
            <div class="inv-block-title">Dispatch & Fulfillment:</div>
            <div style="font-size: 0.76rem; color: #334155;"><strong>Hub:</strong> GrossHub Bhattapukur Hub, Agartala</div>
            <div style="font-size: 0.76rem; color: #334155; margin-top: 1px;"><strong>Rider:</strong> ${escapeHTML(order.rider || "Unassigned")} ${order.riderPhone ? `(📞 ${order.riderPhone})` : ""}</div>
            <div style="font-size: 0.76rem; color: #334155; margin-top: 1px;"><strong>Distance:</strong> ${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km` : "Standard Zone"} • <strong>Status:</strong> <span style="text-transform: uppercase; font-weight: 700; color: #064e3b;">${order.status.replace("_", " ")}</span></div>
            <div style="font-size: 0.76rem; color: #334155; margin-top: 1px;"><strong>Payment Mode:</strong> ${escapeHTML(order.paymentMethod || "COD")}</div>
          </div>
        </div>

        <!-- Itemized Products Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width: 32px;">#</th>
              <th>Item Description</th>
              <th style="width: 80px;">Unit</th>
              <th class="num" style="width: 65px;">MRP</th>
              <th class="num" style="width: 65px;">Rate</th>
              <th class="num" style="width: 45px;">Qty</th>
              <th class="num" style="width: 75px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="7" class="text-center py-2" style="color:#64748b;">Grocery essentials package</td></tr>
            ` : items.map((it, idx) => {
              const itemTotal = (it.price || 0) * (it.qty || 1);
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${escapeHTML(it.name)}</strong></td>
                  <td>${escapeHTML(it.unit || "1 pc")}</td>
                  <td class="num text-muted"><del>₹${it.mrp || it.price}</del></td>
                  <td class="num">₹${it.price}</td>
                  <td class="num"><strong>${it.qty}</strong></td>
                  <td class="num"><strong>₹${itemTotal}</strong></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- Bottom Section: Side-by-Side Verification (Left) + Totals Box (Right) -->
        <div class="inv-bottom-section">
          <!-- Left: Verification, Barcode & Stamp -->
          <div class="inv-security-bar">
            <div class="inv-security-qr">
              <div class="inv-qr-box">
                <span>SCAN</span>
                <span>VERIFY</span>
                <span>GROSS</span>
              </div>
              <div>
                <div style="font-weight: 700; color: #0f172a; font-size: 0.74rem;">AUTHENTIC TAX BILL & RECEIPT</div>
                <div style="font-size: 0.68rem; color: #64748b;">UID: GH-INV-${order.id}-${(order.summary?.grandTotal || 0)}</div>
                <div style="font-size: 0.68rem; color: #64748b;">Mode: <strong>${escapeHTML(order.paymentMethod || "COD")}</strong> (${isPaid ? "PAID" : "DUE"})</div>
              </div>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-family: monospace; font-size: 0.7rem; color: #0f172a; font-weight: 700;">[GROSSHUB-VERIFIED-BILL]</span>
              <span style="font-size: 0.68rem; color: #059669; font-weight: 700;">✓ VALIDATED</span>
            </div>
          </div>

          <!-- Right: Totals Summary Box -->
          <div class="inv-totals-box">
            <table class="inv-totals-table">
              <tr>
                <td>Items Subtotal (${order.summary?.itemCount || items.length} items):</td>
                <td class="num">₹${order.summary?.subtotal || 0}</td>
              </tr>
              <tr>
                <td>Uber Delivery Rider Fee (${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km` : "Standard"}):</td>
                <td class="num">${(order.summary?.deliveryCharge === 0) ? "<strong style=\"color: #16a34a;\">FREE (Sponsored)</strong>" : `₹${order.summary?.deliveryCharge || 0}`}</td>
              </tr>
              ${order.summary?.handlingCharge ? `
              <tr>
                <td>Handling / Platform Fee:</td>
                <td class="num">₹${order.summary.handlingCharge}</td>
              </tr>` : ""}
              ${(order.summary?.couponDiscount || 0) > 0 ? `
              <tr style="color: #16a34a; font-weight: 600;">
                <td>Discount (${escapeHTML(order.couponCode || "PROMO")}):</td>
                <td class="num">-₹${order.summary.couponDiscount}</td>
              </tr>` : ""}
              <tr class="grand-total">
                <td>Total Bill Payable:</td>
                <td class="num">₹${order.summary?.grandTotal || 0}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Official Footer & Verification -->
        <div class="inv-footer">
          <div>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">Customer Guarantee & Terms:</p>
            <p style="margin: 1px 0;">1. 100% Replacement Guarantee on all fresh produce & groceries. 2. Official computer-generated retail tax bill.</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Fulfillment Hub</p>
            <p style="margin: 1px 0; font-size: 0.66rem; color: #64748b;">Agartala Operations • Generated: ${new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>
    `;
  },

  openOrderInvoiceModal(orderId) {
    const order = Store.getOrder(orderId);
    if (!order) {
      showToast('Order not found.', 'danger');
      return;
    }

    this.currentInvoiceType = 'single';
    this.currentInvoiceOrderId = order.id;
    this.currentInvoiceOrder = order;

    const titleEl = document.getElementById('modalInvoiceTitle');
    if (titleEl) titleEl.textContent = `Official Tax Invoice & Bill — ${order.id}`;

    const whatsappBtn = document.getElementById('btnModalShareWhatsApp');
    if (whatsappBtn) whatsappBtn.style.display = 'inline-flex';

    const container = document.getElementById('invoicePrintContainer');
    if (container) container.innerHTML = this.generateOrderInvoiceHTML(order, false);

    openModal('adminInvoiceModal');
  },

  // 1-Click Direct Download of PDF Bill for an individual order
  downloadOrderPDFDirect(orderId) {
    const order = Store.getOrder(orderId);
    if (!order) {
      showToast('Order not found.', 'danger');
      return;
    }

    const filename = `GrossHub_Bill_${order.id}.pdf`;

    if (typeof html2pdf !== 'undefined') {
      showToast(`Generating official PDF bill for ${order.id}... 📥`, 'info');

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '780px';
      tempContainer.style.background = '#ffffff';
      tempContainer.style.padding = '16px';
      tempContainer.style.zIndex = '-1000';
      tempContainer.innerHTML = this.generateOrderInvoiceHTML(order, false);
      document.body.appendChild(tempContainer);

      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      html2pdf().set(opt).from(tempContainer).save().then(() => {
        if (document.body.contains(tempContainer)) {
          document.body.removeChild(tempContainer);
        }
        showToast(`Official PDF bill for ${order.id} downloaded! ✅`, 'success');
      }).catch(err => {
        console.error('Direct PDF error:', err);
        if (document.body.contains(tempContainer)) {
          document.body.removeChild(tempContainer);
        }
        this.openOrderInvoiceModal(orderId);
        showToast('Direct download error. Opening print preview...', 'warning');
      });
    } else {
      this.openOrderInvoiceModal(orderId);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  },

  // Download whatever bill/report is currently in modal as a high-quality PDF file
  downloadCurrentInvoicePDF() {
    const container = document.getElementById('invoicePrintContainer');
    if (!container || !container.innerHTML.trim()) {
      showToast('No invoice document loaded to download.', 'warning');
      return;
    }

    let filename = `GrossHub_Invoice_${new Date().toISOString().slice(0,10)}.pdf`;
    if (this.currentInvoiceType === 'single' && this.currentInvoiceOrderId) {
      filename = `GrossHub_Bill_${this.currentInvoiceOrderId}.pdf`;
    } else if (this.currentInvoiceType === 'all_individual') {
      filename = `GrossHub_All_Individual_Bills_${new Date().toISOString().slice(0,10)}.pdf`;
    } else if (this.currentInvoiceType === 'total_report') {
      filename = `GrossHub_Total_Sales_Statement_${new Date().toISOString().slice(0,10)}.pdf`;
    } else if (this.currentInvoiceType === 'customer_statement') {
      filename = `GrossHub_Customer_Statement_${this.currentInvoiceOrderId || 'Customer'}.pdf`;
    }

    if (typeof html2pdf !== 'undefined') {
      showToast('Generating official PDF document... Please wait 📥', 'info');

      // Clone element for optimal PDF export rendering
      const clone = container.cloneNode(true);
      clone.style.background = '#ffffff';
      clone.style.padding = '12px';
      clone.style.width = '100%';
      clone.style.boxSizing = 'border-box';

      // Hide any no-print banners in clone
      const noPrints = clone.querySelectorAll('.no-print');
      noPrints.forEach(el => el.remove());

      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      html2pdf().set(opt).from(clone).save().then(() => {
        showToast(`PDF Bill saved: ${filename}! ✅`, 'success');
      }).catch(err => {
        console.error('PDF export error:', err);
        showToast('Direct download encountered an issue. Opening print dialog...', 'warning');
        window.print();
      });
    } else {
      showToast('Opening PDF Print / Save Dialog. Select "Save as PDF".', 'info');
      window.print();
    }
  },

  // Generates & prints/downloads bills for every individual order in PDF form
  printAllIndividualBills() {
    let orders = Store.getOrders();
    if (orders.length === 0) {
      showToast('No orders found to generate individual bills.', 'warning');
      return;
    }

    // Apply active filter if any
    let filterLabel = 'All Orders Master Fleet';
    if (this.orderStatusFilter && this.orderStatusFilter !== 'all') {
      orders = orders.filter(o => o.status === this.orderStatusFilter);
      filterLabel = `Status: ${this.orderStatusFilter.toUpperCase()}`;
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      orders = orders.filter(o => 
        o.id.toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q) ||
        (o.rider || '').toLowerCase().includes(q)
      );
      filterLabel += ` (Search: "${q}")`;
    }

    if (orders.length === 0) {
      showToast('No orders match current filter for individual bills.', 'warning');
      return;
    }

    const html = `
      <div id="grosshubAllIndividualBillsDoc">
        <div style="background: #0f172a; color: #ffffff; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;" class="no-print">
          <div>
            <strong>📑 All Orders Individual Bills — Ready in PDF Form</strong><br>
            <small style="color: #94a3b8;">${orders.length} Individual Tax Invoices generated (${filterLabel}). Each bill prints on its own clean A4 page.</small>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-xs btn-hero-primary" onclick="AdminPanel.downloadCurrentInvoicePDF()">
              📥 Download Multi-Page PDF
            </button>
            <button type="button" class="btn-xs btn-secondary" style="background:#334155; color:#fff;" onclick="AdminPanel.printActiveInvoice()">
              🖨️ Print All Bills
            </button>
          </div>
        </div>
        ${orders.map((order, idx) => `
          <div class="individual-order-bill-page" style="${idx < orders.length - 1 ? 'page-break-after: always; break-after: page;' : ''} margin-bottom: 24px;">
            ${this.generateOrderInvoiceHTML(order, true)}
          </div>
        `).join('')}
      </div>
    `;

    this.currentInvoiceType = 'all_individual';
    this.currentInvoiceOrderId = 'ALL';
    this.currentInvoiceOrder = null;

    const titleEl = document.getElementById('modalInvoiceTitle');
    if (titleEl) titleEl.textContent = `All Individual Order Bills (${orders.length} Bills in PDF Form)`;

    const whatsappBtn = document.getElementById('btnModalShareWhatsApp');
    if (whatsappBtn) whatsappBtn.style.display = 'none';

    const container = document.getElementById('invoicePrintContainer');
    if (container) container.innerHTML = html;

    openModal('adminInvoiceModal');
  },

  printTotalBillReport() {
    const allOrders = Store.getOrders();
    if (allOrders.length === 0) {
      showToast('No orders found to generate bill statement.', 'warning');
      return;
    }

    // Determine orders to include (filtered or all)
    let orders = allOrders;
    let filterLabel = 'All Orders Master Report';
    if (this.orderStatusFilter && this.orderStatusFilter !== 'all') {
      orders = allOrders.filter(o => o.status === this.orderStatusFilter);
      filterLabel = `Filtered by Status: ${this.orderStatusFilter.toUpperCase()}`;
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      orders = orders.filter(o => 
        o.id.toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q) ||
        (o.rider || '').toLowerCase().includes(q)
      );
      filterLabel += ` (Search: "${q}")`;
    }

    if (orders.length === 0) {
      showToast('No orders match current filter for Total Bill.', 'warning');
      return;
    }

    // Calculations
    const totalOrdersCount = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.summary?.grandTotal || 0), 0);
    const totalSubtotal = orders.reduce((sum, o) => sum + (o.summary?.subtotal || 0), 0);
    const totalDeliveryFee = orders.reduce((sum, o) => sum + (o.summary?.deliveryCharge || 0), 0);
    const totalDiscounts = orders.reduce((sum, o) => sum + (o.summary?.couponDiscount || 0), 0);
    const totalItems = orders.reduce((sum, o) => sum + (o.summary?.itemCount || (o.items || []).length), 0);

    const deliveredCount = orders.filter(o => o.status === 'delivered').length;
    const upiOrders = orders.filter(o => o.paymentMethod !== 'COD');
    const codOrders = orders.filter(o => o.paymentMethod === 'COD');
    const upiTotal = upiOrders.reduce((sum, o) => sum + (o.summary?.grandTotal || 0), 0);
    const codTotal = codOrders.reduce((sum, o) => sum + (o.summary?.grandTotal || 0), 0);

    const nowStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const html = `
      <div class="invoice-paper" id="grosshubInvoiceDoc" style="max-width: 820px;">
        <!-- Header -->
        <div class="inv-header">
          <div class="inv-brand">
            <h2>🥬 GrossHub</h2>
            <p><strong>GrossHub Administration & Operations Management</strong></p>
            <p>Fulfillment Centre: Bhattapukur, Agartala, Tripura West - 799003</p>
            <p>Helpline: +91 98622 72399 • GSTIN: 16AABCG1234F1Z0</p>
          </div>
          <div class="inv-meta">
            <div class="inv-badge-title">TOTAL BILL & SALES STATEMENT</div>
            <p style="margin-top: 6px;"><strong>Statement Generated:</strong> ${nowStr}</p>
            <p><strong>Scope:</strong> ${filterLabel}</p>
            <div style="margin-top: 8px;">
              <span class="inv-stamp">OFFICIAL STORE RECONCILIATION</span>
            </div>
          </div>
        </div>

        <!-- KPI Executive Summary Row -->
        <div class="report-kpi-row">
          <div class="report-kpi-box">
            <div class="report-kpi-label">Orders Count</div>
            <div class="report-kpi-val">${totalOrdersCount}</div>
            <small style="color: #64748b; font-size: 0.75rem;">${deliveredCount} Delivered</small>
          </div>
          <div class="report-kpi-box">
            <div class="report-kpi-label">Total Bill Revenue</div>
            <div class="report-kpi-val" style="color: #064e3b;">₹${totalRevenue.toLocaleString('en-IN')}</div>
            <small style="color: #64748b; font-size: 0.75rem;">Gross Collections</small>
          </div>
          <div class="report-kpi-box">
            <div class="report-kpi-label">Total Delivery Fees</div>
            <div class="report-kpi-val" style="color: #0284c7;">₹${totalDeliveryFee.toLocaleString('en-IN')}</div>
            <small style="color: #64748b; font-size: 0.75rem;">Fleet Revenue</small>
          </div>
          <div class="report-kpi-box">
            <div class="report-kpi-label">Payment Modes</div>
            <div class="report-kpi-val" style="font-size: 0.95rem; color: #4338ca;">UPI: ₹${upiTotal} | COD: ₹${codTotal}</div>
            <small style="color: #64748b; font-size: 0.75rem;">${upiOrders.length} Online / ${codOrders.length} Cash</small>
          </div>
        </div>

        <!-- Detailed Breakdown Master Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width: 80px;">Order ID</th>
              <th style="width: 105px;">Date & Time</th>
              <th>Customer & Phone</th>
              <th style="width: 95px;">Rider</th>
              <th style="width: 95px;">Payment</th>
              <th class="num" style="width: 55px;">Items</th>
              <th class="num" style="width: 70px;">Deliv Fee</th>
              <th class="num" style="width: 70px;">Discount</th>
              <th class="num" style="width: 85px;">Total Bill</th>
              <th style="width: 80px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td><strong>${o.id}</strong></td>
                <td style="font-size: 0.76rem;">
                  ${new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}<br>
                  <span style="color: #64748b;">${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td>
                  <strong>${escapeHTML(o.customer?.name || 'Customer')}</strong><br>
                  <span style="font-size: 0.76rem; color: #64748b;">📞 ${escapeHTML(o.customer?.phone || '')}</span>
                </td>
                <td style="font-size: 0.78rem;">${escapeHTML(o.rider || 'Unassigned')}</td>
                <td style="font-size: 0.78rem;">
                  <span style="font-weight: 600; color: ${o.paymentMethod === 'COD' ? '#b45309' : '#047857'};">
                    ${escapeHTML(o.paymentMethod || 'COD')}
                  </span>
                </td>
                <td class="num">${o.summary?.itemCount || (o.items || []).length}</td>
                <td class="num">₹${o.summary?.deliveryCharge || 0}</td>
                <td class="num" style="color: ${(o.summary?.couponDiscount || 0) > 0 ? '#16a34a' : 'inherit'};">
                  ${(o.summary?.couponDiscount || 0) > 0 ? `-₹${o.summary.couponDiscount}` : '₹0'}
                </td>
                <td class="num"><strong>₹${o.summary?.grandTotal || 0}</strong></td>
                <td style="text-align: center;">
                  <span style="display:inline-block; padding: 2px 6px; font-size: 0.7rem; font-weight: 700; border-radius: 4px; text-transform: uppercase; background: #e2e8f0; color: #334155;">
                    ${o.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
              <td colspan="5">CONSOLIDATED TOTALS (${orders.length} ORDERS)</td>
              <td class="num">${totalItems}</td>
              <td class="num">₹${totalDeliveryFee}</td>
              <td class="num" style="color: #16a34a;">-₹${totalDiscounts}</td>
              <td class="num" style="color: #064e3b; font-size: 1.05rem;">₹${totalRevenue}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div class="inv-footer" style="margin-top: 24px;">
          <div>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Administration Portal</p>
            <p style="margin: 2px 0;">Official total billing and revenue statement generated for store operations and audit.</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 700; color: #0f172a;">Verified By Store Admin</p>
            <div style="font-family: monospace; font-size: 0.78rem; color: #64748b; margin: 3px 0;">[GROSSHUB-FINANCE-AGARTALA]</div>
          </div>
        </div>
      </div>
    `;

    this.currentInvoiceType = 'total_report';
    this.currentInvoiceOrderId = 'REPORT';
    this.currentInvoiceOrder = null;

    const titleEl = document.getElementById('modalInvoiceTitle');
    if (titleEl) titleEl.textContent = 'Master Total Bill & Sales Statement';

    const whatsappBtn = document.getElementById('btnModalShareWhatsApp');
    if (whatsappBtn) whatsappBtn.style.display = 'none';

    const container = document.getElementById('invoicePrintContainer');
    if (container) container.innerHTML = html;

    openModal('adminInvoiceModal');
  },

  printActiveInvoice() {
    window.print();
  },

  // WhatsApp sharing of invoice to customer
  shareInvoiceOnWhatsApp() {
    if (this.currentInvoiceOrder) {
      const order = this.currentInvoiceOrder;
      const phone = (order.customer?.phone || '').replace(/\D/g, '');
      const isPaid = order.paymentMethod !== 'COD';
      const itemsText = (order.items || []).map(i => `• ${i.name} (x${i.qty}) - ₹${(i.price || 0) * (i.qty || 1)}`).join("\n");

      const msg = `*🥬 GrossHub Agartala — Official Retail Tax Bill*\n` +
        `--------------------------------\n` +
        `*Invoice No:* INV-${order.id}\n` +
        `*Customer:* ${order.customer?.name || 'Customer'}\n` +
        `*Phone:* +91 ${order.customer?.phone || ''}\n` +
        `*Delivery Address:* ${order.customer?.address || 'Agartala'}\n` +
        `--------------------------------\n` +
        `*Items Ordered:*\n${itemsText}\n` +
        `--------------------------------\n` +
        `*Items Subtotal:* ₹${order.summary?.subtotal || 0}\n` +
        `*Delivery Fee:* ₹${order.summary?.deliveryCharge || 0}\n` +
        (order.summary?.couponDiscount ? `*Discount (${order.couponCode || 'PROMO'}):* -₹${order.summary.couponDiscount}\n` : '') +
        `*Grand Total Bill:* ₹${order.summary?.grandTotal || 0}\n` +
        `*Payment Method:* ${order.paymentMethod || 'COD'} (${isPaid ? 'PAID ONLINE' : 'CASH ON DELIVERY DUE'})\n` +
        `*Delivery Partner:* ${order.rider || 'GrossHub Fleet'}\n` +
        `--------------------------------\n` +
        `Thank you for choosing GrossHub Quick Commerce! 🛒\n` +
        `Helpline: +91 98622 72399 • Agartala`;

      const targetUrl = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(targetUrl, '_blank');
      showToast('Opening WhatsApp with customer bill details! 💬', 'info');
      return;
    }

    if (this.currentInvoiceType === 'customer_statement' && this.currentInvoiceOrderId) {
      const phone = this.currentInvoiceOrderId;
      const msg = `*🥬 GrossHub Agartala — Customer Account Statement*\nYour official purchase and billing statement has been prepared. Please contact GrossHub Admin Helpline: +91 98622 72399 for questions.`;
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      return;
    }

    showToast('Please open an individual order bill to share on WhatsApp.', 'warning');
  },

  // 5. Fleet & Riders Management Tab
  renderRidersTab() {
    const container = document.getElementById("adminRidersContainer");
    if (!container) return;

    const riders = Store.getRiders();
    const orders = Store.getOrders();
    const activeDeliveries = orders.filter(o => o.status === "out_for_delivery" || o.status === "preparing");
    const currentPin = Store.getRiderPin();

    const pinEl = document.getElementById("adminDisplayRiderPin");
    if (pinEl) pinEl.textContent = currentPin;

    const totalRidersEl = document.getElementById("kpiFleetTotal");
    if (totalRidersEl) totalRidersEl.textContent = riders.length;

    const fleetActiveEl = document.getElementById("kpiFleetActive");
    if (fleetActiveEl) fleetActiveEl.textContent = activeDeliveries.length;

    container.innerHTML = riders.map(rider => {
      const assigned = orders.filter(o => o.assignedRider === rider.name && o.status !== "delivered" && o.status !== "cancelled");
      const deliveredCount = orders.filter(o => o.assignedRider === rider.name && o.status === "delivered").length;
      const isBusy = assigned.length > 0;

      return `
        <div style="background: var(--white); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                🛵
              </div>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem; color: var(--slate-900);">${escapeHTML(rider.name)}</h4>
                <div style="font-size: 0.82rem; color: var(--slate-500); margin-top: 2px;">
                  📞 ${escapeHTML(rider.phone || "9862272399")} • Zone: ${escapeHTML(rider.zone || "Agartala")}
                </div>
              </div>
            </div>
            <div>
              <span style="font-size: 0.8rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; background: ${isBusy ? "#fff7ed" : "#ecfdf5"}; color: ${isBusy ? "#c2410c" : "#047857"}; border: 1px solid ${isBusy ? "#fed7aa" : "#a7f3d0"};">
                ${isBusy ? `🛵 On Delivery (${assigned.length})` : "🟢 Ready / Idle"}
              </span>
            </div>
          </div>

          <div style="display: flex; gap: 20px; margin: 14px 0; font-size: 0.85rem; background: var(--slate-50); padding: 10px 14px; border-radius: var(--radius-sm); flex-wrap: wrap;">
            <div>Active Deliveries: <strong>${assigned.length}</strong></div>
            <div>Delivered Total: <strong>${deliveredCount}</strong></div>
            <div>Assigned Order IDs: <strong>${assigned.map(o => o.id).join(", ") || "None currently"}</strong></div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="tel:${rider.phone || "9862272399"}" class="btn-xs btn-secondary" style="text-decoration: none;">
              📞 Call Rider
            </a>
            <a href="https://wa.me/91${(rider.phone || "9862272399").replace(/\D/g, "")}" target="_blank" class="btn-xs btn-outline" style="text-decoration: none; color: #15803d; border-color: #86efac;">
              💬 WhatsApp
            </a>
          </div>
        </div>
      `;
    }).join("");
  },

  handleUpdateRiderPin() {
    const current = Store.getRiderPin();
    const pin = prompt("Enter new 4-digit Master Security PIN for Delivery Fleet:", current);
    if (pin && pin.trim().length >= 4) {
      Store.setRiderPin(pin.trim());
      showToast(`Rider PIN updated to ${pin.trim()}!`, "success");
      this.renderRidersTab();
    }
  },

  handleAddNewRider() {
    const name = prompt("Enter new delivery rider full name (e.g. Rider Sanjib):");
    if (!name || !name.trim()) return;
    const phone = prompt("Enter 10-digit mobile number for rider:", "9862272399") || "9862272399";
    const config = Store.getConfig();
    const riders = config.riders || DEFAULT_SHOP_CONFIG.riders;
    const newId = `rider_${Date.now()}`;
    riders.push({ id: newId, name: name.trim(), phone: phone.trim(), zone: "Agartala" });
    config.riders = riders;
    Store.saveConfig(config);
    showToast(`Rider ${name.trim()} added to fleet!`, "success");
    this.renderRidersTab();
  },

  // 6. Customers Directory Tab
  renderCustomersTab() {
    const container = document.getElementById("adminCustomersList");
    if (!container) return;

    const orders = Store.getOrders();
    const customerMap = {};

    orders.forEach(o => {
      const phone = o.customer?.phone;
      if (!phone) return;
      if (!customerMap[phone]) {
        customerMap[phone] = {
          name: o.customer?.name || "Customer",
          phone: phone,
          address: o.customer?.address || "",
          landmark: o.customer?.landmark || "",
          ordersCount: 0,
          totalSpent: 0,
          orders: []
        };
      }
      customerMap[phone].ordersCount += 1;
      customerMap[phone].totalSpent += (o.summary?.grandTotal || o.grandTotal || 0);
      customerMap[phone].orders.push(o);
    });

    const customers = Object.values(customerMap);
    customers.sort((a, b) => b.totalSpent - a.totalSpent);

    const totalCustEl = document.getElementById("kpiTotalCustomers");
    if (totalCustEl) totalCustEl.textContent = customers.length;

    const totalCustRevEl = document.getElementById("kpiTotalCustomerRevenue");
    if (totalCustRevEl) {
      const total = customers.reduce((sum, c) => sum + c.totalSpent, 0);
      totalCustRevEl.textContent = `₹${total}`;
    }

    if (customers.length === 0) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--slate-500);">No customer records logged yet. Customers will appear here as orders are placed.</td></tr>`;
      return;
    }

    container.innerHTML = customers.map(c => `
      <tr>
        <td><strong>${escapeHTML(c.name)}</strong></td>
        <td><code>${escapeHTML(c.phone)}</code></td>
        <td style="max-width:200px; font-size:0.82rem; color:var(--slate-600);">${escapeHTML(c.address)} ${c.landmark ? `<br><small>📍 ${escapeHTML(c.landmark)}</small>` : ""}</td>
        <td><span class="cat-pill-small">${c.ordersCount} Orders</span></td>
        <td><strong style="color:var(--emerald-700);">₹${c.totalSpent}</strong></td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <a href="tel:${c.phone}" class="btn-xs btn-outline" title="Call Customer">📞</a>
            <a href="https://wa.me/91${c.phone.replace(/\D/g, "")}" target="_blank" class="btn-xs btn-outline" style="color:#15803d;" title="WhatsApp Customer">💬</a>
            <button class="btn-xs btn-hero-primary" onclick="AdminPanel.printCustomerStatementPDF('${c.phone}')" title="Print / Download Complete Customer Statement PDF">🧾 Customer Bill PDF</button>
            <button class="btn-xs btn-secondary" onclick="AdminPanel.filterByCustomerPhone('${c.phone}')" title="View customer orders in Orders tab">📦 Orders</button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  printCustomerStatementPDF(phone) {
    const allOrders = Store.getOrders();
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const customerOrders = allOrders.filter(o => {
      const oPhone = String(o.customer?.phone || '').replace(/\D/g, '').slice(-10);
      return oPhone === cleanPhone;
    });

    if (customerOrders.length === 0) {
      showToast('No orders found for this customer.', 'warning');
      return;
    }

    customerOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const firstOrder = customerOrders[0];
    const customerName = firstOrder.customer?.name || 'Customer';
    const customerAddress = firstOrder.customer?.address || 'Agartala, Tripura';
    const customerLandmark = firstOrder.customer?.landmark || '';

    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, o) => sum + (o.summary?.grandTotal || o.grandTotal || 0), 0);
    const totalDeliveryFees = customerOrders.reduce((sum, o) => sum + (o.summary?.deliveryCharge || 0), 0);
    const totalDiscounts = customerOrders.reduce((sum, o) => sum + (o.summary?.couponDiscount || 0), 0);

    const generatedDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const html = `
      <div class="invoice-paper" id="grosshubInvoiceDoc" style="max-width: 820px;">
        <!-- Header -->
        <div class="inv-header">
          <div class="inv-brand">
            <h2>🥬 GrossHub</h2>
            <p><strong>GrossHub Customer Accounts & Billing Statement</strong></p>
            <p>Fulfillment Hub: Bhattapukur, Agartala, Tripura West - 799003</p>
            <p>GSTIN: 16AABCG1234F1Z0 • Helpline: +91 98622 72399</p>
          </div>
          <div class="inv-meta">
            <div class="inv-badge-title">CUSTOMER BILLING STATEMENT</div>
            <p style="margin-top: 6px;"><strong>Customer Phone:</strong> +91 ${cleanPhone}</p>
            <p><strong>Statement Date:</strong> ${generatedDate}</p>
            <div style="margin-top: 8px;">
              <span class="inv-stamp">VERIFIED CUSTOMER ACCOUNT</span>
            </div>
          </div>
        </div>

        <!-- Customer Summary KPI -->
        <div class="report-kpi-row">
          <div class="report-kpi-box">
            <div class="report-kpi-label">Customer Name</div>
            <div class="report-kpi-val" style="font-size: 1rem;">${escapeHTML(customerName)}</div>
            <small style="color: #64748b; font-size: 0.72rem;">+91 ${cleanPhone}</small>
          </div>
          <div class="report-kpi-box">
            <div class="report-kpi-label">Lifetime Orders</div>
            <div class="report-kpi-val">${totalOrders}</div>
            <small style="color: #64748b; font-size: 0.72rem;">Orders logged</small>
          </div>
          <div class="report-kpi-box">
            <div class="report-kpi-label">Total Amount Billed</div>
            <div class="report-kpi-val" style="color: #064e3b;">₹${totalSpent.toLocaleString('en-IN')}</div>
            <small style="color: #64748b; font-size: 0.72rem;">Lifetime purchases</small>
          </div>
          <div class="report-kpi-box">
            <div class="report-kpi-label">Delivery Fees Paid</div>
            <div class="report-kpi-val" style="color: #0284c7;">₹${totalDeliveryFees}</div>
            <small style="color: #16a34a; font-size: 0.72rem;">Saved ₹${totalDiscounts} promos</small>
          </div>
        </div>

        <!-- Primary Address -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 0.85rem;">
          <strong>Registered Delivery Address:</strong> ${escapeHTML(customerAddress)} ${customerLandmark ? `(Landmark: ${escapeHTML(customerLandmark)})` : ''}
        </div>

        <!-- Orders Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width: 85px;">Order ID</th>
              <th style="width: 110px;">Date & Time</th>
              <th>Items Summary</th>
              <th style="width: 90px;">Payment</th>
              <th class="num" style="width: 70px;">Deliv Fee</th>
              <th class="num" style="width: 70px;">Discount</th>
              <th class="num" style="width: 85px;">Total Bill</th>
              <th style="width: 80px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${customerOrders.map(o => `
              <tr>
                <td><strong>${o.id}</strong></td>
                <td style="font-size: 0.76rem;">
                  ${new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}<br>
                  <span style="color: #64748b;">${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td style="font-size: 0.8rem;">
                  ${(o.items || []).map(i => `${escapeHTML(i.name)} × ${i.qty}`).join(', ') || 'Grocery Package'}
                </td>
                <td style="font-size: 0.78rem;">
                  <span style="font-weight: 600; color: ${o.paymentMethod === 'COD' ? '#b45309' : '#047857'};">
                    ${escapeHTML(o.paymentMethod || 'COD')}
                  </span>
                </td>
                <td class="num">₹${o.summary?.deliveryCharge || 0}</td>
                <td class="num" style="color: ${(o.summary?.couponDiscount || 0) > 0 ? '#16a34a' : 'inherit'};">
                  ${(o.summary?.couponDiscount || 0) > 0 ? `-₹${o.summary.couponDiscount}` : '₹0'}
                </td>
                <td class="num"><strong>₹${o.summary?.grandTotal || 0}</strong></td>
                <td style="text-align: center;">
                  <div style="display:flex; gap:3px; justify-content:center;">
                    <button type="button" class="btn-xs btn-outline" style="padding: 2px 6px; font-size: 0.72rem; cursor: pointer;" onclick="AdminPanel.openOrderInvoiceModal('${o.id}')" title="Preview PDF Bill">
                      🧾 PDF
                    </button>
                    <button type="button" class="btn-xs" style="background:#0284c7; color:#fff; border:none; padding: 2px 6px; font-size: 0.72rem; cursor: pointer; border-radius:3px;" onclick="AdminPanel.downloadOrderPDFDirect('${o.id}')" title="Direct Download PDF Bill">
                      📥
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
              <td colspan="4">LIFETIME CONSOLIDATED TOTALS (${customerOrders.length} ORDERS)</td>
              <td class="num">₹${totalDeliveryFees}</td>
              <td class="num" style="color: #16a34a;">-₹${totalDiscounts}</td>
              <td class="num" style="color: #064e3b; font-size: 1.05rem;">₹${totalSpent}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer -->
        <div class="inv-footer" style="margin-top: 20px;">
          <div>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Administration Portal</p>
            <p style="margin: 2px 0;">Official customer billing statement for customer accounts & tax reconciliation.</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Customer Accounts</p>
            <div style="font-family: monospace; font-size: 0.78rem; color: #64748b; margin: 3px 0;">[GROSSHUB-ACCOUNTS-AGARTALA]</div>
          </div>
        </div>
      </div>
    `;

    const titleEl = document.getElementById('modalInvoiceTitle');
    if (titleEl) titleEl.textContent = `Customer Billing Statement — ${customerName} (+91 ${cleanPhone})`;

    const container = document.getElementById('invoicePrintContainer');
    if (container) container.innerHTML = html;

    openModal('adminInvoiceModal');
  },

  filterByCustomerPhone(phone) {
    this.switchTab("orders");
    const searchInput = document.getElementById("adminOrderSearch");
    if (searchInput) {
      searchInput.value = phone;
      this.renderOrders();
    }
  }
};

