from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.concurrency import run_in_threadpool
from nudenet import NudeDetector
import tempfile
import os

app = FastAPI()
detector = NudeDetector()

LABEL_MAP = {
    "FEMALE_BREAST_EXPOSED": "Explicit Nudity",
    "FEMALE_GENITALIA_EXPOSED": "Graphic Female Nudity",
    "MALE_GENITALIA_EXPOSED": "Graphic Male Nudity",
    "BUTTOCKS_EXPOSED": "Partial Nudity",
    "ANUS_EXPOSED": "Explicit Nudity",
    "FEMALE_BREAST_COVERED": "Suggestive",
    "BUTTOCKS_COVERED": "Suggestive",
    "BELLY_EXPOSED": "Suggestive",
    "ARMPITS_EXPOSED": "Safe",
    "FACE_FEMALE": "Safe",
    "FACE_MALE": "Safe",
    "FEET_EXPOSED": "Safe",
}

@app.get("/")
async def health():
    return {"status": "ok", "service": "nudenet"}

@app.post("/moderate")
async def moderate(file: UploadFile):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type")

    contents = await file.read()

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        results = await run_in_threadpool(detector.detect, tmp_path)

        labels = []
        for det in results:
            label = LABEL_MAP.get(det["class"], det["class"])
            labels.append({
                "Name": label,
                "Confidence": round(det["score"] * 100, 2),
                "OriginalLabel": det["class"],
                "Box": det.get("box", [])
            })

        return {"ModerationLabels": labels}

    except Exception:
        raise HTTPException(status_code=500, detail="Internal error")

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
