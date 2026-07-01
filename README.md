# 🌾 BORNE FARMS — Smart Cattle Ownership Platform

**Borne Farms** is a pastoral platform for modern cattle farming, diaspora investment, and data-driven herd management. It combines farm operations, investor marketplace, real-time monitoring, and AI-powered intelligence into a single responsive web application.

Built for three audiences:
- **Farmers** — manage livestock, health, feed, movement, and paddocks.
- **Investors** — buy cattle units, track portfolio growth, and receive revenue splits.
- **Diaspora Nigerians** — own farmland-backed assets from abroad with full transparency.

---

## 🚀 Key Features

### Farm Operations
- **Livestock Management** — register bulls, cows, and calves; track health, gestation, and weight.
- **Geospatial Intelligence** — interactive paddock maps with Leaflet.js for rotation, quarantine zones, and movement tracking.
- **AI UAV & CCTV Feeds** — real-time video streams with YOLO-based cow and human detection.
- **Feed & Growth Tiers** — manage hay, silage, grain, and supplements; unlock productivity tiers.
- **Weather & Crop Advisor** — local weather data and smart planting windows.
- **Voice Notes** — field workers can record audio observations directly in the browser.
- **Weight Estimation** — estimate cattle weight from a side-profile photo using body contour analysis.
- **Theft Alerts** — geofence breach detection and alert tracking.

### Investment & Marketplace
- **Wallet** — deposit, withdraw, and track NGN transactions.
- **Breed Marketplace** — buy and sell cattle units.
- **Offers & Escrow** — accept or reject offers with automatic wallet transfers.
- **Co-Ownership** — split cattle ownership into fractional shares and distribute revenue.
- **Diaspora Portal** — public overview of farm performance, breed lots, and live cameras.
- **Profitability Simulator** — simulate ROI under different feed tiers, timelines, and herd sizes.
- **Price Intelligence** — historical breed pricing with fair-value estimates and trend recommendations.
- **QR Traceability** — paddock-to-plate QR codes for every cattle unit.

### Intelligence
- **Mortality Risk Scoring** — predictive risk scores per cattle category based on health, feed, and weather stress.
- **NDVI Pasture Scan** — analyze drone photos for vegetation health using pseudo-NDVI.
- **Milk & Health Logging** — record daily milk output and health events.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5, Vanilla CSS, Vanilla JavaScript** — modular architecture in `/js`.
- **Chart.js** — data visualization.
- **Leaflet.js** — interactive maps.
- **Lucide Icons** — UI icons.

### Backend
- **Python Flask** with Flask-CORS.
- **SQLite3** — `data/borne_farms.sqlite3`.
- **OpenCV** — video frame and image processing.
- **Ultralytics YOLO** — cattle and person detection.

---

## 📁 Project Structure

```text
borne-farms/
├── js/                       # Frontend modules
│   ├── app.js                # Core app controller, auth, routing
│   ├── intelligence.js       # Intelligence features (10 unique modules)
│   ├── dashboard.js          # Statistics, charts, dashboard widgets
│   ├── finance.js            # Wallet, marketplace, offers, portfolio
│   ├── data.js               # State management and backend sync
│   ├── feed.js               # Feed inventory & consumption
│   ├── geospatial.js         # Maps and paddocks
│   ├── health.js             # Health records and issues
│   ├── livestock.js          # Cattle registration
│   ├── movement.js           # Movement tracking
│   ├── weather.js            # Weather integration
│   └── crop-advisor.js       # Crop recommendations
├── assets/                   # Logos, images, hero video
├── data/                     # SQLite database
├── uploads/                  # Uploaded videos, images, voice notes
├── ai_backend.py             # Flask API server & AI pipeline
├── dashboard.html            # Main authenticated dashboard
├── login.html                # Authentication page (farmer / investor)
├── landing-arva.html         # Marketing landing page
├── trace.html                # Public QR traceability page
├── terms.html                # Terms & Conditions
├── privacy.html              # Privacy Policy
├── index.css                 # Main stylesheet
├── theme.css                 # Theme system
├── manifest.json             # PWA manifest
└── README.md                 # This file
```

---

## ⚙️ Getting Started

### 1. Run the Backend

```bash
# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python ai_backend.py
```

The backend runs at `http://127.0.0.1:5000`.

### 2. Run the Frontend

```bash
python -m http.server 8080
```

Open `http://localhost:8080/landing-arva.html` for the public landing page, or `http://localhost:8080/login.html` to sign in.

### Default Login

The backend seeds a demo account on first run:
- **Email:** `manager@bornefarms.com`
- **Password:** `borne123`

### 3. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BORNE_DB_PATH` | SQLite database path | `data/borne_farms.sqlite3` |
| `YOLO_MODEL` | YOLO weights file | `yolo11m.pt` |
| `UAV_CONFIDENCE` | Drone detection confidence | `0.35` |
| `CCTV_CONFIDENCE` | CCTV detection confidence | `0.25` |

---

## 🌐 Pages

| Page | Purpose |
|------|---------|
| `landing-arva.html` | Public marketing page |
| `login.html` | Authentication (farmer / investor) |
| `dashboard.html` | Authenticated dashboard |
| `trace.html` | Public QR traceability lookup |
| `terms.html` | Terms & Conditions |
| `privacy.html` | Privacy Policy |

---

## 📱 Mobile & PWA

Borne Farms is a Progressive Web App (PWA). The dashboard has a mobile bottom navigation bar, responsive grids, bottom-sheet modals, and safe-area support for iPhones. Users can install it to their home screen on Android and iOS.

---

## ⚠️ Demo Mode

Payment rails (Paystack, Flutterwave, Stripe) and wallet deposits are simulated. The UI labels clearly indicate "Demo" status. Add real API keys and payment webhooks before production use.

---

## 📬 Contact

- **Email:** hello@bornefarms.com
- **Phone:** +234 901 234 5678
- **WhatsApp:** https://wa.me/2349012345678
- **Address:** Plot 245, Central Business District, Abuja, Nigeria

---

&copy; 2026 Borne Farms. A pastoral platform.
