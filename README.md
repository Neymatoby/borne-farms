# 🌾 BORNE FARMS — Smart Cattle Ownership Dashboard

Welcome to **BORNE FARMS**, a premium, state-of-the-art agricultural management and smart cattle ownership dashboard. This project combines modern geospatial tracking, real-time computer vision analysis, feed management, and farm advisories into a single, cohesive web application.

Designed with an editorial aesthetic inspired by modern tech interfaces (cork brown + cutting-mat green color scheme, elegant micro-animations, and grain overlay), it delivers an immersive experience for cattle owners and farm managers.

---

## 🚀 Key Features

- 📊 **Cattle Ownership Dashboard**: Monitor cattle inventory (bulls, cows, calves), gestational status, health, and milk production metrics in real-time.
- 🗺️ **Geospatial Intelligence (Farm Map)**: Interactive paddock rotation maps using [Leaflet.js](https://leafletjs.com/), allowing tracking of animal movements, pasture conditions, and quarantine zones.
- 📹 **AI-Powered UAV & CCTV Feeds**: Real-time video feeds with live object counting. Integrated with a Python backend using **YOLO (v8/11)** to automatically detect and count cows and humans.
- 🌾 **Feed & Growth Tiers**: Manage feed inventory (hay, silage, grains, protein supplements) and unlock growth tiers to optimize herd productivity.
- 🌦️ **Weather & Crop Advisor**: Integrated weather updates and a smart crop advisory system to plan agricultural activities.

---

## 🛠️ Tech Stack

### Frontend
- **Markup & Styling**: Semantic HTML5 & Vanilla CSS (dynamic custom themes, glassmorphism, responsive grid system).
- **Core Logic**: Vanilla JavaScript (modular architecture across specific files in `/js`).
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) for data visualization.
  - [Leaflet.js](https://leafletjs.com/) for interactive farm maps.
  - [Lucide Icons](https://lucide.dev/) for sleek, modern UI iconography.

### Backend (AI & Data)
- **Framework**: Python [Flask](https://flask.palletsprojects.com/) with Flask-CORS.
- **Database**: SQLite3 (`borne_farms.sqlite3`).
- **Computer Vision**: [OpenCV](https://opencv.org/) for video frame processing.
- **Deep Learning**: [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) for object detection.

---

## 📁 Project Structure

```text
borne-farms/
├── js/                       # Modular Frontend Logic
│   ├── app.js                # Core app controller and setup
│   ├── crop-advisor.js       # Crop recommendations & planner
│   ├── dashboard.js          # Main statistics, cards & chart config
│   ├── data.js               # Mock data & state management
│   ├── feed.js               # Feed inventory & purchasing logic
│   ├── finance.js            # Transaction logs, income/expense tracking
│   ├── geospatial.js         # Map layers, paddocks & animal tracking
│   ├── health.js             # Herd health statistics & diagnostics
│   ├── livestock.js          # Cattle registration & detail views
│   ├── movement.js           # Paddock rotation & transfer logic
│   └── weather.js            # Weather API integrations & status
├── assets/                   # Media assets, icons & graphics
├── data/                     # Database files
├── uploads/                  # Temporary upload storage
├── ai_backend.py             # Flask API server & YOLO detection pipeline
├── index.html                # Main dashboard web interface
├── landing.html              # Marketing & editorial landing page
├── index.css                 # Main stylesheet containing design system
├── manifest.json             # PWA web manifest
├── sw.js                     # PWA Service Worker for offline capabilities
├── package.json              # Project definition & scripts
└── README.md                 # Project documentation (this file)
```

---

## ⚙️ Getting Started

### 1. Run the Frontend Dashboard
Since the frontend is built with pure HTML/CSS/JS, you can run it using any simple local development server or open it directly:
* **Option A**: Run using VS Code's Live Server extension.
* **Option B**: Double-click `landing.html` or `index.html` to run locally in the browser.
* **Option C**: Spin up a quick Python HTTP server:
  ```bash
  python -m http.server 8000
  ```
  Then open `http://localhost:8000/landing.html` in your browser.

### 2. Set Up the AI Backend
The backend processes video streams and executes the YOLO detection pipeline.

1. **Install Dependencies**:
   Ensure you have Python 3.8+ installed. Set up a virtual environment and install the required libraries:
   ```bash
   # Create a virtual environment
   python -m venv venv
   # Activate it
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate

   # Install packages
   pip install flask flask-cors opencv-python ultralytics
   ```

2. **YOLO Models**:
   Make sure you download a YOLO weights file (e.g. `yolov8n.pt` or `yolo11m.pt`) and place it in the project root directory.

3. **Environment Variables**:
   You can customize the backend behavior using environment variables:
   - `BORNE_DB_PATH`: Path to the SQLite database. Defaults to `data/borne_farms.sqlite3`.
   - `BORNE_API_TOKEN`: API validation token if needed.
   - `YOLO_MODEL`: Path to the YOLO weight file. Defaults to `yolo11m.pt`.
   - `UAV_CONFIDENCE`: YOLO detection confidence limit (0.00 to 1.00).

4. **Run the Server**:
   ```bash
   python ai_backend.py
   ```
   The Flask server will start running on `http://127.0.0.1:5000`.

---

## 🌾 Live Monitoring & Object Detection Configs
The backend exposes stream endpoints to draw bounding boxes around detected objects. Adjust the variables inside `ai_backend.py` or through your `.env` configuration to fine-tune the tracking confidence (`UAV_CONFIDENCE` & `CCTV_CONFIDENCE`) or stride parameters (`UAV_FRAME_STRIDE`) to balance accuracy and processing performance.
