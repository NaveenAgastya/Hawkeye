import sqlite3
import json
import os
import hashlib
import hmac
import time
import numpy as np
from cryptography.fernet import Fernet
from .config import DATA_DIR

KEY_FILE = DATA_DIR / "biometric_secret.key"
DB_FILE = DATA_DIR / "hid_access.db"

# Initialize or load Fernet encryption key for biometric embeddings
if not KEY_FILE.exists():
    KEY_FILE.write_bytes(Fernet.generate_key())
_fernet = Fernet(KEY_FILE.read_bytes())

def get_connection():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            employee_id TEXT UNIQUE NOT NULL,
            pin_hash TEXT NOT NULL,
            photo TEXT NOT NULL,
            embedding BLOB NOT NULL,
            doors TEXT NOT NULL,
            created_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts REAL NOT NULL,
            user_id INTEGER,
            employee_id TEXT,
            name TEXT,
            sim REAL,
            live REAL,
            ms REAL,
            outcome TEXT NOT NULL,
            reason TEXT,
            spoof_type TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
        CREATE INDEX IF NOT EXISTS idx_users_eid ON users(employee_id);
        """)

# Initialize schema on load
init_db()

def hash_pin(pin: str) -> str:
    """Scrypt password hashing with cryptographically secure random salt."""
    salt = os.urandom(16)
    hashed = hashlib.scrypt(pin.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{hashed.hex()}"

def verify_pin(pin: str, stored_hash: str) -> bool:
    """Constant-time verification of scrypt-hashed PIN."""
    try:
        salt_hex, hash_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        candidate = hashlib.scrypt(pin.encode(), salt=salt, n=2**14, r=8, p=1).hex()
        return hmac.compare_digest(candidate, hash_hex)
    except Exception:
        return False

def encrypt_embedding(emb: np.ndarray) -> bytes:
    """Encrypt float32 normalized face embedding with Fernet (AES-128-CBC + HMAC)."""
    raw_bytes = emb.astype(np.float32).tobytes()
    return _fernet.encrypt(raw_bytes)

def decrypt_embedding(blob: bytes) -> np.ndarray:
    """Decrypt binary blob into float32 numpy vector."""
    decrypted = _fernet.decrypt(blob)
    return np.frombuffer(decrypted, dtype=np.float32)

def add_user(name: str, department: str, employee_id: str, pin: str, photo: str, emb: np.ndarray, doors: list) -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO users (name, department, employee_id, pin_hash, photo, embedding, doors, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, department, employee_id, hash_pin(pin), photo, encrypt_embedding(emb), json.dumps(doors), time.time())
        )
        return cursor.lastrowid

def get_user(uid: int):
    with get_connection() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()

def get_user_by_employee_id(employee_id: str):
    with get_connection() as conn:
        return conn.execute("SELECT * FROM users WHERE employee_id = ?", (employee_id,)).fetchone()

def list_users():
    with get_connection() as conn:
        rows = conn.execute("SELECT id, name, department, employee_id, photo, doors, created_at FROM users ORDER BY id DESC").fetchall()
        users = []
        for r in rows:
            u = dict(r)
            u["doors"] = json.loads(u["doors"])
            users.append(u)
        return users

def delete_user(uid: int):
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (uid,))

def best_match(emb: np.ndarray):
    """
    Search registered users for the highest cosine similarity match.
    Embeddings are L2-normalized so dot product equals cosine similarity.
    """
    with get_connection() as conn:
        rows = conn.execute("SELECT id, name, department, employee_id, photo, pin_hash, embedding, doors FROM users").fetchall()
    
    if not rows:
        return None, 0.0
    
    best_user = None
    best_sim = -1.0
    
    for row in rows:
        stored_emb = decrypt_embedding(row["embedding"])
        sim = float(np.dot(emb, stored_emb))
        if sim > best_sim:
            best_sim = sim
            best_user = row
            
    return best_user, best_sim

def log_attempt(user_id=None, employee_id=None, name=None, sim=None, live=None, ms=0.0, outcome="DENY", reason="", spoof_type="Unknown"):
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO logs (ts, user_id, employee_id, name, sim, live, ms, outcome, reason, spoof_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (time.time(), user_id, employee_id, name, sim, live, ms, outcome, reason, spoof_type)
        )

def get_logs(limit=100, outcome=None):
    with get_connection() as conn:
        if outcome:
            rows = conn.execute("SELECT * FROM logs WHERE outcome = ? ORDER BY ts DESC LIMIT ?", (outcome, limit)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM logs ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

def get_stats():
    with get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM logs").fetchone()[0]
        allow = conn.execute("SELECT COUNT(*) FROM logs WHERE outcome = 'ALLOW'").fetchone()[0]
        verify = conn.execute("SELECT COUNT(*) FROM logs WHERE outcome = 'REQUEST_VERIFICATION'").fetchone()[0]
        deny = conn.execute("SELECT COUNT(*) FROM logs WHERE outcome = 'DENY'").fetchone()[0]
        
        avg_ms_row = conn.execute("SELECT AVG(ms) FROM logs WHERE ms > 0").fetchone()
        avg_ms = round(avg_ms_row[0] or 0.0, 1)

        spoof_rows = conn.execute("""
            SELECT spoof_type, COUNT(*) as cnt 
            FROM logs 
            WHERE outcome = 'DENY' AND spoof_type IS NOT NULL AND spoof_type != 'Real'
            GROUP BY spoof_type
        """).fetchall()
        spoofs = {r["spoof_type"]: r["cnt"] for r in spoof_rows}

        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

        return {
            "total_attempts": total,
            "allow_count": allow,
            "verify_count": verify,
            "deny_count": deny,
            "registered_users": user_count,
            "avg_latency_ms": avg_ms,
            "pass_rate_pct": round((allow / total * 100) if total > 0 else 0, 1),
            "spoof_breakdown": spoofs
        }

def get_user_logs(user_id=None, employee_id=None, limit=50):
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT * FROM logs 
               WHERE (user_id IS NOT NULL AND user_id = ?) 
                  OR (employee_id IS NOT NULL AND employee_id = ?)
               ORDER BY ts DESC LIMIT ?""",
            (user_id, employee_id, limit)
        ).fetchall()
        return [dict(r) for r in rows]

def get_user_dashboard(uid: int):
    user = get_user(uid)
    if not user:
        return None
    
    u = dict(user)
    u["doors"] = json.loads(u["doors"])
    
    logs = get_user_logs(user_id=uid, employee_id=u["employee_id"], limit=30)
    
    passed = sum(1 for l in logs if l["outcome"] == "ALLOW")
    verify = sum(1 for l in logs if l["outcome"] == "REQUEST_VERIFICATION")
    failed = sum(1 for l in logs if l["outcome"] == "DENY")
    avg_ms = round(sum(l["ms"] for l in logs) / len(logs), 1) if logs else 0.0

    return {
        "user": {
            "id": u["id"],
            "name": u["name"],
            "department": u["department"],
            "employee_id": u["employee_id"],
            "photo": f"/photos/{u['photo']}",
            "doors": u["doors"]
        },
        "stats": {
            "total_scans": len(logs),
            "passed": passed,
            "verification_challenges": verify,
            "failed": failed,
            "pass_rate_pct": round((passed / len(logs) * 100), 1) if logs else 100.0,
            "avg_latency_ms": avg_ms
        },
        "history": logs
    }

def reset():
    with get_connection() as conn:
        conn.executescript("DELETE FROM users; DELETE FROM logs;")
