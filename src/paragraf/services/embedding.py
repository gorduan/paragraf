"""Embedding-Service – BAAI/bge-m3 fuer Dense + Sparse Vektoren."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Erzeugt Dense- und Sparse-Embeddings mit BAAI/bge-m3.

    bge-m3 liefert in einem Forward-Pass:
      - Dense: 1024-dim CLS-Token (semantische Aehnlichkeit)
      - Sparse: Lexical Weights (BM25-aehnliche Keyword-Suche)
      - ColBERT: Multi-Vector (nicht verwendet, spart Speicher)
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-m3",
        device: str = "cpu",
        use_fp16: bool = False,
        batch_size: int = 8,
        max_length: int = 512,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.use_fp16 = use_fp16 if device != "cpu" else False
        self.batch_size = batch_size
        self.max_length = max_length
        self._model: Any = None

    async def initialize(self) -> None:
        """Laedt das Modell (lazy, beim ersten Aufruf)."""
        if self._model is not None:
            return
        logger.info("Lade Embedding-Modell: %s auf %s", self.model_name, self.device)
        try:
            from FlagEmbedding import BGEM3FlagModel

            self._model = BGEM3FlagModel(
                self.model_name,
                use_fp16=self.use_fp16,
                device=self.device,
            )
            logger.info("Embedding-Modell geladen (%s)", self.model_name)
        except ImportError:
            logger.warning(
                "FlagEmbedding nicht installiert – Fallback auf sentence-transformers"
            )
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name, device=self.device)
            logger.info("Fallback-Modell geladen via sentence-transformers")

    @property
    def is_bge_m3(self) -> bool:
        """Prueft ob das native bge-m3 Modell (mit Sparse-Support) geladen ist."""
        try:
            from FlagEmbedding import BGEM3FlagModel
            return isinstance(self._model, BGEM3FlagModel)
        except ImportError:
            return False

    def encode_dense(self, texts: list[str]) -> list[list[float]]:
        """Erzeugt Dense-Vektoren (1024-dim)."""
        if self._model is None:
            raise RuntimeError("Modell nicht initialisiert – await initialize() aufrufen")

        if self.is_bge_m3:
            output = self._model.encode(
                texts,
                batch_size=self.batch_size,
                max_length=self.max_length,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            )
            return output["dense_vecs"].tolist()
        else:
            # Fallback sentence-transformers
            embeddings = self._model.encode(
                texts,
                batch_size=self.batch_size,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return embeddings.tolist()

    def encode_dense_and_sparse(
        self, texts: list[str]
    ) -> tuple[list[list[float]], list[dict[str, Any]]]:
        """Erzeugt Dense + Sparse Vektoren in einem Pass.

        Returns:
            Tuple von (dense_vectors, sparse_vectors).
            sparse_vectors: Liste von {token_id: weight} Dicts.
        """
        if self._model is None:
            raise RuntimeError("Modell nicht initialisiert – await initialize() aufrufen")

        if not self.is_bge_m3:
            # Fallback: nur Dense, leere Sparse
            dense = self.encode_dense(texts)
            sparse = [{} for _ in texts]
            return dense, sparse

        output = self._model.encode(
            texts,
            batch_size=self.batch_size,
            max_length=self.max_length,
            return_dense=True,
            return_sparse=True,
            return_colbert_vecs=False,
        )

        dense_vecs = output["dense_vecs"].tolist()
        sparse_vecs = output["lexical_weights"]

        return dense_vecs, sparse_vecs

    def encode_query(self, query: str) -> tuple[list[float], dict[str, Any]]:
        """Erzeugt Dense + Sparse fuer eine einzelne Query."""
        dense_list, sparse_list = self.encode_dense_and_sparse([query])
        return dense_list[0], sparse_list[0]

    @staticmethod
    def sparse_to_qdrant(lexical_weights: dict) -> tuple[list[int], list[float]]:
        """Konvertiert bge-m3 Sparse-Output -> Qdrant SparseVector Format.

        Args:
            lexical_weights: Dict {token_id_str: weight} von bge-m3

        Returns:
            (indices, values) – passend fuer qdrant_client.models.SparseVector
        """
        if not lexical_weights:
            return [], []
        indices = [int(idx) for idx in lexical_weights]
        values = [float(val) for val in lexical_weights.values()]
        return indices, values

    @property
    def dimension(self) -> int:
        """Vektor-Dimension des Modells."""
        return 1024 if "bge-m3" in self.model_name else 768
