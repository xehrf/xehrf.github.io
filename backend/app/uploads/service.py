import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image MIME types for avatars and banners.
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB


def _get_extension(content_type: str) -> str:
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed formats: JPG, PNG, GIF.",
        )
    return extension


def save_upload_file(file: UploadFile, subfolder: str) -> str:
    """Validate and store an uploaded image file in a typed subfolder."""
    if file is None:
        return ""

    extension = _get_extension(file.content_type or "")
    target_dir = UPLOAD_DIR / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{extension}"
    target_file = target_dir / filename
    total_size = 0

    try:
        with target_file.open("wb") as out_file:
            while chunk := file.file.read(8192):
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File is too large. Maximum size is 5MB.",
                    )
                out_file.write(chunk)
    except HTTPException:
        if target_file.exists():
            target_file.unlink(missing_ok=True)
        raise
    except Exception as exc:
        if target_file.exists():
            target_file.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {exc}",
        )
    finally:
        file.file.close()

    return f"/uploads/{subfolder}/{filename}"
