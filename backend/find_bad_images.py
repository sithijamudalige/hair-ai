import os
from PIL import Image

def is_bad(path: str) -> bool:
    try:
        with Image.open(path) as im:
            im.verify()  # checks integrity
        return False
    except Exception:
        return True

root = "dataset/hair"  # change to dataset/hair too
bad = []
for dirpath, _, filenames in os.walk(root):
    for fn in filenames:
        if fn.lower().endswith((".jpg",".jpeg",".png",".bmp",".webp")):
            p = os.path.join(dirpath, fn)
            if is_bad(p):
                bad.append(p)

print("BAD FILES:", len(bad))
for p in bad[:200]:
    print(p)