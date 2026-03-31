"""ModelManager – Download, Status, Cache und GPU-Erkennung fuer ML-Modelle."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Modelle die heruntergeladen werden muessen
MODELS: list[tuple[str, str]] = [
    ("BAAI/bge-m3", "Embedding-Modell"),
    ("BAAI/bge-reranker-v2-m3", "Reranker-Modell"),
]

# Mindestens verfuegbarer Festplattenspeicher in GB
REQUIRED_DISK_GB = 5.0

# Wiederholungsversuche und Backoff
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [2.0, 4.0, 8.0]

# Lock-Timeout: nach 30 Minuten wird der Lock freigegeben
DOWNLOAD_LOCK_TIMEOUT = 30 * 60


def _is_model_downloaded(hub_dir: Path, model_id: str) -> bool:
    """Prueft ob ein Modell vollstaendig heruntergeladen ist.

    Ein Modell gilt als heruntergeladen wenn ein snapshots/-Verzeichnis
    mit mindestens einem Commit-Hash existiert, der Dateien enthaelt.
    """
    safe_name = model_id.replace("/", "--")
    snapshots_dir = hub_dir / f"models--{safe_name}" / "snapshots"
    if not snapshots_dir.exists():
        return False
    # Mindestens ein Snapshot-Verzeichnis mit Dateien
    for snapshot in snapshots_dir.iterdir():
        if snapshot.is_dir() and any(snapshot.iterdir()):
            return True
    return False


def _get_model_size_mb(hub_dir: Path, model_id: str) -> int:
    """Berechnet die Groesse eines Modells im Cache in MB."""
    safe_name = model_id.replace("/", "--")
    model_dir = hub_dir / f"models--{safe_name}"
    if not model_dir.exists():
        return 0
    total_bytes = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file())
    return int(total_bytes / (1024 * 1024))


class ModelManager:
    """Verwaltet den Download, Status und Cache von ML-Modellen.

    Verwendet snapshot_download() fuer zuverlaessigen Download mit
    Modell-Level-Fortschritt (nicht Byte-Level).
    """

    def __init__(self, hf_home: str | None = None) -> None:
        self.hf_home = hf_home or os.environ.get("HF_HOME", "/models")
        self._download_lock = asyncio.Lock()
        self._downloading = False
        self._download_started_at: float = 0.0

    def _check_stale_lock(self) -> None:
        """Gibt den Lock frei wenn er zu lange gehalten wird."""
        if (
            self._downloading
            and self._download_started_at > 0
            and (time.monotonic() - self._download_started_at) > DOWNLOAD_LOCK_TIMEOUT
        ):
            logger.warning("Download-Lock Timeout nach %d Sekunden — Lock wird freigegeben",
                           DOWNLOAD_LOCK_TIMEOUT)
            self._downloading = False
            if self._download_lock.locked():
                self._download_lock.release()

    async def download_models(self) -> AsyncIterator[dict[str, Any]]:
        """Laedt alle ML-Modelle herunter und streamt SSE-Events.

        Yields dicts mit type-Feld:
        - disk_check: Festplattenspeicher-Pruefung
        - disk_warning: Zu wenig Speicher
        - start: Beginn eines Modell-Downloads
        - progress: Modell-Level Fortschritt (model_index, total_models)
        - complete: Modell vollstaendig heruntergeladen
        - retry: Wiederholungsversuch
        - error: Fehler beim Download
        - all_complete: Alle Modelle fertig
        """
        self._check_stale_lock()

        if self._download_lock.locked():
            yield {"type": "error", "message": "Download laeuft bereits"}
            return

        await self._download_lock.acquire()
        self._downloading = True
        self._download_started_at = time.monotonic()
        try:
            # Festplattenspeicher pruefen
            try:
                Path(self.hf_home).mkdir(parents=True, exist_ok=True)
                disk = shutil.disk_usage(self.hf_home)
                free_gb = round(disk.free / (1024**3), 1)
                yield {
                    "type": "disk_check",
                    "free_gb": free_gb,
                    "required_gb": REQUIRED_DISK_GB,
                }
                if free_gb < REQUIRED_DISK_GB:
                    yield {
                        "type": "disk_warning",
                        "free_gb": free_gb,
                        "required_gb": REQUIRED_DISK_GB,
                    }
            except Exception as e:
                logger.warning("Festplattenplatz-Pruefung fehlgeschlagen: %s", e)

            hub_dir = Path(self.hf_home) / "hub"
            total_models = len(MODELS)

            for idx, (model_id, label) in enumerate(MODELS):
                # Pruefen ob Modell schon vollstaendig da ist
                if _is_model_downloaded(hub_dir, model_id):
                    logger.info("Modell %s bereits heruntergeladen — ueberspringe", model_id)
                    yield {"type": "start", "model": model_id, "label": label}
                    yield {"type": "complete", "model": model_id}
                    continue

                yield {"type": "start", "model": model_id, "label": label}
                yield {
                    "type": "progress",
                    "model": model_id,
                    "model_index": idx + 1,
                    "total_models": total_models,
                    "message": f"Lade {label} herunter...",
                }

                success = False
                last_error: str = ""

                for attempt in range(1, MAX_RETRIES + 1):
                    try:
                        download_start = time.monotonic()
                        await asyncio.to_thread(
                            self._snapshot_download_sync, model_id
                        )
                        elapsed = time.monotonic() - download_start
                        size_mb = _get_model_size_mb(hub_dir, model_id)
                        speed_mbps = round(size_mb / max(elapsed, 0.001), 1)

                        yield {
                            "type": "progress",
                            "model": model_id,
                            "model_index": idx + 1,
                            "total_models": total_models,
                            "downloaded_bytes": size_mb * 1024 * 1024,
                            "total_bytes": size_mb * 1024 * 1024,
                            "speed_mbps": speed_mbps,
                            "eta_seconds": 0,
                            "message": f"{label} heruntergeladen ({size_mb} MB)",
                        }
                        yield {"type": "complete", "model": model_id}
                        success = True
                        break
                    except Exception as exc:
                        last_error = str(exc)
                        logger.warning(
                            "Download %s Versuch %d fehlgeschlagen: %s",
                            model_id, attempt, exc,
                        )

                    if not success and attempt < MAX_RETRIES:
                        yield {
                            "type": "retry",
                            "model": model_id,
                            "attempt": attempt,
                            "max_attempts": MAX_RETRIES,
                        }
                        await asyncio.sleep(RETRY_BACKOFF_SECONDS[attempt - 1])

                if not success:
                    yield {
                        "type": "error",
                        "model": model_id,
                        "message": last_error or "Download fehlgeschlagen",
                        "retryable": True,
                    }

            yield {"type": "all_complete"}

        finally:
            self._downloading = False
            self._download_started_at = 0.0
            self._download_lock.release()

    @staticmethod
    def _snapshot_download_sync(model_id: str, cache_dir: str | None = None) -> str:
        """Synchroner Wrapper fuer snapshot_download (laeuft in Thread)."""
        import huggingface_hub

        return huggingface_hub.snapshot_download(
            model_id,
            cache_dir=cache_dir or os.environ.get("HF_HOME", "/models"),
        )

    async def get_model_status(self) -> dict[str, Any]:
        """Gibt den Status aller ML-Modelle zurueck."""
        self._check_stale_lock()
        hub_dir = Path(self.hf_home) / "hub"
        models_info = []
        all_ready = True

        for model_id, label in MODELS:
            downloaded = _is_model_downloaded(hub_dir, model_id)
            size_mb = _get_model_size_mb(hub_dir, model_id) if downloaded else 0

            if not downloaded:
                all_ready = False

            models_info.append({
                "name": model_id,
                "label": label,
                "downloaded": downloaded,
                "size_mb": size_mb,
            })

        return {
            "models_ready": all_ready,
            "models": models_info,
            "downloading": self._downloading,
        }

    async def get_cache_info(self) -> dict[str, Any]:
        """Gibt Informationen ueber den Model-Cache zurueck."""
        hub_dir = Path(self.hf_home) / "hub"
        models_info = []

        total_size_bytes = 0
        if hub_dir.exists():
            total_size_bytes = sum(
                f.stat().st_size for f in hub_dir.rglob("*") if f.is_file()
            )
            for model_id, _label in MODELS:
                size_mb = _get_model_size_mb(hub_dir, model_id)
                models_info.append({"name": model_id, "size_mb": size_mb})

        try:
            Path(self.hf_home).mkdir(parents=True, exist_ok=True)
            disk = shutil.disk_usage(self.hf_home)
            free_space_mb = int(disk.free / (1024 * 1024))
        except Exception:
            free_space_mb = 0

        return {
            "cache_path": self.hf_home,
            "total_size_mb": int(total_size_bytes / (1024 * 1024)),
            "free_space_mb": free_space_mb,
            "models": models_info,
        }

    async def clear_cache(self) -> dict[str, Any]:
        """Loescht den Model-Cache (hub/-Verzeichnis)."""
        hub_dir = Path(self.hf_home) / "hub"

        if not hub_dir.exists():
            return {"erfolg": True, "nachricht": "Model-Cache war bereits leer"}

        try:
            await asyncio.to_thread(shutil.rmtree, str(hub_dir))
            logger.info("Model-Cache geloescht: %s", hub_dir)
            return {"erfolg": True, "nachricht": "Model-Cache geloescht"}
        except Exception as exc:
            logger.error("Fehler beim Loeschen des Model-Cache: %s", exc)
            return {"erfolg": False, "nachricht": f"Fehler: {exc}"}

    async def detect_gpu(self) -> dict[str, Any]:
        """Erkennt GPU via nvidia-smi und torch.cuda."""
        from paragraf.config import settings as app_settings

        nvidia_smi_available = False
        cuda_available = False
        gpu_name = ""
        vram_total_mb = 0

        try:
            output = await asyncio.to_thread(
                subprocess.check_output,
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
            lines = output.decode("utf-8", errors="replace").strip().splitlines()
            if lines:
                parts = lines[0].split(",")
                if len(parts) >= 2:
                    gpu_name = parts[0].strip()
                    try:
                        vram_total_mb = int(parts[1].strip())
                    except ValueError:
                        vram_total_mb = 0
                nvidia_smi_available = True
                cuda_available = True
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            pass

        try:
            import torch

            if torch.cuda.is_available():
                cuda_available = True
                if not gpu_name:
                    gpu_name = torch.cuda.get_device_name(0)
                if not vram_total_mb:
                    vram_total_mb = int(
                        torch.cuda.get_device_properties(0).total_memory / 1024 / 1024
                    )
        except Exception:
            pass

        return {
            "nvidia_smi_available": nvidia_smi_available,
            "cuda_available": cuda_available,
            "gpu_name": gpu_name,
            "vram_total_mb": vram_total_mb,
            "current_device": app_settings.embedding_device,
        }
