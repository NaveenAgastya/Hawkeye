"""
Download weights for MiniFASNet anti-spoofing models into backend/models_store/
Models:
- MiniFASNetV2.onnx (crop scale 2.7)
- MiniFASNetV1SE.onnx (crop scale 4.0)
"""
import sys
import pathlib
import requests

MODELS_DIR = pathlib.Path(__file__).resolve().parent.parent / "models_store"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

WEIGHTS_URLS = {
    "MiniFASNetV2.onnx": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
    "MiniFASNetV1SE.onnx": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx"
}

def download_models():
    print(f"Ensuring anti-spoof models in: {MODELS_DIR}")
    for filename, url in WEIGHTS_URLS.items():
        target = MODELS_DIR / filename
        if target.exists() and target.stat().st_size > 100_000:
            print(f"[OK] {filename} already exists ({target.stat().st_size:,} bytes)")
            continue
        print(f"Downloading {filename} from {url} ...")
        try:
            r = requests.get(url, stream=True, timeout=120)
            r.raise_for_status()
            with open(target, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print(f"[OK] Successfully saved {filename} ({target.stat().st_size:,} bytes)")
        except Exception as e:
            print(f"[ERR] Failed to download {filename}: {e}", file=sys.stderr)
            raise

if __name__ == "__main__":
    download_models()
