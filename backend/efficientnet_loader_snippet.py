def load_efficientnet_b0_classifier(pt_path: str):
    ckpt = torch.load(pt_path, map_location=DEVICE)
    classes = ckpt["classes"]
    n_classes = len(classes)

    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, n_classes)

    model.load_state_dict(ckpt["model"])
    model.to(DEVICE)
    model.eval()
    return model, classes