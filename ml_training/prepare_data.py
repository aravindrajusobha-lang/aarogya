"""
prepare_data.py  -  STEP 1
Cleans the Kaggle MOD dataset and builds a manifest with 5 leak-free folds.
 
What it does
  * merges the 7 dataset classes into the app classes
  * removes exact duplicates and drops images that appear under two different labels
  * groups near-identical images (same photo resized/re-saved) so they always land in the SAME fold
  * optionally adds your own labelled photos from  extra/<label>/*.jpg
    (e.g. extra/normal/ , extra/opmd/ , extra/suspected_malignant/ ...)
  * writes manifest.csv and labels.json (the class order used everywhere)
 
Run:
    python prepare_data.py                       # downloads MOD with kagglehub
    python prepare_data.py --src "D:/path/to/unzipped/archive"   # or use a folder you already have
"""
import argparse, hashlib, json
from collections import Counter
from pathlib import Path
 
import numpy as np
import pandas as pd
from PIL import Image
from sklearn.model_selection import StratifiedGroupKFold
 
# dataset folder name -> app class
CLASS_MAP = {
    "OC": "suspected_malignant",   # oral cancer
    "MC": "suspected_malignant",   # mouth cancer
    "OLP": "opmd",                 # oral lichen planus (potentially malignant)
    "OT": "benign_inflammatory",   # oral thrush
    "CaS": "benign_inflammatory",  # canker sores
    "CoS": "benign_inflammatory",  # cold sores
    "Gum": "benign_inflammatory",  # gingivostomatitis
}
EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
 
 
def ahash(path, size=16):
    im = Image.open(path).convert("L").resize((size, size))
    a = np.asarray(im, dtype=np.float32)
    return (a > a.mean()).flatten()
 
 
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=None, help="folder of the unzipped MOD dataset (default: download with kagglehub)")
    ap.add_argument("--extra", default="extra", help="folder with your own photos: extra/<label>/*.jpg")
    ap.add_argument("--out", default="prepared")
    ap.add_argument("--near_th", type=int, default=12, help="max hash distance (of 256 bits) to call two images near-identical")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
 
    src = args.src
    if src is None:
        import kagglehub
        src = kagglehub.dataset_download("javedrashid/mouth-and-oral-diseases-mod")
    src = Path(src)
    print("Dataset folder:", src)
 
    rows = []
    for p in src.rglob("*"):
        if p.suffix.lower() in EXTS and p.parent.name in CLASS_MAP:
            rows.append((str(p.resolve()), p.parent.name, CLASS_MAP[p.parent.name], "mod"))
    extra = Path(args.extra)
    if extra.exists():
        for p in extra.rglob("*"):
            if p.suffix.lower() in EXTS:
                rows.append((str(p.resolve()), p.parent.name, p.parent.name, "own"))
    df = pd.DataFrame(rows, columns=["path", "orig_class", "label", "source"])
    print("Images found:", len(df))
    if df.empty:
        raise SystemExit("No images found - check --src")
 
    # drop corrupt images
    ok = []
    for p in df.path:
        try:
            with Image.open(p) as im:
                im.verify()
            ok.append(True)
        except Exception:
            ok.append(False)
    df = df[ok].reset_index(drop=True)
    print("Corrupt removed:", ok.count(False))
 
    # exact duplicates
    df["md5"] = [hashlib.md5(Path(p).read_bytes()).hexdigest() for p in df.path]
    conflict_md5 = set(df.groupby("md5").label.nunique().loc[lambda s: s > 1].index)
    n0 = len(df)
    df = df[~df.md5.isin(conflict_md5)]
    print("Removed (same image under different labels):", n0 - len(df))
    n0 = len(df)
    df = df.drop_duplicates("md5").reset_index(drop=True)
    print("Removed exact duplicates:", n0 - len(df))
 
    # near-duplicate clusters (union-find over hash distance)
    H = np.array([ahash(p) for p in df.path])
    parent = list(range(len(df)))
 
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
 
    for i in range(len(df)):
        d = (H[i + 1:] != H[i]).sum(1)
        for j in np.where(d <= args.near_th)[0]:
            ra, rb = find(i), find(i + 1 + j)
            if ra != rb:
                parent[rb] = ra
    df["cluster"] = [find(i) for i in range(len(df))]
    sizes = df.cluster.map(df.cluster.value_counts())
    print("Images that have a near-identical twin:", int((sizes > 1).sum()), "(kept together in the same fold)")
 
    # folds, stratified by label, grouped by cluster
    sgkf = StratifiedGroupKFold(n_splits=args.folds, shuffle=True, random_state=args.seed)
    df["fold"] = -1
    for k, (_, te) in enumerate(sgkf.split(df, df.label, groups=df.cluster)):
        df.loc[df.index[te], "fold"] = k
 
    labels = sorted(df.label.unique())
    out = Path(args.out)
    out.mkdir(exist_ok=True)
    df.drop(columns=["md5"]).to_csv(out / "manifest.csv", index=False)
    json.dump(labels, open(out / "labels.json", "w"))
 
    print("\nClass order saved to labels.json:", labels)
    print("\nImages per class per fold:")
    print(pd.crosstab(df.label, df.fold))
    if "normal" not in labels:
        print("\nWARNING: there is NO 'normal' class. Put healthy-mouth photos in extra/normal/ and run this again,")
        print("otherwise the model will call every healthy mouth a disease.")
 
 
if __name__ == "__main__":
    main()
