# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pip dependencies into /install
COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application source
COPY src/ src/
COPY scripts/ scripts/

# Create cache directories
RUN mkdir -p /models /data

# Environment defaults
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/models \
    TORCH_HOME=/models/torch \
    QDRANT_URL=http://qdrant:6333 \
    QDRANT_COLLECTION=paragraf \
    EMBEDDING_MODEL=BAAI/bge-m3 \
    EMBEDDING_DEVICE=cpu \
    EMBEDDING_BATCH_SIZE=8 \
    EMBEDDING_MAX_LENGTH=512 \
    RERANKER_MODEL=BAAI/bge-reranker-v2-m3 \
    RERANKER_TOP_K=5 \
    RETRIEVAL_TOP_K=20 \
    FINAL_TOP_K=5 \
    SIMILARITY_THRESHOLD=0.35 \
    LOG_LEVEL=INFO \
    DATA_DIR=/data \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["python", "-m", "paragraf", "--mode", "api", "--port", "8000"]
