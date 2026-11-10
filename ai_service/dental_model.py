"""
Aarogya-Drishti AI Inference Engine - Module B (Dental Examination Model)
Multi-label EfficientNet-B0 PyTorch Model with Sigmoid Activation
Labels: caries, gingivitis, calculus, plaque_soft_deposit, discoloration
Per-class thresholding from thresholds.json
"""

import os
import json
from typing import Dict, Any, List
import numpy as np
from PIL import Image
import torch
import timm

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DENTAL_WEIGHTS_PATH = os.path.join(BASE_DIR, "dental_model.pt")
DENTAL_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "dental_thresholds.json")

DEFAULT_DENTAL_LABELS = [
    "caries",
    "gingivitis",
    "calculus",
    "plaque_soft_deposit",
    "discoloration"
]

DEFAULT_DENTAL_THRESHOLDS = {
    "caries": 0.50,
    "gingivitis": 0.45,
    "calculus": 0.50,
    "plaque_soft_deposit": 0.50,
    "discoloration": 0.55
}

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def load_dental_config(config_path: str = DENTAL_CONFIG_PATH) -> Dict[str, Any]:
    """Safely loads dental multi-label thresholds with robust fallback."""
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            labels = data.get("labels", DEFAULT_DENTAL_LABELS)
            thresholds = data.get("thresholds", DEFAULT_DENTAL_THRESHOLDS)
            return {
                "labels": labels,
                "thresholds": thresholds,
                "see_dentist_labels": data.get("see_dentist_labels", DEFAULT_DENTAL_LABELS[:4]),
            }
        except Exception as e:
            print(f"[DentalAIService Warning] Corrupted thresholds file {config_path} ({e}). Falling back safely.")

    return {
        "labels": DEFAULT_DENTAL_LABELS,
        "thresholds": DEFAULT_DENTAL_THRESHOLDS,
        "see_dentist_labels": DEFAULT_DENTAL_LABELS[:4],
    }


class DentalScreeningModel:
    def __init__(self, weights_path: str = DENTAL_WEIGHTS_PATH, config_path: str = DENTAL_CONFIG_PATH):
        self.weights_path = weights_path
        self.config_path = config_path

        cfg = load_dental_config(self.config_path)
        self.labels = cfg["labels"]
        self.thresholds = cfg["thresholds"]
        self.see_dentist_labels = cfg["see_dentist_labels"]
        self.model_version = "v1.0.0-dental-efficientnet_b0-demo"
        self.is_placeholder = False

        self.device = torch.device("cpu")
        num_classes = len(self.labels)
        self.model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=num_classes)

        self._load_weights()
        self.model.eval()

    def _load_weights(self):
        if os.path.exists(self.weights_path):
            try:
                checkpoint = torch.load(self.weights_path, map_location=self.device, weights_only=False)
                if isinstance(checkpoint, dict):
                    if "state_dict" in checkpoint:
                        self.model.load_state_dict(checkpoint["state_dict"], strict=False)
                    else:
                        self.model.load_state_dict(checkpoint, strict=False)
                    self.model_version = checkpoint.get("model_version", self.model_version)
                    self.is_placeholder = checkpoint.get("is_placeholder", False)
                elif isinstance(checkpoint, torch.nn.Module):
                    self.model = checkpoint
                print(f"[DentalAIService] Loaded dental weights from {self.weights_path} (Version: {self.model_version})")
            except Exception as e:
                print(f"[DentalAIService] Failed loading weights from {self.weights_path}: {e}. Creating demo placeholder.")
                self.is_placeholder = True
                self.model_version = "v1.0.0-dental-efficientnet_b0-demo-placeholder"
        else:
            print(f"[DentalAIService] No weights found at {self.weights_path}. Running demo placeholder.")
            self.is_placeholder = True
            self.model_version = "v1.0.0-dental-efficientnet_b0-demo-placeholder"

    def preprocess(self, pil_image: Image.Image) -> torch.Tensor:
        """RGB, resize to 224x224, /255, ImageNet norm, NCHW float32 tensor."""
        rgb_img = pil_image.convert("RGB")
        resized = rgb_img.resize((224, 224), Image.Resampling.BILINEAR)
        arr = np.asarray(resized, dtype=np.float32) / 255.0
        norm_arr = (arr - MEAN) / STD
        chw_arr = np.transpose(norm_arr, (2, 0, 1))
        tensor = torch.from_numpy(chw_arr).unsqueeze(0).to(self.device)
        return tensor

    def predict(self, pil_image: Image.Image) -> Dict[str, Any]:
        """
        Executes multi-label inference with Sigmoid activations and per-class thresholds.
        """
        input_tensor = self.preprocess(pil_image)

        with torch.no_grad():
            logits = self.model(input_tensor)
            # Sigmoid activation for multi-label classification
            probs = torch.sigmoid(logits).squeeze(0).cpu().numpy()

        findings: List[Dict[str, Any]] = []
        any_flagged = False

        for i, label in enumerate(self.labels):
            prob = float(probs[i]) if i < len(probs) else 0.0
            threshold = float(self.thresholds.get(label, 0.50))
            flagged = bool(prob >= threshold)
            if flagged and label in self.see_dentist_labels:
                any_flagged = True

            findings.append({
                "label": label,
                "probability": round(prob, 4),
                "threshold": threshold,
                "flagged": flagged,
            })

        return {
            "findings": findings,
            "see_dentist_recommended": any_flagged,
            "model_version": self.model_version,
            "is_placeholder": self.is_placeholder,
            "labels": self.labels,
        }


# Singleton dental model instance
dental_model_instance = DentalScreeningModel()

