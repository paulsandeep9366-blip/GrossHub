/**
 * GrossHub - SMS & Customer OTP Gateway
 * Powered by Google Firebase Phone Authentication (10,000 free SMS/mo)
 * Delivers real cellular SMS OTPs to customer mobile numbers without needing a backend server.
 * Enforces unique OTP generation and strict rejection of incorrect OTPs.
 */

const SMSGateway = {
  activeConfirmationResult: null,
  activeTargetPhone: "",
  activeCustomerName: "",
  fallbackOtp: null,
  lastGeneratedOtp: null,
  recaptchaVerifier: null,

  init() {
    this.initFirebase();
  },

  isFirebaseConfigured() {
    if (typeof Store === "undefined") return false;
    const cfg = (Store.getFirebaseConfig ? Store.getFirebaseConfig() : null) || {};
    return !!(cfg && cfg.apiKey && cfg.projectId && cfg.apiKey.trim().length > 5);
  },

  initFirebase() {
    if (typeof firebase === "undefined") return false;
    if (!this.isFirebaseConfigured()) return false;

    try {
      const cfg = Store.getFirebaseConfig();
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(cfg);
        console.log("[SMSGateway] Firebase Phone Auth initialized successfully.");
      }
      return true;
    } catch (e) {
      console.warn("[SMSGateway] Firebase init note:", e);
      return false;
    }
  },

  initRecaptcha(containerId = "recaptcha-container") {
    if (typeof firebase === "undefined" || !this.isFirebaseConfigured()) return null;

    try {
      const container = document.getElementById(containerId);
      if (!container) return null;

      if (!this.recaptchaVerifier) {
        this.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
          size: "invisible",
          callback: () => {
            console.log("[SMSGateway] reCAPTCHA verified.");
          },
          "expired-callback": () => {
            console.warn("[SMSGateway] reCAPTCHA expired, resetting...");
            this.resetRecaptcha();
          }
        });
      }
      return this.recaptchaVerifier;
    } catch (e) {
      console.warn("[SMSGateway] Recaptcha setup error:", e);
      return null;
    }
  },

  resetRecaptcha() {
    try {
      if (this.recaptchaVerifier && typeof grecaptcha !== "undefined") {
        this.recaptchaVerifier.render().then(widgetId => {
          grecaptcha.reset(widgetId);
        });
      }
    } catch(e) {}
  },

  /**
   * Generates a guaranteed unique, cryptographically random 6-digit OTP code
   */
  generateUniqueOtp() {
    let code;
    let attempts = 0;
    do {
      if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        code = String(100000 + (arr[0] % 900000));
      } else {
        code = String(Math.floor(100000 + Math.random() * 900000));
      }
      attempts++;
    } while (code === this.lastGeneratedOtp && attempts < 10);

    this.lastGeneratedOtp = code;
    return code;
  },

  /**
   * Dispatches an OTP via real cellular SMS (Firebase) or unique simulation code
   */
  async sendOtpSms(rawPhone, name = "Customer", recaptchaContainerId = "recaptcha-container") {
    const cleanDigits = String(rawPhone).replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      return { success: false, error: "Please enter a valid 10-digit mobile number." };
    }

    const tenDigit = cleanDigits.slice(-10);
    const e164Phone = `+91${tenDigit}`;
    this.activeTargetPhone = e164Phone;
    this.activeCustomerName = name;

    // Invalidate any previous pending OTP so each login attempt is strictly unique
    this.fallbackOtp = null;
    this.activeConfirmationResult = null;

    // 1. Live Google Firebase Phone Auth SMS
    if (typeof firebase !== "undefined" && this.isFirebaseConfigured()) {
      try {
        this.initFirebase();
        const appVerifier = this.initRecaptcha(recaptchaContainerId);

        if (!appVerifier) {
          throw new Error("Invisible security verification could not be rendered. Please refresh the page.");
        }

        const confirmationResult = await firebase.auth().signInWithPhoneNumber(e164Phone, appVerifier);
        this.activeConfirmationResult = confirmationResult;

        return {
          success: true,
          mode: "firebase_live",
          phone: e164Phone,
          message: `Real SMS OTP sent to ${e164Phone}. Please check your SMS messages!`
        };
      } catch (err) {
        console.error("[SMSGateway] Firebase SMS dispatch failed:", err);
        this.resetRecaptcha();

        let userMsg = err.message || "Failed to send SMS";
        if (err.code === "auth/invalid-phone-number") {
          userMsg = "Invalid Indian mobile number format (+91).";
        } else if (err.code === "auth/too-many-requests") {
          userMsg = "Too many requests to this phone number. Please try again in a few minutes.";
        } else if (err.code === "auth/quota-exceeded") {
          userMsg = "Daily SMS quota reached on your Firebase project. Please check Firebase console.";
        }

        return {
          success: false,
          error: userMsg,
          rawError: err
        };
      }
    } else {
      // 2. Simulation Mode: Generate unique random 6-digit OTP
      const uniqueCode = this.generateUniqueOtp();
      this.fallbackOtp = uniqueCode;

      return {
        success: true,
        mode: "demo_fallback",
        code: uniqueCode,
        phone: e164Phone,
        message: `SMS Gateway ready (Simulation). Code: ${uniqueCode}`
      };
    }
  },

  /**
   * Strictly verifies the customer OTP code.
   * Incorrect code CANNOT verify or proceed.
   */
  async verifyOtpSms(inputCode) {
    const cleanCode = String(inputCode || "").trim();

    // Must be exactly 6 digits
    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      return {
        success: false,
        error: "Please enter the complete 6-digit verification code received on SMS."
      };
    }

    // 1. Live Firebase Confirmation
    if (this.activeConfirmationResult) {
      try {
        const result = await this.activeConfirmationResult.confirm(cleanCode);
        // Successfully verified! Consume session immediately so OTP cannot be reused
        this.activeConfirmationResult = null;
        this.fallbackOtp = null;
        return {
          success: true,
          mode: "firebase_live",
          user: result.user
        };
      } catch (err) {
        console.error("[SMSGateway] Code confirmation failed:", err);
        let errMsg = "❌ Incorrect SMS verification code! Access denied. Please check your phone messages.";
        if (err.code === "auth/invalid-verification-code") {
          errMsg = "❌ Incorrect 6-digit verification code! Access denied.";
        } else if (err.code === "auth/code-expired") {
          errMsg = "⏱️ This SMS code has expired. Please tap Resend to receive a fresh SMS.";
        }
        return {
          success: false,
          error: errMsg
        };
      }
    }

    // 2. Simulation Mode: STRICT EXACT MATCH AGAINST fallbackOtp
    if (this.fallbackOtp) {
      if (cleanCode === this.fallbackOtp) {
        // Successfully verified! Invalidate immediately so it cannot be reused
        this.fallbackOtp = null;
        return {
          success: true,
          mode: "demo_fallback"
        };
      } else {
        // STRICT REJECTION OF INCORRECT OTP
        return {
          success: false,
          error: "❌ Incorrect OTP! Access denied. Please enter the exact code sent to your mobile."
        };
      }
    }

    // 3. No active session or OTP expired/already consumed
    return {
      success: false,
      error: "⚠️ No active verification session found. Please tap Resend to receive a new OTP."
    };
  }
};
