import os
import json
import base64

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
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.responses import FileResponse
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

        raw_pose = getattr(f, 'pose', None)
        pose_list = [float(x) for x in raw_pose] if raw_pose is not None else [0.0, 0.0, 0.0]

        out.append({
            "bbox": [float(x) for x in f.bbox],
            "pose": pose_list,
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


HAIR_ASSISTANT_SYSTEM_PROMPT = """You are a professional barber, grooming expert, and fashion stylist AI assistant.
Your goal is to converse with the user, understand their face shape, skin tone, hair type, and style preferences.
Based on their profile, you MUST provide a complete look recommendation that includes:
1. The best hairstyles for them.
2. Complementary beard or facial hair styles.
3. Fashion and clothing tips (colors and styles) that match their look and skin tone.

Be extremely brief, conversational, and direct. Break your advice into short, easy-to-read sections.

CRITICAL REQUIREMENT:
At the very end of your response, you MUST output 3 secret machine-readable tags containing EXACTLY 3 recommendations each from the following strict lists:
AVAILABLE HAIR STYLES: "fade", "buzz_cut", "dreads", "wavy", "pompadour", "mullet", "comb_over", "spiky", "fringe", "long_hair"
AVAILABLE BEARD STYLES: "clean_shaven", "stubble", "goatee", "short_boxed", "full_beard", "faded_beard", "ducktail", "anchor", "mustache"
AVAILABLE FASHION STYLES: "smart_casual", "streetwear", "business_professional", "athleisure", "minimalist", "vintage", "grunge", "preppy"

You must use this exact format on new lines:
RECOMMENDED_HAIR=["style1", "style2", "style3"]
RECOMMENDED_BEARDS=["style1", "style2", "style3"]
RECOMMENDED_FASHION=["style1", "style2", "style3"]

Example response:
Based on your oval face and skin tone, here is your complete look:
Hair: I'd recommend a tight fade or some textured waves.
Beard: A short boxed beard will sharpen your jawline perfectly.
Fashion: Earth tones like olive green and navy blue will look incredible on you. Go for smart-casual layers.

RECOMMENDED_HAIR=["fade", "wavy", "buzz_cut"]
RECOMMENDED_BEARDS=["short_boxed", "faded_beard", "stubble"]
RECOMMENDED_FASHION=["smart_casual", "minimalist", "streetwear"]
"""


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



GEMINI_VISION_PROMPT = """You are a professional barber and hairstylist AI. Analyze this person's face photo carefully.

Look at their:
- Face shape (oval, round, square, heart, oblong)
- Current hair (length, texture, thickness)
- Facial hair / beard
- Overall style vibe

Give a SHORT, friendly, personalized recommendation (3-4 sentences max).

CRITICAL: At the very end, output EXACTLY 3 recommended hairstyles from this strict list:
AVAILABLE STYLES: "fade", "buzz_cut", "dreads", "wavy", "pompadour", "mullet", "comb_over", "spiky", "fringe", "long_hair"

Use this EXACT format on a new line:
RECOMMENDED_STYLES=["style1", "style2", "style3"]
"""

# Initialize global pipe for offline generation
local_pipe = None

class FaceSwapRequest(BaseModel):
    source_image: str  # Base64 string of the user's face


class GeminiGenerateRequest(BaseModel):
    image_base64: str
    style_name: str
    category: str = "hair"


@app.post("/generate-hairstyle")
async def generate_hairstyle(req: GeminiGenerateRequest):
    api_key = os.getenv("HUGGINGFACE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="Hugging Face API Key is required in .env")

    img_data = req.image_base64
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]

    try:
        # Save input image to a temporary file for Gradio
        temp_input_path = "temp_input.jpg"
        with open(temp_input_path, "wb") as f:
            f.write(base64.b64decode(img_data))
        
        try:
            # We are doing 100% offline generation using diffusers
            import torch
            from diffusers import AutoPipelineForImage2Image
            from PIL import Image
            
            # Use a global pipeline to avoid reloading on every request
            global local_pipe
            if 'local_pipe' not in globals() or local_pipe is None:
                print("Loading LCM AI model (this may take a few minutes the first time to download)...")
                # LCM Dreamshaper v7 is amazing for fast 4-step generation and perfect for low-strength image2image
                model_id = "SimianLuo/LCM_Dreamshaper_v7"
                
                # Check for GPU, fallback to CPU
                device = "cuda" if torch.cuda.is_available() else "cpu"
                dtype = torch.float16 if torch.cuda.is_available() else torch.float32
                
                local_pipe = AutoPipelineForImage2Image.from_pretrained(
                    model_id, torch_dtype=dtype, safety_checker=None
                )
                local_pipe.to(device)
                print("Model loaded successfully!")
            
            # Load the input image
            init_image = Image.open(temp_input_path).convert("RGB")
            # Resize image to save memory and speed up CPU generation
            init_image.thumbnail((512, 512))
            
            # Remove background for better quality editing
            try:
                from rembg import remove
                print("Removing background using rembg...")
                no_bg_image = remove(init_image)
                # Create a solid white background
                clean_image = Image.new("RGB", no_bg_image.size, (255, 255, 255))
                # Paste the subject using the alpha channel as a mask
                if no_bg_image.mode == "RGBA":
                    clean_image.paste(no_bg_image, mask=no_bg_image.split()[3])
                else:
                    clean_image = no_bg_image.convert("RGB")
                init_image = clean_image
                print("Background removed successfully.")
            except Exception as e:
                print(f"Failed to remove background: {e}")
            
            # Generate prompt based on category
            if req.category == "hair":
                prompt = f"a short {req.style_name.replace('_', ' ')} haircut"
            elif req.category == "beard":
                prompt = f"a man with a highly detailed {req.style_name.replace('_', ' ')} beard on his face"
            elif req.category == "fashion":
                prompt = f"a man wearing {req.style_name.replace('_', ' ')} clothing, highly detailed fashion"
            else:
                prompt = f"a short {req.style_name.replace('_', ' ')} haircut"
                
            print(f"Generating offline image for prompt: {prompt} (Category: {req.category})")
            
            # Generate! Use LCM (4 steps) and low strength (0.35) to perfectly preserve the face and skin color!
            output_image = local_pipe(
                prompt=prompt,
                image=init_image,
                num_inference_steps=4,
                guidance_scale=8.0,
                strength=0.35,
            ).images[0]
            
            # ULTIMATE FIX: Force 100% face preservation by pasting the original face back onto the generated image!
            try:
                import cv2
                import numpy as np
                print("Restoring exact original face pixels...")
                
                # Convert images to CV2 format
                orig_cv = cv2.cvtColor(np.array(init_image), cv2.COLOR_RGB2BGR)
                gen_cv = cv2.cvtColor(np.array(output_image), cv2.COLOR_RGB2BGR)
                
                # Detect face in the original image
                faces = face_app.get(orig_cv)
                if faces:
                    # Get the largest face
                    faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0])*(x.bbox[3]-x.bbox[1]), reverse=True)
                    f = faces[0]
                    x1, y1, x2, y2 = [int(v) for v in f.bbox]
                    h, w = orig_cv.shape[:2]
                    
                    # Create a mask specifically for the inner face (eyes, nose, mouth, cheeks)
                    mask = np.zeros((h, w), dtype=np.uint8)
                    center_x = (x1 + x2) // 2
                    
                    if req.category in ["hair", "fashion"]:
                        # Restore full face
                        center_y = int(y1 + (y2 - y1) * 0.55) 
                        axes = (int((x2 - x1) * 0.38), int((y2 - y1) * 0.45))
                    else:
                        # For beard, ONLY restore the upper face (eyes/forehead) so we don't overwrite the generated beard!
                        center_y = int(y1 + (y2 - y1) * 0.35) 
                        axes = (int((x2 - x1) * 0.38), int((y2 - y1) * 0.25))
                        
                    cv2.ellipse(mask, (center_x, center_y), axes, 0, 0, 360, 255, -1)
                    
                    # Heavily blur the mask for seamless, invisible blending
                    mask = cv2.GaussianBlur(mask, (41, 41), 0)
                    mask_3d = mask[:, :, None] / 255.0
                    
                    # Blend the original exact face onto the generated image
                    blended = (orig_cv * mask_3d + gen_cv * (1 - mask_3d)).astype(np.uint8)
                    output_image = Image.fromarray(cv2.cvtColor(blended, cv2.COLOR_BGR2RGB))
                    print("Face completely restored!")
                else:
                    print("No face detected for restoration.")
            except Exception as e:
                print(f"Failed to restore face: {e}")
            
            # Save the generated image
            output_image_path = "temp_output.jpg"
            output_image.save(output_image_path, "JPEG")
            
            # Read the generated image and convert to base64
            with open(output_image_path, "rb") as img_file:
                encoded_string = base64.b64encode(img_file.read()).decode('utf-8')
                final_data_uri = f"data:image/jpeg;base64,{encoded_string}"
                
            if os.path.exists(output_image_path):
                os.remove(output_image_path)
                
        except Exception as e:
            print(f"Offline Image Edit Failed: {e}")
            # Fallback to returning the original image so the app doesn't crash
            final_data_uri = req.image_base64
            
        # Cleanup temp file
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)
            
        return {"image_url": final_data_uri}

    except Exception as e:
        print(f"Hugging Face Image Edit Failed: {e}")
        # Force reload trigger
        raise HTTPException(status_code=502, detail=f"Failed to edit image via Hugging Face AI: {e}") from e


if __name__ == "__main__":
    import uvicorn
    import base64

    uvicorn.run(app, host="0.0.0.0", port=8000)