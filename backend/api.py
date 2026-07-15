import os
import json

# Ensure .env is loaded and overrides any old terminal variables
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

import urllib.request
import urllib.error
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import cv2
import torch
import torch.nn as nn
from pathlib import Path
from torchvision import models, transforms
from PIL import Image
import onnxruntime as ort

# Disable online version checks that can timeout on restricted networks.
os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")

from insightface.app import FaceAnalysis

# ------------- CORS middleware for React frontend -------------
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FaceType + HairType API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(BASE_DIR / ".env")

available_ort_providers = set(ort.get_available_providers())
insightface_providers = ["CPUExecutionProvider"]
if DEVICE == "cuda" and "CUDAExecutionProvider" in available_ort_providers:
    insightface_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

# ---------- load InsightFace (for face bbox) ----------
face_app = FaceAnalysis(name="buffalo_l", providers=insightface_providers)
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

# Load EfficientNet models (Face, Hair, Skin)
face_model, FACE_CLASSES = load_efficientnet_b0_classifier(str(MODELS_DIR / "face.pt"))
hair_model, HAIR_CLASSES = load_efficientnet_b0_classifier(str(MODELS_DIR / "hair.pt"))
skin_model, SKIN_CLASSES = load_efficientnet_b0_classifier(str(MODELS_DIR / "skin.pt"))  # <--- Added skin model

# Transformation for all models
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

        # Predict face type
        face_label, face_conf = predict_pil(face_model, FACE_CLASSES, bgr_to_pil_rgb(face_crop))
        # Predict hair type
        if hair_crop.size == 0:
            hair_label, hair_conf = None, None
        else:
            hair_label, hair_conf = predict_pil(hair_model, HAIR_CLASSES, bgr_to_pil_rgb(hair_crop))
        # Predict skin type
        skin_label, skin_conf = predict_pil(skin_model, SKIN_CLASSES, bgr_to_pil_rgb(face_crop))

        out.append({
            "bbox": [float(x) for x in f.bbox],
            "det_score": float(f.det_score),
            "face_type": {"label": face_label, "confidence": face_conf},
            "hair_type": {"label": hair_label, "confidence": hair_conf},
            "skin_type": {"label": skin_label, "confidence": skin_conf},   # <--- Added output
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


class UserProfilePayload(BaseModel):
    faceType: str
    skinTone: str
    hairType: str
    beardStyle: str = "Not specified"
    hairLength: str = "Not specified"
    stylePreference: str = ""
    additionalNotes: str = ""
    source: str = "live"


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class HairAssistantRequest(BaseModel):
    profile: UserProfilePayload
    messages: List[ChatMessagePayload] = []


HAIR_ASSISTANT_SYSTEM_PROMPT = """You are Aura Hair Assistant, a friendly expert barber and stylist AI.

The user completed a face, skin, and hair analysis. Use their confirmed profile to recommend:
- Haircut styles that suit their face shape
- Beard styles (or clean-shaven advice) if relevant
- Styling tips, maintenance, and products
- Color or treatment suggestions when appropriate

Be specific, practical, and encouraging. Format recommendations clearly with headings and bullet points.
If information is missing, make reasonable suggestions and mention what you assumed.
Always personalize advice to their face type, skin tone, and hair type."""


def build_profile_context(profile: UserProfilePayload) -> str:
    return (
        f"Confirmed client profile:\n"
        f"- Face type: {profile.faceType}\n"
        f"- Skin tone: {profile.skinTone}\n"
        f"- Hair type: {profile.hairType}\n"
        f"- Current beard style: {profile.beardStyle}\n"
        f"- Hair length: {profile.hairLength}\n"
        f"- Style preference: {profile.stylePreference or 'None given'}\n"
        f"- Additional notes: {profile.additionalNotes or 'None'}\n"
        f"- Analysis source: {profile.source}"
    )


def call_groq_chat(messages: list) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured on the server.")

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1200,
    }

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Groq API error: {body}") from e
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Groq API: {e}") from e

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise HTTPException(status_code=502, detail="Unexpected response from Groq API.") from e


@app.post("/chat/hair-assistant")
async def hair_assistant(req: HairAssistantRequest):
    profile_context = build_profile_context(req.profile)

    groq_messages = [
        {"role": "system", "content": HAIR_ASSISTANT_SYSTEM_PROMPT},
        {"role": "system", "content": profile_context},
    ]

    for msg in req.messages:
        if msg.role not in {"user", "assistant"}:
            continue
        groq_messages.append({"role": msg.role, "content": msg.content})

    if not req.messages:
        groq_messages.append({
            "role": "user",
            "content": (
                "Based on my confirmed profile, please recommend haircuts, beard styles, "
                "and grooming tips that would suit me best. Include 3-5 specific style names."
            ),
        })

    reply = call_groq_chat(groq_messages)
    return {"reply": reply}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)