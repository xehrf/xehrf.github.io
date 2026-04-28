import os
from pathlib import Path
from tempfile import SpooledTemporaryFile
 
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
SPOOL_MAX_SIZE = 1024 * 1024
CHUNK_SIZE = 64 * 1024
MAGIC_HEADER_SIZE = 16
 
# Cloudinary auto-configures from CLOUDINARY_URL env variable
cloudinary.config(cloudinary_url=os.environ.get("CLOUDINARY_URL"))


def _detect_image_mime(header: bytes) -> str | None:
    if len(header) >= 3 and header[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(header) >= 8 and header[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(header) >= 6 and header[:6] in {b"GIF87a", b"GIF89a"}:
        return "image/gif"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


def _validate_magic_bytes(content_type: str, header: bytes) -> None:
    detected_content_type = _detect_image_mime(header)
    if detected_content_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file content does not match a supported image format.",
        )
    if detected_content_type != content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file content does not match the declared MIME type.",
        )
 
 
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

    temp_file = SpooledTemporaryFile(max_size=SPOOL_MAX_SIZE, mode="w+b")
    total_size = 0
    header = bytearray()

    try:
        while chunk := file.file.read(CHUNK_SIZE):
            total_size += len(chunk)
            if total_size > MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="File is too large. Maximum size is 5MB.",
                )
            if len(header) < MAGIC_HEADER_SIZE:
                remaining = MAGIC_HEADER_SIZE - len(header)
                header.extend(chunk[:remaining])
            temp_file.write(chunk)

        _validate_magic_bytes(content_type, bytes(header))
        temp_file.seek(0)

        result = cloudinary.uploader.upload(
            temp_file,
            folder=f"codearena/{subfolder}",
            resource_type="image",
            overwrite=True,
        )
        return result["secure_url"]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {exc}",
        )
    finally:
        temp_file.close()
        file.file.close()
 
