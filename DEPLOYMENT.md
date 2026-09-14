# GrossHub Deployment Guide — GitHub Pages & Custom Domain (grosshub.in)

The repository has already been initialized with a clean root commit containing all production assets and the `CNAME` file for `grosshub.in`.

---

## Step 1: Create a Repository on GitHub

1. Open [GitHub New Repository](https://github.com/new).
2. Set **Repository name** (e.g., `grosshub` or `grosshub-store`).
3. Set visibility to **Public** (required for free GitHub Pages).
4. Do **NOT** initialize with a README, .gitignore, or license (the local repo already has everything).
5. Click **Create repository**.

---

## Step 2: Push Your Local Code to GitHub

Open Terminal on your Mac and run these commands:

```bash
cd "/Users/sandeeppaul/.gemini/antigravity-ide/brain/c2190df4-c479-450f-9a9b-5ab58bf19250/GrossHub New"

# Replace <YOUR_GITHUB_USERNAME> with your actual GitHub handle:
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/grosshub.git
git branch -M main
git push -u origin main
```

---

## Step 3: Enable GitHub Pages

1. In your GitHub repository, go to **Settings** (top tab).
2. In the left sidebar, click **Pages** (under the "Code and automation" section).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` and folder `/(root)`.
   - Click **Save**.
4. Under **Custom domain**:
   - You will see `grosshub.in` automatically detected from the included `CNAME` file.
   - Check the box **Enforce HTTPS** once the DNS check completes.

---

## Step 4: DNS Settings for `grosshub.in` (Domain Registrar)

In your domain provider's DNS management (GoDaddy, Namecheap, Cloudflare, etc.), configure:

| Type | Host / Name | Target / Value |
| :--- | :--- | :--- |
| **A** | `@` | `185.199.108.153` |
| **A** | `@` | `185.199.109.153` |
| **A** | `@` | `185.199.110.153` |
| **A** | `@` | `185.199.111.153` |
| **CNAME** | `www` | `<YOUR_GITHUB_USERNAME>.github.io` |

---

## Your Live Store URLs
- **Custom Domain**: `https://grosshub.in`
- **GitHub Default URL**: `https://<YOUR_GITHUB_USERNAME>.github.io/grosshub/`
