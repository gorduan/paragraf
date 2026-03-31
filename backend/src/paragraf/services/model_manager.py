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

# Dateiendungen die als grosse Modelldateien gelten
LARGE_FILE_EXTENSIONS = {".safetensors", ".bin", ".model"}

# Wiederholungsversuche und Backoff
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [2.0, 4.0, 8.0]


class ModelManager:
    """Verwaltet den Download, Status und Cache von ML-Modellen.

    Verwendet hf_hub_download() per Datei (nicht snapshot_download) fuer
    echten Byte-Level-Fortschritt beim Download.
    """

    def __init__(self, hf_home: str | None = None) -> None:
        self.hf_home = hf_home or os.environ.get("HF_HOME", "/models")
        self._download_lock = asyncio.Lock()
        self._downloading = False

    async def download_models(self) -> AsyncIterator[dict[str, Any]]:
        """Laedt alle ML-Modelle herunter und streamt SSE-Events.

        Yields dicts mit type-Feld:
        - disk_check: Festplattenspeicher-Pruefung
        - disk_warning: Zu wenig Speicher (nur Warnung, kein Abbruch)
        - start: Beginn eines Modell-Downloads
        - progress: Fortschritt in Bytes
        - retry: Wiederholungsversuch
        - complete: Modell vollstaendig heruntergeladen
        - error: Fehler beim Download
        - all_complete: Alle Modelle fertig
        """
        if self._download_lock.locked():
            yield {"type": "error", "message": "Download laeuft bereits"}
            return

        # Lock manuell acquiren um async generator mit Lock zu kombinieren
        await self._download_lock.acquire()
        self._downloading = True
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

            # Jedes Modell herunterladen
            for model_id, label in MODELS:
                yield {"type": "start", "model": model_id, "label": label}

                success = False
                last_error: str = ""

                for attempt in range(1, MAX_RETRIES + 1):
                    try:
                        async for event in self._download_model_with_progress(model_id):
                            yield event
                            if event.get("type") == "complete":
                                success = True
                                break
                        if success:
                            break
                    except Exception as exc:
                        last_error = str(exc)

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
            self._download_lock.release()

    async def _download_model_with_progress(
        self, model_id: str
    ) -> AsyncIterator[dict[str, Any]]:
        """Download eines einzelnen Modells mit Byte-Level-Fortschritt.

        Verwendet hf_hub_download() pro Datei fuer echten Fortschritt.
        """
        import huggingface_hub

        # Alle Dateien des Repos ermitteln
        all_files: list[str] = list(
            await asyncio.to_thread(huggingface_hub.list_repo_files, model_id)
        )

        # Grosse Dateien filtern
        large_files = [
            f for f in all_files
            if Path(f).suffix in LARGE_FILE_EXTENSIONS
        ]

        total_downloaded = 0
        total_estimated = 0

        for filename in large_files:
            file_start = time.monotonic()

            # Download der Datei
            result_path = await asyncio.to_thread(
                huggingface_hub.hf_hub_download,
                repo_id=model_id,
                filename=filename,
                cache_dir=self.hf_home,
            )

            # Dateigröße nach Download ermitteln
            file_bytes = Path(result_path).stat().st_size if result_path else 0
            elapsed = time.monotonic() - file_start
            total_downloaded += file_bytes
            total_estimated += file_bytes

            speed_mbps = (file_bytes / (1024 * 1024)) / max(elapsed, 0.001)
            remaining_files = len(large_files) - (large_files.index(filename) + 1)
            eta_seconds = int(remaining_files * elapsed) if remaining_files > 0 else 0

            yield {
                "type": "progress",
                "model": model_id,
                "downloaded_bytes": total_downloaded,
                "total_bytes": total_estimated,
                "speed_mbps": round(speed_mbps, 2),
                "eta_seconds": eta_seconds,
            }

        # Kleine Config-Dateien per snapshot_download nachladen (schnell, da grosse schon da)
        try:
            await asyncio.to_thread(
                huggingface_hub.snapshot_download,
                model_id,
                cache_dir=self.hf_home,
            )
        except Exception as exc:
            logger.warning("snapshot_download fuer %s fehlgeschlagen: %s", model_id, exc)

        yield {"type": "complete", "model": model_id}

    async def get_model_status(self) -> dict[str, Any]:
        """Gibt den Status aller ML-Modelle zurueck.

        Prueft ob Modell-Verzeichnisse mit .safetensors-Dateien existieren.
        """
        hub_dir = Path(self.hf_home) / "hub"
        models_info = []
        all_ready = True

        for model_id, label in MODELS:
            # HuggingFace speichert Modelle als models--org--name
            safe_name = model_id.replace("/", "--")
            model_dir = hub_dir / f"models--{safe_name}"

            downloaded = False
            size_mb = 0

            if model_dir.exists():
                # Suche nach Modelldateien als Indikator fuer kompletten Download
                model_files = (
                    list(model_dir.rglob("*.safetensors"))
                    or list(model_dir.rglob("*.bin"))
                )
                if model_files:
                    downloaded = True
                    # Gesamtgroesse berechnen
                    total_bytes = sum(
                        f.stat().st_size for f in model_dir.rglob("*") if f.is_file()
                    )
                    size_mb = int(total_bytes / (1024 * 1024))

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
        """Gibt Informationen ueber den Model-Cache zurueck.

        Berechnet Gesamtgroesse und freien Speicherplatz.
        """
        hub_dir = Path(self.hf_home) / "hub"
        models_info = []

        # Gesamtgroesse des Hub-Verzeichnisses
        total_size_bytes = 0
        if hub_dir.exists():
            total_size_bytes = sum(
                f.stat().st_size for f in hub_dir.rglob("*") if f.is_file()
            )
            # Pro-Modell-Groessen
            for model_id, _label in MODELS:
                safe_name = model_id.replace("/", "--")
                model_dir = hub_dir / f"models--{safe_name}"
                size_mb = 0
                if model_dir.exists():
                    size_bytes = sum(
                        f.stat().st_size for f in model_dir.rglob("*") if f.is_file()
                    )
                    size_mb = int(size_bytes / (1024 * 1024))
                models_info.append({"name": model_id, "size_mb": size_mb})

        # Freier Speicher
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
        """Loescht den Model-Cache (hub/-Verzeichnis).

        Returns:
            dict mit erfolg und nachricht.
        """
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
        """Erkennt GPU via nvidia-smi und torch.cuda.

        Versucht zuerst nvidia-smi, dann torch.cuda als Fallback.
        """
        from paragraf.config import settings as app_settings

        nvidia_smi_available = False
        cuda_available = False
        gpu_name = ""
        vram_total_mb = 0

        # nvidia-smi pruefen
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
                cuda_available = True  # nvidia-smi vorhanden impliziert CUDA-faehige GPU
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            pass

        # torch.cuda als Fallback / zusaetzliche Bestaetigung
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
