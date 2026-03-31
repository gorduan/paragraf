"""Tests fuer den ModelManager Service."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from paragraf.services.model_manager import ModelManager


class TestModelManagerStatus:
    """Tests fuer get_model_status()."""

    async def test_get_model_status_empty(self, tmp_path: Path) -> None:
        """Mit leerem Verzeichnis gibt es keine heruntergeladenen Modelle."""
        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.get_model_status()

        assert result["models_ready"] is False
        assert len(result["models"]) == 2
        assert all(not m["downloaded"] for m in result["models"])
        assert all(m["size_mb"] == 0 for m in result["models"])
        assert result["downloading"] is False

    async def test_get_model_status_with_models(self, tmp_path: Path) -> None:
        """Gefundene safetensors-Dateien werden als heruntergeladen erkannt."""
        # Fake Cache-Struktur anlegen
        hub = tmp_path / "hub"
        for model_id in ["BAAI/bge-m3", "BAAI/bge-reranker-v2-m3"]:
            safe_name = model_id.replace("/", "--")
            model_dir = hub / f"models--{safe_name}" / "snapshots" / "abc123"
            model_dir.mkdir(parents=True)
            # Fake safetensors-Datei (1 MB)
            fake_file = model_dir / "model.safetensors"
            fake_file.write_bytes(b"0" * 1024 * 1024)

        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.get_model_status()

        assert result["models_ready"] is True
        assert all(m["downloaded"] for m in result["models"])
        assert all(m["size_mb"] > 0 for m in result["models"])

    async def test_get_model_status_partial(self, tmp_path: Path) -> None:
        """Nur teilweise heruntergeladene Modelle -> models_ready=False."""
        hub = tmp_path / "hub"
        # Nur erstes Modell
        safe_name = "BAAI/bge-m3".replace("/", "--")
        model_dir = hub / f"models--{safe_name}" / "snapshots" / "abc123"
        model_dir.mkdir(parents=True)
        (model_dir / "model.safetensors").write_bytes(b"0" * 1024 * 1024)

        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.get_model_status()

        assert result["models_ready"] is False
        assert result["models"][0]["downloaded"] is True
        assert result["models"][1]["downloaded"] is False


class TestModelManagerCache:
    """Tests fuer get_cache_info() und clear_cache()."""

    async def test_get_cache_info(self, tmp_path: Path) -> None:
        """Cache-Info enthaelt Pfad, Groessen und freien Speicher."""
        hub = tmp_path / "hub"
        for model_id in ["BAAI/bge-m3", "BAAI/bge-reranker-v2-m3"]:
            safe_name = model_id.replace("/", "--")
            model_dir = hub / f"models--{safe_name}"
            model_dir.mkdir(parents=True)
            (model_dir / "data.bin").write_bytes(b"0" * 512 * 1024)  # 512 KB

        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.get_cache_info()

        assert result["cache_path"] == str(tmp_path)
        assert result["total_size_mb"] >= 1  # 2 x 512KB = 1MB
        assert result["free_space_mb"] > 0
        assert len(result["models"]) == 2

    async def test_get_cache_info_empty_dir(self, tmp_path: Path) -> None:
        """Leeres Verzeichnis -> total_size_mb=0."""
        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.get_cache_info()

        assert result["cache_path"] == str(tmp_path)
        assert result["total_size_mb"] == 0
        assert result["free_space_mb"] > 0

    async def test_clear_cache(self, tmp_path: Path) -> None:
        """clear_cache() loescht das hub/-Verzeichnis."""
        hub = tmp_path / "hub"
        hub.mkdir()
        subdir = hub / "models--BAAI--bge-m3"
        subdir.mkdir()
        (subdir / "test.bin").write_bytes(b"test")

        assert hub.exists()

        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.clear_cache()

        assert result["erfolg"] is True
        assert not hub.exists()

    async def test_clear_cache_empty(self, tmp_path: Path) -> None:
        """clear_cache() auf leerem Verzeichnis gibt keinen Fehler."""
        manager = ModelManager(hf_home=str(tmp_path))
        result = await manager.clear_cache()

        assert result["erfolg"] is True
        assert "leer" in result["nachricht"].lower()


class TestModelManagerGpu:
    """Tests fuer detect_gpu()."""

    async def test_detect_gpu_no_nvidia(self, tmp_path: Path) -> None:
        """Ohne GPU: nvidia_smi=False, cuda=False."""
        import sys
        import types

        # Torch-Modul mocken falls nicht installiert
        fake_cuda = MagicMock()
        fake_cuda.is_available.return_value = False
        fake_torch = types.ModuleType("torch")
        fake_torch.cuda = fake_cuda  # type: ignore[attr-defined]

        with (
            patch(
                "paragraf.services.model_manager.subprocess.check_output",
                side_effect=FileNotFoundError("nvidia-smi not found"),
            ),
            patch.dict(sys.modules, {"torch": fake_torch}),
        ):
            manager = ModelManager(hf_home=str(tmp_path))
            result = await manager.detect_gpu()

        assert result["nvidia_smi_available"] is False
        assert result["cuda_available"] is False
        assert result["gpu_name"] == ""
        assert result["vram_total_mb"] == 0
        assert "current_device" in result

    async def test_detect_gpu_with_nvidia_smi(self, tmp_path: Path) -> None:
        """Mit nvidia-smi: Werte werden korrekt geparst."""
        import sys
        import types

        mock_output = b"NVIDIA GeForce RTX 3080, 10240\n"

        # Torch-Modul mocken
        fake_cuda = MagicMock()
        fake_cuda.is_available.return_value = False  # torch nicht benutzt wenn nvidia-smi da
        fake_torch = types.ModuleType("torch")
        fake_torch.cuda = fake_cuda  # type: ignore[attr-defined]

        with (
            patch(
                "paragraf.services.model_manager.subprocess.check_output",
                return_value=mock_output,
            ),
            patch.dict(sys.modules, {"torch": fake_torch}),
        ):
            manager = ModelManager(hf_home=str(tmp_path))
            result = await manager.detect_gpu()

        assert result["nvidia_smi_available"] is True
        assert result["cuda_available"] is True
        assert "RTX 3080" in result["gpu_name"]
        assert result["vram_total_mb"] == 10240


class TestModelManagerDownload:
    """Tests fuer den Download-Mechanismus."""

    async def test_download_lock_prevents_concurrent(self, tmp_path: Path) -> None:
        """Gleichzeitige Downloads werden mit Fehlermeldung abgewiesen."""
        manager = ModelManager(hf_home=str(tmp_path))

        # Lock manuell acquiren um einen laufenden Download zu simulieren
        await manager._download_lock.acquire()
        try:
            events = []
            async for event in manager.download_models():
                events.append(event)
        finally:
            manager._download_lock.release()

        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "laeuft bereits" in events[0]["message"]

    def _make_hf_mock(self) -> MagicMock:
        """Erstellt ein Mock-huggingface_hub Modul."""
        import sys
        import types

        fake_hf = types.ModuleType("huggingface_hub")
        fake_hf.list_repo_files = MagicMock(return_value=[])  # type: ignore[attr-defined]
        fake_hf.hf_hub_download = MagicMock(return_value="/tmp/fake")  # type: ignore[attr-defined]
        fake_hf.snapshot_download = MagicMock(return_value="/tmp/fake")  # type: ignore[attr-defined]
        return fake_hf

    async def test_download_includes_disk_check(self, tmp_path: Path) -> None:
        """Download beginnt mit Festplatten-Check."""
        import sys

        manager = ModelManager(hf_home=str(tmp_path))
        fake_hf = self._make_hf_mock()

        with patch.dict(sys.modules, {"huggingface_hub": fake_hf}):
            events = []
            async for event in manager.download_models():
                events.append(event)

        event_types = [e["type"] for e in events]
        assert "disk_check" in event_types
        assert events[0]["type"] == "disk_check"

    async def test_download_all_complete_event(self, tmp_path: Path) -> None:
        """Nach erfolgreichem Download wird all_complete gesendet."""
        import sys

        manager = ModelManager(hf_home=str(tmp_path))
        fake_hf = self._make_hf_mock()

        with patch.dict(sys.modules, {"huggingface_hub": fake_hf}):
            events = []
            async for event in manager.download_models():
                events.append(event)

        assert events[-1]["type"] == "all_complete"

    async def test_download_start_events_per_model(self, tmp_path: Path) -> None:
        """Fuer jedes Modell wird ein start-Event gesendet."""
        import sys

        manager = ModelManager(hf_home=str(tmp_path))
        fake_hf = self._make_hf_mock()

        with patch.dict(sys.modules, {"huggingface_hub": fake_hf}):
            events = []
            async for event in manager.download_models():
                events.append(event)

        start_events = [e for e in events if e["type"] == "start"]
        assert len(start_events) == 2
        model_names = [e["model"] for e in start_events]
        assert "BAAI/bge-m3" in model_names
        assert "BAAI/bge-reranker-v2-m3" in model_names
