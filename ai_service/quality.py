"""
Aarogya-Drishti AI Quality Assessment
Rejects oral images that are too small, too blurry (Laplacian variance), or too dark.
"""

from typing import Tuple, Dict, Any
import numpy as np
from PIL import Image

MIN_WIDTH = 100
MIN_HEIGHT = 100
MIN_BRIGHTNESS = 35.0  # Out of 255
MIN_LAPLACIAN_VAR = 65.0  # Blur threshold


def compute_laplacian_variance(gray_array: np.ndarray) -> float:
    """
    Computes variance of the discrete 2D Laplacian operator across the grayscale image.
    A low variance indicates a lack of high-frequency edges (defocused / blurry).
    """
    # 3x3 discrete Laplacian kernel
    # [ 0,  1,  0 ]
    # [ 1, -4,  1 ]
    # [ 0,  1,  0 ]
    h, w = gray_array.shape
    if h < 3 or w < 3:
        return 0.0

    # Fast 2D convolution using numpy slicing
    center = gray_array[1:-1, 1:-1] * -4.0
    top = gray_array[:-2, 1:-1]
    bottom = gray_array[2:, 1:-1]
    left = gray_array[1:-1, :-2]
    right = gray_array[1:-1, 2:]

    laplacian = center + top + bottom + left + right
    return float(np.var(laplacian))


def check_image_quality(image: Image.Image) -> Dict[str, Any]:
    """
    Evaluates image dimensions, luminance, and focus clarity.
    Returns: {"ok": bool, "reason": Optional[str], "blur_score": float, "brightness": float}
    """
    w, h = image.size
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        return {
            "ok": False,
            "reason": f"Image resolution ({w}x{h}) is too small. Minimum required is {MIN_WIDTH}x{MIN_HEIGHT}.",
            "blur_score": 0.0,
            "brightness": 0.0,
        }

    # Convert to grayscale for illumination & blur checks
    gray = image.convert("L")
    gray_np = np.asarray(gray, dtype=np.float32)

    brightness = float(np.mean(gray_np))
    if brightness < MIN_BRIGHTNESS:
        return {
            "ok": False,
            "reason": f"Image is too dark ({brightness:.1f}/255). Please ensure adequate lighting before retaking.",
            "blur_score": 0.0,
            "brightness": round(brightness, 1),
        }

    # Resize to standard size for consistent blur scoring
    sample_for_blur = gray.resize((224, 224), Image.Resampling.BILINEAR)
    blur_score = compute_laplacian_variance(np.asarray(sample_for_blur, dtype=np.float32))

    if blur_score < MIN_LAPLACIAN_VAR:
        return {
            "ok": False,
            "reason": f"Image is too blurry (clarity score: {blur_score:.1f}, minimum required: {MIN_LAPLACIAN_VAR}). Please hold camera steady and tap to focus.",
            "blur_score": round(blur_score, 1),
            "brightness": round(brightness, 1),
        }

    return {
        "ok": True,
        "reason": None,
        "blur_score": round(blur_score, 1),
        "brightness": round(brightness, 1),
    }

