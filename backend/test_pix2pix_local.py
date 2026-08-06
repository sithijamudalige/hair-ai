import torch
from diffusers import StableDiffusionInstructPix2PixPipeline, EulerAncestralDiscreteScheduler
from PIL import Image

model_id = "timbrooks/instruct-pix2pix"
pipe = StableDiffusionInstructPix2PixPipeline.from_pretrained(
    model_id, torch_dtype=torch.float32, safety_checker=None
)
pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
pipe.to("cpu")

init_image = Image.open("C:/Users/sithi/.gemini/antigravity/brain/74c6e627-2e13-4bd2-a06d-cdb6138f3480/.user_uploaded/media__1785918898022.png").convert("RGB")
init_image.thumbnail((384, 384))

instruction = "give him a short fade"

output_image = pipe(
    instruction,
    image=init_image,
    num_inference_steps=20,
    image_guidance_scale=1.5,
    guidance_scale=7.5,
).images[0]

output_image.save("pix2pix_test_local.jpg")
print("Saved to pix2pix_test_local.jpg")
