import os
import argparse
from tqdm import tqdm

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models

def train_one(dataset_dir: str, out_path: str, epochs: int = 10, batch_size: int = 16, lr: float = 3e-4):
    device = "cuda" if torch.cuda.is_available() else "cpu"

    train_tfm = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.2, 0.2, 0.2),
        transforms.RandomRotation(10),
        transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406], [0.229,0.224,0.225]),
    ])

    val_tfm = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406], [0.229,0.224,0.225]),
    ])

    full = datasets.ImageFolder(dataset_dir, transform=train_tfm)
    class_names = full.classes
    n_classes = len(class_names)

    n_val = max(1, int(0.2 * len(full)))
    n_train = len(full) - n_val
    train_ds, val_ds = random_split(full, [n_train, n_val])
    # swap val transform
    val_ds.dataset.transform = val_tfm

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    # Powerful backbone (EfficientNet)
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, n_classes)
    model.to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()

    best = 0.0
    for epoch in range(1, epochs + 1):
        model.train()
        for x, y in tqdm(train_loader, desc=f"epoch {epoch}/{epochs} train"):
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            logits = model(x)
            loss = loss_fn(logits, y)
            loss.backward()
            opt.step()

        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for x, y in tqdm(val_loader, desc=f"epoch {epoch}/{epochs} val"):
                x, y = x.to(device), y.to(device)
                pred = model(x).argmax(1)
                correct += (pred == y).sum().item()
                total += y.numel()

        acc = correct / max(1, total)
        print(f"val_acc={acc:.4f}")
        if acc > best:
            best = acc
            os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
            torch.save({"model": model.state_dict(), "classes": class_names}, out_path)
            print(f"saved {out_path} (best={best:.4f})")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=3e-4)
    args = ap.parse_args()
    train_one(args.data, args.out, args.epochs, args.batch, args.lr)

if __name__ == "__main__":
    main()