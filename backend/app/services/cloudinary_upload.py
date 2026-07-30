from typing import Optional
import cloudinary
import cloudinary.uploader

from app.core.config import settings


def _configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def _ensure_config() -> None:
    if not _configured():
        raise RuntimeError(
            "Cloudinary no está configurado. Define CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el entorno."
        )
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_absence_evidence(file_bytes: bytes, filename: str) -> dict:
    """Sube evidencia de ausencia. Retorna {url, public_id}."""
    _ensure_config()
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="payapp/absences",
        resource_type="image",
        public_id=None,
        use_filename=True,
        unique_filename=True,
        overwrite=False,
        filename_override=filename,
    )
    return {
        "url": result.get("secure_url") or result.get("url"),
        "public_id": result.get("public_id"),
    }


def destroy_absence_evidence(public_id: Optional[str]) -> None:
    """Elimina la imagen de Cloudinary (al anular ausencia o reemplazar evidencia)."""
    if not public_id:
        return
    if not _configured():
        return
    _ensure_config()
    cloudinary.uploader.destroy(public_id, invalidate=True)


def upload_settlement_notice(file_bytes: bytes, filename: str) -> dict:
    """Sube carta/archivo de preaviso de liquidación. Retorna {url, public_id}."""
    _ensure_config()
    lower = (filename or "").lower()
    resource_type = "raw" if lower.endswith(".pdf") else "image"
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="payapp/settlements",
        resource_type=resource_type,
        public_id=None,
        use_filename=True,
        unique_filename=True,
        overwrite=False,
        filename_override=filename,
    )
    return {
        "url": result.get("secure_url") or result.get("url"),
        "public_id": result.get("public_id"),
    }


def destroy_settlement_notice(public_id: Optional[str]) -> None:
    """Elimina el archivo de preaviso de Cloudinary."""
    if not public_id:
        return
    if not _configured():
        return
    _ensure_config()
    resource_type = "raw" if "/raw/" in (public_id or "") or public_id.endswith(".pdf") else "image"
    cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
