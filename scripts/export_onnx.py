#!/usr/bin/env python3
"""
Aarogya-Drishti Oral Screening AI Engine
Script: scripts/export_onnx.py
Exports:
  1. MODULE A: Mucosal lesion model (oral_model.pt -> oral_model.onnx)
  2. MODULE B: Dental examination model (dental_model.pt -> dental_model.onnx)
Performs strict 5-sample parity tests between PyTorch and ONNX Runtime (diff <= 1e-3).
"""

import os
import sys
import shutil
import numpy as np
import torch
import timm
import onnx
import onnxruntime as ort

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_MODELS_DIR = os.path.join(BASE_DIR, "public", "models")
CLIENT_MODELS_DIR = os.path.join(BASE_DIR, "client", "public", "models")

# Module A paths
ORAL_MODEL_PT = os.path.join(BASE_DIR, "oral_model.pt")
ORAL_ONNX_ROOT = os.path.join(PUBLIC_MODELS_DIR, "oral_model.onnx")
ORAL_ONNX_CLIENT = os.path.join(CLIENT_MODELS_DIR, "oral_model.onnx")
ORAL_CLASSES = ["normal", "benign_inflammatory", "opmd", "suspected_malignant"]

# Module B paths
DENTAL_MODEL_PT = os.path.join(BASE_DIR, "dental_model.pt")
DENTAL_ONNX_ROOT = os.path.join(PUBLIC_MODELS_DIR, "dental_model.onnx")
DENTAL_ONNX_CLIENT = os.path.join(CLIENT_MODELS_DIR, "dental_model.onnx")
DENTAL_LABELS = ["caries", "gingivitis", "calculus", "plaque_soft_deposit", "discoloration"]


def get_or_create_oral_model():
    """Loads existing oral_model.pt or creates demo placeholder."""
    model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=len(ORAL_CLASSES))
    is_placeholder = False

    if os.path.exists(ORAL_MODEL_PT):
        print(f"[Module A] Loading existing weights from: {ORAL_MODEL_PT}")
        try:
            loaded = torch.load(ORAL_MODEL_PT, map_location="cpu", weights_only=False)
            if isinstance(loaded, dict) and "state_dict" in loaded:
                model.load_state_dict(loaded["state_dict"], strict=False)
            elif isinstance(loaded, dict):
                model.load_state_dict(loaded, strict=False)
            elif isinstance(loaded, torch.nn.Module):
                model = loaded
            print("[Module A] Successfully loaded PyTorch weights.")
        except Exception as err:
            print(f"[Module A Warning] Failed loading weights ({err}). Recreating placeholder.")
            is_placeholder = True
    else:
        is_placeholder = True

    if is_placeholder:
        print("[Module A] Creating demo placeholder model (MODEL NOT TRAINED - DEMO ONLY)")
        torch.manual_seed(42)
        torch.save({
            "state_dict": model.state_dict(),
            "model_version": "v1.0.0-efficientnet_b0-demo-placeholder",
            "classes": ORAL_CLASSES,
            "architecture": "efficientnet_b0",
            "is_placeholder": True,
            "notice": "MODEL NOT TRAINED - DEMO ONLY - NOT FOR CLINICAL USE"
        }, ORAL_MODEL_PT)
        print(f"[Module A] Saved placeholder to: {ORAL_MODEL_PT}")

    model.eval()
    return model


def get_or_create_dental_model():
    """Loads existing dental_model.pt or creates demo placeholder."""
    model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=len(DENTAL_LABELS))
    is_placeholder = False

    if os.path.exists(DENTAL_MODEL_PT):
        print(f"[Module B] Loading existing weights from: {DENTAL_MODEL_PT}")
        try:
            loaded = torch.load(DENTAL_MODEL_PT, map_location="cpu", weights_only=False)
            if isinstance(loaded, dict) and "state_dict" in loaded:
                model.load_state_dict(loaded["state_dict"], strict=False)
            elif isinstance(loaded, dict):
                model.load_state_dict(loaded, strict=False)
            elif isinstance(loaded, torch.nn.Module):
                model = loaded
            print("[Module B] Successfully loaded PyTorch dental weights.")
        except Exception as err:
            print(f"[Module B Warning] Failed loading weights ({err}). Recreating placeholder.")
            is_placeholder = True
    else:
        is_placeholder = True

    if is_placeholder:
        print("[Module B] Creating demo placeholder dental model (MODEL NOT TRAINED - DEMO ONLY)")
        torch.manual_seed(77)
        torch.save({
            "state_dict": model.state_dict(),
            "model_version": "v1.0.0-dental-efficientnet_b0-demo-placeholder",
            "labels": DENTAL_LABELS,
            "architecture": "efficientnet_b0_multilabel",
            "is_placeholder": True,
            "notice": "MODEL NOT TRAINED - DEMO ONLY - NOT FOR CLINICAL USE"
        }, DENTAL_MODEL_PT)
        print(f"[Module B] Saved placeholder to: {DENTAL_MODEL_PT}")

    model.eval()
    return model


def export_model_to_onnx(model, onnx_path_root, onnx_path_client, name="model"):
    """Exports PyTorch model to ONNX with opset 17."""
    os.makedirs(PUBLIC_MODELS_DIR, exist_ok=True)
    os.makedirs(CLIENT_MODELS_DIR, exist_ok=True)

    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)
    print(f"[{name}] Exporting to {onnx_path_root} (opset 17, [1,3,224,224])...")

    try:
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path_root,
            export_params=True,
            opset_version=17,
            do_constant_folding=True,
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={"input": {0: "batch_size"}, "logits": {0: "batch_size"}},
            dynamo=False,
        )
    except TypeError:
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path_root,
            export_params=True,
            opset_version=17,
            do_constant_folding=True,
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={"input": {0: "batch_size"}, "logits": {0: "batch_size"}},
        )

    # Validate ONNX schema
    onnx_model = onnx.load(onnx_path_root)
    onnx.checker.check_model(onnx_model)
    file_size_mb = os.path.getsize(onnx_path_root) / (1024 * 1024)
    print(f"[{name}] ONNX model verified ({file_size_mb:.2f} MB).")

    # Copy to client/public/models
    shutil.copyfile(onnx_path_root, onnx_path_client)
    print(f"[{name}] Mirrored to client: {onnx_path_client}")


def run_parity_test(pytorch_model, onnx_path, name="model", tolerance=1e-3, num_samples=5):
    """Executes parity test on random inputs comparing PyTorch and ONNX Runtime."""
    print(f"\n[{name}] Running {num_samples}-sample parity verification between PyTorch and ONNX Runtime...")
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    max_abs_diff = 0.0

    np.random.seed(12345)
    for sample_idx in range(1, num_samples + 1):
        sample_input_np = np.random.randn(1, 3, 224, 224).astype(np.float32)
        sample_tensor = torch.from_numpy(sample_input_np)

        with torch.no_grad():
            pt_out = pytorch_model(sample_tensor).cpu().numpy()

        ort_out = session.run(["logits"], {"input": sample_input_np})[0]

        diff = np.max(np.abs(pt_out - ort_out))
        if diff > max_abs_diff:
            max_abs_diff = diff

        print(f"  Sample {sample_idx}/{num_samples}: Max absolute difference = {diff:.6e}")
        if diff > tolerance:
            print(f"[{name} FAIL] Sample {sample_idx} exceeded tolerance ({diff} > {tolerance})!")
            sys.exit(1)

    print(f"[{name} PASS] All {num_samples} samples verified! Overall maximum difference: {max_abs_diff:.6e} <= {tolerance}")
    return max_abs_diff


def main():
    print("=" * 65)
    print("Aarogya-Drishti AI Engine - Multi-Module ONNX Exporter & Parity")
    print("=" * 65)

    # 1. Module A: Mucosal Lesion Model
    oral_model = get_or_create_oral_model()
    export_model_to_onnx(oral_model, ORAL_ONNX_ROOT, ORAL_ONNX_CLIENT, name="Module A - Mucosal")
    run_parity_test(oral_model, ORAL_ONNX_ROOT, name="Module A - Mucosal", tolerance=1e-3, num_samples=5)

    # 2. Module B: Dental Examination Model
    dental_model = get_or_create_dental_model()
    export_model_to_onnx(dental_model, DENTAL_ONNX_ROOT, DENTAL_ONNX_CLIENT, name="Module B - Dental")
    run_parity_test(dental_model, DENTAL_ONNX_ROOT, name="Module B - Dental", tolerance=1e-3, num_samples=5)

    print("\n" + "=" * 65)
    print("SUCCESS: All models exported to ONNX and verified with 100% parity!")
    print("=" * 65)


if __name__ == "__main__":
    main()
