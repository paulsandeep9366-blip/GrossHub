/**
 * GrossHub - Automated WhatsApp Notification Engine
 * Sends instant order notifications to the Store Admin on WhatsApp
 * via CallMeBot Free API, Custom Webhook, and 1-Tap Direct WhatsApp.
 */

const WhatsAppNotifier = {
  STORAGE_KEY: 'grosshub_whatsapp_settings',
  LOGS_KEY: 'grosshub_whatsapp_logs',

  getDefaultConfig() {
    return {
      enabled: true,
      targetPhone: '919862272399',
      callMeBotApiKey: '',
      webhookUrl: '',
      autoOpenDirectWa: false,
      soundAlert: true
    };
  },

  getConfig() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return Object.assign(this.getDefaultConfig(), JSON.parse(stored));
      }
    } catch (e) {
      console.warn('[WhatsAppNotifier] Error reading config:', e);
    }
    return this.getDefaultConfig();
  },

  saveConfig(newConfig) {
    try {
      const merged = Object.assign(this.getConfig(), newConfig);
      // Clean phone number (strip +, spaces, dashes)
      if (merged.targetPhone) {
        merged.targetPhone = String(merged.targetPhone).replace(/\D/g, '');
        if (merged.targetPhone.length === 10) {
          merged.targetPhone = '91' + merged.targetPhone;
        }
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('[WhatsAppNotifier] Error saving config:', e);
      return this.getDefaultConfig();
    }
  },

  getLogs() {
    try {
      const logs = localStorage.getItem(this.LOGS_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      return [];
    }
  },

  addLog(entry) {
    try {
      const logs = this.getLogs();
      logs.unshift({
        id: 'WAL-' + Date.now(),
        timestamp: new Date().toISOString(),
        ...entry
      });
      if (logs.length > 50) logs.length = 50;
      localStorage.setItem(this.LOGS_KEY, JSON.stringify(logs));
    } catch (e) {}
  },

  formatOrderMessage(order) {
    const cust = order.customer || {};
    const items = order.items || [];
    const summary = order.summary || {};
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString([], { day: '2-digit', month: 'short' });

    const itemsText = items.map((item, idx) => {
      const unit = item.unit ? ` (${item.unit})` : '';
      return `${idx + 1}. *${item.name}* × ${item.qty}${unit} — ₹${(item.price || 0) * (item.qty || 1)}`;
    }).join('
');

    const addressParts = [
      cust.address,
      cust.houseNo ? `House: ${cust.houseNo}` : '',
      cust.landmark ? `Landmark: ${cust.landmark}` : ''
    ].filter(Boolean).join(', ');

    const mapLink = order.customerLat && order.customerLng 
      ? `https://maps.google.com/?q=${order.customerLat},${order.customerLng}`
      : `https://maps.google.com/?q=Battala,Agartala`;

    const deliveryFeeText = summary.deliveryCharge === 0 ? 'FREE' : `₹${summary.deliveryCharge}`;
    const couponText = summary.couponDiscount > 0 ? `
🏷️ *Discount (${order.couponCode || 'Promo'}):* -₹${summary.couponDiscount}` : '';

    return `🚨 *NEW GROSSHUB ORDER RECEIVED!*
━━━━━━━━━━━━━━━━━━━
🆔 *Order ID:* #${order.id}
⏰ *Time:* ${dateStr}, ${timeStr}
━━━━━━━━━━━━━━━━━━━
👤 *CUSTOMER DETAILS:*
• *Name:* ${cust.name || 'Customer'}
• *Phone:* +${cust.phone || 'N/A'}
• *Address:* ${addressParts || 'Battala, Agartala'}
• *Delivery Slot:* ${order.deliverySlot || 'Instant (30-45 mins)'}
• *Distance:* ${order.deliveryDistanceLabel || (order.deliveryDistanceKm ? order.deliveryDistanceKm + ' km' : 'Local')}
• 📍 *GPS Map:* ${mapLink}

📦 *ITEMS ORDERED (${summary.itemCount || items.length}):*
${itemsText}
━━━━━━━━━━━━━━━━━━━
💰 *PAYMENT SUMMARY:*
• *Subtotal:* ₹${summary.subtotal || 0}
• *Delivery Fee:* ${deliveryFeeText}${couponText}
• ⭐ *GRAND TOTAL:* ₹${summary.grandTotal || 0}
• *Payment Mode:* ${order.paymentMethod || 'Cash on Delivery'}
━━━━━━━━━━━━━━━━━━━
🏪 *Manage in Admin Center:*
http://localhost:8080/admin

_GrossHub Express • Battala, Agartala_`;
  },

  getDirectWhatsAppUrl(order, phone = null) {
    const cfg = this.getConfig();
    const target = phone || cfg.targetPhone || '919862272399';
    const text = this.formatOrderMessage(order);
    return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  },

  async sendOrderNotification(order) {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      console.log('[WhatsAppNotifier] Notifications disabled in settings.');
      return { skipped: true, reason: 'disabled' };
    }

    const message = this.formatOrderMessage(order);
    const targetPhone = cfg.targetPhone || '919862272399';
    const results = {
      orderId: order.id,
      targetPhone: targetPhone,
      callMeBot: null,
      webhook: null,
      directLink: this.getDirectWhatsAppUrl(order, targetPhone)
    };

    // 1. Play sound chime if enabled
    if (cfg.soundAlert) {
      this.playChime();
    }

    // 2. Dispatch via CallMeBot if API key configured
    if (cfg.callMeBotApiKey && cfg.callMeBotApiKey.trim().length > 0) {
      try {
        const apiKey = cfg.callMeBotApiKey.trim();
        const callMeBotRes = await this.dispatchCallMeBot(targetPhone, message, apiKey);
        results.callMeBot = callMeBotRes;
      } catch (e) {
        console.warn('[WhatsAppNotifier] CallMeBot dispatch error:', e);
        results.callMeBot = { success: false, error: e.message };
      }
    }

    // 3. Dispatch via custom Webhook if configured
    if (cfg.webhookUrl && cfg.webhookUrl.trim().length > 0) {
      try {
        const webhookRes = await this.dispatchWebhook(cfg.webhookUrl.trim(), order, message);
        results.webhook = webhookRes;
      } catch (e) {
        console.warn('[WhatsAppNotifier] Webhook dispatch error:', e);
        results.webhook = { success: false, error: e.message };
      }
    }

    // 4. Log notification event
    this.addLog({
      orderId: order.id,
      amount: order.summary ? order.summary.grandTotal : 0,
      targetPhone: targetPhone,
      hasCallMeBot: !!cfg.callMeBotApiKey,
      callMeBotResult: results.callMeBot ? results.callMeBot.success : null,
      hasWebhook: !!cfg.webhookUrl,
      webhookResult: results.webhook ? results.webhook.success : null
    });

    // 5. If auto-open direct WhatsApp is enabled
    if (cfg.autoOpenDirectWa) {
      try {
        window.open(results.directLink, '_blank');
      } catch (e) {}
    }

    return results;
  },

  async dispatchCallMeBot(phone, text, apiKey) {
    const encodedText = encodeURIComponent(text);
    const cleanPhone = phone.startsWith('+') ? phone : '+' + phone;

    const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalServer) {
      try {
        const proxyUrl = `/api/notify-whatsapp?phone=${encodeURIComponent(cleanPhone)}&apikey=${encodeURIComponent(apiKey)}&text=${encodedText}`;
        const resp = await fetch(proxyUrl);
        if (resp.ok) {
          const data = await resp.json();
          return { success: true, via: 'local-proxy', data };
        }
      } catch (e) {
        console.warn('[WhatsAppNotifier] Local proxy attempt failed, falling back to direct:', e);
      }
    }

    const directUrl = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}&text=${encodedText}&apikey=${encodeURIComponent(apiKey)}`;
    
    try {
      await fetch(directUrl, { mode: 'no-cors', cache: 'no-cache' });
      return { success: true, via: 'direct-nocors' };
    } catch (e) {
      try {
        const img = new Image();
        img.src = directUrl;
        return { success: true, via: 'image-beacon' };
      } catch (err2) {
        return { success: false, error: err2.message };
      }
    }
  },

  async dispatchWebhook(url, order, message) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'order.placed',
        timestamp: new Date().toISOString(),
        orderId: order.id,
        order: order,
        formattedMessage: message
      })
    });
    return { success: resp.ok, status: resp.status };
  },

  async sendTestAlert() {
    const cfg = this.getConfig();
    const phone = cfg.targetPhone || '919862272399';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const testMsg = `🔔 *GROSSHUB WHATSAPP ALERTS VERIFIED!*
━━━━━━━━━━━━━━━━━━━
✅ Connection to *+${phone}* is working!
⏰ *Test Timestamp:* ${timeStr}
🏪 *Store:* GrossHub Agartala (Battala)
━━━━━━━━━━━━━━━━━━━
Whenever a customer places an order on your storefront, an instant itemized notification with customer address, items, and total amount will be sent here automatically! 🚀`;

    if (cfg.callMeBotApiKey && cfg.callMeBotApiKey.trim().length > 0) {
      const res = await this.dispatchCallMeBot(phone, testMsg, cfg.callMeBotApiKey.trim());
      return { success: true, method: 'callmebot', details: res };
    } else if (cfg.webhookUrl && cfg.webhookUrl.trim().length > 0) {
      const res = await this.dispatchWebhook(cfg.webhookUrl.trim(), { id: 'TEST-ORDER' }, testMsg);
      return { success: res.success, method: 'webhook', details: res };
    } else {
      const directUrl = `https://wa.me/${phone}?text=${encodeURIComponent(testMsg)}`;
      window.open(directUrl, '_blank');
      return { success: true, method: 'direct-opened', directUrl };
    }
  },

  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }
};

if (typeof window !== 'undefined') {
  window.WhatsAppNotifier = WhatsAppNotifier;
}
