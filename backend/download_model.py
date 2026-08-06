import torch
from diffusers import StableDiffusionInstructPix2PixPipeline

print("Starting model download. This will take a few minutes...")
model_id = "timbrooks/instruct-pix2pix"

# We just initialize it to force the download to the huggingface cache
pipe = StableDiffusionInstructPix2PixPipeline.from_pretrained(
    model_id, torch_dtype=torch.float32, safety_checker=None
)

print("Download complete! Model is now cached.")
