#!/usr/bin/env python3
"""
Optionaler Pre-Download der ML-Modelle.
Kann vor dem ersten Container-Start ausgefuehrt werden,
um die Modelle im Volume vorzuladen.

Usage:
    docker compose run --rm backend python scripts/download_models.py
"""

import os
import sys


def main():
    hf_home = os.environ.get("HF_HOME", "/models")
    os.environ["HF_HOME"] = hf_home
    os.environ.setdefault("TORCH_HOME", os.path.join(hf_home, "torch"))

    print(f"HF_HOME={hf_home}")
    print("Lade Embedding-Modell (BAAI/bge-m3)...")

    from FlagEmbedding import BGEM3FlagModel

    model = BGEM3FlagModel(
        "BAAI/bge-m3",
        use_fp16=True,
    )
    del model
    print("Embedding-Modell geladen.")

    print("Lade Reranker-Modell (BAAI/bge-reranker-v2-m3)...")
    from sentence_transformers import CrossEncoder

    reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")
    del reranker
    print("Reranker-Modell geladen.")

    print("Alle Modelle erfolgreich heruntergeladen!")


if __name__ == "__main__":
    main()
