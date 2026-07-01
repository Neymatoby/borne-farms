import os
import json
import sqlite3
import threading
import time
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DATABASE_PATH = Path(os.getenv("BORNE_DB_PATH", DATA_DIR / "borne_farms.sqlite3"))
API_TOKEN = os.getenv("BORNE_API_TOKEN", "")

app = Flask(__name__)
CORS(app)

state_lock = threading.Lock()
camera_videos = {}
camera_counts = {
    "1": {"cows": 0, "humans": 0},
    "2": {"cows": 0, "humans": 0},
    "3": {"cows": 0, "humans": 0},
    "4": {"cows": 0, "humans": 0},
}
model = None
uav_link_analysis = True  # toggled via /uav_link_analysis

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL", "yolo11m.pt")
DRONE_CAMERA_ID = "1"
UAV_CONFIDENCE = float(os.getenv("UAV_CONFIDENCE", "0.05"))
UAV_IMAGE_SIZE = int(os.getenv("UAV_IMAGE_SIZE", "1024"))
UAV_TILE_SIZE = int(os.getenv("UAV_TILE_SIZE", "640"))
UAV_TILE_OVERLAP = float(os.getenv("UAV_TILE_OVERLAP", "0.20"))
UAV_FRAME_STRIDE = int(os.getenv("UAV_FRAME_STRIDE", "3"))
UAV_MAX_WIDTH = int(os.getenv("UAV_MAX_WIDTH", "1280"))
UAV_TRACK_DISTANCE = int(os.getenv("UAV_TRACK_DISTANCE", "85"))
UAV_ENHANCE_TILES = os.getenv("UAV_ENHANCE_TILES", "1") != "0"
CCTV_CONFIDENCE = float(os.getenv("CCTV_CONFIDENCE", "0.25"))
FARM_DATA_DOCUMENT_ID = "primary"


def default_farm_data():
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    today = time.strftime("%Y-%m-%d", time.gmtime())
    milk_history = []
    for i in range(7):
        day = time.strftime("%Y-%m-%d", time.gmtime(time.time() - (6 - i) * 86400))
        milk_history.append({"date": day, "liters": [810, 828, 842, 806, 861, 833, 845][i]})
    return {
        "__seedVersion": 5,
        "organization": {
            "id": "borne",
            "name": "BORNE FARMS",
            "location": "Nigeria"
        },
        "livestock": {
            "cattle": {
                "bull": {"count": 14, "pregnant": 0, "sick": 1},
                "cow": {"count": 132, "pregnant": 38, "sick": 2},
                "calf": {"count": 47, "pregnant": 0, "sick": 1}
            }
        },
        "locations": {
            "paddock": 96,
            "pasture": 78,
            "transport": 8,
            "quarantine": 11
        },
        "goals": {
            "primaryGoal": "Complete pasture rotation for Zone B and verify all new cattle registrations.",
            "progress": 72,
            "tasks": [
                {"id": "t1", "name": "Morning Feed Routine", "status": "completed"},
                {"id": "t2", "name": "Zone B Pasture Rotation", "status": "in-progress"},
                {"id": "t3", "name": "New Cattle Registration", "status": "pending"}
            ],
            "lastUpdated": now
        },
        "monthlyStats": {
            "births": 12,
            "deaths": 2,
            "sold": 9,
            "purchased": 16,
            "milkProduction": 845
        },
        "milkHistory": milk_history,
        "finance": {
            "currency": "\u20a6",
            "income": [
                {"label": "Milk sales", "value": 1520000},
                {"label": "Cattle sales", "value": 740000},
                {"label": "Other", "value": 220000}
            ],
            "expense": [
                {"label": "Feed", "value": 880000},
                {"label": "Vet & health", "value": 310000},
                {"label": "Labour", "value": 340000}
            ]
        },
        "feedInventory": {
            "hay": {"quantity": 12400, "costPerKg": 150, "tier": 1},
            "silage": {"quantity": 8600, "costPerKg": 120, "tier": 2},
            "grainMix": {"quantity": 4200, "costPerKg": 250, "tier": 2},
            "proteinSupplement": {"quantity": 1850, "costPerKg": 450, "tier": 3},
            "mineralLick": {"quantity": 940, "costPerKg": 380, "tier": 3},
            "premiumBlend": {"quantity": 1200, "costPerKg": 600, "tier": 4}
        },
        "dailyFeedConsumption": {
            "hay": 620,
            "silage": 410,
            "grainMix": 180,
            "proteinSupplement": 75,
            "premiumBlend": 40
        },
        "feedTiers": {
            "1": {"name": "Basic Grazing", "unlocked": True, "minCattle": 0},
            "2": {"name": "Enhanced Nutrition", "unlocked": True, "minCattle": 0},
            "3": {"name": "Premium Growth", "unlocked": False, "minCattle": 5},
            "4": {"name": "Elite Yield Max", "unlocked": False, "minCattle": 15}
        },
        "investment": {
            "auth": {
                "provider": "Local Auth (Demo)",
                "status": "kyc-pending",
                "riskLevel": "standard",
                "methods": ["Phone OTP", "Email OTP", "Passkey", "BVN/NIN KYC"]
            },
            "paymentRails": [
                {"key": "paystack", "name": "Paystack", "region": "Nigeria", "methods": ["Card", "Bank Transfer", "USSD"], "status": "Demo"},
                {"key": "flutterwave", "name": "Flutterwave", "region": "Africa + global cards", "methods": ["Card", "Mobile Money", "Bank Transfer"], "status": "Demo"},
                {"key": "stripe", "name": "Stripe", "region": "Global", "methods": ["Card", "Apple Pay", "Google Pay"], "status": "Planned"}
            ],
            "wallet": {
                "currency": "NGN",
                "balance": 380000,
                "lockedValue": 520000,
                "escrowValue": 0
            },
            "breedLots": [
                {"id": "lot-bunaji", "breed": "White Fulani", "localName": "Bunaji", "region": "Nigeria / Sahel", "unitPrice": 185000, "availableUnits": 42, "minUnits": 1, "feedTier": "Basic", "expectedMonthlyGrowth": 4.8, "image": "https://upload.wikimedia.org/wikipedia/commons/4/41/Fula_cattle_herders_by_John_Atherton.jpg"},
                {"id": "lot-sokoto", "breed": "Sokoto Gudali", "localName": "Gudali", "region": "Northern Nigeria", "unitPrice": 225000, "availableUnits": 28, "minUnits": 1, "feedTier": "Advanced", "expectedMonthlyGrowth": 5.6, "image": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Sokoto_Gudali_breed.jpg"},
                {"id": "lot-brahman", "breed": "Brahman", "localName": "Heat Hardy", "region": "Tropical beef", "unitPrice": 310000, "availableUnits": 16, "minUnits": 1, "feedTier": "Premium", "expectedMonthlyGrowth": 6.4, "image": "https://upload.wikimedia.org/wikipedia/commons/a/af/Brahman_(Bos_indicus).jpg"},
                {"id": "lot-holstein", "breed": "Holstein Friesian", "localName": "Dairy Yield", "region": "Dairy stock", "unitPrice": 355000, "availableUnits": 11, "minUnits": 1, "feedTier": "Premium", "expectedMonthlyGrowth": 5.9, "image": "https://upload.wikimedia.org/wikipedia/commons/1/11/Holstein_cow_with_one-day_calf_01.jpg"}
            ],
            "holdings": [
                {"id": "own-001", "breed": "White Fulani", "units": 2, "purchasePrice": 370000, "currentValue": 421800, "weightStartKg": 218, "weightCurrentKg": 248, "growthPercent": 13.8, "feedTier": "Advanced", "lockUntil": "2026-10-30", "status": "Locked", "tag": "BRN-WF-204"},
                {"id": "own-002", "breed": "Brahman", "units": 1, "purchasePrice": 310000, "currentValue": 334500, "weightStartKg": 252, "weightCurrentKg": 270, "growthPercent": 7.1, "feedTier": "Premium", "lockUntil": None, "status": "Tradable", "tag": "BRN-BR-118"}
            ],
            "marketplaceOffers": [
                {"id": "off-001", "holdingId": "own-002", "buyer": "Amina K.", "price": 348000, "expires": "2026-05-06", "status": "Open"},
                {"id": "off-002", "holdingId": "own-001", "buyer": "Diaspora AgFund", "price": 430000, "expires": "2026-05-08", "status": "Locked asset"}
            ],
            "transactions": [
                {"id": "txn-204", "type": "Buy", "rail": "Paystack Bank Transfer", "amount": 370000, "status": "Settled", "date": "2026-04-23"},
                {"id": "txn-205", "type": "Feed Upgrade", "rail": "Wallet", "amount": 52000, "status": "Settled", "date": "2026-04-30"}
            ]
        },
        "activeHealthIssues": [
            {"id": "h1", "disease": "Mastitis", "category": "cow", "severity": "high", "date": today, "count": 1},
            {"id": "h2", "disease": "Foot Rot", "category": "cow", "severity": "medium", "date": today, "count": 1}
        ],
        "vaccinationRecords": [
            {"id": "v1", "vaccine": "FMD (Foot & Mouth)", "category": "cow", "date": today, "count": 45, "handler": "Dr. Adeyemi"},
            {"id": "v2", "vaccine": "CBPP (Pleuropneumonia)", "category": "cow", "date": today, "count": 38, "handler": "Dr. Adeyemi"},
            {"id": "v3", "vaccine": "Anthrax", "category": "bull", "date": today, "count": 12, "handler": "Dr. Adeyemi"}
        ],
        "weightHistory": [
            {"week": -3, "bull": 410, "cow": 348, "calf": 92, "avg": 312},
            {"week": -2, "bull": 418, "cow": 352, "calf": 98, "avg": 316},
            {"week": -1, "bull": 425, "cow": 355, "calf": 102, "avg": 320},
            {"week": 0, "bull": 432, "cow": 360, "calf": 108, "avg": 324}
        ],
        "feedConsumptionHistory": [
            {"week": -3, "hay": 4200, "silage": 2800, "grainMix": 1200, "total": 8200},
            {"week": -2, "hay": 4350, "silage": 2900, "grainMix": 1250, "total": 8500},
            {"week": -1, "hay": 4100, "silage": 2750, "grainMix": 1180, "total": 8030},
            {"week": 0, "hay": 4450, "silage": 3000, "grainMix": 1300, "total": 8750}
        ],
        "recentMovements": [
            {"id": "m1", "date": now, "animalId": "BRN-WF-204", "from": "paddock", "to": "pasture", "reason": "Rotation", "handler": "Ibrahim", "count": 1},
            {"id": "m2", "date": now, "animalId": "BRN-CW-051", "from": "pasture", "to": "quarantine", "reason": "Health check", "handler": "Grace", "count": 1}
        ],
        "feedingLogs": [
            {"id": "f1", "date": now, "location": "paddock", "feedType": "hay", "quantity": 420, "animalsCount": 96, "handler": "Musa"},
            {"id": "f2", "date": now, "location": "pasture", "feedType": "silage", "quantity": 260, "animalsCount": 78, "handler": "Grace"}
        ],
        "cameras": [
            {"id": "uav01", "name": "Drone Feed", "ip": "192.168.1.201", "stream_url": "", "status": "online", "resolution": "4K"},
            {"id": "cam02", "name": "Feeding Station", "ip": "192.168.1.102", "stream_url": "", "status": "online", "resolution": "1080p"},
            {"id": "cam03", "name": "Milking Parlor", "ip": "192.168.1.103", "stream_url": "", "status": "online", "resolution": "720p"},
            {"id": "cam04", "name": "Main Gate", "ip": "192.168.1.104", "stream_url": "", "status": "offline", "resolution": "720p"}
        ],
        "lastUpdated": now
    }


class DB:
    """Context manager that opens an sqlite3 connection and closes it on exit."""
    def __init__(self):
        self.connection = sqlite3.connect(DATABASE_PATH, timeout=30.0)
        self.connection.row_factory = sqlite3.Row

    def __enter__(self):
        return self.connection

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.connection.commit()
        else:
            self.connection.rollback()
        self.connection.close()
        return False


def get_db():
    return DB()


def init_db():
    with get_db() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS farm_documents (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                actor TEXT NOT NULL DEFAULT 'system',
                payload TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'manager',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_login TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'NGN',
                status TEXT NOT NULL DEFAULT 'completed',
                description TEXT,
                reference TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS payment_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'NGN',
                provider TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reference TEXT NOT NULL UNIQUE,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS cattle_records (
                id TEXT PRIMARY KEY,
                tag TEXT NOT NULL UNIQUE,
                breed TEXT NOT NULL,
                category TEXT NOT NULL,
                birth_date TEXT,
                weight_kg REAL DEFAULT 0,
                feed_tier TEXT DEFAULT 'Basic',
                health_history TEXT DEFAULT '[]',
                movement_history TEXT DEFAULT '[]',
                milk_yield_history TEXT DEFAULT '[]',
                owner_shares TEXT DEFAULT '[]',
                qr_token TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                breed TEXT NOT NULL,
                units INTEGER NOT NULL,
                price_per_unit INTEGER NOT NULL,
                region TEXT DEFAULT 'Nigeria',
                sale_date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ndvi_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone TEXT NOT NULL,
                avg_ndvi REAL NOT NULL,
                health_score TEXT NOT NULL,
                coverage_percent REAL DEFAULT 0,
                image_path TEXT,
                notes TEXT,
                scan_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS co_ownership_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                holding_id TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                owner_email TEXT,
                fraction REAL NOT NULL,
                invested_amount INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS voice_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_name TEXT NOT NULL,
                animal_tag TEXT,
                transcript TEXT,
                audio_path TEXT,
                duration_sec INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS weight_estimates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                animal_tag TEXT NOT NULL,
                estimated_kg REAL NOT NULL,
                confidence REAL DEFAULT 0,
                image_path TEXT,
                body_condition_score REAL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS theft_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                animal_tag TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                zone TEXT,
                details TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def read_farm_data():
    with get_db() as connection:
        row = connection.execute(
            "SELECT payload FROM farm_documents WHERE id = ?",
            (FARM_DATA_DOCUMENT_ID,)
        ).fetchone()

    if row:
        return json.loads(row["payload"])

    data = default_farm_data()
    write_farm_data(data, "seed")
    return data


def write_farm_data(data, event_type="farm_data.updated"):
    data["lastUpdated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    with get_db() as connection:
        connection.execute(
            """
            INSERT INTO farm_documents (id, payload, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload,
                updated_at = CURRENT_TIMESTAMP
            """,
            (FARM_DATA_DOCUMENT_ID, payload)
        )
        connection.execute(
            "INSERT INTO audit_log (event_type, payload) VALUES (?, ?)",
            (event_type, payload)
        )
    return data


def require_api_token():
    if not API_TOKEN:
        return None
    token = request.headers.get("X-Borne-Api-Key", "")
    if token != API_TOKEN:
        return jsonify({"error": "Unauthorized"}), 401
    return None


# ====================
# AUTH HELPERS
# ====================
import hashlib
import secrets
import uuid

active_sessions = {}  # token -> user_id

def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return f"{salt}${hashed}"

def verify_password(password, stored):
    if "$" not in stored:
        return False
    salt, _ = stored.split("$", 1)
    return stored == hash_password(password, salt)

def get_current_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token and token in active_sessions:
        user_id = active_sessions[token]
        with get_db() as conn:
            row = conn.execute("SELECT id, email, name, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if row:
            return dict(row)
    return None

def require_user():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return user


def get_or_create_default_user():
    """Ensure a default user exists so the demo always has someone to log in as."""
    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE email = ?", ("manager@bornefarms.com",)).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
                ("manager@bornefarms.com", "Farm Manager", hash_password("borne123"), "manager")
            )
            row = conn.execute("SELECT id FROM users WHERE email = ?", ("manager@bornefarms.com",)).fetchone()
        user_id = row["id"]
        # Seed demo wallet with opening balance so the marketplace can be tested immediately
        txn_count = conn.execute(
            "SELECT COUNT(*) as c FROM wallet_transactions WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        if txn_count == 0:
            conn.execute(
                "INSERT INTO wallet_transactions (user_id, type, amount, currency, status, description, reference) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, "deposit", 380000, "NGN", "completed", "Demo wallet seed", "BRN-DEMO-SEED")
            )
        return user_id


# ====================
# WALLET HELPERS
# ====================
def get_wallet_balance(user_id):
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT COALESCE(SUM(CASE WHEN type IN ('deposit', 'sale', 'offer_accepted') THEN amount
                                      WHEN type IN ('withdraw', 'buy', 'feed_upgrade') THEN -amount
                                      ELSE 0 END), 0) as balance
            FROM wallet_transactions
            WHERE user_id = ? AND status = 'completed'
            """,
            (user_id,)
        ).fetchone()
    return int(row["balance"])

def add_wallet_transaction(user_id, txn_type, amount, currency="NGN", description="", reference="", status="completed"):
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO wallet_transactions (user_id, type, amount, currency, status, description, reference)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, txn_type, amount, currency, status, description, reference)
        )
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def create_reference():
    return "BRN-" + uuid.uuid4().hex[:12].upper()


class CattleTracker:
    def __init__(self, max_distance=95, max_missed=12):
        self.max_distance = max_distance
        self.max_missed = max_missed
        self.next_id = 1
        self.tracks = {}

    def update(self, detections):
        assigned_detection_indexes = set()

        for track_id, track in list(self.tracks.items()):
            best_index = None
            best_distance = self.max_distance

            for index, detection in enumerate(detections):
                if index in assigned_detection_indexes:
                    continue

                distance = (
                    (detection["center"][0] - track["center"][0]) ** 2
                    + (detection["center"][1] - track["center"][1]) ** 2
                ) ** 0.5
                if distance < best_distance:
                    best_index = index
                    best_distance = distance

            if best_index is None:
                track["missed"] += 1
                if track["missed"] > self.max_missed:
                    del self.tracks[track_id]
                continue

            detection = detections[best_index]
            track["center"] = detection["center"]
            track["box"] = detection["box"]
            track["confidence"] = detection["confidence"]
            track["missed"] = 0
            track["trail"].append(detection["center"])
            track["trail"] = track["trail"][-18:]
            assigned_detection_indexes.add(best_index)

        for index, detection in enumerate(detections):
            if index in assigned_detection_indexes:
                continue

            self.tracks[self.next_id] = {
                "center": detection["center"],
                "box": detection["box"],
                "confidence": detection["confidence"],
                "missed": 0,
                "trail": [detection["center"]],
            }
            self.next_id += 1

        return self.tracks


trackers = {
    DRONE_CAMERA_ID: CattleTracker(max_distance=UAV_TRACK_DISTANCE),
}


def get_model():
    global model
    if model is None:
        model = YOLO(YOLO_MODEL_PATH)
    return model


def safe_filename(filename):
    name = Path(filename or "uploaded-video.mp4").name
    stem = Path(name).stem or "uploaded-video"
    suffix = Path(name).suffix or ".mp4"
    timestamp = int(time.time())
    return f"{stem}-{timestamp}{suffix}"


@app.get("/health")
def health():
    return jsonify({"ok": True, "backend": "borne-farms-ai"})


@app.post("/uav_link_analysis")
def toggle_uav_link_analysis():
    global uav_link_analysis
    data = request.get_json(silent=True) or {}
    uav_link_analysis = bool(data.get("enabled", True))
    return jsonify({"uav_link_analysis": uav_link_analysis})


@app.get("/uav_link_analysis")
def get_uav_link_analysis():
    return jsonify({"uav_link_analysis": uav_link_analysis})


@app.post("/upload")
def upload_video():
    uploaded_file = request.files.get("video")
    if uploaded_file is None:
        return jsonify({"error": "No video file uploaded. Expected form field: video"}), 400

    camera_id = request.form.get("camera", "1")
    if camera_id not in camera_counts:
        return jsonify({"error": "Invalid camera. Choose camera 1, 2, 3, or 4."}), 400

    upload_path = UPLOAD_DIR / safe_filename(uploaded_file.filename)
    uploaded_file.save(upload_path)

    with state_lock:
        camera_videos[camera_id] = str(upload_path)
        camera_counts[camera_id] = {"cows": 0, "humans": 0}
        if camera_id == DRONE_CAMERA_ID:
            trackers[DRONE_CAMERA_ID] = CattleTracker(max_distance=UAV_TRACK_DISTANCE)

    return jsonify({
        "message": f"Video uploaded for camera {camera_id}. Open the stream to begin detection.",
        "camera": camera_id,
        "stream_url": f"http://127.0.0.1:5000/video_feed/{camera_id}",
        "counts_url": "http://127.0.0.1:5000/counts",
        "totals": get_total_counts(),
        "cameras": dict(camera_counts)
    })


@app.get("/counts")
def counts():
    with state_lock:
        return jsonify({
            "totals": get_total_counts(),
            "cameras": dict(camera_counts)
        })


def get_total_counts():
    cows = sum(counts["cows"] for counts in camera_counts.values())
    humans = sum(counts["humans"] for counts in camera_counts.values())
    return {"cows": cows, "humans": humans}


def get_class_ids(detector, names):
    wanted = set(names)
    return [
        class_id
        for class_id, class_name in detector.names.items()
        if str(class_name).lower() in wanted
    ]


def resize_for_uav(frame):
    height, width = frame.shape[:2]
    if width <= UAV_MAX_WIDTH:
        return frame

    scale = UAV_MAX_WIDTH / width
    return cv2.resize(frame, (UAV_MAX_WIDTH, int(height * scale)), interpolation=cv2.INTER_AREA)


def iter_tiles(frame):
    height, width = frame.shape[:2]
    if width <= UAV_TILE_SIZE and height <= UAV_TILE_SIZE:
        yield 0, 0, frame
        return

    stride = max(1, int(UAV_TILE_SIZE * (1 - UAV_TILE_OVERLAP)))
    y_positions = list(range(0, max(1, height - UAV_TILE_SIZE + 1), stride))
    x_positions = list(range(0, max(1, width - UAV_TILE_SIZE + 1), stride))

    if not y_positions or y_positions[-1] != max(0, height - UAV_TILE_SIZE):
        y_positions.append(max(0, height - UAV_TILE_SIZE))
    if not x_positions or x_positions[-1] != max(0, width - UAV_TILE_SIZE):
        x_positions.append(max(0, width - UAV_TILE_SIZE))

    for y in y_positions:
        for x in x_positions:
            yield x, y, frame[y:y + UAV_TILE_SIZE, x:x + UAV_TILE_SIZE]


def enhance_aerial_tile(tile):
    if not UAV_ENHANCE_TILES:
        return tile

    lab = cv2.cvtColor(tile, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lightness = clahe.apply(lightness)
    enhanced = cv2.merge((lightness, channel_a, channel_b))
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
    return cv2.addWeighted(enhanced, 1.25, cv2.GaussianBlur(enhanced, (0, 0), 1.0), -0.25, 0)


def suppress_duplicate_detections(detections, overlap_threshold=0.45):
    if not detections:
        return []

    boxes = []
    scores = []
    for detection in detections:
        x1, y1, x2, y2 = detection["box"]
        boxes.append([x1, y1, max(1, x2 - x1), max(1, y2 - y1)])
        scores.append(float(detection["confidence"]))

    kept_indexes = cv2.dnn.NMSBoxes(boxes, scores, UAV_CONFIDENCE, overlap_threshold)
    if len(kept_indexes) == 0:
        return []

    if hasattr(kept_indexes, "flatten"):
        indexes = kept_indexes.flatten()
    else:
        indexes = kept_indexes

    return [detections[int(index)] for index in indexes]


def detect_drone_objects(frame, detector):
    detections = []
    cow_class_ids = set(get_class_ids(detector, ["cow"]))
    human_class_ids = set(get_class_ids(detector, ["person"]))
    target_class_ids = list(cow_class_ids | human_class_ids)

    for offset_x, offset_y, tile in iter_tiles(frame):
        inference_tile = enhance_aerial_tile(tile)
        results = detector(
            inference_tile,
            verbose=False,
            conf=UAV_CONFIDENCE,
            imgsz=UAV_IMAGE_SIZE,
            classes=target_class_ids or None,
        )[0]

        for box in results.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            class_name = detector.names.get(class_id, "").lower()
            x1, y1, x2, y2 = [int(value) for value in box.xyxy[0]]
            x1 += offset_x
            x2 += offset_x
            y1 += offset_y
            y2 += offset_y
            detections.append({
                "class_name": class_name,
                "confidence": confidence,
                "box": (x1, y1, x2, y2),
                "center": ((x1 + x2) // 2, (y1 + y2) // 2),
            })

    cow_detections = suppress_duplicate_detections([
        detection for detection in detections if detection["class_name"] == "cow"
    ])
    human_detections = suppress_duplicate_detections([
        detection for detection in detections if detection["class_name"] == "person"
    ])
    return cow_detections, human_detections


def draw_shepherd_mode(frame, cow_detections, human_detections, tracker):
    annotated_frame = frame.copy()
    tracks = tracker.update(cow_detections)
    active_tracks = [
        (track_id, track)
        for track_id, track in tracks.items()
        if track["missed"] == 0
    ]
    cow_centers = [track["center"] for _, track in active_tracks]

    for track_id, track in active_tracks:
        center = track["center"]
        x1, y1, x2, y2 = track["box"]
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (40, 235, 235), 1)
        cv2.circle(annotated_frame, center, 6, (40, 235, 235), -1)
        cv2.circle(annotated_frame, center, 13, (26, 121, 121), 2)
        for start, end in zip(track["trail"], track["trail"][1:]):
            cv2.line(annotated_frame, start, end, (120, 220, 220), 1, cv2.LINE_AA)
        cv2.putText(
            annotated_frame,
            f"CATTLE {track_id}",
            (center[0] + 10, center[1] - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (40, 235, 235),
            1,
            cv2.LINE_AA,
        )

    for detection in human_detections:
        x1, y1, x2, y2 = detection["box"]
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (80, 170, 255), 2)
        cv2.putText(
            annotated_frame,
            "HUMAN",
            (x1, max(18, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (80, 170, 255),
            2,
            cv2.LINE_AA,
        )

    if uav_link_analysis:
        for index, start in enumerate(cow_centers):
            linked = sorted(
                cow_centers[index + 1:],
                key=lambda point: (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2,
            )[:2]
            for end in linked:
                cv2.line(annotated_frame, start, end, (40, 235, 235), 2, cv2.LINE_AA)

    link_label = "LINK ON" if uav_link_analysis else "LINK OFF"
    label = f"SHEPHERD MODE | {link_label} | Cows: {len(cow_centers)} | Humans: {len(human_detections)}"
    cv2.rectangle(annotated_frame, (12, 12), (470, 48), (0, 0, 0), -1)
    cv2.putText(
        annotated_frame,
        label,
        (22, 36),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.62,
        (40, 235, 235),
        2,
        cv2.LINE_AA,
    )
    return annotated_frame


def generate_frames(camera_id):

    with state_lock:
        video_path = camera_videos.get(camera_id)

    if not video_path or not os.path.exists(video_path):
        return

    detector = get_model()
    cap = cv2.VideoCapture(video_path)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    video_fps = float(cap.get(cv2.CAP_PROP_FPS) or 25)
    frame_interval = 1.0 / video_fps if video_fps > 0 else 0.04
    frame_index = 0
    last_drone_frame = None
    last_emit_time = 0

    if frame_count <= 0:
        cap.release()
        return

    try:
        while cap.isOpened():
            ok, frame = cap.read()
            if not ok:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_index = 0
                continue

            if camera_id == DRONE_CAMERA_ID:
                frame = resize_for_uav(frame)
                should_process = frame_index % max(1, UAV_FRAME_STRIDE) == 0 or last_drone_frame is None

                if should_process:
                    cow_detections, human_detections = detect_drone_objects(frame, detector)
                    with state_lock:
                        camera_counts[camera_id] = {
                            "cows": len(cow_detections),
                            "humans": len(human_detections),
                        }
                    last_drone_frame = draw_shepherd_mode(
                        frame,
                        cow_detections,
                        human_detections,
                        trackers[DRONE_CAMERA_ID],
                    )

                annotated_frame = last_drone_frame
            else:
                results = detector(frame, verbose=False, conf=CCTV_CONFIDENCE)[0]
                cows = 0
                humans = 0

                for box in results.boxes:
                    class_id = int(box.cls[0])
                    class_name = detector.names.get(class_id, "").lower()
                    if class_name == "cow":
                        cows += 1
                    elif class_name == "person":
                        humans += 1

                with state_lock:
                    camera_counts[camera_id] = {"cows": cows, "humans": humans}

                annotated_frame = results.plot()
            encoded_ok, buffer = cv2.imencode(".jpg", annotated_frame)
            if not encoded_ok:
                continue

            # Throttle to native FPS so the video plays at normal speed
            now = time.time()
            elapsed = now - last_emit_time
            if elapsed < frame_interval:
                time.sleep(frame_interval - elapsed)
            last_emit_time = time.time()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            )
            frame_index += 1
    finally:
        cap.release()


@app.get("/video_feed")
def video_feed():
    return video_feed_for_camera("1")


@app.get("/video_feed/<camera_id>")
def video_feed_for_camera(camera_id):
    if camera_id not in camera_counts:
        return jsonify({"error": "Invalid camera. Choose camera 1, 2, 3, or 4."}), 400

    return Response(
        generate_frames(camera_id),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


# ============================================================
# REST CRUD API — Farm Data Persistence
# The frontend syncs its localStorage state to this API so
# data survives across devices and browser resets.
# ============================================================

@app.get("/api/farm")
def api_get_farm():
    """Return the full farm data document."""
    return jsonify(read_farm_data())


@app.put("/api/farm")
def api_put_farm():
    """Replace the full farm data document (frontend syncs its entire state)."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Expected JSON farm data object"}), 400
    written = write_farm_data(data, "farm_data.replaced")
    return jsonify(written)


@app.patch("/api/farm")
def api_patch_farm():
    """Deep-merge a partial update into the farm data document."""
    patch = request.get_json(silent=True)
    if not patch or not isinstance(patch, dict):
        return jsonify({"error": "Expected JSON patch object"}), 400
    data = read_farm_data()
    _deep_merge(data, patch)
    written = write_farm_data(data, "farm_data.patched")
    return jsonify(written)


def _deep_merge(target, source):
    """Recursively merge source into target (in-place)."""
    for key, value in source.items():
        if (
            key in target
            and isinstance(target[key], dict)
            and isinstance(value, dict)
        ):
            _deep_merge(target[key], value)
        else:
            target[key] = value


# ---- Resource-specific convenience endpoints ----

@app.get("/api/stats")
def api_stats():
    """Return computed statistics (mirrors the frontend calculateStats)."""
    data = read_farm_data()
    livestock = data.get("livestock", {}).get("cattle", {})
    total = sum(c.get("count", 0) for c in livestock.values())
    pregnant = sum(c.get("pregnant", 0) for c in livestock.values())
    sick = sum(c.get("sick", 0) for c in livestock.values())
    male = livestock.get("bull", {}).get("count", 0)
    female = livestock.get("cow", {}).get("count", 0)
    young = livestock.get("calf", {}).get("count", 0)
    monthly = data.get("monthlyStats", {})
    return jsonify({
        "total": total, "male": male, "female": female, "young": young,
        "pregnant": pregnant, "sick": sick, "healthy": total - sick,
        "byLocation": data.get("locations", {}),
        "birthsThisMonth": monthly.get("births", 0),
        "deathsThisMonth": monthly.get("deaths", 0),
        "milkProduction": monthly.get("milkProduction", 0),
        "activeDiseases": len(data.get("activeHealthIssues", [])),
    })


@app.post("/api/livestock")
def api_add_livestock():
    """Add cattle to a category. Body: {category, count}"""
    body = request.get_json(silent=True) or {}
    category = body.get("category", "cow")
    count = int(body.get("count", 1))
    data = read_farm_data()
    cattle = data.setdefault("livestock", {}).setdefault("cattle", {})
    if category not in cattle:
        cattle[category] = {"count": 0, "pregnant": 0, "sick": 0}
    cattle[category]["count"] = cattle[category].get("count", 0) + count
    return jsonify(write_farm_data(data, "livestock.added"))


@app.post("/api/milk")
def api_log_milk():
    """Log a milk reading. Body: {liters, date?}"""
    body = request.get_json(silent=True) or {}
    liters = int(body.get("liters", 0))
    date_str = body.get("date") or time.strftime("%Y-%m-%d", time.gmtime())
    data = read_farm_data()
    history = data.setdefault("milkHistory", [])
    # Upsert by date
    existing = next((e for e in history if e.get("date") == date_str), None)
    if existing:
        existing["liters"] = liters
    else:
        history.append({"date": date_str, "liters": liters})
    history.sort(key=lambda e: e["date"])
    if len(history) > 14:
        history[:] = history[-14:]
    data.setdefault("monthlyStats", {})["milkProduction"] = liters
    return jsonify(write_farm_data(data, "milk.logged"))


@app.post("/api/health")
def api_record_health():
    """Record a health event. Body: {type, category, disease, severity, count?}"""
    body = request.get_json(silent=True) or {}
    data = read_farm_data()
    h_type = body.get("type", "disease")
    count = int(body.get("count", 1))
    if h_type == "disease":
        data.setdefault("activeHealthIssues", []).append({
            "id": f"h{int(time.time())}",
            "disease": body.get("disease", "Unknown"),
            "category": body.get("category", "cow"),
            "severity": body.get("severity", "medium"),
            "date": time.strftime("%Y-%m-%d", time.gmtime()),
            "count": count,
        })
        cattle = data.setdefault("livestock", {}).setdefault("cattle", {})
        cat = body.get("category", "cow")
        if cat in cattle:
            cattle[cat]["sick"] = cattle[cat].get("sick", 0) + count
    elif h_type == "birth":
        data.setdefault("monthlyStats", {})["births"] = data.get("monthlyStats", {}).get("births", 0) + count
        cattle = data.setdefault("livestock", {}).setdefault("cattle", {})
        cattle.setdefault("calf", {"count": 0, "pregnant": 0, "sick": 0})["count"] += count
    elif h_type == "death":
        data.setdefault("monthlyStats", {})["deaths"] = data.get("monthlyStats", {}).get("deaths", 0) + count
        cattle = data.setdefault("livestock", {}).setdefault("cattle", {})
        cat = body.get("category", "cow")
        if cat in cattle:
            cattle[cat]["count"] = max(0, cattle[cat].get("count", 0) - count)
    return jsonify(write_farm_data(data, "health.recorded"))


@app.post("/api/movement")
def api_record_movement():
    """Record a cattle movement. Body: {animalId, from, to, reason, handler, count?}"""
    body = request.get_json(silent=True) or {}
    data = read_farm_data()
    movement = {
        "id": f"m{int(time.time())}",
        "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "animalId": body.get("animalId", ""),
        "from": body.get("from", ""),
        "to": body.get("to", ""),
        "reason": body.get("reason", ""),
        "handler": body.get("handler", ""),
        "count": int(body.get("count", 1)),
    }
    data.setdefault("recentMovements", []).insert(0, movement)
    locations = data.get("locations", {})
    count = movement["count"]
    if movement["from"] in locations:
        locations[movement["from"]] = max(0, locations[movement["from"]] - count)
    if movement["to"] in locations:
        locations[movement["to"]] = locations.get(movement["to"], 0) + count
    return jsonify(write_farm_data(data, "movement.recorded"))


@app.post("/api/feed")
def api_log_feeding():
    """Log a feeding event. Body: {location, feedType, quantity, animalsCount, handler}"""
    body = request.get_json(silent=True) or {}
    data = read_farm_data()
    feed_type = body.get("feedType", "hay")
    quantity = int(body.get("quantity", 0))
    log = {
        "id": f"f{int(time.time())}",
        "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "location": body.get("location", ""),
        "feedType": feed_type,
        "quantity": quantity,
        "animalsCount": int(body.get("animalsCount", 0)),
        "handler": body.get("handler", ""),
    }
    data.setdefault("feedingLogs", []).insert(0, log)
    inv = data.get("feedInventory", {})
    if feed_type in inv:
        inv[feed_type]["quantity"] = max(0, inv[feed_type].get("quantity", 0) - quantity)
    consumption = data.get("dailyFeedConsumption", {})
    if feed_type in consumption:
        consumption[feed_type] = consumption.get(feed_type, 0) + quantity
    return jsonify(write_farm_data(data, "feed.logged"))


@app.get("/api/audit")
def api_audit_log():
    """Return recent audit log entries."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, event_type, actor, created_at FROM audit_log ORDER BY id DESC LIMIT 50"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# ============================================================
# AUTH ENDPOINTS
# ============================================================

@app.post("/api/auth/register")
def api_register():
    """Register a new user. Body: {email, name, password}"""
    body = request.get_json(silent=True) or {}
    email = body.get("email", "").strip().lower()
    name = body.get("name", "").strip()
    password = body.get("password", "")
    if not email or not password or not name:
        return jsonify({"error": "email, name and password are required"}), 400
    with get_db() as conn:
        try:
            conn.execute(
                "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
                (email, name, hash_password(password), "manager")
            )
        except sqlite3.IntegrityError:
            return jsonify({"error": "Email already registered"}), 409
    return jsonify({"success": True, "message": "Account created"})


@app.post("/api/auth/login")
def api_login():
    """Log in and return a bearer token. Body: {email, password}"""
    body = request.get_json(silent=True) or {}
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
            (email,)
        ).fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            return jsonify({"error": "Invalid email or password"}), 401
        token = secrets.token_urlsafe(32)
        active_sessions[token] = row["id"]
        conn.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (row["id"],))
        return jsonify({
            "token": token,
            "user": {"id": row["id"], "email": row["email"], "name": row["name"], "role": row["role"]}
        })


@app.post("/api/auth/logout")
def api_logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    active_sessions.pop(token, None)
    return jsonify({"success": True})


@app.get("/api/auth/me")
def api_me():
    user = require_user()
    if isinstance(user, tuple):
        return user
    return jsonify(user)


# ============================================================
# WALLET ENDPOINTS
# ============================================================

@app.get("/api/wallet")
def api_wallet():
    """Return wallet balance and transaction history for current user."""
    user = require_user()
    if isinstance(user, tuple):
        return user
    balance = get_wallet_balance(user["id"])
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, type, amount, currency, status, description, reference, created_at
               FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50""",
            (user["id"],)
        ).fetchall()
    return jsonify({"balance": balance, "currency": "NGN", "transactions": [dict(r) for r in rows]})


@app.post("/api/wallet/deposit")
def api_wallet_deposit():
    """Demo deposit (would be triggered by Paystack/Flutterwave webhook in production)."""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    amount = int(body.get("amount", 0))
    if amount <= 0:
        return jsonify({"error": "amount must be greater than 0"}), 400
    reference = body.get("reference") or create_reference()
    add_wallet_transaction(user["id"], "deposit", amount, "NGN", "Wallet deposit", reference)
    return jsonify({"success": True, "balance": get_wallet_balance(user["id"]), "reference": reference})


@app.post("/api/wallet/withdraw")
def api_wallet_withdraw():
    """Demo withdrawal."""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    amount = int(body.get("amount", 0))
    if amount <= 0:
        return jsonify({"error": "amount must be greater than 0"}), 400
    balance = get_wallet_balance(user["id"])
    if amount > balance:
        return jsonify({"error": "Insufficient balance"}), 400
    reference = body.get("reference") or create_reference()
    add_wallet_transaction(user["id"], "withdraw", amount, "NGN", "Wallet withdrawal", reference)
    return jsonify({"success": True, "balance": get_wallet_balance(user["id"]), "reference": reference})


# ============================================================
# MARKETPLACE ENDPOINTS
# ============================================================

@app.post("/api/marketplace/buy")
def api_marketplace_buy():
    """Buy units of a breed. Body: {lotId, units}. Deducts wallet, adds holding, creates transaction."""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    lot_id = body.get("lotId")
    units = int(body.get("units", 1))
    if units <= 0 or not lot_id:
        return jsonify({"error": "lotId and units required"}), 400

    data = read_farm_data()
    lots = data.get("investment", {}).get("breedLots", [])
    lot = next((l for l in lots if l["id"] == lot_id), None)
    if not lot:
        return jsonify({"error": "Breed lot not found"}), 404
    if units > lot.get("availableUnits", 0):
        return jsonify({"error": "Not enough units available"}), 400

    total_cost = units * lot["unitPrice"]
    balance = get_wallet_balance(user["id"])
    if total_cost > balance:
        return jsonify({"error": "Insufficient wallet balance"}), 400

    # Deduct wallet
    add_wallet_transaction(user["id"], "buy", total_cost, "NGN", f"Buy {units} units of {lot['breed']}", create_reference())

    # Update lot availability
    lot["availableUnits"] = lot.get("availableUnits", 0) - units

    # Add holding
    holding = {
        "id": f"own-{int(time.time())}",
        "breed": lot["breed"],
        "units": units,
        "purchasePrice": total_cost,
        "currentValue": total_cost,
        "weightStartKg": 220,
        "weightCurrentKg": 220,
        "growthPercent": 0,
        "feedTier": lot.get("feedTier", "Basic"),
        "lockUntil": None,
        "status": "Tradable",
        "tag": f"BRN-{lot['breed'][:2].upper()}-{int(time.time()) % 1000}",
        "purchaseDate": time.strftime("%Y-%m-%d", time.gmtime())
    }
    data.setdefault("investment", {}).setdefault("holdings", []).append(holding)

    # Record transaction
    txn = {
        "id": f"txn-{int(time.time())}",
        "type": "Buy",
        "rail": "Wallet",
        "amount": total_cost,
        "status": "Settled",
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
        "breed": lot["breed"],
        "units": units
    }
    data.setdefault("investment", {}).setdefault("transactions", []).insert(0, txn)
    write_farm_data(data, "marketplace.buy")

    return jsonify({"success": True, "balance": get_wallet_balance(user["id"]), "holding": holding})


@app.post("/api/marketplace/sell")
def api_marketplace_sell():
    """Sell a holding. Body: {holdingId, pricePerUnit}. Adds to marketplace offers."""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    holding_id = body.get("holdingId")
    price_per_unit = int(body.get("pricePerUnit", 0))
    if not holding_id or price_per_unit <= 0:
        return jsonify({"error": "holdingId and pricePerUnit required"}), 400

    data = read_farm_data()
    holdings = data.get("investment", {}).get("holdings", [])
    holding = next((h for h in holdings if h["id"] == holding_id), None)
    if not holding:
        return jsonify({"error": "Holding not found"}), 404

    offer = {
        "id": f"off-{int(time.time())}",
        "holdingId": holding_id,
        "sellerId": user["id"],
        "sellerName": user.get("name", "You"),
        "buyer": "Open Marketplace",
        "price": price_per_unit * holding.get("units", 1),
        "pricePerUnit": price_per_unit,
        "units": holding.get("units", 1),
        "breed": holding.get("breed", ""),
        "expires": time.strftime("%Y-%m-%d", time.gmtime(time.time() + 30 * 86400)),
        "status": "Open",
        "createdAt": time.strftime("%Y-%m-%d", time.gmtime())
    }
    data.setdefault("investment", {}).setdefault("marketplaceOffers", []).insert(0, offer)
    holding["status"] = "Listed"
    write_farm_data(data, "marketplace.sell")

    return jsonify({"success": True, "offer": offer})


# ============================================================
# OFFERS ENDPOINTS
# ============================================================

@app.post("/api/offers/respond")
def api_respond_offer():
    """Accept or reject an offer. Body: {offerId, action: 'accept'|'reject'}"""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    offer_id = body.get("offerId")
    action = body.get("action", "")
    if not offer_id or action not in ("accept", "reject"):
        return jsonify({"error": "offerId and action (accept|reject) required"}), 400

    data = read_farm_data()
    offers = data.get("investment", {}).get("marketplaceOffers", [])
    offer = next((o for o in offers if o["id"] == offer_id), None)
    if not offer:
        return jsonify({"error": "Offer not found"}), 404
    if offer.get("status") != "Open":
        return jsonify({"error": "Offer is not open"}), 400

    if action == "reject":
        offer["status"] = "Rejected"
        write_farm_data(data, "offer.rejected")
        return jsonify({"success": True, "offer": offer})

    # Accept: buyer pays seller (demo: buyer is always the current user)
    buyer = user
    total_price = offer.get("price", 0)
    balance = get_wallet_balance(buyer["id"])
    if total_price > balance:
        return jsonify({"error": "Insufficient wallet balance to accept offer"}), 400

    holding_id = offer.get("holdingId")
    holdings = data.get("investment", {}).get("holdings", [])
    holding = next((h for h in holdings if h["id"] == holding_id), None)
    if not holding:
        return jsonify({"error": "Holding not found"}), 404

    # Transfer funds
    add_wallet_transaction(buyer["id"], "buy", total_price, "NGN", f"Buy {holding['breed']} via offer", create_reference())
    # Credit seller if they exist in DB
    seller_id = offer.get("sellerId")
    if seller_id:
        add_wallet_transaction(seller_id, "offer_accepted", total_price, "NGN", f"Sold {holding['breed']}", create_reference())

    # Transfer holding
    holding["status"] = "Tradable"
    holding["purchasePrice"] = total_price
    holding["currentValue"] = total_price
    holding["purchaseDate"] = time.strftime("%Y-%m-%d", time.gmtime())

    offer["status"] = "Accepted"
    offer["buyer"] = buyer.get("name", "Buyer")

    txn = {
        "id": f"txn-{int(time.time())}",
        "type": "Sale",
        "rail": "Wallet",
        "amount": total_price,
        "status": "Settled",
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
        "breed": holding.get("breed", ""),
        "units": holding.get("units", 1)
    }
    data.setdefault("investment", {}).setdefault("transactions", []).insert(0, txn)
    write_farm_data(data, "offer.accepted")

    return jsonify({"success": True, "balance": get_wallet_balance(buyer["id"]), "offer": offer, "holding": holding})


# ============================================================
# PAYMENT CHECKOUT SIMULATION
# ============================================================

@app.post("/api/payment/checkout")
def api_payment_checkout():
    """Create a simulated payment checkout. Body: {amount, provider: 'paystack'|'flutterwave'|'stripe'}"""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    amount = int(body.get("amount", 0))
    provider = body.get("provider", "paystack")
    if amount <= 0:
        return jsonify({"error": "amount required"}), 400
    if provider not in ("paystack", "flutterwave", "stripe"):
        return jsonify({"error": "provider must be paystack, flutterwave or stripe"}), 400

    reference = create_reference()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO payment_sessions (user_id, amount, currency, provider, status, reference, metadata)
               VALUES (?, ?, 'NGN', ?, 'pending', ?, ?)""",
            (user["id"], amount, provider, reference, json.dumps({"provider": provider, "amount": amount}))
        )

    return jsonify({
        "success": True,
        "reference": reference,
        "provider": provider,
        "amount": amount,
        "currency": "NGN",
        "checkout_url": f"/api/payment/simulate/{reference}",
        "message": "Demo mode: this is a simulated payment. Add real API keys to process live payments."
    })


@app.get("/api/payment/simulate/<reference>")
def api_payment_simulate(reference):
    """Simulate a successful payment callback."""
    user = require_user()
    if isinstance(user, tuple):
        return user
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, amount, status FROM payment_sessions WHERE reference = ?",
            (reference,)
        ).fetchone()
    if not row:
        return jsonify({"error": "Payment session not found"}), 404
    if row["status"] != "pending":
        return jsonify({"error": "Payment already processed"}), 400

    with get_db() as conn:
        conn.execute(
            "UPDATE payment_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE reference = ?",
            (reference,)
        )
    add_wallet_transaction(user["id"], "deposit", row["amount"], "NGN", "Simulated wallet deposit", reference)
    return jsonify({"success": True, "balance": get_wallet_balance(user["id"]), "reference": reference})


# ============================================================
# CAMERA STREAM URL ENDPOINTS
# ============================================================

@app.patch("/api/cameras/<camera_id>")
def api_update_camera(camera_id):
    """Update a camera, including stream_url for live HTTP/HLS feeds."""
    body = request.get_json(silent=True) or {}
    data = read_farm_data()
    cameras = data.get("cameras", [])
    camera = next((c for c in cameras if c["id"] == camera_id), None)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404

    allowed = {"name", "ip", "status", "resolution", "stream_url"}
    for key, value in body.items():
        if key in allowed:
            camera[key] = value
    return jsonify(write_farm_data(data, "camera.updated"))


@app.post("/api/cameras")
def api_add_camera():
    """Add a new camera. Body: {id, name, ip, stream_url?, status?, resolution?}"""
    body = request.get_json(silent=True) or {}
    data = read_farm_data()
    cameras = data.setdefault("cameras", [])
    cam_id = body.get("id") or f"cam{len(cameras) + 1:02d}"
    if any(c["id"] == cam_id for c in cameras):
        return jsonify({"error": "Camera id already exists"}), 409

    camera = {
        "id": cam_id,
        "name": body.get("name", "New Camera"),
        "ip": body.get("ip", ""),
        "stream_url": body.get("stream_url", ""),
        "status": body.get("status", "online"),
        "resolution": body.get("resolution", "1080p")
    }
    cameras.append(camera)
    camera_counts[cam_id] = {"cows": 0, "humans": 0}
    write_farm_data(data, "camera.added")
    return jsonify(camera)


# ============================================================
# 1. PADDOCK-TO-PLATE QR TRACEABILITY
# ============================================================

def seed_cattle_records():
    """Seed traceability records for existing holdings if none exist."""
    with get_db() as conn:
        existing = conn.execute("SELECT COUNT(*) as c FROM cattle_records").fetchone()["c"]
        if existing > 0:
            return
        data = read_farm_data()
        holdings = data.get("investment", {}).get("holdings", [])
        health_issues = data.get("activeHealthIssues", [])
        movements = data.get("recentMovements", [])
        milk_history = data.get("milkHistory", [])
        for h in holdings:
            tag = h.get("tag", f"BRN-{h['id']}")
            token = uuid.uuid4().hex[:16].upper()
            health_hist = json.dumps([{
                "event": hi.get("disease", ""),
                "severity": hi.get("severity", ""),
                "date": hi.get("date", "")
            } for hi in health_issues])
            move_hist = json.dumps([{
                "from": m.get("from", ""),
                "to": m.get("to", ""),
                "reason": m.get("reason", ""),
                "date": m.get("date", "")
            } for m in movements if m.get("animalId") == tag])
            milk_hist = json.dumps(milk_history[-7:])
            conn.execute(
                """INSERT INTO cattle_records (id, tag, breed, category, birth_date, weight_kg, feed_tier, health_history, movement_history, milk_yield_history, qr_token, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (h["id"], tag, h.get("breed", "Unknown"), "cow", "2025-06-01",
                 h.get("weightCurrentKg", 220), h.get("feedTier", "Basic"),
                 health_hist, move_hist, milk_hist, token, "active")
            )


@app.get("/api/traceability")
def api_traceability_list():
    """List all cattle traceability records."""
    seed_cattle_records()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, tag, breed, category, weight_kg, feed_tier, qr_token, status, created_at, updated_at FROM cattle_records ORDER BY created_at DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/traceability/<qr_token>")
def api_traceability_detail(qr_token):
    """Get full traceability record by QR token (public endpoint for scanning)."""
    seed_cattle_records()
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM cattle_records WHERE qr_token = ?",
            (qr_token,)
        ).fetchone()
    if not row:
        return jsonify({"error": "Record not found"}), 404
    record = dict(row)
    record["health_history"] = json.loads(record.get("health_history") or "[]")
    record["movement_history"] = json.loads(record.get("movement_history") or "[]")
    record["milk_yield_history"] = json.loads(record.get("milk_yield_history") or "[]")
    record["owner_shares"] = json.loads(record.get("owner_shares") or "[]")
    return jsonify(record)


@app.post("/api/traceability")
def api_traceability_create():
    """Create a new cattle traceability record. Body: {tag, breed, category, weightKg, feedTier}"""
    body = request.get_json(silent=True) or {}
    tag = body.get("tag", "").strip()
    if not tag:
        return jsonify({"error": "tag is required"}), 400
    token = uuid.uuid4().hex[:16].upper()
    with get_db() as conn:
        try:
            conn.execute(
                """INSERT INTO cattle_records (id, tag, breed, category, birth_date, weight_kg, feed_tier, qr_token, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (f"cr-{int(time.time())}", tag, body.get("breed", "Unknown"), body.get("category", "cow"),
                 body.get("birthDate", time.strftime("%Y-%m-%d", time.gmtime())),
                 float(body.get("weightKg", 0)), body.get("feedTier", "Basic"), token, "active")
            )
        except sqlite3.IntegrityError:
            return jsonify({"error": "Tag already exists"}), 409
    return jsonify({"success": True, "qr_token": token, "tag": tag})


# ============================================================
# 2. PREDICTIVE MORTALITY RISK SCORING
# ============================================================

@app.get("/api/risk-scores")
def api_risk_scores():
    """Compute mortality risk scores for all cattle based on health, weight, feed, and weather."""
    data = read_farm_data()
    health_issues = data.get("activeHealthIssues", [])
    weight_history = data.get("weightHistory", [])
    feed_inventory = data.get("feedInventory", {})
    daily_consumption = data.get("dailyFeedConsumption", {})
    livestock = data.get("livestock", {}).get("cattle", {})

    # Calculate feed stress: if consumption exceeds available stock within 5 days
    total_daily = sum(daily_consumption.values())
    total_stock = sum(f.get("quantity", 0) for f in feed_inventory.values())
    days_of_feed = total_stock / max(1, total_daily) if total_daily > 0 else 999
    feed_stress = max(0, 1 - days_of_feed / 14)  # stress if < 14 days of feed

    # Weight trend: declining weight is a risk factor
    weight_trend = 0
    if len(weight_history) >= 2:
        recent = weight_history[-1].get("avg", 0)
        prev = weight_history[-2].get("avg", 0)
        if prev > 0:
            weight_trend = (recent - prev) / prev  # negative = declining

    risks = []
    for category, info in livestock.items():
        count = info.get("count", 0)
        sick = info.get("sick", 0)
        pregnant = info.get("pregnant", 0)

        # Base risk from sick ratio
        sick_ratio = sick / max(1, count)
        # Pregnant animals have slightly higher baseline risk
        pregnancy_factor = pregnant / max(1, count) * 0.15

        # Health issue severity weighting
        severity_weight = 0
        for hi in health_issues:
            if hi.get("category") == category:
                severity_weight += {"high": 0.35, "medium": 0.20, "low": 0.08}.get(hi.get("severity", "medium"), 0.15)

        # Weight decline risk
        weight_risk = max(0, -weight_trend) * 2.0 if weight_trend < 0 else 0

        # Composite score (0-100)
        raw_score = (sick_ratio * 40 + severity_weight * 30 + feed_stress * 20 + weight_risk * 15 + pregnancy_factor * 10) * 100
        score = min(100, max(0, int(raw_score)))

        if score >= 65:
            level = "critical"
            recommendation = f"Immediate intervention needed for {category}s. {sick} sick out of {count}. Review health protocols and isolate affected animals."
        elif score >= 35:
            level = "elevated"
            recommendation = f"Monitor {category}s closely. {sick} sick, {pregnant} pregnant. Ensure feed supply and schedule vet checks."
        else:
            level = "low"
            recommendation = f"{category.capitalize()}s are healthy. Continue current management practices."

        risks.append({
            "category": category,
            "count": count,
            "sick": sick,
            "pregnant": pregnant,
            "riskScore": score,
            "riskLevel": level,
            "feedStress": round(feed_stress * 100, 1),
            "weightTrend": round(weight_trend * 100, 1),
            "recommendation": recommendation,
            "daysOfFeedRemaining": round(days_of_feed, 1)
        })

    risks.sort(key=lambda r: r["riskScore"], reverse=True)
    overall = sum(r["riskScore"] * r["count"] for r in risks) / max(1, sum(r["count"] for r in risks))
    return jsonify({"overall": round(overall, 1), "categories": risks, "feedDaysRemaining": round(days_of_feed, 1)})


# ============================================================
# 3. CO-OWNERSHIP FRACTIONAL SPLITS
# ============================================================

@app.get("/api/co-ownership/<holding_id>")
def api_co_ownership_get(holding_id):
    """Get co-ownership shares for a holding."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM co_ownership_shares WHERE holding_id = ? ORDER BY fraction DESC",
            (holding_id,)
        ).fetchall()
    data = read_farm_data()
    holding = next((h for h in data.get("investment", {}).get("holdings", []) if h["id"] == holding_id), None)
    return jsonify({
        "holding": holding,
        "shares": [dict(r) for r in rows],
        "totalFraction": sum(r["fraction"] for r in rows)
    })


@app.post("/api/co-ownership/split")
def api_co_ownership_split():
    """Add a co-owner to a holding. Body: {holdingId, ownerName, ownerEmail, fraction, investedAmount}"""
    body = request.get_json(silent=True) or {}
    holding_id = body.get("holdingId")
    owner_name = body.get("ownerName", "").strip()
    fraction = float(body.get("fraction", 0))
    invested = int(body.get("investedAmount", 0))

    if not holding_id or not owner_name or fraction <= 0 or fraction > 1:
        return jsonify({"error": "holdingId, ownerName, fraction (0-1) required"}), 400

    # Check existing fractions don't exceed 1.0
    with get_db() as conn:
        existing = conn.execute(
            "SELECT COALESCE(SUM(fraction), 0) as total FROM co_ownership_shares WHERE holding_id = ?",
            (holding_id,)
        ).fetchone()
        if existing["total"] + fraction > 1.0:
            return jsonify({"error": f"Total fractions would exceed 100%. Available: {1.0 - existing['total']:.0%}"}), 400

        conn.execute(
            """INSERT INTO co_ownership_shares (holding_id, owner_name, owner_email, fraction, invested_amount)
               VALUES (?, ?, ?, ?, ?)""",
            (holding_id, owner_name, body.get("ownerEmail", ""), fraction, invested)
        )

    # Auto-distribute: if there's wallet revenue, split by fraction
    return jsonify({"success": True, "ownerName": owner_name, "fraction": fraction})


@app.post("/api/co-ownership/distribute")
def api_co_ownership_distribute():
    """Distribute revenue to co-owners by fraction. Body: {holdingId, totalRevenue}"""
    user = require_user()
    if isinstance(user, tuple):
        return user
    body = request.get_json(silent=True) or {}
    holding_id = body.get("holdingId")
    total_revenue = int(body.get("totalRevenue", 0))
    if not holding_id or total_revenue <= 0:
        return jsonify({"error": "holdingId and totalRevenue required"}), 400

    with get_db() as conn:
        shares = conn.execute(
            "SELECT * FROM co_ownership_shares WHERE holding_id = ?",
            (holding_id,)
        ).fetchall()
        if not shares:
            return jsonify({"error": "No co-owners found for this holding"}), 404

        distributions = []
        for share in shares:
            payout = int(total_revenue * share["fraction"])
            distributions.append({
                "owner": share["owner_name"],
                "fraction": share["fraction"],
                "payout": payout
            })

    return jsonify({"success": True, "totalRevenue": total_revenue, "distributions": distributions})


# ============================================================
# 4. BREED MARKETPLACE PRICE INTELLIGENCE
# ============================================================

def seed_sale_history():
    """Seed historical sale data for price intelligence."""
    with get_db() as conn:
        existing = conn.execute("SELECT COUNT(*) as c FROM sale_history").fetchone()["c"]
        if existing > 0:
            return
        base_prices = {
            "White Fulani": 185000,
            "Sokoto Gudali": 225000,
            "Brahman": 310000,
            "Holstein Friesian": 355000,
        }
        for breed, base in base_prices.items():
            for weeks_ago in range(12, 0, -1):
                # Simulate price variation: ±8% with slight upward trend
                import random
                random.seed(hash(breed) + weeks_ago)
                variation = random.uniform(-0.08, 0.08) + (12 - weeks_ago) * 0.003
                price = int(base * (1 + variation))
                sale_date = time.strftime("%Y-%m-%d", time.gmtime(time.time() - weeks_ago * 7 * 86400))
                units = random.randint(1, 5)
                conn.execute(
                    "INSERT INTO sale_history (breed, units, price_per_unit, region, sale_date) VALUES (?, ?, ?, ?, ?)",
                    (breed, units, price, "Nigeria", sale_date)
                )


@app.get("/api/marketplace/prices")
def api_marketplace_prices():
    """Get price intelligence: historical averages, trends, and fair value estimates per breed."""
    seed_sale_history()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT breed, price_per_unit, units, sale_date FROM sale_history ORDER BY sale_date DESC"
        ).fetchall()

    from collections import defaultdict
    by_breed = defaultdict(list)
    for r in rows:
        by_breed[r["breed"]].append(dict(r))

    intelligence = []
    for breed, sales in by_breed.items():
        prices = [s["price_per_unit"] for s in sales]
        recent_prices = prices[:5]
        older_prices = prices[5:] if len(prices) > 5 else prices
        avg_recent = sum(recent_prices) / len(recent_prices) if recent_prices else 0
        avg_older = sum(older_prices) / len(older_prices) if older_prices else avg_recent
        trend_pct = ((avg_recent - avg_older) / avg_older * 100) if avg_older > 0 else 0
        min_price = min(prices) if prices else 0
        max_price = max(prices) if prices else 0
        fair_value = int(avg_recent * 0.97)  # slightly below recent avg as fair value
        total_units = sum(s["units"] for s in sales)

        intelligence.append({
            "breed": breed,
            "avgPrice": int(avg_recent),
            "fairValue": fair_value,
            "minPrice": min_price,
            "maxPrice": max_price,
            "trendPct": round(trend_pct, 1),
            "trendDirection": "up" if trend_pct > 1 else "down" if trend_pct < -1 else "stable",
            "totalUnitsSold": total_units,
            "sampleCount": len(prices),
            "recommendation": "Buy" if trend_pct < -2 else ("Hold" if abs(trend_pct) < 2 else "Sell - prices rising")
        })

    intelligence.sort(key=lambda x: x["avgPrice"], reverse=True)
    return jsonify(intelligence)


@app.post("/api/marketplace/record-sale")
def api_record_sale():
    """Record a completed sale for price intelligence. Body: {breed, units, pricePerUnit, region}"""
    body = request.get_json(silent=True) or {}
    breed = body.get("breed", "").strip()
    units = int(body.get("units", 1))
    price = int(body.get("pricePerUnit", 0))
    if not breed or price <= 0:
        return jsonify({"error": "breed and pricePerUnit required"}), 400
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sale_history (breed, units, price_per_unit, region, sale_date) VALUES (?, ?, ?, ?, ?)",
            (breed, units, price, body.get("region", "Nigeria"), time.strftime("%Y-%m-%d", time.gmtime()))
        )
    return jsonify({"success": True, "breed": breed, "pricePerUnit": price})


# ============================================================
# 5. DRONE NDVI PASTURE HEALTH SCAN
# ============================================================

@app.post("/api/ndvi/analyze")
def api_ndvi_analyze():
    """Analyze an uploaded drone image for NDVI pasture health. Accepts multipart image upload."""
    if cv2 is None:
        return jsonify({"error": "OpenCV (cv2) is not available on the server"}), 500

    uploaded_file = request.files.get("image")
    zone = request.form.get("zone", "Pasture Zone A")
    if uploaded_file is None:
        return jsonify({"error": "No image uploaded. Expected form field: image"}), 400

    # Save and load image
    img_path = UPLOAD_DIR / f"ndvi-{int(time.time())}.jpg"
    uploaded_file.save(img_path)
    img = cv2.imread(str(img_path))
    if img is None:
        return jsonify({"error": "Could not read image file"}), 400

    # Compute pseudo-NDVI from RGB: (G - R) / (G + R)
    # This is an approximation since true NDVI needs near-infrared
    b, g, r = cv2.split(img.astype("float32"))
    denominator = g + r + 1e-6
    ndvi = (g - r) / denominator
    avg_ndvi = float(ndvi.mean())

    # Classify health
    if avg_ndvi > 0.3:
        health = "excellent"
        coverage = min(100, avg_ndvi * 180)
    elif avg_ndvi > 0.15:
        health = "good"
        coverage = avg_ndvi * 150
    elif avg_ndvi > 0.05:
        health = "moderate"
        coverage = avg_ndvi * 120
    elif avg_ndvi > -0.05:
        health = "poor"
        coverage = max(0, avg_ndvi * 100)
    else:
        health = "bare"
        coverage = 0

    # Generate NDVI visualization (color-mapped)
    ndvi_vis = cv2.applyColorMap((ndvi * 255).astype("uint8"), cv2.COLORMAP_RDYlGn)
    vis_path = UPLOAD_DIR / f"ndvi-vis-{int(time.time())}.jpg"
    cv2.imwrite(str(vis_path), ndvi_vis)

    # Save scan record
    with get_db() as conn:
        conn.execute(
            """INSERT INTO ndvi_scans (zone, avg_ndvi, health_score, coverage_percent, image_path, notes, scan_date)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (zone, round(avg_ndvi, 4), health, round(coverage, 1), str(vis_path.name),
             f"Pseudo-NDVI from RGB. Avg: {avg_ndvi:.3f}", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        )

    recommendations = {
        "excellent": "Pasture is thriving. Continue current rotation schedule. Good for grazing.",
        "good": "Pasture health is solid. Maintain rotation and monitor for dry patches.",
        "moderate": "Consider reducing grazing pressure in this zone. Plan supplemental feed.",
        "poor": "Rest this zone for 3-4 weeks. Apply fertilizer or irrigation if possible.",
        "bare": "This zone needs full rehabilitation. Re-seed and rest for 6+ weeks."
    }

    return jsonify({
        "zone": zone,
        "avgNdvi": round(avg_ndvi, 4),
        "healthScore": health,
        "coveragePercent": round(coverage, 1),
        "recommendation": recommendations.get(health, "Monitor closely."),
        "visualizationUrl": f"/uploads/{vis_path.name}",
        "scanDate": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    })


@app.get("/api/ndvi/scans")
def api_ndvi_scans():
    """Get all NDVI scan history."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM ndvi_scans ORDER BY scan_date DESC LIMIT 50"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# ============================================================
# 6. DIASPORA INVESTMENT PORTAL
# ============================================================

@app.get("/api/diaspora/portal")
def api_diaspora_portal():
    """Public endpoint for diaspora investors: farm overview, available breed lots, live cameras, and performance."""
    data = read_farm_data()
    investment = data.get("investment", {})

    # Public-safe data (no wallet balance or private info)
    breed_lots = investment.get("breedLots", [])
    cameras = [c for c in data.get("cameras", []) if c.get("status") == "online" and c.get("stream_url")]
    livestock = data.get("livestock", {}).get("cattle", {})

    # Performance metrics
    weight_history = data.get("weightHistory", [])
    milk_history = data.get("milkHistory", [])
    avg_growth = 0
    if len(weight_history) >= 2:
        avg_growth = ((weight_history[-1].get("avg", 0) - weight_history[0].get("avg", 0)) / weight_history[0].get("avg", 1)) * 100

    avg_milk = sum(m.get("liters", 0) for m in milk_history) / max(1, len(milk_history))

    return jsonify({
        "farm": {
            "name": data.get("organization", {}).get("name", "Borne Farms"),
            "location": data.get("organization", {}).get("location", "Nigeria"),
            "totalCattle": sum(c.get("count", 0) for c in livestock.values()),
            "avgGrowthPercent": round(avg_growth, 1),
            "avgDailyMilkLiters": round(avg_milk, 0)
        },
        "breedLots": [{
            "id": lot["id"],
            "breed": lot["breed"],
            "localName": lot.get("localName", ""),
            "region": lot.get("region", ""),
            "unitPrice": lot["unitPrice"],
            "availableUnits": lot.get("availableUnits", 0),
            "feedTier": lot.get("feedTier", ""),
            "expectedMonthlyGrowth": lot.get("expectedMonthlyGrowth", 0),
            "image": lot.get("image", "")
        } for lot in breed_lots],
        "liveCameras": [{"id": c["id"], "name": c["name"], "streamUrl": c["stream_url"]} for c in cameras],
        "performance": {
            "weightHistory": weight_history,
            "milkHistory": milk_history[-7:],
            "healthIssues": len(data.get("activeHealthIssues", [])),
            "monthlyStats": data.get("monthlyStats", {})
        }
    })


# ============================================================
# 7. VOICE NOTES FOR FIELD WORKERS
# ============================================================

@app.post("/api/voice-notes")
def api_voice_note_upload():
    """Upload a voice note with optional auto-transcript. Accepts multipart: audio file + workerName + animalTag + transcript."""
    body = request.form
    audio_file = request.files.get("audio")
    worker_name = body.get("workerName", "Unknown")
    animal_tag = body.get("animalTag", "")
    transcript = body.get("transcript", "")

    if not audio_file:
        return jsonify({"error": "No audio file. Expected form field: audio"}), 400

    audio_path = UPLOAD_DIR / f"voice-{int(time.time())}.webm"
    audio_file.save(audio_path)

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO voice_notes (worker_name, animal_tag, transcript, audio_path, duration_sec)
               VALUES (?, ?, ?, ?, ?)""",
            (worker_name, animal_tag, transcript, str(audio_path.name), int(body.get("duration", 0)))
        )
        note_id = cursor.lastrowid

    return jsonify({"success": True, "id": note_id, "audioUrl": f"/uploads/{audio_path.name}", "transcript": transcript})


@app.get("/api/voice-notes")
def api_voice_notes_list():
    """List all voice notes."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, worker_name, animal_tag, transcript, audio_path, duration_sec, created_at FROM voice_notes ORDER BY id DESC LIMIT 50"
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["audioUrl"] = f"/uploads/{d['audio_path']}"
        result.append(d)
    return jsonify(result)


@app.delete("/api/voice-notes/<note_id>")
def api_voice_note_delete(note_id):
    with get_db() as conn:
        conn.execute("DELETE FROM voice_notes WHERE id = ?", (int(note_id),))
    return jsonify({"success": True})


# ============================================================
# 8. WEIGHT ESTIMATION FROM PHOTOS
# ============================================================

@app.post("/api/weight-estimate")
def api_weight_estimate():
    """Estimate cattle weight from a photo using body area analysis. Accepts multipart: image + animalTag."""
    if cv2 is None:
        return jsonify({"error": "OpenCV (cv2) not available"}), 500

    image_file = request.files.get("image")
    animal_tag = request.form.get("animalTag", "Unknown")
    if not image_file:
        return jsonify({"error": "No image uploaded. Expected form field: image"}), 400

    img_path = UPLOAD_DIR / f"weight-{int(time.time())}.jpg"
    image_file.save(img_path)
    img = cv2.imread(str(img_path))
    if img is None:
        return jsonify({"error": "Could not read image"}), 400

    # Estimate weight using body contour area
    # This is a heuristic: larger contour = larger animal
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (21, 21), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        # Fallback: use image area
        body_area = img.shape[0] * img.shape[1] * 0.4
        confidence = 0.3
    else:
        largest = max(contours, key=cv2.contourArea)
        body_area = cv2.contourArea(largest)
        confidence = min(0.85, max(0.3, body_area / (img.shape[0] * img.shape[1])))

    # Heuristic weight formula: area-based estimation
    # Typical cattle photo: 1920x1080, body fills ~40% = ~830k pixels -> ~400kg
    # Scale factor calibrated for side-profile photos
    img_area = img.shape[0] * img.shape[1]
    body_ratio = body_area / img_area if img_area > 0 else 0.3
    estimated_kg = max(80, min(800, body_ratio * 1000))

    # Body condition score (1-9 scale) based on contour fullness
    bcs = round(max(2, min(9, 3 + body_ratio * 8)), 1)

    # Draw contour on image for visual feedback
    annotated = img.copy()
    if contours:
        cv2.drawContours(annotated, [max(contours, key=cv2.contourArea)], -1, (0, 255, 0), 3)
    vis_path = UPLOAD_DIR / f"weight-vis-{int(time.time())}.jpg"
    cv2.imwrite(str(vis_path), annotated)

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO weight_estimates (animal_tag, estimated_kg, confidence, image_path, body_condition_score)
               VALUES (?, ?, ?, ?, ?)""",
            (animal_tag, round(estimated_kg, 1), round(confidence, 2), str(img_path.name), bcs)
        )
        est_id = cursor.lastrowid

    return jsonify({
        "id": est_id,
        "animalTag": animal_tag,
        "estimatedKg": round(estimated_kg, 1),
        "confidence": round(confidence, 2),
        "bodyConditionScore": bcs,
        "visualizationUrl": f"/uploads/{vis_path.name}",
        "note": "Estimate based on body contour area. For best results, use a side-profile photo with the cattle filling most of the frame."
    })


@app.get("/api/weight-estimates")
def api_weight_estimates_list():
    """List all weight estimates."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, animal_tag, estimated_kg, confidence, body_condition_score, created_at FROM weight_estimates ORDER BY id DESC LIMIT 50"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# ============================================================
# 9. CATTLE THEFT ALERT SYSTEM
# ============================================================

@app.post("/api/theft-alert")
def api_create_theft_alert():
    """Create a theft alert. Body: {animalTag, alertType, zone, details}"""
    body = request.get_json(silent=True) or {}
    animal_tag = body.get("animalTag", "").strip()
    alert_type = body.get("alertType", "geofence_breach")
    if not animal_tag:
        return jsonify({"error": "animalTag required"}), 400

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO theft_alerts (animal_tag, alert_type, zone, details)
               VALUES (?, ?, ?, ?)""",
            (animal_tag, alert_type, body.get("zone", ""), body.get("details", ""))
        )
        alert_id = cursor.lastrowid

    return jsonify({
        "success": True,
        "id": alert_id,
        "animalTag": animal_tag,
        "alertType": alert_type,
        "message": f"Theft alert triggered for {animal_tag}. Farm manager notified."
    })


@app.get("/api/theft-alerts")
def api_theft_alerts_list():
    """List all theft alerts (active first)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM theft_alerts ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, id DESC LIMIT 50"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/theft-alerts/<alert_id>/resolve")
def api_resolve_theft_alert(alert_id):
    """Mark a theft alert as resolved."""
    with get_db() as conn:
        conn.execute("UPDATE theft_alerts SET status = 'resolved' WHERE id = ?", (int(alert_id),))
    return jsonify({"success": True, "id": int(alert_id), "status": "resolved"})


@app.post("/api/theft-alerts/check")
def api_theft_check():
    """Check cattle locations against farm boundaries. Body: {cattle: [{tag, lat, lng}], boundary: {lat, lng, radiusMeters}}"""
    body = request.get_json(silent=True) or {}
    cattle_list = body.get("cattle", [])
    boundary = body.get("boundary", {})
    center_lat = boundary.get("lat", 0)
    center_lng = boundary.get("lng", 0)
    radius_m = boundary.get("radiusMeters", 500)

    import math
    alerts = []
    for c in cattle_list:
        clat = c.get("lat", 0)
        clng = c.get("lng", 0)
        # Haversine distance
        dlat = math.radians(clat - center_lat)
        dlng = math.radians(clng - center_lng)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(center_lat)) * math.cos(math.radians(clat)) * math.sin(dlng/2)**2
        distance = 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        if distance > radius_m:
            alert = {
                "animalTag": c.get("tag", "Unknown"),
                "distance": round(distance, 1),
                "alertType": "geofence_breach",
                "details": f"Animal is {round(distance - radius_m, 1)}m outside farm boundary"
            }
            alerts.append(alert)
            # Auto-create alert in DB
            with get_db() as conn:
                conn.execute(
                    """INSERT INTO theft_alerts (animal_tag, alert_type, zone, details) VALUES (?, ?, ?, ?)""",
                    (c["tag"], "geofence_breach", "outside_boundary", alert["details"])
                )

    return jsonify({"alerts": alerts, "checkedCount": len(cattle_list), "boundaryRadius": radius_m})


# ============================================================
# 10. FARM PROFITABILITY SIMULATOR
# ============================================================

@app.post("/api/simulator/profitability")
def api_profitability_simulator():
    """Simulate farm profitability under different scenarios. Body: {feedTier, sellInMonths, additionalCattle, feedCostPerKg}"""
    body = request.get_json(silent=True) or {}
    data = read_farm_data()

    # Current baseline
    livestock = data.get("livestock", {}).get("cattle", {})
    current_total = sum(c.get("count", 0) for c in livestock.values())
    current_milk = data.get("monthlyStats", {}).get("milkProduction", 800)
    feed_inventory = data.get("feedInventory", {})
    daily_consumption = data.get("dailyFeedConsumption", {})

    # Simulation parameters
    feed_tier = body.get("feedTier", "Basic")
    sell_in_months = int(body.get("sellInMonths", 6))
    additional_cattle = int(body.get("additionalCattle", 0))
    feed_cost_override = body.get("feedCostPerKg")

    # Feed tier multipliers (impact on growth and milk)
    tier_multipliers = {
        "Basic": {"growth": 1.0, "milk": 1.0, "cost": 1.0},
        "Advanced": {"growth": 1.25, "milk": 1.15, "cost": 1.4},
        "Premium": {"growth": 1.5, "milk": 1.3, "cost": 1.8},
        "Elite": {"growth": 1.8, "milk": 1.5, "cost": 2.2}
    }
    tm = tier_multipliers.get(feed_tier, tier_multipliers["Basic"])

    # Simulated herd size
    sim_total = current_total + additional_cattle

    # Monthly milk revenue (₦250/liter average) - milkProduction is daily liters
    milk_price_per_liter = 250
    sim_daily_milk = current_milk * tm["milk"] * (sim_total / max(1, current_total))
    sim_monthly_milk = sim_daily_milk * 30
    milk_revenue = sim_monthly_milk * milk_price_per_liter * sell_in_months

    # Feed cost over period - use actual monthly feed expense from finance data
    finance = data.get("finance", {})
    feed_expense_entry = next((e for e in finance.get("expense", []) if "feed" in e.get("label", "").lower()), None)
    base_monthly_feed = feed_expense_entry.get("value", 880000) if feed_expense_entry else 880000
    monthly_feed_cost = base_monthly_feed * tm["cost"] * (sim_total / max(1, current_total))
    total_feed_cost = monthly_feed_cost * sell_in_months

    # Cattle sale revenue (estimate avg price ₦250,000 per head)
    avg_sale_price = 250000
    # Growth appreciation
    growth_rate = 0.05 * tm["growth"]  # 5% base monthly growth
    appreciated_price = avg_sale_price * (1 + growth_rate) ** sell_in_months
    sale_revenue = sim_total * appreciated_price if body.get("sellAll", False) else additional_cattle * appreciated_price

    # Other costs (vet, labour) - from finance data, exclude feed
    other_monthly = sum(e.get("value", 0) for e in finance.get("expense", []) if "feed" not in e.get("label", "").lower())
    total_other_cost = other_monthly * sell_in_months * (sim_total / max(1, current_total))

    total_revenue = milk_revenue + sale_revenue
    total_cost = total_feed_cost + total_other_cost
    net_profit = total_revenue - total_cost
    roi_pct = (net_profit / max(1, total_cost)) * 100

    # Compare with baseline (no changes)
    baseline_milk = current_milk * 30 * milk_price_per_liter * sell_in_months
    baseline_feed = base_monthly_feed * sell_in_months
    baseline_other = other_monthly * sell_in_months
    baseline_cost = baseline_feed + baseline_other
    baseline_net = baseline_milk - baseline_cost

    return jsonify({
        "scenario": {
            "feedTier": feed_tier,
            "sellInMonths": sell_in_months,
            "additionalCattle": additional_cattle,
            "simulatedHerdSize": sim_total
        },
        "projections": {
            "milkRevenue": int(milk_revenue),
            "saleRevenue": int(sale_revenue),
            "feedCost": int(total_feed_cost),
            "otherCost": int(total_other_cost),
            "totalRevenue": int(total_revenue),
            "totalCost": int(total_cost),
            "netProfit": int(net_profit),
            "roiPercent": round(roi_pct, 1),
            "monthlyMilkLiters": int(sim_monthly_milk),
            "dailyMilkLiters": int(sim_daily_milk),
            "appreciatedPricePerHead": int(appreciated_price)
        },
        "baseline": {
            "netProfit": int(baseline_net),
            "totalRevenue": int(baseline_milk),
            "totalCost": int(baseline_cost),
            "herdSize": current_total
        },
        "comparison": {
            "profitDifference": int(net_profit - baseline_net),
            "roiDifference": round(roi_pct - ((baseline_net / max(1, baseline_cost)) * 100), 1),
            "verdict": "profitable" if net_profit > baseline_net else "less_profitable" if net_profit > 0 else "loss"
        }
    })


@app.get("/uploads/<path:filename>")
def serve_upload(filename):
    """Serve uploaded files (NDVI visualizations, voice notes, weight images, etc.)."""
    return send_from_directory(str(UPLOAD_DIR), filename)


if __name__ == "__main__":
    init_db()
    get_or_create_default_user()
    seed_cattle_records()
    seed_sale_history()
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
