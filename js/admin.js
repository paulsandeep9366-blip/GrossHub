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
    if (sessionStorage.getItem('grosshub_admin_logged_in') === 'true') {
      this.isAuthenticated = true;
      this.showDashboard();
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
        errorEl.textContent = 'Invalid password. Default is grosshub123';
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
          <div class="snippet-order-row">
            <div>
              <strong>${o.id}</strong> • <span class="text-muted">${escapeHTML(o.customer?.name || 'Customer')}</span>
            </div>
            <div>
              <span class="track-badge ${o.status}">${formatStatusLabel(o.status)}</span>
              <strong>₹${o.summary?.grandTotal || 0}</strong>
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
      <tr>
        <td>
          <strong>${order.id}</strong><br>
          <small class="text-muted">${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</small>
        </td>
        <td>
          <strong>${escapeHTML(order.customer?.name || 'Guest')}</strong><br>
          <small class="text-muted">${order.customer?.phone || 'No phone'}</small>
        </td>
        <td>
          <small class="addr-clamp" title="${escapeHTML(order.customer?.address || '')}">
            ${escapeHTML(order.customer?.address || 'Bhattapukur, Agartala')}
          </small>
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
        </td>
        <td>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="btn-xs btn-outline" onclick="AdminPanel.viewOrderDetails('${order.id}')" title="View details">
              👁️ View
            </button>
            <button class="btn-xs btn-hero-primary" onclick="AdminPanel.openOrderInvoiceModal('${order.id}')" title="Print / Download PDF Bill">
              🧾 PDF Bill
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
    Store.updateOrderStatus(orderId, newStatus);
    showToast(`Order ${orderId} status updated to ${newStatus}`, 'success');
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
  openOrderInvoiceModal(orderId) {
    const order = Store.getOrder(orderId);
    if (!order) {
      showToast('Order not found.', 'danger');
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
    const gps = order.gpsCoords || order.customer?.gpsCoords;

    const html = `
      <div class="invoice-paper" id="grosshubInvoiceDoc">
        <!-- Top Invoice Header -->
        <div class="inv-header">
          <div class="inv-brand">
            <h2>🥬 GrossHub</h2>
            <p><strong>GrossHub Quick Commerce Private Limited</strong></p>
            <p>Fulfillment Hub: Bhattapukur, Agartala, Tripura West - 799003</p>
            <p>GSTIN: <strong>16AABCG1234F1Z0</strong> • FSSAI Lic: <strong>21623001000452</strong></p>
            <p>Helpline: <strong>+91 98622 72399</strong> • Email: support@grosshub.in • Web: grosshub.in</p>
          </div>
          <div class="inv-meta">
            <div class="inv-badge-title">CUSTOMER TAX INVOICE & BILL</div>
            <p style="margin-top: 6px;"><strong>Invoice No:</strong> INV-${order.id}</p>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Date Placed:</strong> ${orderDate}</p>
            <p><strong>Time Placed:</strong> ${orderTime}</p>
            <p><strong>Delivery Slot:</strong> ${escapeHTML(order.deliverySlot || 'Express 30-45 mins')}</p>
            <div style="margin-top: 8px;">
              <span class="inv-stamp" style="${isPaid ? 'border-color: #16a34a; color: #15803d;' : 'border-color: #d97706; color: #b45309;'}">
                ${isPaid ? 'PAID VIA ONLINE UPI / QR' : 'PAYMENT DUE (CASH ON DELIVERY)'}
              </span>
            </div>
          </div>
        </div>

        <!-- Customer & Delivery Details Grid -->
        <div class="inv-grid-2">
          <div>
            <div class="inv-block-title">Customer & Delivery Destination:</div>
            <div style="font-size: 0.98rem; font-weight: 700; color: #0f172a;">${escapeHTML(order.customer?.name || 'Customer')}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;">📞 +91 ${escapeHTML(order.customer?.phone || 'N/A')}</div>
            <div style="font-size: 0.83rem; color: #475569; margin-top: 3px; line-height: 1.4;">
              📍 ${escapeHTML(order.customer?.address || 'Agartala, Tripura')}
              ${order.customer?.landmark ? `<br><small><strong>Landmark:</strong> ${escapeHTML(order.customer.landmark)}</small>` : ''}
              ${order.customer?.notes ? `<br><small><strong>Notes / Instructions:</strong> ${escapeHTML(order.customer.notes)}</small>` : ''}
              ${gps ? `<br><small style="color: #047857; font-weight: 600;">🎯 <strong>GPS Coordinates:</strong> ${gps.lat.toFixed(4)}° N, ${gps.lng.toFixed(4)}° E ${gps.accuracy ? `(±${gps.accuracy}m)` : ''}</small>` : ''}
            </div>
          </div>
          <div>
            <div class="inv-block-title">Fulfillment & Logistics Dispatch:</div>
            <div style="font-size: 0.85rem; color: #334155;"><strong>Fulfillment Hub:</strong> GrossHub Bhattapukur Hub, Agartala</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Assigned Fleet Rider:</strong> ${escapeHTML(order.rider || 'Unassigned')}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Rider Contact:</strong> ${order.riderPhone ? `📞 ${order.riderPhone}` : 'GrossHub Agartala Dispatch'}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Delivery Distance:</strong> ${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km (${order.deliveryDistanceLabel || 'Calculated'})` : 'Standard City Delivery Zone'}</div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Delivery Status:</strong> <span style="text-transform: uppercase; font-weight: 700; color: #064e3b;">${order.status.replace('_', ' ')}</span></div>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;"><strong>Payment Method:</strong> ${escapeHTML(order.paymentMethod || 'COD')}</div>
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
              <td>Delivery Fee (${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km` : 'Standard'}):</td>
              <td class="num">${(order.summary?.deliveryCharge === 0) ? '<strong style="color: #16a34a;">FREE</strong>' : `₹${order.summary?.deliveryCharge || 0}`}</td>
            </tr>
            ${order.summary?.handlingCharge ? `
            <tr>
              <td>Handling / Platform Fee:</td>
              <td class="num">₹${order.summary.handlingCharge}</td>
            </tr>` : ''}
            ${(order.summary?.couponDiscount || 0) > 0 ? `
            <tr style="color: #16a34a; font-weight: 600;">
              <td>Discount Applied (${escapeHTML(order.couponCode || 'PROMO')}):</td>
              <td class="num">-₹${order.summary.couponDiscount}</td>
            </tr>` : ''}
            <tr class="grand-total">
              <td>Total Bill Payable:</td>
              <td class="num">₹${order.summary?.grandTotal || 0}</td>
            </tr>
            <tr>
              <td style="font-size:0.8rem; color:#64748b;">Payment Mode:</td>
              <td class="num" style="font-size:0.82rem; font-weight:700;">${escapeHTML(order.paymentMethod || 'COD')}</td>
            </tr>
          </table>
        </div>

        <!-- Official Footer & Verification -->
        <div class="inv-footer">
          <div>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">Customer Guarantee & Terms:</p>
            <p style="margin: 2px 0;">1. All fresh produce & essentials are guaranteed fresh on delivery. 100% replacement guarantee.</p>
            <p style="margin: 0;">2. Computer-generated official tax invoice issued by GrossHub Quick Commerce.</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 700; color: #0f172a;">GrossHub Fulfillment Hub</p>
            <div style="font-family: monospace; font-size: 0.78rem; color: #64748b; margin: 3px 0;">[GROSSHUB-HQ-VALIDATED-INVOICE]</div>
            <p style="margin: 0; font-size: 0.72rem; color: #64748b;">Bhattapukur, Agartala - 799003</p>
          </div>
        </div>
      </div>
    `;

    const titleEl = document.getElementById('modalInvoiceTitle');
    if (titleEl) titleEl.textContent = `Customer Bill & Tax Invoice — ${order.id}`;

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

    const titleEl = document.getElementById('modalInvoiceTitle');
    if (titleEl) titleEl.textContent = 'Master Total Bill & Sales Statement';

    const container = document.getElementById('invoicePrintContainer');
    if (container) container.innerHTML = html;

    openModal('adminInvoiceModal');
  },

  printActiveInvoice() {
    window.print();
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
            <a href="rider.html" class="btn-xs btn-outline" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
              🛵 Open Rider Dispatch Screen
            </a>
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
                  <button type="button" class="btn-xs btn-outline" style="padding: 2px 6px; font-size: 0.72rem; cursor: pointer;" onclick="AdminPanel.openOrderInvoiceModal('${o.id}')">
                    🧾 PDF
                  </button>
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

