FROM python:3.12-slim

WORKDIR /app

# System-Dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# uv installieren
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Dependencies zuerst (Docker Layer Caching)
COPY pyproject.toml .
RUN uv venv && uv pip install -e ".[compression]"

# Quellcode
COPY src/ src/
COPY scripts/ scripts/

# Datenverzeichnis
RUN mkdir -p data/raw data/processed

# Nicht als Root laufen
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Health-Check Endpoint (nur bei HTTP-Transport)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/mcp || exit 1

# Standardmaessig stdio-Transport
CMD ["uv", "run", "python", "-m", "paragraf"]
