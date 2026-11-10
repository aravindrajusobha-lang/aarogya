import json
from pathlib import Path
import torch
import timm
from PIL import Image
from torchvision import transforms as T

image_path = r"C:\Users\YTC CHINTAPALLI\.gemini\antigravity\brain\8c1db4b6-392c-492b-8d90-54b83ee44c6d\.user_uploaded\media_1794224616130_ec7b6cf0.jpg"

base_dir = Path(__file__).resolve().parent
ck = torch.load(base_dir / "model.pt", map_location="cpu")
labels = ck["labels"]
arch = ck["arch"]

model = timm.create_model(arch, pretrained=False, num_classes=len(labels))
model.load_state_dict(ck["state_dict"])
model.eval()

tf = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

img = Image.open(image_path).convert("RGB")
tensor = tf(img).unsqueeze(0)

with torch.no_grad():
    logits = model(tensor)
    probs = torch.softmax(logits, dim=1)[0].numpy()

result = {label: float(prob) for label, prob in zip(labels, probs)}
predicted_idx = int(probs.argmax())
predicted_label = labels[predicted_idx]

print("=== PYTORCH / ONNX MODEL PREDICTION ===")
print(f"Architecture: {arch}")
print(f"Predicted Class: {predicted_label}")
print(f"Confidence: {probs[predicted_idx] * 100:.2f}%")
print("All Class Probabilities:")
for label, p in result.items():
    print(f"  - {label}: {p * 100:.2f}%")
