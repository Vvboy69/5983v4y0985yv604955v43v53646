# Texting App

Split deployment: **Netlify** (frontend) + **Render** (API)

## 🚀 Deployment Steps

### 1. Deploy API to Render

1. Push this entire repo to **GitHub**
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variable:**
     - `JWT_SECRET` = (generate a random string)
     - `ALLOWED_ORIGIN` = `https://your-site.netlify.app` (your Netlify URL)
5. Deploy!
6. Copy your Render URL (e.g., `https://texting-api.onrender.com`)

### 2. Deploy Frontend to Netlify

1. Open `public/index.html`
2. Find this line (~line 376):
   ```javascript
   const API_URL = 'https://your-app-name.onrender.com';
   ```
3. Replace with your **actual Render URL**
4. Push to GitHub (or drag `public/` folder to Netlify)
5. Go to [netlify.com](https://netlify.com) → New site from Git
6. Select your repo
7. Build settings:
   - **Publish directory:** `public`
   - Or just use the `netlify.toml` (already configured)
8. Deploy!

### 3. Update CORS on Render

After Netlify deploys, go back to Render and set:
- `ALLOWED_ORIGIN` = `https://your-site.netlify.app`

---

## 📁 File Distribution

### Upload to Render (API):
```
texting/
├── server.js
├── package.json
├── netlify.toml (optional, ignored by Render)
└── db.json (auto-created)
```

### Upload to Netlify (Website):
```
public/
└── index.html
```

---

## 🏥 Uptime Robot Monitoring

Use your Render health endpoint:
```
https://your-app.onrender.com/api/health
```

Expected response: `{"status":"ok",...}`
