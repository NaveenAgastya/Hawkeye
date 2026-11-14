"""
ISO/IEC 30107-3 Biometric Presentation Attack Detection Benchmark Evaluation
Evaluates:
- APCER (Attack Presentation Classification Error Rate) per attack instrument species:
  - Printed Photo
  - Screen Replay
  - Video Replay
  - 3D / Silicone Mask
- BPCER (Bona Fide Presentation Classification Error Rate)
- Decision Latency (ms) against target <= 2.0s
"""
import os
import sys
import time
import json
import pathlib
import cv2
import numpy as np

# Ensure backend root is on sys.path
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.vision import Vision, decide
from app.config import LIVE_ALLOW, LIVE_DENY, MAX_LATENCY_MS

EVAL_DIR = BASE_DIR / "tests" / "eval_data"

def run_evaluation():
    print("=" * 70)
    print(" HID BIOMETRICS: FACE LIVENESS & PRESENTATION ATTACK EVALUATION ")
    print(" Standard: ISO/IEC 30107-3 | Target Latency <= 2.0s ")
    print("=" * 70)

    if not EVAL_DIR.exists():
        print(f"Eval directory not found at {EVAL_DIR}. Generating synthetic dataset first...")
        from scripts.generate_sample_data import generate_samples
        generate_samples(10)

    v = Vision()

    def process_directory(folder_path):
        results = []
        files = list(folder_path.glob("*.jpg")) + list(folder_path.glob("*.png"))
        for p in files:
            t0 = time.perf_counter()
            img = cv2.imread(str(p))
            if img is None:
                continue
            res = v.analyze(img)
            lat_ms = (time.perf_counter() - t0) * 1000.0
            
            live_score = res["liveness"] if res else 0.0
            spoof_type = res["spoof_type"] if res else "No Face"
            results.append({
                "path": p.name,
                "liveness": live_score,
                "spoof_type": spoof_type,
                "latency_ms": lat_ms
            })
        return results

    # 1. Evaluate Bona Fide (Real Faces)
    real_dir = EVAL_DIR / "real"
    real_results = process_directory(real_dir) if real_dir.exists() else []
    
    if not real_results:
        print("[WARN] No bona fide images found. Generating sample data...")
        from scripts.generate_sample_data import generate_samples
        generate_samples(10)
        real_results = process_directory(real_dir)

    # BPCER: percentage of real presentations incorrectly categorized as attack (< LIVE_DENY)
    real_scores = [r["liveness"] for r in real_results]
    real_latencies = [r["latency_ms"] for r in real_results]
    bpcer = float(np.mean([s < LIVE_DENY for s in real_scores])) if real_scores else 0.0

    # 2. Evaluate Attacks per category
    attack_base = EVAL_DIR / "attack"
    categories = sorted([d for d in attack_base.iterdir() if d.is_dir()]) if attack_base.exists() else []

    attack_metrics = {}
    all_attack_latencies = []

    for cat_dir in categories:
        cat_name = cat_dir.name
        cat_results = process_directory(cat_dir)
        scores = [r["liveness"] for r in cat_results]
        lats = [r["latency_ms"] for r in cat_results]
        all_attack_latencies.extend(lats)

        # APCER: percentage of presentation attacks incorrectly classified as bona fide (>= LIVE_ALLOW)
        apcer = float(np.mean([s >= LIVE_ALLOW for s in scores])) if scores else 0.0
        # Detection rate: attacks successfully caught (< LIVE_ALLOW)
        detection_rate = 1.0 - apcer
        avg_score = float(np.mean(scores)) if scores else 0.0

        attack_metrics[cat_name] = {
            "n": len(cat_results),
            "apcer": apcer,
            "detection_rate": detection_rate,
            "avg_liveness_score": round(avg_score, 3),
            "avg_latency_ms": round(float(np.mean(lats)), 1) if lats else 0.0
        }

    # Latency Performance Check
    all_latencies = real_latencies + all_attack_latencies
    mean_latency = float(np.mean(all_latencies)) if all_latencies else 0.0
    p95_latency = float(np.percentile(all_latencies, 95)) if all_latencies else 0.0
    latency_compliance = mean_latency <= MAX_LATENCY_MS

    # Print Formatted Report Table
    print("\n" + "-" * 70)
    print(f"{'EVALUATION SCENARIO':<28} | {'SAMPLES':<8} | {'ERROR RATE':<12} | {'ACCURACY':<10}")
    print("-" * 70)
    print(f"{'Bona Fide (Real Users)':<28} | {len(real_results):<8} | BPCER: {bpcer:6.1%} | {1.0 - bpcer:6.1%}")
    
    for cat_name, m in attack_metrics.items():
        label = f"Attack: {cat_name.replace('_', ' ').title()}"
        print(f"{label:<28} | {m['n']:<8} | APCER: {m['apcer']:6.1%} | Det: {m['detection_rate']:6.1%}")

    print("-" * 70)
    print("\nDECISION LATENCY PERFORMANCE:")
    print(f"  * Mean Latency:        {mean_latency:6.1f} ms")
    print(f"  * 95th Percentile:     {p95_latency:6.1f} ms")
    print(f"  * Hackathon Target:    <= {MAX_LATENCY_MS} ms")
    print(f"  * Target Met:          {'[PASS] YES' if latency_compliance else '[FAIL] NO'}")
    print("-" * 70)

    # Save summary json
    report = {
        "timestamp": time.time(),
        "bpcer": bpcer,
        "bona_fide_samples": len(real_results),
        "attack_scenarios": attack_metrics,
        "latency": {
            "mean_ms": round(mean_latency, 1),
            "p95_ms": round(p95_latency, 1),
            "max_allowed_ms": MAX_LATENCY_MS,
            "compliant": latency_compliance
        }
    }
    report_file = BASE_DIR / "tests" / "eval_report.json"
    report_file.write_text(json.dumps(report, indent=2))
    print(f"[OK] Full benchmark report exported to: {report_file}\n")
    return report

if __name__ == "__main__":
    run_evaluation()
