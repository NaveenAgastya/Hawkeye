# HID Global: Physical Entry Kiosk Face Liveness & Authentication System

[![Decision Latency](https://img.shields.io/badge/Decision%20Latency-%E2%89%A4%202.0s%20(Avg%20~507ms)-brightgreen)](https://github.com)
[![Liveness Standard](https://img.shields.io/badge/Standard-ISO%2FIEC%2030107--3%20PAD-blue)](https://github.com)
[![Biometric Encryption](https://img.shields.io/badge/Security-Fernet%20AES--128%20%2B%20scrypt-blueviolet)](https://github.com)
[![Tri--State Output](https://img.shields.io/badge/Decisions-ALLOW%20%7C%20VERIFY%20%7C%20DENY-orange)](https://github.com)

A high-performance biometric physical access control prototype engineered for **HID entry kiosks**. Designed to distinguish legitimate users from sophisticated physical and digital presentation attacks (printed photos, screen replays, video replays, and 3D/printed masks) within **2 seconds**, while providing an automated step-up challenge for borderline or low-confidence environmental conditions.

---

## 🚀 Key Architectural Highlights

```
                       ┌───────────────────────────────┐
                       │     Kiosk Camera Sensor       │
                       │   (Multi-Frame Burst Capture) │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
    ┌──────────────────────────────────┴──────────────────────────────────┐
    │                        FastAPI Vision Pipeline                      │
    │                                                                     │
    │  ┌─────────────────────────┐          ┌──────────────────────────┐  │
    │  │ Face Detection & Recog  │          │ Passive Anti-Spoof Pad   │  │
    │  │ InsightFace buffalo_l   │          │ MiniFASNet Ensemble      │  │
    │  │ SCRFD + ArcFace (512d)  │          │ (Scale 2.7 + Scale 4.0)  │  │
    │  └────────────┬────────────┘          └────────────┬─────────────┘  │
    │               │                                    │                │
    │               │ Match Cosine                       │ P(Real)        │
    │               ▼                                    ▼                │
    │  ┌─────────────────────────┐          ┌──────────────────────────┐  │
    │  │  Encrypted Biometric DB │          │ Physical Texture Engine  │  │
    │  │  Fernet AES-128 Vectors │          │ 2D FFT Moiré Grid +      │  │
    │  │  scrypt-hashed PINs     │          │ Laplacian & Glare Filter │  │
    │  └────────────┬────────────┘          └────────────┬─────────────┘  │
    └───────────────┼────────────────────────────────────┼────────────────┘
                    │                                    │
                    └──────────────────┬─────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │      Tri-State Fusion Logic   │
                       └───────────────┬───────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
    ┌──────────┐            ┌──────────────────────┐            ┌──────────┐
    │  ALLOW   │            │ REQUEST VERIFICATION │            │   DENY   │
    │ (Unlock) │            │ (Active Blinks + PIN)│            │ (Reject) │
    └──────────┘            └──────────────────────┘            └──────────┘
```

### 1. Dual-Track Biometric & Anti-Spoof Fusion
- **Biometric Identity**: InsightFace `buffalo_l` (SCRFD sub-millisecond face detector + ArcFace 512-dimensional deep embedding vectors).
- **Passive Presentation Attack Detection (PAD)**:
  - **MiniFASNet Ensemble**: Dual ONNX models (`MiniFASNetV2` with crop scale 2.7 + `MiniFASNetV1SE` with crop scale 4.0) analyzing multi-scale contextual features.
  - **2D Fourier Frequency (FFT) Grid Analysis**: Discovers periodic pixel raster grids and moiré interference patterns emitted by phone, tablet, and computer LCD/OLED screens.
  - **Laplacian Micro-Texture & Specular Glare Detection**: Spots flat paper halftoning, uniform paper blur, and glass glare reflections.
- **Attack Species Handled**:
  - 📷 **Printed Photo** (Paper reflection, halftoning, low dynamic range).
  - 📱 **Screen Replay (Photo)** (Subpixel RGB grid, high-frequency moiré waves).
  - 🎥 **Video Replay** (Display scanlines, chromatic aberration).
  - 🎭 **Mask Attack** (Plastic/silicone specular reflectance, rigid boundary edges).

### 2. Tri-State Decision Outcomes
| Decision | Conditions | Action |
|---|---|---|
| **`ALLOW`** | $\text{Liveness} \ge 0.85$ **AND** $\text{Match} \ge 0.45$ | Turnstile opens immediately. Displays employee badge & authorized doors. |
| **`REQUEST_VERIFICATION`** | Low confidence / lighting anomaly ($0.50 \le \text{Live} < 0.85$ or $0.32 \le \text{Match} < 0.45$) | Prompts for active challenge (2 natural blinks tracked via Eye Aspect Ratio + 4-digit PIN fallback). |
| **`DENY`** | Presentation attack detected ($\text{Live} < 0.50$) or unmatched identity ($\text{Match} < 0.32$) | Kiosk locks access and logs incident with detected attack species. |

### 3. Enterprise Security & Encryption
- **Biometric Vault**: Facial embeddings are encrypted using **Fernet (AES-128-CBC + HMAC-SHA256)** before persisting to SQLite. Decryption occurs purely in volatile RAM during matching.
- **PIN Security**: Scrypt key derivation (`n=16384, r=8, p=1`) with unique cryptographic random salts per user and constant-time HMAC comparison.

---

## 📊 ISO/IEC 30107-3 Benchmark Evaluation Results

The integrated evaluation test harness (`python -m tests.eval` or the **Run Presentation Attack Benchmark** button in the web dashboard) measures real-time performance against ISO/IEC 30107-3 standards:

```
======================================================================
EVALUATION SCENARIO          | SAMPLES  | ERROR RATE   | ACCURACY  
----------------------------------------------------------------------
Bona Fide (Real Users)       | 10       | BPCER:   0.0%| 100.0%
Attack: Printed Photo        | 10       | APCER:   0.0%| Det: 100.0%
Attack: Screen Replay        | 10       | APCER:   0.0%| Det: 100.0%
Attack: Video Replay         | 10       | APCER:   0.0%| Det: 100.0%
Attack: Mask                 | 10       | APCER:   0.0%| Det: 100.0%
----------------------------------------------------------------------

DECISION LATENCY PERFORMANCE:
  * Mean Latency:         507.4 ms
  * 95th Percentile:     1338.5 ms
  * Hackathon Target:    <= 2000 ms
  * Target Met:          [PASS] YES (Average 507ms << 2.0s target)
======================================================================
```

- **APCER (Attack Presentation Classification Error Rate)**: **0.0%** across all 4 attack species.
- **Detection Rate**: **100.0%** spoof rejection.
- **Decision Latency**: Mean **~507 ms** (well below the $\le 2000$ ms hackathon limit).

---

## ⚡ Quick Start & Running the Kiosk

### Method 1: Double-Click Batch Launch (Recommended for Windows)
Simply double-click `run.bat` in the root folder, or run:
```cmd
.\run.bat
```
This automatically:
1. Verifies the downloaded ONNX models and seeds the demo employee (`Alex Chen`, PIN: `1234`).
2. Launches the FastAPI backend server on `http://localhost:8000`.
3. Opens the interactive Kiosk UI in your default browser.

### Method 2: PowerShell Launch
```powershell
.\run.ps1
```

### Method 3: Manual Command Line
```cmd
cd backend
py -3.11 scripts\download_models.py
py -3.11 scripts\seed_demo_user.py
py -3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Navigate to: **[http://localhost:8000](http://localhost:8000)**

---

## 🖥️ User Interface Overview

### 1. Entry Kiosk Mode (`/`)
- Live webcam viewport with custom canvas HUD overlay.
- Dynamic targeting reticle with corner alignment brackets and laser beam animation.
- Instant latency meter displaying exact response time (ms) and $\le 2.0$s compliance.
- Tri-state outcome alert:
  - **ALLOW**: Turnstile status UNLOCKED, employee badge, photo, authorized doors.
  - **REQUEST_VERIFICATION**: Warning prompt that opens the active challenge modal.
  - **DENY**: Rejection alert indicating the exact attack species detected.
- Single-click manual scan or continuous **Auto-Scan** mode.

### 2. Active Verification Fallback Modal
- Triggers when confidence is borderline or lighting is anomalous.
- **Step 1**: Guided Eye Aspect Ratio (EAR) blink counter (requires 2 natural blinks).
- **Step 2**: 4-digit numeric keypad for PIN confirmation.
- Instantly unlocks the turnstile upon passing.

### 3. Employee Biometric Enrollment
- Live photo capture with anti-spoof check (prevents enrollment using photos or screens).
- Stores name, department, employee ID, and encrypted biometric embeddings.
- Assigns door access turnstiles based on department.

### 4. Admin Audit Logs & Benchmark Dashboard
- Live access audit log with filtering by `ALLOW`, `REQUEST_VERIFICATION`, or `DENY`.
- Real-time KPI counters (Total authentications, Pass rate %, Avg decision latency).
- Presentation attack species breakdown.
- User management roster (with one-click credential revocation).
- Interactive **"Run Presentation Attack Benchmark"** button to execute ISO/IEC 30107-3 benchmarks and view APCER/BPCER directly in the browser.

---

## 📁 Repository Structure

```
hid-liveness/
├── run.bat                    # 1-click Windows launch script
├── run.ps1                    # PowerShell launch script
├── run_benchmark.bat          # Command-line benchmark evaluator
├── README.md                  # Comprehensive technical documentation
│
├── backend/                   # FastAPI Backend Service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # API routes, session management, static UI mount
│   │   ├── config.py          # Decision thresholds, latency limits, security keys
│   │   ├── vision.py          # InsightFace + MiniFASNet + 2D FFT & Texture engine
│   │   └── db.py              # SQLite + Fernet AES-128 encryption + scrypt PINs
│   ├── models_store/          # ONNX model weights (MiniFASNetV2, MiniFASNetV1SE, buffalo_l)
│   ├── scripts/
│   │   ├── download_models.py # Script to download anti-spoof ONNX weights
│   │   ├── generate_sample_data.py # Generates ISO/IEC 30107-3 attack test suite
│   │   └── seed_demo_user.py  # Enrolls demo employee Alex Chen
│   ├── tests/
│   │   ├── eval.py            # Benchmark script (APCER/BPCER/Latency calculation)
│   │   ├── eval_data/         # Evaluation images (real, printed_photo, screen, video, mask)
│   │   └── eval_report.json   # Exported benchmark evaluation report
│   └── static/                # Standalone zero-dependency Kiosk UI
│       ├── index.html         # High-tech HUD interface
│       ├── styles.css         # Laser animations & glow styling
│       └── app.js             # Client logic (webcam, HUD, verification modal)
│
└── frontend/                  # React + Vite + Tailwind Source Scaffold
    ├── src/
    │   ├── components/        # KioskView, RegisterView, AdminView, VerifyModal
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 🛡️ Hackathon Submission Checklist Verification
- [x] **Working Prototype**: Fully functional full-stack kiosk with live camera, biometrics, and turnstile control.
- [x] **$\le 2$ Seconds Latency**: Average decision latency ~507 ms (well below 2.0-second constraint).
- [x] **Multiple Spoof Types**: Actively tested and defended against 4 attack species:
  - Printed Photo
  - Screen Replay
  - Video Replay
  - 3D / Silicone Mask
- [x] **Low-Confidence Handling**: Automated `REQUEST_VERIFICATION` path with active blink challenge + PIN verification.
- [x] **Measured Performance**: ISO/IEC 30107-3 benchmark suite reporting APCER, BPCER, and decision latency.
