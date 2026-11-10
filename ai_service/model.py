"""
Aarogya-Drishti AI Inference Engine - Module A (Mucosal Lesion Model)
EfficientNet-B0 PyTorch Model Wrapper with Configurable Class List
Allows adding OSMF, non-healing ulcer, etc. without code changes.
"""

import os
import json
from typing import Dict, Any, List
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
import timm

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEIGHTS_PATH = os.path.join(BASE_DIR, "oral_model.pt")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "lesion_classes.json")

DEFAULT_CLASSES = ["normal", "benign_inflammatory", "opmd", "suspected_malignant"]
DEFAULT_REFERRAL_CLASSES = ["opmd", "suspected_malignant", "osmf", "non_healing_ulcer"]
DEFAULT_CONFIDENCE_THRESHOLD = 0.60

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def load_lesion_class_config(config_path: str = CONFIG_PATH) -> Dict[str, Any]:
    """
    Safely loads configurable classes and referral rules from JSON file.
    If the file is missing, empty, or corrupted, fails safely and falls back to default classes.
    """
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            classes = data.get("classes")
            if isinstance(classes, list) and len(classes) >= 2:
                referral_classes = data.get("specialist_referral_classes", DEFAULT_REFERRAL_CLASSES)
                threshold = float(data.get("confidence_threshold", DEFAULT_CONFIDENCE_THRESHOLD))
                return {
                    "classes": classes,
                    "specialist_referral_classes": referral_classes,
                    "confidence_threshold": threshold,
                    "config_source": config_path,
                }
            else:
                print(f"[AIService Warning] Invalid 'classes' array in {config_path}. Falling back safely to default classes.")
        except Exception as e:
            print(f"[AIService Warning] Corrupted config file {config_path} ({e}). Falling back safely to default classes.")

    return {
        "classes": DEFAULT_CLASSES,
        "specialist_referral_classes": DEFAULT_REFERRAL_CLASSES,
        "confidence_threshold": DEFAULT_CONFIDENCE_THRESHOLD,
        "config_source": "fallback_defaults",
    }


class OralScreeningModel:
    def __init__(self, weights_path: str = WEIGHTS_PATH, config_path: str = CONFIG_PATH):
        self.weights_path = weights_path
        self.config_path = config_path

        # Load configurable classes
        cfg = load_lesion_class_config(self.config_path)
        self.classes = cfg["classes"]
        self.referral_classes = cfg["specialist_referral_classes"]
        self.confidence_threshold = cfg["confidence_threshold"]
        self.model_version = "v1.0.0-efficientnet_b0-demo"
        self.is_placeholder = False

        self.device = torch.device("cpu")
        num_classes = len(self.classes)
        self.model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=num_classes)

        self._load_weights()
        self.model.eval()

    def reload_config(self):
        """Allows hot-reloading classes from config without restarting process."""
        cfg = load_lesion_class_config(self.config_path)
        self.classes = cfg["classes"]
        self.referral_classes = cfg["specialist_referral_classes"]
        self.confidence_threshold = cfg["confidence_threshold"]
        print(f"[AIService] Reloaded lesion classes: {self.classes}")

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
                print(f"[AIService] Loaded weights from {self.weights_path} (Version: {self.model_version}, Placeholder: {self.is_placeholder})")
            except Exception as e:
                print(f"[AIService] Failed loading weights from {self.weights_path}: {e}. Falling back to demo placeholder.")
                self.is_placeholder = True
                self.model_version = "v1.0.0-efficientnet_b0-demo-placeholder"
        else:
            print(f"[AIService] No weights found at {self.weights_path}. Running demo placeholder.")
            self.is_placeholder = True
            self.model_version = "v1.0.0-efficientnet_b0-demo-placeholder"

    def preprocess(self, pil_image: Image.Image) -> torch.Tensor:
        """
        RGB conversion, resize to 224x224, /255, normalize with mean/std, CHW float32 tensor.
        """
        rgb_img = pil_image.convert("RGB")
        resized = rgb_img.resize((224, 224), Image.Resampling.BILINEAR)
        arr = np.asarray(resized, dtype=np.float32) / 255.0
        norm_arr = (arr - MEAN) / STD
        chw_arr = np.transpose(norm_arr, (2, 0, 1))
        tensor = torch.from_numpy(chw_arr).unsqueeze(0).to(self.device)
        return tensor

    def predict(self, pil_image: Image.Image) -> Dict[str, Any]:
        """
        Executes forward inference, calculates softmax probabilities across configured classes,
        and determines clinical referral flag.
        """
        input_tensor = self.preprocess(pil_image)

        with torch.no_grad():
            logits = self.model(input_tensor)
            probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        # Adapt probabilities to match configured classes
        num_classes = len(self.classes)
        prob_dict = {}
        for i in range(num_classes):
            prob = float(probs[i]) if i < len(probs) else 0.0
            prob_dict[self.classes[i]] = round(prob, 4)

        # Normalize if class count altered
        total_p = sum(prob_dict.values())
        if total_p > 0:
            prob_dict = {k: round(v / total_p, 4) for k, v in prob_dict.items()}

        # Highest confidence class
        predicted_label = max(prob_dict, key=prob_dict.get)
        confidence = prob_dict[predicted_label]

        # Referral rule: label in referral_classes OR confidence < threshold
        refer_to_specialist = bool(
            predicted_label in self.referral_classes or confidence < self.confidence_threshold
        )

        return {
            "label": predicted_label,
            "confidence": confidence,
            "probabilities": prob_dict,
            "refer_to_specialist": refer_to_specialist,
            "model_version": self.model_version,
            "is_placeholder": self.is_placeholder,
            "classes": self.classes,
        }


# Singleton model instance
model_instance = OralScreeningModel()
