# GrossHub — Quick-Commerce Grocery Platform

GrossHub is an express grocery delivery platform for Agartala, Tripura, delivering essentials in 30–45 minutes with real-time GPS tracking, dispatch management, customer ordering, and merchant administration.

---

## 🚀 Quick Start (1-Click Run)

To run GrossHub locally, run either command from your terminal:

```bash
./start.sh
```

or:

```bash
python3 start.py
```

### What this does:
1. **Finds an open port** (defaults to `8080`, or next available).
2. **Starts a local HTTP server** with no-cache headers for instant code reloads.
3. **Automatically opens your default web browser** to the GrossHub Storefront.
4. **Displays direct links** to all 4 portals in your terminal.

---

## 🌐 Portals & Default Credentials

| Portal | Local URL | Default Login |
| :--- | :--- | :--- |
| 🛒 **Customer Storefront** | [http://localhost:8080/](http://localhost:8080/) | Any 10-digit mobile number + SMS OTP |
| 👤 **Customer Account** | [http://localhost:8080/customer.html](http://localhost:8080/customer.html) | Mobile OTP Login |
| 🛵 **Rider Dispatch** | [http://localhost:8080/rider.html](http://localhost:8080/rider.html) | Password: `rider123` |
| 🏪 **Admin Control Center** | [http://localhost:8080/admin.html](http://localhost:8080/admin.html) | Password: `grosshub123` |

---

## 🛑 How to Stop the Server
Press **`Ctrl + C`** in the terminal where `start.sh` or `start.py` is running.

---

## 📱 How to Open on Your Mobile Phone

1. Ensure your phone is connected to the **same Wi-Fi network** as your computer.
2. Run `./start.sh` or `python3 start.py`.
3. An **ASCII QR Code** and local network URL (e.g. `http://192.168.x.x:8080/`) will appear in your terminal.
4. Point your phone camera at the terminal screen to scan the QR code and tap to open GrossHub instantly!
5. **Install as App:**
   - **Android (Chrome):** Tap the **"Install GrossHub App"** banner at the bottom or browser menu ➔ **"Install app"**.
   - **iPhone (Safari):** Tap the Share button (⎋) at the bottom ➔ select **"Add to Home Screen" ➕**.
