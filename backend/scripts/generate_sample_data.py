"""
Generate synthetic and benchmark test datasets for ISO/IEC 30107-3 liveness evaluation.
Creates directories and sample images for:
- Bona fide (Real)
- Printed Photo attacks (Paper texture, flat lighting, halftoning)
- Screen Replay attacks (Moiré pattern, RGB subpixel grid, specular screen glare)
- Video Replay attacks (Refresh scanlines, compression)
- Mask attacks (Plastic/latex specular reflectance, rigid contour)
"""
import os
import pathlib
import cv2
import numpy as np

EVAL_DIR = pathlib.Path(__file__).resolve().parent.parent / "tests" / "eval_data"

def create_face_canvas(width=320, height=320):
    """Draws a base realistic human face silhouette with skin tones and facial landmarks."""
    canvas = np.ones((height, width, 3), dtype=np.uint8) * 230
    center = (width // 2, height // 2)
    
    # Natural skin tone gradient (BGR)
    skin_color = (175, 195, 235)  # Natural warm skin tone in BGR
    cv2.ellipse(canvas, center, (80, 110), 0, 0, 360, skin_color, -1)
    
    # Eyes
    left_eye = (width // 2 - 32, height // 2 - 20)
    right_eye = (width // 2 + 32, height // 2 - 20)
    cv2.circle(canvas, left_eye, 10, (255, 255, 255), -1)
    cv2.circle(canvas, right_eye, 10, (255, 255, 255), -1)
    cv2.circle(canvas, left_eye, 5, (60, 40, 20), -1)
    cv2.circle(canvas, right_eye, 5, (60, 40, 20), -1)
    
    # Eyebrows
    cv2.line(canvas, (left_eye[0] - 15, left_eye[1] - 14), (left_eye[0] + 15, left_eye[1] - 12), (50, 40, 30), 3)
    cv2.line(canvas, (right_eye[0] - 15, right_eye[1] - 12), (right_eye[0] + 15, right_eye[1] - 14), (50, 40, 30), 3)

    # Nose
    nose_tip = (width // 2, height // 2 + 15)
    cv2.line(canvas, (width // 2, height // 2 - 10), nose_tip, (150, 170, 210), 2)
    
    # Mouth / Lips
    mouth_center = (width // 2, height // 2 + 50)
    cv2.ellipse(canvas, mouth_center, (28, 10), 0, 0, 360, (130, 140, 195), -1)
    cv2.line(canvas, (mouth_center[0] - 25, mouth_center[1]), (mouth_center[0] + 25, mouth_center[1]), (100, 100, 160), 2)

    # Hair
    cv2.ellipse(canvas, (width // 2, height // 2 - 70), (88, 55), 0, 180, 360, (40, 30, 20), -1)

    return canvas

def make_screen_replay(base_img):
    """Simulates screen replay: High frequency pixel grid + Moiré pattern + screen glare."""
    img = base_img.copy()
    h, w = img.shape[:2]
    
    # Add LCD pixel raster grid
    grid = np.zeros((h, w), dtype=np.float32)
    grid[::3, :] += 25
    grid[:, ::3] += 25
    
    # Moiré sinusoidal wave pattern
    x = np.arange(w)
    y = np.arange(h)
    xx, yy = np.meshgrid(x, y)
    moire = 20.0 * np.sin(xx / 4.0 + yy / 4.0)
    
    # Add specular glass reflection glare
    glare = np.zeros((h, w), dtype=np.float32)
    cv2.ellipse(glare, (int(w * 0.7), int(h * 0.3)), (50, 30), 45, 0, 360, 80, -1)
    
    combined = img.astype(np.float32)
    for c in range(3):
        combined[:, :, c] += grid + moire + glare
        
    return np.clip(combined, 0, 255).astype(np.uint8)

def make_printed_photo(base_img):
    """Simulates printed paper attack: Flat lighting, paper texture, CMYK halftoning noise."""
    img = base_img.copy()
    h, w = img.shape[:2]
    
    # Paper texture noise
    noise = np.random.normal(0, 18, (h, w, 3)).astype(np.float32)
    
    # Reduce dynamic range / contrast (printed paper has lower gamut)
    f = img.astype(np.float32) * 0.85 + noise + 20
    
    # Add slight border simulating paper edge
    result = np.clip(f, 0, 255).astype(np.uint8)
    cv2.rectangle(result, (2, 2), (w-3, h-3), (255, 255, 255), 4)
    return result

def make_video_replay(base_img):
    """Simulates video replay on a phone: Scanlines, chromatic shift, display glow."""
    img = base_img.copy()
    h, w = img.shape[:2]
    
    # Scanlines
    scanlines = np.zeros((h, w, 3), dtype=np.float32)
    scanlines[::4, :, :] = -30
    
    # Chromatic aberration (RGB channel shift)
    shifted = np.zeros_like(img)
    shifted[:, :, 0] = np.roll(img[:, :, 0], shift=3, axis=1) # B shift
    shifted[:, :, 1] = img[:, :, 1]                           # G
    shifted[:, :, 2] = np.roll(img[:, :, 2], shift=-3, axis=1)# R shift
    
    combined = np.clip(shifted.astype(np.float32) + scanlines, 0, 255).astype(np.uint8)
    return combined

def make_mask(base_img):
    """Simulates 3D / printed mask attack: Unnatural boundary, rigid edges, plastic specular highlights."""
    img = base_img.copy()
    h, w = img.shape[:2]
    
    # Plastic mask specular reflection
    specular = np.zeros((h, w), dtype=np.float32)
    cv2.circle(specular, (w // 2 - 15, h // 2 + 10), 20, 90, -1)
    cv2.circle(specular, (w // 2, h // 2 - 40), 30, 80, -1)
    
    blurred_spec = cv2.GaussianBlur(specular, (21, 21), 0)
    
    combined = img.astype(np.float32)
    for c in range(3):
        combined[:, :, c] += blurred_spec
        
    result = np.clip(combined, 0, 255).astype(np.uint8)
    # Mask cut-out edge seam
    cv2.ellipse(result, (w // 2, h // 2), (85, 115), 0, 0, 360, (60, 50, 40), 2)
    return result

def generate_samples(num_per_class=10):
    dirs = {
        "real": EVAL_DIR / "real",
        "printed_photo": EVAL_DIR / "attack" / "printed_photo",
        "screen_replay": EVAL_DIR / "attack" / "screen_replay",
        "video_replay": EVAL_DIR / "attack" / "video_replay",
        "mask": EVAL_DIR / "attack" / "mask"
    }

    for p in dirs.values():
        p.mkdir(parents=True, exist_ok=True)

    print("[GEN] Generating ISO/IEC benchmark evaluation test set...")
    for i in range(num_per_class):
        # Slightly vary each sample
        base = create_face_canvas()
        # Add slight natural variation
        noise = np.random.normal(0, 3, base.shape).astype(np.int16)
        base = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        # 1. Bona Fide
        cv2.imwrite(str(dirs["real"] / f"real_{i+1:03d}.jpg"), base)

        # 2. Printed Photo
        print_img = make_printed_photo(base)
        cv2.imwrite(str(dirs["printed_photo"] / f"print_{i+1:03d}.jpg"), print_img)

        # 3. Screen Replay
        screen_img = make_screen_replay(base)
        cv2.imwrite(str(dirs["screen_replay"] / f"screen_{i+1:03d}.jpg"), screen_img)

        # 4. Video Replay
        video_img = make_video_replay(base)
        cv2.imwrite(str(dirs["video_replay"] / f"video_{i+1:03d}.jpg"), video_img)

        # 5. Mask
        mask_img = make_mask(base)
        cv2.imwrite(str(dirs["mask"] / f"mask_{i+1:03d}.jpg"), mask_img)

    print(f"[GEN] Generated {num_per_class} samples for each category in {EVAL_DIR}")

if __name__ == "__main__":
    generate_samples()
