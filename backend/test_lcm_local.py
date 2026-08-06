import torch
from diffusers import AutoPipelineForImage2Image
from PIL import Image

print("Loading LCM...")
pipe = AutoPipelineForImage2Image.from_pretrained(
    "SimianLuo/LCM_Dreamshaper_v7", 
    torch_dtype=torch.float32, 
    safety_checker=None
)
pipe.to("cpu")

init_image = Image.open("C:/Users/sithi/.gemini/antigravity/brain/74c6e627-2e13-4bd2-a06d-cdb6138f3480/.user_uploaded/media__1785918898022.png").convert("RGB")
init_image.thumbnail((512, 512))

prompt = "a handsome man with a short fade haircut, hyperrealistic, detailed face, photorealistic"
print("Generating...")
output_image = pipe(
    prompt=prompt,
    image=init_image,
    num_inference_steps=4,
    guidance_scale=8.0,
    strength=0.45,
).images[0]

output_image.save("lcm_test_output.jpg")
print("Done! Saved to lcm_test_output.jpg")
