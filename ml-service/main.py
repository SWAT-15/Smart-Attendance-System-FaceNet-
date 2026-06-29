import base64
import io
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1

app = FastAPI(
    title="FaceNet Embedding & Verification Service",
    description="Provides /embed and /verify endpoints for the Smart Attendance System",
    version="1.0.0"
)

# ── CORS (allow Spring Boot backend to call this) ──────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Lock this to your backend URL in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Model Init ─────────────────────────────────────────────────────
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"[FaceNet] Running on: {device}")

# MTCNN: face detector + aligner
mtcnn = MTCNN(image_size=160, margin=14, keep_all=False, device=device)

# InceptionResnetV1: trained on CASIA-WebFace
resnet = InceptionResnetV1(pretrained='casia-webface').eval().to(device)

# ── Schemas ────────────────────────────────────────────────────────
class EmbedRequest(BaseModel):
    imageB64: str

class EmbedResponse(BaseModel):
    embedding: list[float]
    faceDetected: bool

class VerifyRequest(BaseModel):
    sourceImageB64: str
    targetEmbedding: list[float]

class VerifyResponse(BaseModel):
    verified: bool
    distance: float
    similarity: float

# ── Helpers ────────────────────────────────────────────────────────
def decode_image(base64_str: str) -> Image.Image:
    """Decode a base64 image string (with or without data: prefix)."""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

def get_embedding(img: Image.Image) -> np.ndarray:
    """Run MTCNN face detection + InceptionResNetV1 embedding extraction."""
    face_tensor = mtcnn(img)
    if face_tensor is None:
        raise HTTPException(status_code=422, detail="No face detected in the image. Ensure good lighting and face the camera.")
    face_tensor = face_tensor.unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = resnet(face_tensor).cpu().numpy()[0]
    return embedding

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Returns cosine similarity in range [-1, 1]. Higher = more similar."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.clip(dot / (norm_a * norm_b), -1.0, 1.0))

# ── Endpoints ──────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check for Railway/Docker deploy readiness probes."""
    return {"status": "ok", "device": str(device)}

@app.post("/embed", response_model=EmbedResponse)
async def embed_face(request: EmbedRequest):
    """
    Extract a 512-dim face embedding from a base64 JPEG image.

    Used during face ENROLLMENT — store the returned embedding in Supabase
    as the student's faceEmbedding (float[] column via pgvector).

    Input:  { imageB64: "data:image/jpeg;base64,..." }
    Output: { embedding: [float x 512], faceDetected: true }
    """
    img = decode_image(request.imageB64)
    embedding = get_embedding(img)
    return EmbedResponse(embedding=embedding.tolist(), faceDetected=True)

@app.post("/verify", response_model=VerifyResponse)
async def verify_face(request: VerifyRequest):
    """
    Verify a live face frame against a stored embedding.

    Called during attendance submission — the Spring Boot backend calls this
    with the student's captured face frame and stored enrollment embedding.

    Threshold:
      similarity >= 0.75 → VERIFIED  (cosine distance <= 0.25)
      similarity < 0.75  → REJECTED

    Input:  { sourceImageB64: "...", targetEmbedding: [float x 512] }
    Output: { verified: bool, distance: float, similarity: float }
    """
    img = decode_image(request.sourceImageB64)
    source_embedding = get_embedding(img)
    target_embedding = np.array(request.targetEmbedding, dtype=np.float32)

    similarity = cosine_similarity(source_embedding, target_embedding)
    distance   = 1.0 - similarity
    # Threshold: cosine distance <= 0.25 ≈ similarity >= 0.75
    verified = bool(distance <= 0.25)

    return VerifyResponse(verified=verified, distance=distance, similarity=similarity)

# ── Entrypoint ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

