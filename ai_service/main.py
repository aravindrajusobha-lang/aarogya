"""
Aarogya-Drishti AI Microservice (FastAPI)
AI Engine with Multi-Module Oral Health Capabilities:
  - MODULE A: Mucosal Lesion Screening (POST /predict) - Configurable classes
  - MODULE B: Dental Multi-Label Screening (POST /predict/dental) - Sigmoid & per-class thresholds
  - Probe: GET /health
"""

import io
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from .model import model_instance
from .dental_model import dental_model_instance
from .quality import check_image_quality

app = FastAPI(
    title="Aarogya-Drishti Oral Screening AI Engine",
    description="Community-based oral mucosal screening and dental triage AI microservice",
    version="2.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Service health and engine metadata probe."""
    return {
        "status": "ok",
        "service": "aarogya-drishti-ai-engine",
        "modules": {
            "module_a_mucosal": {
                "loaded": True,
                "model_version": model_instance.model_version,
                "is_placeholder": model_instance.is_placeholder,
                "classes": model_instance.classes,
                "referral_classes": model_instance.referral_classes,
            },
            "module_b_dental": {
                "loaded": True,
                "model_version": dental_model_instance.model_version,
                "is_placeholder": dental_model_instance.is_placeholder,
                "labels": dental_model_instance.labels,
                "thresholds": dental_model_instance.thresholds,
            },
            "module_c_risk": {
                "loaded": True,
                "description": "Rule-based multi-lingual patient risk questionnaire with clinical validation requirements",
            },
        },
        "simulation": True,
        "disclaimer": "This AI model provides screening assistance only, never a confirmed diagnosis. All results require professional clinical assessment.",
    }


async def _decode_and_validate_image(image: UploadFile) -> Image.Image:
    """Helper to validate MIME type, file size <= 8MB, and decode to PIL Image."""
    content_type = (image.content_type or "").lower()
    if not (
        content_type in ["image/jpeg", "image/png", "image/jpg", "application/octet-stream"]
        or image.filename.lower().endswith((".jpg", ".jpeg", ".png"))
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only JPEG and PNG formats are permitted.",
        )

    try:
        raw_bytes = await image.read()
        if len(raw_bytes) == 0:
            raise ValueError("Uploaded file is empty.")
        if len(raw_bytes) > 8 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image exceeds maximum 8 MB limit.",
            )
        pil_image = Image.open(io.BytesIO(raw_bytes))
        return pil_image
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode image: {err}",
        )


@app.post("/predict")
async def predict_oral_lesion(image: UploadFile = File(...)):
    """
    MODULE A: Mucosal Lesion Screening (EfficientNet-B0).
    Evaluates blur/dark/size quality, then infers across configurable classes.
    """
    pil_image = await _decode_and_validate_image(image)
    quality_result = check_image_quality(pil_image)

    if not quality_result["ok"]:
        return {
            "label": None,
            "confidence": 0.0,
            "probabilities": {cls_name: 0.0 for cls_name in model_instance.classes},
            "refer_to_specialist": True,
            "model_version": model_instance.model_version,
            "is_placeholder": model_instance.is_placeholder,
            "image_quality": {
                "ok": False,
                "reason": quality_result["reason"],
                "blur_score": quality_result["blur_score"],
                "brightness": quality_result["brightness"],
            },
            "disclaimer": "This AI result is a screening aid, not a diagnosis. Please consult a doctor.",
        }

    prediction = model_instance.predict(pil_image)

    return {
        "label": prediction["label"],
        "confidence": prediction["confidence"],
        "probabilities": prediction["probabilities"],
        "refer_to_specialist": prediction["refer_to_specialist"],
        "model_version": prediction["model_version"],
        "is_placeholder": prediction["is_placeholder"],
        "classes": prediction["classes"],
        "image_quality": {
            "ok": True,
            "reason": None,
            "blur_score": quality_result["blur_score"],
            "brightness": quality_result["brightness"],
        },
        "disclaimer": "This AI result is a screening aid, not a diagnosis. Please consult a doctor.",
    }


@app.post("/predict/dental")
async def predict_dental_findings(image: UploadFile = File(...)):
    """
    MODULE B: Dental Examination (Multi-label EfficientNet-B0 with Sigmoid).
    Labels: caries, gingivitis, calculus, plaque_soft_deposit, discoloration.
    Per-class thresholds applied from thresholds.json.
    """
    pil_image = await _decode_and_validate_image(image)
    quality_result = check_image_quality(pil_image)

    if not quality_result["ok"]:
        return {
            "findings": [
                {
                    "label": lbl,
                    "probability": 0.0,
                    "threshold": dental_model_instance.thresholds.get(lbl, 0.5),
                    "flagged": False,
                }
                for lbl in dental_model_instance.labels
            ],
            "see_dentist_recommended": False,
            "model_version": dental_model_instance.model_version,
            "is_placeholder": dental_model_instance.is_placeholder,
            "image_quality": {
                "ok": False,
                "reason": quality_result["reason"],
                "blur_score": quality_result["blur_score"],
                "brightness": quality_result["brightness"],
            },
            "disclaimer": "This AI result is a screening aid, not a diagnosis. Please consult a dentist.",
        }

    prediction = dental_model_instance.predict(pil_image)

    return {
        "findings": prediction["findings"],
        "see_dentist_recommended": prediction["see_dentist_recommended"],
        "model_version": prediction["model_version"],
        "is_placeholder": prediction["is_placeholder"],
        "image_quality": {
            "ok": True,
            "reason": None,
            "blur_score": quality_result["blur_score"],
            "brightness": quality_result["brightness"],
        },
        "disclaimer": "This AI result is a screening aid, not a diagnosis. Please consult a dentist.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_service.main:app", host="0.0.0.0", port=8000, reload=True)
