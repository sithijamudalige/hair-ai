from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

import torch
from torch.utils.data import Dataset
from torchvision import datasets

class SafeImageFolder(Dataset):
    def __init__(self, root, transform):
        self.ds = datasets.ImageFolder(root, transform=transform)
        self.classes = self.ds.classes

    def __len__(self):
        return len(self.ds)

    def __getitem__(self, idx):
        try:
            return self.ds[idx]
        except Exception:
            return None  # bad sample

def collate_skip_none(batch):
    batch = [b for b in batch if b is not None]
    if len(batch) == 0:
        return None
    xs, ys = zip(*batch)
    return torch.stack(xs, 0), torch.tensor(ys)

# ... inside train_one() replace:
# ds = datasets.ImageFolder(dataset_dir, transform=tfm)
# with:
# ds = SafeImageFolder(dataset_dir, transform=tfm)
# class_names = ds.classes

# and DataLoader(..., collate_fn=collate_skip_none)
# train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0, collate_fn=collate_skip_none)
# val_loader   = DataLoader(val_ds,   batch_size=batch_size, shuffle=False, num_workers=0, collate_fn=collate_skip_none)

# and in your loops, skip None batches:
# for batch in tqdm(train_loader, ...):
#     if batch is None:
#         continue
#     x, y = batch
#     ...