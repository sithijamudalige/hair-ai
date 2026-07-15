import os
from PIL import Image

EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

def is_bad_strict(path: str) -> bool:
    try:
        with Image.open(path) as im:
            im.load()           # fully decode pixels (catches truncated files)
            im.convert("RGB")   # forces conversion like torchvision does
        return False
    except Exception:
        return True

def scan(root: str):
    bad = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if fn.lower().endswith(EXTS):
                p = os.path.join(dirpath, fn)
                if is_bad_strict(p):
                    bad.append(p)
    return bad

if __name__ == "__main__":
    root = "dataset/hair"  # change to dataset/hair too
    bad = scan(root)
    print("BAD FILES:", len(bad))
    for p in bad:
        print(p)