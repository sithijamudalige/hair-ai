import os
import argparse
from tqdm import tqdm

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models
from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

def train_one(dataset_dir: str, out_path: str, epochs: int = 5, batch_size: int = 16, lr: float = 1e-4):
    device = "cuda" if torch.cuda.is_available() else "cpu"

    tfm = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    ds = datasets.ImageFolder(dataset_dir, transform=tfm)
    class_names = ds.classes
    n_classes = len(class_names)

    # split train/val
    val_ratio = 0.2
    n_val = max(1, int(len(ds) * val_ratio))
    n_train = len(ds) - n_val
    train_ds, val_ds = random_split(ds, [n_train, n_val])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    # model
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    model.fc = nn.Linear(model.fc.in_features, n_classes)
    model.to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()

    best_val = 0.0

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for x, y in tqdm(train_loader, desc=f"epoch {epoch}/{epochs} train"):
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            logits = model(x)
            loss = loss_fn(logits, y)
            loss.backward()
            opt.step()
            total_loss += loss.item() * x.size(0)

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for x, y in tqdm(val_loader, desc=f"epoch {epoch}/{epochs} val"):
                x, y = x.to(device), y.to(device)
                logits = model(x)
                pred = logits.argmax(dim=1)
                correct += (pred == y).sum().item()
                total += y.numel()

        val_acc = correct / max(1, total)
        print(f"epoch={epoch} train_loss={total_loss/max(1,n_train):.4f} val_acc={val_acc:.4f}")

        if val_acc > best_val:
            best_val = val_acc
            ckpt = {
                "model": model.state_dict(),
                "classes": class_names,
            }
            os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
            torch.save(ckpt, out_path)
            print(f"saved best to {out_path} (val_acc={best_val:.4f})")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="Path to ImageFolder dataset (e.g., dataset/hair)")
    ap.add_argument("--out", required=True, help="Output .pt file (e.g., models/hair.pt)")
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=1e-4)
    args = ap.parse_args()

    train_one(args.data, args.out, args.epochs, args.batch, args.lr)

if __name__ == "__main__":
    main()