import os
import urllib.request
import json

api_key = "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"

payload = {
    "model": "llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.7,
    "max_tokens": 10,
}

req = urllib.request.Request(
    "https://api.groq.com/openai/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req) as resp:
        print("Success:", resp.read().decode("utf-8"))
except Exception as e:
    print("Error:", str(e))
    if hasattr(e, 'read'):
        print("Body:", e.read().decode("utf-8", errors="replace"))
