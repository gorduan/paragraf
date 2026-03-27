---
generated: 2026-03-27
focus: quality
status: current
---

# Testing Patterns

**Analysis Date:** 2026-03-27

## Test Framework

**Runner:**
- pytest >= 8.0.0 (dev dependency in `backend/pyproject.toml`)
- pytest-asyncio >= 0.23.0 (for async test support)
- Config: `backend/pyproject.toml` section `[tool.pytest.ini_options]`

**Assertion Library:**
- Built-in `assert` statements (pytest native assertions)
- `pytest.raises()` for exception testing

**Run Commands:**
```bash
# Run all tests inside Docker
docker compose exec backend python -m pytest tests/ -v

# Run all tests locally (from backend/ directory)
cd backend && python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_parser.py -v

# Run a specific test class
python -m pytest tests/test_models.py::TestChunkMetadata -v
```

## Test File Organization

**Location:**
- All backend tests in a separate `backend/tests/` directory (not co-located with source)
- No frontend tests exist

**Naming:**
- `test_*.py` prefix for all test files
- `conftest.py` for shared fixtures

**Structure:**
```
backend/
├── tests/
│   ├── conftest.py              # Shared fixtures (sample_chunk, sample_results, data_dir)
│   ├── test_config.py           # Settings/configuration tests
│   ├── test_embedding.py        # EmbeddingService unit tests
│   ├── test_eurlex_parser.py    # EUR-Lex HTML parser tests
│   ├── test_integration.py      # Multi-component integration tests
│   ├── test_law_registry.py     # LAW_REGISTRY data integrity tests
│   ├── test_models.py           # Pydantic model validation tests
│   ├── test_parser.py           # XML parser tests
│   ├── test_prompts.py          # MCP prompt module tests
│   ├── test_qdrant_store.py     # QdrantStore unit tests (mocked)
│   └── test_reranker.py         # RerankerService unit tests
└── src/paragraf/
    └── ...
```

## Test Structure

**Suite Organization:**
```python
"""Tests fuer den XML-Parser."""

from __future__ import annotations

from paragraf.services.parser import GesetzParser

# Inline test data as module-level constants
SAMPLE_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<dokumente>...</dokumente>
""".encode()


class TestGesetzParser:
    """Tests fuer das XML-Parsing."""

    def setup_method(self):
        self.parser = GesetzParser()

    def test_parse_xml_returns_chunks(self):
        chunks = self.parser.parse_xml(SAMPLE_XML)
        assert len(chunks) >= 2
        assert all(c.text for c in chunks)
```

**Patterns:**
- Test classes group related tests using `class Test*:` pattern
- `setup_method(self)` for per-test instance setup (not `setUp` or fixtures for simple cases)
- German docstrings on test classes: `"""Tests fuer die Pydantic-Settings-Konfiguration."""`
- German docstrings on tests that need explanation: `"""Neue Gesetzesabkuerzungen werden korrekt erkannt."""`
- Module-level docstrings describe the test scope
- Test method names use `test_` prefix with descriptive snake_case

**Async Test Pattern:**
```python
import pytest
from unittest.mock import AsyncMock

class TestQdrantStore:
    @pytest.mark.asyncio
    async def test_upsert_empty_chunks(self):
        store = QdrantStore()
        count = await store.upsert_chunks([])
        assert count == 0
```

Note: `asyncio_mode = "auto"` is set in `backend/pyproject.toml`, so `@pytest.mark.asyncio` is technically optional but still used explicitly in some tests.

## Mocking

**Framework:** `unittest.mock` (standard library)

**Patterns:**
```python
from unittest.mock import AsyncMock

class TestQdrantStore:
    @pytest.mark.asyncio
    async def test_get_collection_info_error(self):
        store = QdrantStore()
        mock_client = AsyncMock()
        mock_client.get_collection.side_effect = Exception("Not found")
        store._client = mock_client
        info = await store.get_collection_info()
        assert "error" in info

    @pytest.mark.asyncio
    async def test_close_resets_client(self):
        store = QdrantStore()
        store._client = AsyncMock()
        await store.close()
        assert store._client is None
```

**What to Mock:**
- External service clients (Qdrant async client via `AsyncMock`)
- ML models are NOT loaded in unit tests (services test initialization params only)

**What NOT to Mock:**
- Pydantic model creation and validation
- Parser logic (tested with inline XML/HTML samples)
- Pure functions like `long_context_reorder()`, `_normalize_abkuerzung()`
- Reranker fallback behavior (tested without loaded model)

## Fixtures and Factories

**Shared Fixtures (in `backend/tests/conftest.py`):**
```python
@pytest.fixture
def sample_chunk() -> LawChunk:
    """Ein Beispiel-LawChunk fuer Tests."""
    return LawChunk(
        id="SGB_IX_§152",
        text="§ 152 SGB IX – Feststellung der Behinderung\n\nAuf Antrag...",
        metadata=ChunkMetadata(
            gesetz="SGB IX",
            paragraph="§ 152",
            absatz=None,
            titel="Feststellung der Behinderung, Ausweise",
            abschnitt="Teil 3 – Schwerbehindertenrecht",
            hierarchie_pfad="SGB IX > Teil 3 > § 152",
            norm_id="BJNR323410016BJNE015201126",
            quelle="gesetze-im-internet.de",
            chunk_typ="paragraph",
        ),
    )

@pytest.fixture
def sample_results() -> list[SearchResult]:
    """Beispiel-Suchergebnisse fuer Tests."""
    # Generates 5 results with decreasing scores

@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """Temporaeres Datenverzeichnis."""
    raw = tmp_path / "raw"
    processed = tmp_path / "processed"
    raw.mkdir()
    processed.mkdir()
    return tmp_path
```

**Inline Test Data:**
- XML test data as module-level byte strings: `SAMPLE_XML` in `backend/tests/test_parser.py`
- HTML test data as module-level strings: `SAMPLE_EURLEX_HTML` in `backend/tests/test_eurlex_parser.py`
- Helper factory functions for creating test objects: `_make_result()` in `backend/tests/test_reranker.py`

**Factory Pattern:**
```python
def _make_result(rank: int, score: float, text: str = "text") -> SearchResult:
    """Erzeugt ein Test-SearchResult."""
    return SearchResult(
        chunk=LawChunk(
            id=f"test_{rank}",
            text=text,
            metadata=ChunkMetadata(gesetz="SGB IX", paragraph=f"§ {rank}"),
        ),
        score=score,
        rank=rank,
    )
```

## Coverage

**Requirements:** No coverage targets enforced
**Coverage tool:** Not configured (no pytest-cov in dependencies)

## Test Types

**Unit Tests (majority):**
- Service initialization and configuration: `test_config.py`, `test_embedding.py`
- Pydantic model creation and validation: `test_models.py`
- Pure function behavior: `test_reranker.py` (long_context_reorder), `test_parser.py` (normalization)
- Filter construction: `test_qdrant_store.py` (_build_filter)
- Data integrity: `test_law_registry.py` (registry completeness, no duplicates)
- Module import verification: `test_prompts.py`

**Integration Tests:**
- Parser-to-chunk pipeline: `test_integration.py::TestParsingPipeline`
- Reranker-to-reorder pipeline: `test_integration.py::TestRerankerPipeline`
- Filter-to-registry consistency: `test_integration.py::TestSearchFilter`
- Note: These are "lightweight integration" tests -- they test multiple components together but do NOT require running services (Qdrant, ML models)

**E2E Tests:**
- Not present. No browser-based or full-stack tests exist.
- No Playwright, Cypress, or similar frameworks configured

**API Tests:**
- Not present. No FastAPI TestClient tests exist for REST endpoints.

## Testing Strategy Notes

**What IS well-tested:**
- Pydantic model validation and defaults (`test_models.py`, `test_config.py`)
- XML/HTML parsing with inline sample data (`test_parser.py`, `test_eurlex_parser.py`)
- Law registry data integrity and consistency (`test_law_registry.py`)
- Service initialization parameters (`test_embedding.py`, `test_reranker.py`, `test_qdrant_store.py`)
- Filter construction logic (`test_qdrant_store.py`)

**What is NOT tested:**
- FastAPI REST endpoints (no TestClient usage)
- Frontend code (zero frontend tests)
- Actual embedding generation (requires GPU/model download)
- Actual Qdrant queries (requires running Qdrant instance)
- SSE streaming behavior
- Docker compose integration
- nginx proxy routing

## CI/CD Pipeline

**CI Pipeline:** Not configured. No `.github/workflows/`, no CI config files detected.

**Pre-commit hooks:** Not configured. No `.pre-commit-config.yaml` detected.

**Static Analysis Tools (available but no CI enforcement):**
- Ruff (Python linting): `ruff >= 0.4.0` in dev dependencies
- Mypy (Python type checking): `mypy >= 1.10.0` in dev dependencies, strict mode enabled
- TypeScript compiler (`tsc`): strict mode, run as part of `npm run build`

## Adding New Tests

**For a new Python service:**
1. Create `backend/tests/test_<service_name>.py`
2. Add module docstring in German: `"""Tests fuer den <Service>."""`
3. Group tests in `class Test<ServiceName>:`
4. Use `setup_method(self)` for shared setup
5. For async tests, use `@pytest.mark.asyncio` decorator
6. Mock external clients with `AsyncMock`

**For a new Pydantic model:**
1. Add tests to `backend/tests/test_models.py` or create a new file
2. Test defaults, required fields, validation constraints
3. Use inline construction (no fixtures needed for simple models)

**For integration tests:**
1. Add to `backend/tests/test_integration.py` or create new `test_integration_<area>.py`
2. Use inline sample data (XML, HTML) as module-level constants
3. Test component pipelines without external services

---

*Testing analysis: 2026-03-27*
