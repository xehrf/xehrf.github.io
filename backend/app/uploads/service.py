import os
from pathlib import Path
 
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status
 
# Local fallback dir (still needed for UPLOAD_DIR reference in main.py)
BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
 
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
 
# Cloudinary auto-configures from CLOUDINARY_URL env variable
cloudinary.config(cloudinary_url=os.environ.get("CLOUDINARY_URL"))
 
 
def save_upload_file(file: UploadFile, subfolder: str) -> str:
    """Upload image to Cloudinary and return the secure URL."""
    if file is None:
        return ""
 
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: JPG, PNG, GIF, WEBP.",
        )
 
    # Read file into memory with size check
    data = b""
    while chunk := file.file.read(8192):
        data += chunk
        if len(data) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File is too large. Maximum size is 5MB.",
            )
    file.file.close()
 
    try:
        result = cloudinary.uploader.upload(
            data,
            folder=f"codearena/{subfolder}",
            resource_type="image",
            overwrite=True,
        )
        return result["secure_url"]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {exc}",
        )
 