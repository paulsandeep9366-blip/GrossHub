/**
 * GrossHub - SMS & Customer OTP Gateway
 * Powered by Google Firebase Phone Authentication (10,000 free SMS/mo)
 * Delivers real cellular SMS OTPs to customer mobile numbers without needing a backend server.
 * Enforces strict rejection of incorrect OTPs and consumes sessions upon verification.
 */

const SMSGateway = {
  activeConfirmationResult: null,
  activeTargetPhone: "",
  activeCustomerName: "",
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
      } else {
        const currentApp = firebase.app();
        if (currentApp.options && (currentApp.options.apiKey !== cfg.apiKey || currentApp.options.projectId !== cfg.projectId)) {
          currentApp.delete().then(() => {
            firebase.initializeApp(cfg);
            console.log("[SMSGateway] Firebase Phone Auth re-initialized with updated credentials.");
          }).catch(e => {
            console.warn("[SMSGateway] Firebase re-init note:", e);
          });
        }
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
   * Dispatches a real cellular SMS OTP to customer mobile phone (+91) via Firebase
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
    this.activeConfirmationResult = null;

    // Strict requirement: Firebase credentials must be configured for real SMS
    if (!this.isFirebaseConfigured()) {
      return {
        success: false,
        error: "⚠️ Firebase SMS Gateway credentials not yet configured in Admin Portal. Please enter your Firebase API Key and Project ID in Admin Settings (admin.html) to send live SMS."
      };
    }

    if (typeof firebase === "undefined") {
      return {
        success: false,
        error: "Google Firebase SDK is currently loading. Please check your internet connection and try again."
      };
    }

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
        userMsg = "Too many SMS requests to this phone number. Please try again in a few minutes.";
      } else if (err.code === "auth/quota-exceeded") {
        userMsg = "Daily SMS quota reached on your Firebase project. Please check Firebase console.";
      } else if (err.code === "auth/billing-not-enabled") {
        userMsg = "Firebase Phone Authentication requires identity verification in Firebase console.";
      } else if (err.code === "auth/invalid-app-credential") {
        userMsg = "Invalid Firebase credentials. Please verify your API Key and Project ID in Admin Settings.";
      }

      return {
        success: false,
        error: userMsg,
        rawError: err
      };
    }
  },

  /**
   * Strictly verifies the customer OTP code via Firebase Phone Auth confirmation.
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

    if (!this.activeConfirmationResult) {
      return {
        success: false,
        error: "⚠️ No active SMS verification session found. Please tap Resend to receive a fresh SMS OTP."
      };
    }

    try {
      const result = await this.activeConfirmationResult.confirm(cleanCode);
      // Successfully verified! Invalidate confirmation result immediately so it cannot be reused
      this.activeConfirmationResult = null;
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
};
