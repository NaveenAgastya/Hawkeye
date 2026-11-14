import os
import pathlib

# Base directory for the backend
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PHOTOS_DIR = DATA_DIR / "photos"
MODELS_DIR = BASE_DIR / "models_store"

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# MiniFASNet anti-spoofing models with crop scales
# Ensemble: MiniFASNetV2 (scale 2.7) + MiniFASNetV1SE (scale 4.0)
SPOOF_MODELS = [
    (MODELS_DIR / "MiniFASNetV2.onnx", 2.7),
    (MODELS_DIR / "MiniFASNetV1SE.onnx", 4.0)
]

# Decision Thresholds (ArcFace Cosine Similarity & Anti-Spoof Liveness Score)
SIM_ALLOW = float(os.getenv("SIM_ALLOW", 0.45))
SIM_DENY = float(os.getenv("SIM_DENY", 0.32))
LIVE_ALLOW = float(os.getenv("LIVE_ALLOW", 0.85))
LIVE_DENY = float(os.getenv("LIVE_DENY", 0.50))

# Target latency constraint
MAX_LATENCY_MS = 2000  # Hackathon target: <= 2 seconds

# Active Verification (Challenge-Response Fallback)
TOKEN_TTL = int(os.getenv("TOKEN_TTL", 90)) # seconds valid for secondary verification
MAX_PIN_TRIES = int(os.getenv("MAX_PIN_TRIES", 3))
REQUIRED_BLINKS = 2
EAR_LOW_THRESH = 0.20
EAR_HIGH_THRESH = 0.26

# Admin API security
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "hid-hackathon-2026-admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_PIN = os.getenv("ADMIN_PIN", "9999")

# Default Access Control Doors by Department
DEFAULT_DOORS = {
    "Engineering": ["Main Lobby Turnstile", "Engineering Lab B", "Server Room 1", "Cafeteria Turnstile"],
    "Security": ["Main Lobby Turnstile", "Security Operations Center", "All Perimeters", "Executive Floor"],
    "Executive": ["Main Lobby Turnstile", "Executive Boardroom", "Executive Floor", "Private Lounge"],
    "Operations": ["Main Lobby Turnstile", "Warehouse Loading Bay", "Facility Ops", "Cafeteria Turnstile"],
    "General": ["Main Lobby Turnstile", "Cafeteria Turnstile"]
}
