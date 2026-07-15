from fastapi import FastAPI, File, UploadFile, HTTPException
import numpy as np
import cv2
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

from insightface.app import FaceAnalysis

# ------------- CORS middleware for React frontend -------------
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FaceType + HairType API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ---------- load InsightFace (for face bbox) ----------
face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=-1, det_size=(640, 640))

# ---------- model helpers for EfficientNet ----------
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

# Load EfficientNet models
face_model, FACE_CLASSES = load_efficientnet_b0_classifier("models/face.pt")
hair_model, HAIR_CLASSES = load_efficientnet_b0_classifier("models/hair.pt")

tfm = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def decode_upload_to_bgr(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image")
    return bgr

def bgr_to_pil_rgb(img_bgr: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)

@torch.no_grad()
def predict_pil(model, classes, pil_img: Image.Image):
    x = tfm(pil_img).unsqueeze(0).to(DEVICE)
    logits = model(x)
    probs = torch.softmax(logits, dim=1)[0]
    idx = int(torch.argmax(probs).item())
    return classes[idx], float(probs[idx].item())

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def crop_face_and_hair(bgr: np.ndarray, bbox):
    h, w = bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]

    x1 = clamp(x1, 0, w-1)
    x2 = clamp(x2, 0, w-1)
    y1 = clamp(y1, 0, h-1)
    y2 = clamp(y2, 0, h-1)

    # Face crop
    face_crop = bgr[y1:y2, x1:x2].copy()

    # Hair crop: area above the face bbox (simple heuristic)
    face_h = max(1, y2 - y1)
    hair_top = clamp(y1 - int(0.8 * face_h), 0, h-1)
    hair_bottom = clamp(y1 + int(0.1 * face_h), 0, h-1)
    hair_crop = bgr[hair_top:hair_bottom, x1:x2].copy()

    return face_crop, hair_crop

def analyze_bgr(bgr: np.ndarray):
    faces = face_app.get(bgr)
    out = []
    for f in faces:
        face_crop, hair_crop = crop_face_and_hair(bgr, f.bbox)

        if face_crop.size == 0:
            continue

        face_label, face_conf = predict_pil(face_model, FACE_CLASSES, bgr_to_pil_rgb(face_crop))

        if hair_crop.size == 0:
            hair_label, hair_conf = None, None
        else:
            hair_label, hair_conf = predict_pil(hair_model, HAIR_CLASSES, bgr_to_pil_rgb(hair_crop))

        out.append({
            "bbox": [float(x) for x in f.bbox],
            "det_score": float(f.det_score),
            "face_type": {"label": face_label, "confidence": face_conf},
            "hair_type": {"label": hair_label, "confidence": hair_conf},
        })

    return {"num_faces": len(out), "faces": out}

@app.post("/analyze")
async def analyze_upload(image: UploadFile = File(...)):
    data = await image.read()
    try:
        bgr = decode_upload_to_bgr(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return analyze_bgr(bgr)

@app.get("/analyze/camera")
def analyze_camera(camera_index: int = 0):
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail=f"Could not open camera {camera_index}")
    ok, frame = cap.read()
    cap.release()
    if not ok or frame is None:
        raise HTTPException(status_code=500, detail="Could not read frame from camera")
    return analyze_bgr(frame)