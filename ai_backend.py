import os
import json
import sqlite3
import threading
import time
from pathlib import Path

from flask import Flask, Response, jsonify, request
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
    return {
        "organization": {
            "id": "borne",
            "name": "BORNE FARMS",
            "location": "Nigeria"
        },
        "livestock": {
            "cattle": {
                "bull": {"count": 0, "pregnant": 0, "sick": 0},
                "cow": {"count": 0, "pregnant": 0, "sick": 0},
                "calf": {"count": 0, "pregnant": 0, "sick": 0}
            }
        },
        "locations": {
            "paddock": 0,
            "pasture": 0,
            "transport": 0,
            "quarantine": 0
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
            "births": 0,
            "deaths": 0,
            "sold": 0,
            "purchased": 0,
            "milkProduction": 0
        },
        "feedInventory": {
            "hay": {"quantity": 0, "costPerKg": 150, "tier": 1},
            "silage": {"quantity": 0, "costPerKg": 120, "tier": 2},
            "grainMix": {"quantity": 0, "costPerKg": 250, "tier": 2},
            "proteinSupplement": {"quantity": 0, "costPerKg": 450, "tier": 3},
            "mineralLick": {"quantity": 0, "costPerKg": 380, "tier": 3},
            "premiumBlend": {"quantity": 0, "costPerKg": 600, "tier": 4}
        },
        "dailyFeedConsumption": {
            "hay": 0,
            "silage": 0,
            "grainMix": 0,
            "proteinSupplement": 0,
            "premiumBlend": 0
        },
        "feedTiers": {
            "1": {"name": "Basic Grazing", "unlocked": True, "minCattle": 0},
            "2": {"name": "Enhanced Nutrition", "unlocked": True, "minCattle": 0},
            "3": {"name": "Premium Growth", "unlocked": False, "minCattle": 5},
            "4": {"name": "Elite Yield Max", "unlocked": False, "minCattle": 15}
        },
        "investment": {
            "auth": {
                "provider": "Supabase Auth + Passkeys",
                "status": "kyc-ready",
                "riskLevel": "standard",
                "methods": ["Phone OTP", "Email OTP", "Passkey", "BVN/NIN KYC"]
            },
            "paymentRails": [
                {"key": "paystack", "name": "Paystack", "region": "Nigeria", "methods": ["Card", "Bank Transfer", "USSD"], "status": "ready"},
                {"key": "flutterwave", "name": "Flutterwave", "region": "Africa + global cards", "methods": ["Card", "Mobile Money", "Bank Transfer"], "status": "ready"},
                {"key": "stripe", "name": "Stripe", "region": "Global", "methods": ["Card", "Apple Pay", "Google Pay"], "status": "planned"}
            ],
            "wallet": {
                "currency": "NGN",
                "balance": 380000,
                "lockedValue": 520000,
                "escrowValue": 0
            },
            "breedLots": [],
            "holdings": [],
            "marketplaceOffers": [],
            "transactions": []
        },
        "activeHealthIssues": [],
        "recentMovements": [],
        "feedingLogs": [],
        "cameras": [
            {"id": "uav01", "name": "Drone Feed", "ip": "192.168.1.201", "status": "online", "resolution": "4K"},
            {"id": "cam02", "name": "Feeding Station", "ip": "192.168.1.102", "status": "online", "resolution": "1080p"},
            {"id": "cam03", "name": "Milking Parlor", "ip": "192.168.1.103", "status": "online", "resolution": "720p"},
            {"id": "cam04", "name": "Main Gate", "ip": "192.168.1.104", "status": "offline", "resolution": "720p"}
        ],
        "lastUpdated": now
    }


def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
