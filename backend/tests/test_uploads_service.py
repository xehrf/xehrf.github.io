from io import BytesIO

import pytest
from fastapi import HTTPException

from app.uploads import service as uploads_service


class _TrackingBytesIO(BytesIO):
    def __init__(self, initial_bytes: bytes) -> None:
        super().__init__(initial_bytes)
        self.read_sizes: list[int] = []

    def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)
        return super().read(size)


class _DummyUploadFile:
    def __init__(self, content_type: str, payload: bytes) -> None:
        self.content_type = content_type
        self.file = _TrackingBytesIO(payload)


def test_save_upload_file_streams_via_tempfile(monkeypatch) -> None:
    png_data = b"\x89PNG\r\n\x1a\n" + b"x" * 64
    upload = _DummyUploadFile("image/png", png_data)
    captured: dict[str, object] = {}

    def fake_upload(file_obj, **kwargs):
        captured["file_obj"] = file_obj
        captured["folder"] = kwargs["folder"]
        assert not isinstance(file_obj, (bytes, bytearray))
        file_obj.seek(0)
        assert file_obj.read() == png_data
        return {"secure_url": "https://cdn.example.com/image.png"}

    monkeypatch.setattr(uploads_service.cloudinary.uploader, "upload", fake_upload)

    url = uploads_service.save_upload_file(upload, "avatars")

    assert url == "https://cdn.example.com/image.png"
    assert captured["folder"] == "codearena/avatars"
    assert upload.file.closed is True
    assert upload.file.read_sizes
    assert all(size == uploads_service.CHUNK_SIZE for size in upload.file.read_sizes[:-1])


def test_save_upload_file_rejects_magic_bytes_mismatch(monkeypatch) -> None:
    upload = _DummyUploadFile("image/png", b"\xff\xd8\xff" + b"x" * 32)
    monkeypatch.setattr(
        uploads_service.cloudinary.uploader,
        "upload",
        lambda *_args, **_kwargs: pytest.fail("Cloudinary upload should not be called"),
    )

    with pytest.raises(HTTPException) as exc_info:
        uploads_service.save_upload_file(upload, "avatars")

    assert exc_info.value.status_code == 400
    assert "declared mime type" in str(exc_info.value.detail).lower()


def test_save_upload_file_rejects_oversized_payload(monkeypatch) -> None:
    large_png = b"\x89PNG\r\n\x1a\n" + b"x" * uploads_service.MAX_UPLOAD_SIZE
    upload = _DummyUploadFile("image/png", large_png)
    monkeypatch.setattr(
        uploads_service.cloudinary.uploader,
        "upload",
        lambda *_args, **_kwargs: pytest.fail("Cloudinary upload should not be called"),
    )

    with pytest.raises(HTTPException) as exc_info:
        uploads_service.save_upload_file(upload, "avatars")

    assert exc_info.value.status_code == 413


def test_save_upload_file_rejects_unknown_magic_bytes(monkeypatch) -> None:
    upload = _DummyUploadFile("image/webp", b"not-a-real-image")
    monkeypatch.setattr(
        uploads_service.cloudinary.uploader,
        "upload",
        lambda *_args, **_kwargs: pytest.fail("Cloudinary upload should not be called"),
    )

    with pytest.raises(HTTPException) as exc_info:
        uploads_service.save_upload_file(upload, "avatars")

    assert exc_info.value.status_code == 400
    assert "supported image format" in str(exc_info.value.detail).lower()
