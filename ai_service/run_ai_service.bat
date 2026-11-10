@echo off
echo ========================================================
echo Starting Aarogya-Drishti Oral Screening AI Microservice
echo Port: 8000 ^| Host: 0.0.0.0 ^| Model: EfficientNet-B0
echo ========================================================
python -m uvicorn ai_service.main:app --host 0.0.0.0 --port 8000 --reload

