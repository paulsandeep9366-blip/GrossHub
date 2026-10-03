# GrossHub Deployment Guide — GitHub Pages & Custom Domain (grosshub.in)

The repository has already been initialized with a clean root commit containing all production assets and the `CNAME` file for `grosshub.in`.

---

## 🌐 Separate Portal Direct Links

Each portal is completely isolated with its own dedicated direct URL:

### 1. Production (`grosshub.in`)
- 🛒 **Customer Storefront**: [https://grosshub.in/](https://grosshub.in/) (or `https://grosshub.in/index.html`)
- 👤 **Customer Account Direct**: [https://grosshub.in/customer.html](https://grosshub.in/customer.html)
- 🛵 **Rider Dispatch Portal**: [https://grosshub.in/rider.html](https://grosshub.in/rider.html)
- 🏪 **Merchant Admin Control Center**: [https://grosshub.in/admin.html](https://grosshub.in/admin.html)

### 2. GitHub Pages (`github.io`)
- 🛒 **Customer Storefront**: [https://paulsandeep9366-blip.github.io/GrossHub/](https://paulsandeep9366-blip.github.io/GrossHub/)
- 👤 **Customer Account Direct**: [https://paulsandeep9366-blip.github.io/GrossHub/customer.html](https://paulsandeep9366-blip.github.io/GrossHub/customer.html)
- 🛵 **Rider Dispatch Portal**: [https://paulsandeep9366-blip.github.io/GrossHub/rider.html](https://paulsandeep9366-blip.github.io/GrossHub/rider.html)
- 🏪 **Merchant Admin Control Center**: [https://paulsandeep9366-blip.github.io/GrossHub/admin.html](https://paulsandeep9366-blip.github.io/GrossHub/admin.html)

### 3. Local Development (`localhost:8080`)
- 🛒 **Customer Storefront**: [http://localhost:8080/](http://localhost:8080/)
- 👤 **Customer Account Direct**: [http://localhost:8080/customer.html](http://localhost:8080/customer.html)
- 🛵 **Rider Dispatch Portal**: [http://localhost:8080/rider.html](http://localhost:8080/rider.html)
- 🏪 **Merchant Admin Control Center**: [http://localhost:8080/admin.html](http://localhost:8080/admin.html)

---

## Default Login Credentials
- **Merchant Admin Password**: `grosshub123`
- **Rider Passwords**: `rider123` (IDs: `bikash`, `rahul`, `samir`)
- **Customer Gate**: Any valid 10-digit mobile number + SMS OTP verification

---

## DNS Settings for `grosshub.in` (Domain Registrar)

In your domain provider's DNS management (GoDaddy, Namecheap, Cloudflare, etc.), configure:

| Type | Host / Name | Target / Value |
| :--- | :--- | :--- |
| **A** | `@` | `185.199.108.153` |
| **A** | `@` | `185.199.109.153` |
| **A** | `@` | `185.199.110.153` |
| **A** | `@` | `185.199.111.153` |
| **CNAME** | `www` | `paulsandeep9366-blip.github.io` |
