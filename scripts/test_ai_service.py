#!/usr/bin/env python3
"""
Aarogya-Drishti AI Microservice Integration Test
Tests:
  - GET /health (Modules A, B, C)
  - POST /predict (Module A - Mucosal Lesion)
  - POST /predict/dental (Module B - Dental multi-label with Sigmoid & thresholds)
  - Blurry & dark image quality rejection on both endpoints
"""

import io
import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import numpy as np
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from ai_service.main import app

client = TestClient(app)


def create_test_image(pattern="sharp", size=(256, 256)):
    """Helper to generate sharp, blurry, or dark test images."""
    if pattern == "sharp":
        img = Image.new("RGB", size, color=(240, 220, 210))
        draw = ImageDraw.Draw(img)
        for i in range(0, size[0], 16):
            draw.line([(i, 0), (i, size[1])], fill=(30, 20, 10), width=3)
            draw.line([(0, i), (size[0], i)], fill=(40, 30, 20), width=3)
        draw.rectangle([50, 50, 180, 180], outline=(180, 20, 30), width=5)
        return img
    elif pattern == "blurry":
        arr = np.ones((size[1], size[0], 3), dtype=np.uint8) * 160
        return Image.fromarray(arr)
    elif pattern == "dark":
        arr = np.ones((size[1], size[0], 3), dtype=np.uint8) * 15
        return Image.fromarray(arr)
    else:
        raise ValueError(f"Unknown pattern: {pattern}")


def image_to_bytes(pil_img: Image.Image, fmt="JPEG") -> bytes:
    buf = io.BytesIO()
    pil_img.save(buf, format=fmt)
    return buf.getvalue()


def run_tests():
    print("=" * 65)
    print("Testing Aarogya-Drishti AI Engine (FastAPI TestClient)")
    print("=" * 65)

    # 1. Health check
    print("\n1. Testing GET /health...")
    resp = client.get("/health")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["status"] == "ok"
    assert "modules" in data
    assert "module_a_mucosal" in data["modules"]
    assert "module_b_dental" in data["modules"]
    assert "module_c_risk" in data["modules"]
    print(f"  [PASS] Service OK. Module A classes: {data['modules']['module_a_mucosal']['classes']}")
    print(f"  [PASS] Module B labels: {data['modules']['module_b_dental']['labels']}")

    # 2. Module A: Predict sharp image
    print("\n2. Testing POST /predict (Module A - Mucosal Lesion)...")
    sharp_bytes = image_to_bytes(create_test_image("sharp"))
    files = {"image": ("test_sharp.jpg", sharp_bytes, "image/jpeg")}
    resp = client.post("/predict", files=files)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["image_quality"]["ok"] is True
    assert "label" in data and data["label"] is not None
    assert "confidence" in data
    assert "probabilities" in data
    assert "refer_to_specialist" in data
    print(f"  [PASS] Predicted: '{data['label']}' (Conf: {data['confidence']:.2%}, Refer: {data['refer_to_specialist']})")

    # 3. Module B: Predict dental image
    print("\n3. Testing POST /predict/dental (Module B - Dental Multi-label)...")
    files_dental = {"image": ("test_dental.jpg", sharp_bytes, "image/jpeg")}
    resp_dental = client.post("/predict/dental", files=files_dental)
    assert resp_dental.status_code == 200, f"Expected 200, got {resp_dental.status_code}: {resp_dental.text}"
    data_dental = resp_dental.json()
    assert data_dental["image_quality"]["ok"] is True
    assert "findings" in data_dental
    assert len(data_dental["findings"]) == 5
    for finding in data_dental["findings"]:
        assert "label" in finding
        assert "probability" in finding
        assert "threshold" in finding
        assert "flagged" in finding
        print(f"    - {finding['label']}: {finding['probability']:.2%} (Threshold: {finding['threshold']}, Flagged: {finding['flagged']})")
    assert "see_dentist_recommended" in data_dental
    print(f"  [PASS] Dental findings verified. See dentist: {data_dental['see_dentist_recommended']}")

    # 4. Quality checks on both endpoints
    print("\n4. Testing Quality Screening Rejection (Blur & Dark)...")
    # A) Blurry image -> Module A
    blurry_bytes = image_to_bytes(create_test_image("blurry"))
    files_blur = {"image": ("test_blurry.jpg", blurry_bytes, "image/jpeg")}
    resp_blur = client.post("/predict", files=files_blur)
    assert resp_blur.status_code == 200
    data_blur = resp_blur.json()
    assert data_blur["image_quality"]["ok"] is False
    assert "blurry" in data_blur["image_quality"]["reason"].lower()
    print(f"  [PASS] Module A successfully rejected blurry image: '{data_blur['image_quality']['reason']}'")

    # B) Dark image -> Module B
    dark_bytes = image_to_bytes(create_test_image("dark"))
    files_dark = {"image": ("test_dark.jpg", dark_bytes, "image/jpeg")}
    resp_dark = client.post("/predict/dental", files=files_dark)
    assert resp_dark.status_code == 200
    data_dark = resp_dark.json()
    assert data_dark["image_quality"]["ok"] is False
    assert "dark" in data_dark["image_quality"]["reason"].lower()
    print(f"  [PASS] Module B successfully rejected dark image: '{data_dark['image_quality']['reason']}'")

    print("\n" + "=" * 65)
    print("ALL AI MICROSERVICE FASTAPI TESTS PASSED (100%)!")
    print("=" * 65)


if __name__ == "__main__":
    run_tests()
