"""
export_onnx.py  -  STEP 3
Converts model.pt to ONNX for the offline (browser) model and checks it gives the same answers.
 
    python export_onnx.py
Output: public/models/oral_model.onnx  and  public/models/labels.json
Run it again after EVERY retrain, so the online and offline models are always the same version.
"""
import json, shutil
from pathlib import Path
 
import numpy as np
import pandas as pd
import onnxruntime as ort
import timm
import torch
from PIL import Image
from torchvision import transforms as T
 
OUT = Path("public/models")
OUT.mkdir(parents=True, exist_ok=True)
CLIENT_MODELS = Path("../client/public/models")
CLIENT_DIST = Path("../client/dist/models")
 
ck = torch.load("model.pt", map_location="cpu")
labels = ck["labels"]
model = timm.create_model(ck["arch"], pretrained=False, num_classes=len(labels))
model.load_state_dict(ck["state_dict"])
model.eval()
 
dummy = torch.randn(1, 3, 224, 224)
path = OUT / "oral_model.onnx"
kw = dict(input_names=["input"], output_names=["logits"], opset_version=17,
          dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}})
try:
    torch.onnx.export(model, dummy, str(path), dynamo=False, **kw)
except TypeError:                       # older torch without the dynamo argument
    torch.onnx.export(model, dummy, str(path), **kw)
json.dump(labels, open(OUT / "labels.json", "w"))
if Path("model_info.json").exists():
    shutil.copy("model_info.json", OUT / "model_info.json")
 
# parity test on real images
tf = T.Compose([T.Resize((224, 224)), T.ToTensor(), T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
paths = pd.read_csv("prepared/manifest.csv").path.sample(5, random_state=1).tolist()
sess = ort.InferenceSession(str(path))
worst = 0.0
for p in paths:
    x = tf(Image.open(p).convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        a = model(x).numpy()
    b = sess.run(None, {"input": x.numpy()})[0]
    worst = max(worst, float(np.abs(a - b).max()))
print("Max difference PyTorch vs ONNX:", worst)
if worst > 1e-3:
    raise SystemExit("PARITY FAILED - do not use this ONNX file")

# Synchronize with web app client and root
if CLIENT_MODELS.exists():
    shutil.copy(path, CLIENT_MODELS / "oral_model.onnx")
    json.dump(labels, open(CLIENT_MODELS / "labels.json", "w"))
    print("Synchronized to:", CLIENT_MODELS / "oral_model.onnx")
if CLIENT_DIST.exists():
    shutil.copy(path, CLIENT_DIST / "oral_model.onnx")
    print("Synchronized to:", CLIENT_DIST / "oral_model.onnx")
if Path("model.pt").exists():
    shutil.copy("model.pt", Path("../oral_model.pt"))
    print("Synchronized to: ../oral_model.pt")

print("OK ->", path, "| classes:", labels)
