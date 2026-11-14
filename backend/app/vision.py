import os
import time
import math
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from .config import (
    MODELS_DIR,
    SPOOF_MODELS,
    SIM_ALLOW,
    SIM_DENY,
    LIVE_ALLOW,
    LIVE_DENY,
    EAR_LOW_THRESH,
    EAR_HIGH_THRESH,
    REQUIRED_BLINKS,
)

def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()

def _crop_face(img: np.ndarray, bbox: list, scale: float, out_size: int = 80) -> np.ndarray:
    """
    Scale and crop the bounding box according to Silent-Face-Anti-Spoofing requirements.
    Ensures sufficient context (forehead, chin, surrounding background) is captured for texture/reflection analysis.
    """
    h, w = img.shape[:2]
    x1, y1, x2, y2 = bbox
    bw, bh = x2 - x1, y2 - y1
    
    scale = min((h - 1) / max(1, bh), (w - 1) / max(1, bw), scale)
    nw, nh = bw * scale, bh * scale
    cx, cy = x1 + bw / 2.0, y1 + bh / 2.0
    
    l = max(0, int(cx - nw / 2.0))
    t = max(0, int(cy - nh / 2.0))
    r = min(w - 1, int(cx + nw / 2.0))
    b = min(h - 1, int(cy + nh / 2.0))
    
    cropped = img[t:b+1, l:r+1]
    if cropped.size == 0 or cropped.shape[0] < 5 or cropped.shape[1] < 5:
        return cv2.resize(img, (out_size, out_size))
    return cv2.resize(cropped, (out_size, out_size))

_FFT_SIZE = 96
_Y, _X = np.ogrid[:_FFT_SIZE, :_FFT_SIZE]
_DIST_CENTER = np.sqrt((_X - _FFT_SIZE // 2)**2 + (_Y - _FFT_SIZE // 2)**2)
_HIGH_FREQ_MASK = _DIST_CENTER > (_FFT_SIZE * 0.40)

def analyze_frequency_and_texture(face_img: np.ndarray) -> dict:
    """
    Physical presentation attack signal and capture quality analysis:
    1. FFT High-Frequency Ratio: Identifies screen sub-pixel grids, refresh lines & moiré patterns.
    2. Specular Glare Ratio: Checks for glass surface reflections typical of mobile/tablet/laptop screens.
    3. Laplacian Variance: Measures blur / micro-texture (distinguishes motion blur from flat paper prints).
    4. Luminance: Detects under-exposure (< 40) or severe backlighting (> 225).
    """
    if face_img is None or face_img.size == 0:
        return {
            "fft_ratio": 0.35,
            "laplacian_var": 60.0,
            "glare_ratio": 0.0,
            "mean_luminance": 120.0,
            "is_screen": False,
            "is_paper": False,
            "is_blurry": False,
            "is_poor_lighting": False,
            "texture_conf": 0.8
        }

    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY) if len(face_img.shape) == 3 else face_img
    if gray.shape[0] != _FFT_SIZE or gray.shape[1] != _FFT_SIZE:
        gray = cv2.resize(gray, (_FFT_SIZE, _FFT_SIZE), interpolation=cv2.INTER_AREA)

    # 1. 2D Fourier Transform Analysis on standard 96x96 grid
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = np.log(np.abs(fshift) + 1e-6)

    total_energy = np.sum(magnitude_spectrum) + 1e-6
    high_freq_energy = np.sum(magnitude_spectrum[_HIGH_FREQ_MASK])
    high_freq_ratio = float(high_freq_energy / total_energy)

    # Digital screens exhibit characteristic high-frequency grid interference (> 0.55 on outer ring)
    is_screen_moire = high_freq_ratio > 0.55

    # 2. Specular Reflection / Glare from protective glass / display surface
    bright_pixels = np.sum(gray > 248)
    glare_ratio = float(bright_pixels / (_FFT_SIZE * _FFT_SIZE))
    is_screen_glare = glare_ratio > 0.05

    # 3. Micro-texture variance & motion blur
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    
    # 4. Lighting analysis
    mean_luminance = float(np.mean(gray))
    is_poor_lighting = mean_luminance < 40.0 or mean_luminance > 225.0

    is_screen = is_screen_moire or is_screen_glare
    is_paper = (laplacian_var < 28.0) and (not is_screen) and (mean_luminance > 70.0)
    
    # Genuine face blur flag (only considered when not a screen/photo attack)
    is_blurry = (laplacian_var < 35.0) and (not is_screen) and (not is_paper)

    # Texture confidence score (1.0 = genuine skin micro-texture, 0.0 = screen/print artifact)
    texture_conf = 1.0
    if is_screen:
        texture_conf -= 0.50
    if is_paper:
        texture_conf -= 0.45

    return {
        "fft_ratio": high_freq_ratio,
        "laplacian_var": laplacian_var,
        "glare_ratio": glare_ratio,
        "mean_luminance": mean_luminance,
        "is_screen": is_screen,
        "is_paper": is_paper,
        "is_blurry": is_blurry,
        "is_poor_lighting": is_poor_lighting,
        "texture_conf": max(0.05, min(0.99, texture_conf))
    }

class Vision:
    def __init__(self):
        print("[VISION] Initializing Face Analysis (InsightFace buffalo_s MobileFaceNet)...")
        # Initialize FaceAnalysis with lightweight mobile detection & ArcFace embedding model (< 50ms)
        self.fa = FaceAnalysis(
            name="buffalo_s",
            root=str(MODELS_DIR),
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"]
        )
        self.fa.prepare(ctx_id=-1, det_size=(256, 256))

        # Re-initialize InsightFace sessions with 4-thread CPU options for zero-latency execution
        opt_so = ort.SessionOptions()
        opt_so.intra_op_num_threads = 4
        opt_so.inter_op_num_threads = 1
        opt_so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        for m_name in ['detection', 'recognition']:
            if m_name in self.fa.models:
                m = self.fa.models[m_name]
                m.session = ort.InferenceSession(m.model_file, sess_options=opt_so, providers=["CPUExecutionProvider"])

        print("[VISION] InsightFace initialized with ultra-fast MobileFaceNet engine.")

        # Load MiniFASNet ONNX Anti-Spoofing ensemble with multi-threaded options
        self.spoof_sessions = []
        so = ort.SessionOptions()
        so.intra_op_num_threads = 4
        so.inter_op_num_threads = 2
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        for model_path, crop_scale in SPOOF_MODELS:
            if not model_path.exists():
                raise FileNotFoundError(f"Missing anti-spoof model at {model_path}. Run download_models.py first.")
            print(f"[VISION] Loading Anti-Spoof model: {model_path.name} (scale {crop_scale})...")
            sess = ort.InferenceSession(str(model_path), sess_options=so, providers=["CPUExecutionProvider"])
            self.spoof_sessions.append((sess, crop_scale))
        print(f"[VISION] {len(self.spoof_sessions)} MiniFASNet models loaded.")

    def run_minifas_ensemble(self, img: np.ndarray, bbox: list) -> tuple[float, float, float]:
        """
        Runs the MiniFASNet ensemble across multiple contextual crops.
        Class 0: Spoof (Paper print)
        Class 1: Real (Bona Fide live face)
        Class 2: Spoof (Screen / Video replay)
        Returns (real_prob, paper_prob, screen_prob).
        """
        real_probs = []
        paper_probs = []
        screen_probs = []
        for sess, scale in self.spoof_sessions:
            crop = _crop_face(img, bbox, scale, out_size=80)
            tensor = crop.astype(np.float32).transpose(2, 0, 1)[None, ...]
            input_name = sess.get_inputs()[0].name
            raw_logits = sess.run(None, {input_name: tensor})[0][0]
            probs = _softmax(raw_logits)
            paper_probs.append(float(probs[0]) if len(probs) > 0 else 0.0)
            real_probs.append(float(probs[1]) if len(probs) > 1 else float(probs[0]))
            screen_probs.append(float(probs[2]) if len(probs) > 2 else 0.0)
            
        return float(np.mean(real_probs)), float(np.mean(paper_probs)), float(np.mean(screen_probs))

    def analyze(self, img: np.ndarray) -> dict:
        """
        Detects primary face, extracts ArcFace 512-d normalized embedding,
        and computes fused multi-signal passive liveness score.
        Optimized for < 100ms total latency.
        """
        if img is None or img.size == 0:
            return None

        # Downscale large input frames for ultra-fast SCRFD face detection
        h, w = img.shape[:2]
        if max(h, w) > 480:
            scale = 480.0 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)

        # Face Detection via SCRFD
        faces = self.fa.get(img)
        if not faces:
            return None

        # Select the most prominent face by area
        primary_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        bbox = [int(v) for v in primary_face.bbox]
        x1, y1, x2, y2 = bbox

        # MiniFASNet deep feature score across classes (Real, Paper, Screen)
        minifas_live, minifas_paper, minifas_screen = self.run_minifas_ensemble(img, bbox)

        # Physical texture & Fourier frequency analysis
        face_crop = img[max(0, y1):min(img.shape[0], y2), max(0, x1):min(img.shape[1], x2)]
        tex_metrics = analyze_frequency_and_texture(face_crop)

        # Physical presentation attack indicators:
        has_screen_moire = tex_metrics["fft_ratio"] > 0.52
        has_glass_glare = tex_metrics["glare_ratio"] > 0.04
        is_screen_physical = tex_metrics["is_screen"] or has_screen_moire or has_glass_glare
        
        # Bona fide capture quality degradation (motion blur, low light):
        is_capture_blurry = (tex_metrics["laplacian_var"] < 50.0) and (not is_screen_physical)
        is_poor_lighting = tex_metrics["is_poor_lighting"] and (not is_screen_physical)

        # Presentation Attack Detection (Photo / Screen / Paper Spoof):
        if is_screen_physical or (minifas_screen > 0.35 and not is_capture_blurry):
            is_spoof = True
            predicted_spoof = "Screen Replay (Photo / Video)"
        elif tex_metrics["is_paper"] or (minifas_paper > 0.40 and not is_capture_blurry):
            is_spoof = True
            predicted_spoof = "Printed Photo Attack"
        elif (minifas_live < 0.68) and (not is_capture_blurry) and (not is_poor_lighting):
            is_spoof = True
            predicted_spoof = "Photo Display Spoof"
        else:
            is_spoof = False
            predicted_spoof = "Real"

        # Signal Fusion:
        fused_liveness = float(0.70 * minifas_live + 0.30 * tex_metrics["texture_conf"])
        if is_spoof:
            # Force low liveness indicator on confirmed spoof presentation attack
            fused_liveness = min(fused_liveness, 0.35)
        fused_liveness = max(0.01, min(0.99, fused_liveness))

        # Quality flags for bona fide captures (distinguishes blur from spoofs)
        is_blurry = is_capture_blurry and (not is_spoof)
        is_poor_lighting = is_poor_lighting and (not is_spoof)

        return {
            "bbox": bbox,
            "embedding": primary_face.normed_embedding,
            "det_score": float(primary_face.det_score),
            "liveness": fused_liveness,
            "minifas_score": minifas_live,
            "minifas_paper": minifas_paper,
            "minifas_screen": minifas_screen,
            "texture_score": tex_metrics["texture_conf"],
            "fft_ratio": tex_metrics["fft_ratio"],
            "glare_ratio": tex_metrics["glare_ratio"],
            "laplacian_var": tex_metrics["laplacian_var"],
            "is_spoof": is_spoof,
            "is_blurry": is_blurry,
            "is_poor_lighting": is_poor_lighting,
            "spoof_type": predicted_spoof,
            "num_faces": len(faces)
        }

def decide(res_or_liveness, similarity: float = None, face_detected: bool = True) -> tuple[str, str]:
    """
    HID Entry Decision Engine:
    - Photo Display / Screen / Paper Spoof -> HARD BLOCK (DENY). Never ask secondary verification.
    - Unrecognized Face (similarity < SIM_DENY) -> DENY.
    - Genuine face with motion blur / low quality / poor lighting -> REQUEST_VERIFICATION.
    - Genuine face with clear capture & high match -> ALLOW.
    """
    if isinstance(res_or_liveness, dict):
        res = res_or_liveness
        liveness = res.get("liveness", 0.0)
    else:
        liveness = float(res_or_liveness) if res_or_liveness is not None else 0.0
        res = {
            "liveness": liveness,
            "is_spoof": liveness < LIVE_DENY,
            "spoof_type": "Presentation Attack" if liveness < LIVE_DENY else "Real",
            "is_blurry": False,
            "is_poor_lighting": False
        }

    if not face_detected or res is None:
        return "DENY", "No human face detected in camera view. Please align your face inside the terminal."

    # 1. HARD BLOCK ON PRESENTATION ATTACKS (Photo / Screen / Paper Spoofs)
    # Presentation attacks MUST be blocked immediately with DENY without secondary verification.
    if res.get("is_spoof", False):
        spoof_type = res.get("spoof_type", "Photo Display Spoof")
        return "DENY", f"Access Denied: Presentation Attack Detected ({spoof_type}). Access Blocked."

    # 2. IMMEDIATE REJECTION IF IDENTITY DOES NOT MATCH
    if similarity is None or similarity < SIM_DENY:
        return "DENY", f"Access Denied: Unrecognized face. Credential similarity ({similarity or 0:.2f}) below threshold."

    # 3. BONA FIDE LIVE PERSON WITH GOOD CAPTURE QUALITY & HIGH MATCH -> ACCESS GRANTED
    if similarity >= SIM_ALLOW and not res.get("is_blurry", False) and not res.get("is_poor_lighting", False):
        return "ALLOW", f"Identity verified and bona fide liveness confirmed (Match: {similarity:.2f}). Access Granted."

    # 4. BONA FIDE USER WITH LOW IMAGE QUALITY / BLUR / SUBOPTIMAL LIGHTING -> REQUEST SECONDARY VERIFICATION
    # Only genuine degraded captures route to secondary verification
    reasons = []
    if res.get("is_blurry", False):
        reasons.append("motion blur / camera focus")
    if res.get("is_poor_lighting", False):
        reasons.append("suboptimal ambient lighting")
    if similarity < SIM_ALLOW:
        reasons.append(f"borderline similarity ({similarity:.2f})")

    quality_detail = ", ".join(reasons) if reasons else "suboptimal image quality"
    return "REQUEST_VERIFICATION", f"Low capture quality detected ({quality_detail}). Please complete secondary verification."

def count_blinks(ear_series: list[float], low_thresh: float = EAR_LOW_THRESH, high_thresh: float = EAR_HIGH_THRESH) -> int:
    """
    Finite state machine to detect authentic blink cycles from Eye Aspect Ratio (EAR) sequence:
    Open -> Eye Closes (< low_thresh) -> Eye Re-opens (> high_thresh) = 1 valid blink.
    """
    if not ear_series or len(ear_series) < 3:
        return 0

    blinks = 0
    in_closed_state = False

    for ear in ear_series:
        if ear < low_thresh:
            in_closed_state = True
        elif ear > high_thresh and in_closed_state:
            blinks += 1
            in_closed_state = False

    return blinks
