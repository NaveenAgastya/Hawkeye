"""
Seed an enrolled demo employee in the database for immediate testing.
"""
import sys
import pathlib
import numpy as np

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app import db
from app.config import DEFAULT_DOORS

def seed():
    existing = db.get_user_by_employee_id("HID-84920")
    if existing:
        print("[SEED] Demo user 'Alex Chen' (HID-84920) is already enrolled.")
        return

    # Create normalized sample embedding
    np.random.seed(42)
    fake_emb = np.random.randn(512).astype(np.float32)
    fake_emb /= np.linalg.norm(fake_emb)

    uid = db.add_user(
        name="Alex Chen",
        department="Engineering",
        employee_id="HID-84920",
        pin="1234",
        photo="HID-84920.jpg",
        emb=fake_emb,
        doors=DEFAULT_DOORS["Engineering"]
    )
    print(f"[SEED] Successfully created demo user 'Alex Chen' (ID: {uid}, Employee ID: HID-84920, PIN: 1234)")

if __name__ == "__main__":
    seed()
