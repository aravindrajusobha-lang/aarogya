"""
train.py  -  STEP 2
Fine-tunes EfficientNet-B0 on prepared/manifest.csv
 
  python train.py --mode cv      # honest accuracy estimate: 5 rounds, every image is tested once
  python train.py --mode final   # trains the model you will deploy -> model.pt + labels.json
 
Always run "cv" first and read the report. It tells you how well the model really does on
photos it has never seen. "final" only produces the file to deploy.
"""
import argparse, json, time
from pathlib import Path
 
import numpy as np
import pandas as pd
import timm
import torch
from PIL import Image
from sklearn.metrics import balanced_accuracy_score, classification_report, confusion_matrix
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms as T
 
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
REFER = {"opmd", "suspected_malignant"}   # labels that mean "send to a specialist"
 
TF_TRAIN = T.Compose([
    T.Resize((256, 256)),
    T.RandomResizedCrop(224, scale=(0.7, 1.0)),
    T.RandomHorizontalFlip(),
    T.RandomRotation(15),
    T.ColorJitter(0.3, 0.3, 0.2, 0.02),
    T.ToTensor(),
    T.Normalize(MEAN, STD),
])
TF_EVAL = T.Compose([T.Resize((224, 224)), T.ToTensor(), T.Normalize(MEAN, STD)])  # same as the app's preprocessing
 
 
class DS(Dataset):
    def __init__(self, df, label2idx, tf):
        self.paths = df.path.tolist()
        self.y = [label2idx[l] for l in df.label]
        self.tf = tf
 
    def __len__(self):
        return len(self.paths)
 
    def __getitem__(self, i):
        img = Image.open(self.paths[i]).convert("RGB")
        return self.tf(img), self.y[i]
 
 
def get_device():
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"
 
 
@torch.no_grad()
def predict(model, loader, dev):
    model.eval()
    out = []
    for x, _ in loader:
        out.append(torch.softmax(model(x.to(dev)), 1).cpu().numpy())
    return np.concatenate(out)
 
 
def train_one(train_df, val_df, labels, args, dev):
    label2idx = {l: i for i, l in enumerate(labels)}
    tr = DataLoader(DS(train_df, label2idx, TF_TRAIN), batch_size=args.bs, shuffle=True, num_workers=args.workers)
    va = DataLoader(DS(val_df, label2idx, TF_EVAL), batch_size=args.bs, num_workers=args.workers)
 
    model = timm.create_model(args.arch, pretrained=False, num_classes=len(labels)).to(dev)

    # Transfer feature extractor from local oral_model.pt if available
    for candidate in [Path(args.init_weights), Path("../oral_model.pt"), Path("oral_model.pt")]:
        if candidate.exists():
            try:
                ck = torch.load(candidate, map_location=dev)
                sd = ck.get("state_dict", ck)
                sd_filtered = {k: v for k, v in sd.items() if not k.startswith("classifier.") and not k.startswith("head.")}
                model.load_state_dict(sd_filtered, strict=False)
                print(f"  [Init] Transferred pre-trained backbone from {candidate}")
                break
            except Exception as ex:
                print(f"  [Init] Could not load {candidate}: {ex}")
    counts = np.bincount([label2idx[l] for l in train_df.label], minlength=len(labels))
    weights = torch.tensor(counts.sum() / (len(labels) * np.maximum(counts, 1)), dtype=torch.float32).to(dev)
    loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.1)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-2)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
 
    best, best_state, bad = -1, None, 0
    yv = [label2idx[l] for l in val_df.label]
    for ep in range(args.epochs):
        model.train()
        total_loss = 0.0
        batches = 0
        for x, y in tr:
            x, y = x.to(dev), y.to(dev)
            opt.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            opt.step()
            total_loss += loss.item()
            batches += 1
        sched.step()
        avg_loss = total_loss / max(batches, 1)
        score = balanced_accuracy_score(yv, predict(model, va, dev).argmax(1))   # average recall over classes
        print(f"  epoch {ep + 1:2d}/{args.epochs:2d} | train loss: {avg_loss:.4f} | val balanced-acc: {score:.3f}")
        if score > best:
            best, bad = score, 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= args.patience:
                print("  early stop")
                break
    model.load_state_dict(best_state)
    return model, best
 
 
def report(y_true, y_prob, labels, title):
    y_pred = y_prob.argmax(1)
    print(f"\n===== {title} =====")
    print(classification_report(y_true, y_pred, target_names=labels, digits=3, zero_division=0))
    print("Confusion matrix (rows = true, columns = predicted):")
    print(pd.DataFrame(confusion_matrix(y_true, y_pred, labels=range(len(labels))), index=labels, columns=labels))
    refer_idx = [i for i, l in enumerate(labels) if l in REFER]
    if refer_idx:
        t = np.isin(y_true, refer_idx)
        p = np.isin(y_pred, refer_idx)
        sens = (t & p).sum() / max(t.sum(), 1)
        spec = (~t & ~p).sum() / max((~t).sum(), 1)
        print(f"\nREFERRAL (opmd + suspected_malignant caught as either): sensitivity {sens:.3f}, specificity {spec:.3f}")
        print("Sensitivity = share of truly suspicious cases that were NOT missed. This is the number that matters most.")
 
 
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["cv", "final"], default="cv")
    ap.add_argument("--data", default="prepared")
    ap.add_argument("--arch", default="efficientnet_b0")
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--patience", type=int, default=8)
    ap.add_argument("--bs", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--workers", type=int, default=0, help="0 is safest on Windows")
    ap.add_argument("--init_weights", default="../oral_model.pt", help="Path to initial weights checkpoint")
    args = ap.parse_args()
    torch.manual_seed(42)
    np.random.seed(42)
 
    data = Path(args.data)
    df = pd.read_csv(data / "manifest.csv")
    labels = json.load(open(data / "labels.json"))     # THE class order - never re-sort it
    label2idx = {l: i for i, l in enumerate(labels)}
    dev = get_device()
    print("Device:", dev, "| classes:", labels, "| images:", len(df))
    folds = sorted(df.fold.unique())
 
    if args.mode == "cv":
        all_true, all_prob = [], []
        for k in folds:
            test = df[df.fold == k]
            val = df[df.fold == folds[(folds.index(k) + 1) % len(folds)]]
            train = df[(df.fold != k) & (df.fold != val.fold.iloc[0])]
            print(f"\n--- round {k}: train {len(train)}, val {len(val)}, test {len(test)} ---")
            model, _ = train_one(train, val, labels, args, dev)
            te = DataLoader(DS(test, label2idx, TF_EVAL), batch_size=args.bs, num_workers=args.workers)
            all_prob.append(predict(model, te, dev))
            all_true += [label2idx[l] for l in test.label]
        report(np.array(all_true), np.concatenate(all_prob), labels, "CROSS-VALIDATION (every image tested once, never seen in training)")
        print("\nNote: the dataset is small and web-style. Do NOT quote these numbers as real-world accuracy.")
        print("Test on doctor-labelled photos from your own health workers for that.")
    else:
        val_fold = folds[0]
        train, val = df[df.fold != val_fold], df[df.fold == val_fold]
        print(f"Final training: train {len(train)}, val {len(val)}")
        model, best = train_one(train, val, labels, args, dev)
        save_dir = data.parent if data.name == "prepared" else Path(".")
        ckpt = {"state_dict": model.state_dict(), "arch": args.arch, "labels": labels, "model_version": "v2.0.0-trained-mod", "is_placeholder": False}
        torch.save(ckpt, save_dir / "model.pt")
        json.dump(labels, open(save_dir / "labels.json", "w"))
        json.dump({"arch": args.arch, "val_balanced_acc": best, "trained": time.strftime("%Y-%m-%d"), "images": len(df)},
                  open(save_dir / "model_info.json", "w"))
        print(f"\nSaved {save_dir / 'model.pt'}, {save_dir / 'labels.json'}, {save_dir / 'model_info.json'}")
 
 
if __name__ == "__main__":
    main()
