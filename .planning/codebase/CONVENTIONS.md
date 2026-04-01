---
generated: 2026-03-27
focus: quality
status: current
---

# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

**Python Files:**
- snake_case for all module files: `embedding.py`, `qdrant_store.py`, `eurlex_parser.py`
- Test files prefixed with `test_`: `test_config.py`, `test_embedding.py`, `test_parser.py`
- Models in dedicated directory: `backend/src/paragraf/models/law.py`

**TypeScript/React Files:**
- PascalCase for components and pages: `SearchPage.tsx`, `ResultCard.tsx`, `HealthOverlay.tsx`
- camelCase for utility/hook files: `useApi.ts`, `useHealthCheck.ts`, `api.ts`
- Config files use dot notation: `vite.config.ts`, `tsconfig.json`

**Python Functions/Variables:**
- snake_case for functions and variables: `encode_dense()`, `hybrid_search()`, `parse_xml()`
- Private methods prefixed with underscore: `_load_model()`, `_build_filter()`, `_normalize_abkuerzung()`
- Constants in UPPER_SNAKE_CASE: `DENSE_VECTOR_NAME`, `SPARSE_VECTOR_NAME`, `LAW_REGISTRY`

**TypeScript Functions/Variables:**
- camelCase for functions and variables: `fetchJson()`, `handleSearch()`, `setResults()`
- PascalCase for React components: `SearchPage`, `ResultCard`, `HealthOverlay`
- PascalCase for TypeScript interfaces/types: `SearchRequest`, `HealthResponse`, `SearchResultItem`

**Python Classes:**
- PascalCase: `EmbeddingService`, `QdrantStore`, `RerankerService`, `GesetzParser`
- Test classes prefixed with `Test`: `TestSettings`, `TestGesetzParser`, `TestEmbeddingService`

**Python Types:**
- PascalCase for Pydantic models: `LawChunk`, `ChunkMetadata`, `SearchResult`, `SearchFilter`
- PascalCase for dataclasses: `AppContext`, `LawDefinition`
- PascalCase for enums: `Gesetzbuch` (uses `StrEnum`)

**Domain-specific naming:**
- German terms for domain models (law-specific fields): `gesetz`, `paragraph`, `abschnitt`, `titel`, `rechtsgebiet`
- English for technical/infrastructure names: `embedding`, `reranker`, `parser`, `client`
- API field names use German where user-facing: `anfrage`, `gesetzbuch`, `nachricht`, `erfolg`

## Code Style

**Python Formatting:**
- Linter: Ruff (configured in `backend/pyproject.toml`)
- Target: Python 3.12
- Line length: 100 characters
- Ruff rules enabled: `E` (pycodestyle errors), `F` (pyflakes), `I` (isort), `N` (pep8-naming), `W` (warnings), `UP` (pyupgrade), `B` (bugbear), `SIM` (simplify)
- Test files exempt from E501 (long lines allowed for XML strings)

**TypeScript Formatting:**
- No ESLint or Prettier configured (relies on TypeScript compiler strict checks)
- TypeScript strict mode enabled in `frontend/tsconfig.json`
- Target: ES2022

**Python Type Hints:**
- `from __future__ import annotations` at top of every Python file (PEP 604 style)
- Use `str | None` instead of `Optional[str]`
- Use `list[str]` instead of `List[str]`
- Mypy configured in strict mode (`backend/pyproject.toml`: `strict = true`)
- Return type annotations on all public methods
- Parameter type annotations on all functions

**TypeScript Strict Mode:**
- `strict: true` in `frontend/tsconfig.json`
- Explicit interface definitions for all API types in `frontend/src/lib/api.ts`
- Props interfaces defined inline above components

## Import Organization

**Python Import Order:**
1. `from __future__ import annotations` (always first)
2. Standard library imports (`pathlib`, `logging`, `asyncio`, `re`, `json`)
3. Third-party imports (`pydantic`, `fastapi`, `qdrant_client`, `mcp`)
4. Local imports (`from paragraf.config import settings`, `from paragraf.models.law import ...`)

**Python Import Style:**
- Use `from` imports for specific items: `from paragraf.models.law import LawChunk, SearchResult`
- Use module-level logger: `logger = logging.getLogger(__name__)`
- Lazy imports for heavy dependencies (torch, FlagEmbedding) inside methods

**TypeScript Import Order:**
1. React imports: `import React, { useState, useEffect } from "react"`
2. Third-party imports: `import { Loader } from "lucide-react"`
3. Local component imports: `import { SearchBar } from "../components/SearchBar"`
4. Type imports: `import type { SearchResultItem } from "../lib/api"`

**Path Aliases:**
- TypeScript: `@/*` maps to `src/*` (configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`)
- Python: standard package imports via `paragraf.*` namespace

## Error Handling

**Python Backend Patterns:**
- Service methods raise descriptive exceptions with German messages: `raise RuntimeError("Nicht verbunden – await connect() aufrufen")`
- FastAPI validation errors caught via custom exception handler returning structured JSON with German error messages in `backend/src/paragraf/api.py`
- Try/except with specific exception types: `except httpx.HTTPError`, `except ImportError`
- Logger-based error reporting: `logger.exception("Fehler beim Laden der ML-Modelle")`
- Graceful degradation pattern: embedding service falls back from FlagEmbedding to sentence-transformers on ImportError

**TypeScript Frontend Patterns:**
- Try/catch in async handlers with error state: `setError(e.message || "Suche fehlgeschlagen")`
- Generic `useApi<T>` hook (`frontend/src/hooks/useApi.ts`) manages `{ data, loading, error }` state
- API client throws on non-OK responses: `throw new Error("API Fehler: ${res.status} ${res.statusText}")`
- Error messages displayed in German via `role="alert"` elements

**SSE Stream Error Handling:**
- `asyncio.CancelledError` and `GeneratorExit` caught separately for client disconnect scenarios
- Keepalive mechanism prevents proxy timeout during long operations (`backend/src/paragraf/api.py` lines 744-773)

## Logging

**Framework:** Python standard `logging` module (not structlog, despite being a dependency)

**Initialization:**
- `logging.basicConfig()` in `create_api()` function in `backend/src/paragraf/api.py`
- Format: `"%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"`
- Date format: `"%H:%M:%S"`
- Log level configurable via `settings.log_level`

**Patterns:**
- Module-level logger: `logger = logging.getLogger(__name__)` at top of each service module
- Use `logger.info()` for startup/lifecycle events: `"=== Paragraf REST-API startet ==="`
- Use `logger.warning()` for recoverable issues: `"Count-Abfrage fuer %s fehlgeschlagen: %s"`
- Use `logger.error()` for connection failures: `"Qdrant nicht erreichbar: %s"`
- Use `logger.exception()` for unexpected errors (includes traceback): `"Fehler beim Laden der ML-Modelle"`
- Use %-style formatting (not f-strings) in log calls for lazy evaluation

**Frontend:**
- `console.error()` for API stream errors only
- No structured logging framework

## Comments

**Python Docstrings:**
- German language docstrings on all classes and public methods
- Triple-quote style: `"""Beschreibung."""`
- Module-level docstrings at top of every file: `"""Embedding-Service – BAAI/bge-m3 fuer Dense + Sparse Vektoren."""`
- Technical details in docstrings explain design decisions (e.g., why ColBERT is not used)

**Section Markers:**
- Heavy use of ASCII section markers in Python and TypeScript:
  ```python
  # ── Qdrant ──────────────────────────────────────────────
  # ── Embedding ───────────────────────────────────────────
  ```
- Same pattern in TypeScript:
  ```typescript
  // ── Contexts ─────────────────────────────────────────────────────────────────
  // ── App ──────────────────────────────────────────────────────────────────────
  ```

**Inline Comments:**
- German for domain-specific explanations: `# Finde Paragraph 1`
- German for test descriptions: `"""Neue Gesetzesabkuerzungen werden korrekt erkannt."""`
- `# noqa:` annotations for intentional linting exceptions: `# noqa: ANN001`

**JSDoc/TSDoc:**
- JSDoc block comment on `frontend/src/lib/api.ts` only
- Not used systematically in frontend code

## Function Design

**Async Patterns (Python):**
- All service methods that touch I/O are `async`: `async def connect()`, `async def hybrid_search()`
- CPU-bound work offloaded to threads via `asyncio.to_thread()` or `asyncio.get_event_loop().run_in_executor()`
- Background initialization pattern: `asyncio.create_task(_init_models())` for non-blocking startup
- `AsyncIterator` for streaming responses (SSE)

**Async Patterns (TypeScript):**
- `async/await` for API calls in event handlers
- SSE streaming via manual ReadableStream consumption in `api.indexGesetze()`

**React Component Patterns:**
- Function components only (no class components)
- Named exports for components: `export function SearchPage()`
- Default export only for `App` component: `export default function App()`
- Props interfaces defined directly above the component
- Hooks for shared stateful logic: `useApi<T>()`, `useHealthCheck()`
- Context API for cross-cutting state: `ThemeContext`, `BookmarkContext`

**Parameter Patterns (Python):**
- Keyword arguments with defaults for service constructors
- Pydantic `Field()` with `description` for API models
- `Literal` types for constrained strings: `Literal["stdio", "streamable-http"]`

## Module Design

**Python Exports:**
- `__init__.py` contains only `__version__`
- No barrel files; import directly from specific modules
- Services are classes instantiated in lifespan handlers

**TypeScript Exports:**
- Named exports for components and hooks
- `api` object exported as a namespace from `frontend/src/lib/api.ts`
- Types co-located with API client (interfaces in same file as fetch functions)
- Context exports from `App.tsx`: `ThemeContext`, `BookmarkContext`

**Barrel Files:**
- Not used in either Python or TypeScript

## Git Conventions

**Branch Policy:**
- All commits and pushes go directly to `main`

**Commit Messages:**
- Mix of English and German commit messages
- Prefix patterns observed: `fix:`, `Add`, `Fix`
- Recent examples: `"Fix .gitignore: data/ rule..."`, `"fix: SSE-Stream-Abbruch bei Indexierung..."`

## Accessibility Conventions (Frontend)

**ARIA:**
- `role="status"` and `aria-live="polite"` on loading indicators
- `role="alert"` on error messages
- `aria-label` on sections and main content area
- `aria-hidden="true"` on decorative icons
- Live region for page change announcements

**CSS:**
- Skip-link pattern in `frontend/src/styles/index.css`
- `prefers-reduced-motion` media query disables animations
- `prefers-contrast: more` media query enhances contrast
- Focus-visible outlines on interactive elements (3px solid primary-500)
- `.sr-only` class for screen-reader-only content

**Keyboard:**
- Ctrl+1 through Ctrl+7 keyboard shortcuts for page navigation
- Focus management on page change via `mainRef.current?.focus()`

## Pydantic Conventions

**Model Style:**
- Inherit from `BaseModel` for API request/response models (in `backend/src/paragraf/api_models.py`)
- Inherit from `BaseModel` for domain models (in `backend/src/paragraf/models/law.py`)
- Use `BaseSettings` with `SettingsConfigDict` for configuration (in `backend/src/paragraf/config.py`)
- Use `@dataclass` for simple data containers: `AppContext`, `LawDefinition`
- Use `Field()` with `description` for API documentation
- Use `Field(default_factory=list)` for mutable defaults

**Validation:**
- `Field(ge=1, le=20)` for numeric range constraints
- `Field(min_length=2, max_length=5)` for list length constraints
- German description strings in Field annotations

---

*Convention analysis: 2026-03-27*
