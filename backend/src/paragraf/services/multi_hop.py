"""Multi-Hop Suche -- Verkettung von Suche und Querverweis-Traversal."""

from __future__ import annotations

import logging

from paragraf.config import settings
from paragraf.models.law import SearchFilter
from paragraf.services.qdrant_store import QdrantStore
from paragraf.services.reranker import RerankerService
from paragraf.services.query_expander import QueryExpander

logger = logging.getLogger(__name__)


class MultiHopService:
    """Orchestriert mehrstufige Suche mit Querverweis-Traversal."""

    def __init__(
        self,
        qdrant: QdrantStore,
        reranker: RerankerService,
        query_expander: QueryExpander,
    ) -> None:
        self.qdrant = qdrant
        self.reranker = reranker
        self.query_expander = query_expander

    async def search_with_hops(
        self,
        query: str,
        tiefe: int = 1,
        max_per_hop: int = 5,
        search_filter: SearchFilter | None = None,
        expand: bool = True,
    ) -> dict:
        """Sucht, folgt Querverweisen, sucht weiter.

        Returns dict with keys: query, expanded_terms, hops, results, total, visited_paragraphs
        """
        # Clamp tiefe to settings max
        tiefe = min(tiefe, settings.multi_hop_max_depth)

        # Query expansion
        expanded_terms: list[str] = []
        search_query = query
        if expand and settings.query_expansion_enabled:
            search_query, expanded_terms = self.query_expander.expand(query)

        visited: set[str] = set()  # "gesetz_paragraph" keys for circular detection
        all_results: list[dict] = []  # HopResultItem dicts

        # Hop 0: Initial search
        initial_results = await self.qdrant.hybrid_search(
            search_query, top_k=max_per_hop, search_filter=search_filter
        )
        # Rerank initial results
        if initial_results and self.reranker:
            initial_results = await self.reranker.arerank(query, initial_results, top_k=max_per_hop)

        for r in initial_results:
            key = f"{r.chunk.metadata.gesetz}_{r.chunk.metadata.paragraph}"
            if key in visited:
                continue
            visited.add(key)
            all_results.append({
                "paragraph": r.chunk.metadata.paragraph,
                "gesetz": r.chunk.metadata.gesetz,
                "titel": r.chunk.metadata.titel,
                "text": r.chunk.text[:500],
                "score": r.score,
                "hop": 0,
                "via_reference": None,
            })

        # Subsequent hops: follow references
        actual_hops = 0
        current_hop_results = initial_results
        for hop_num in range(1, tiefe + 1):
            next_hop_results = []
            for r in current_hop_results[:3]:  # Limit to top 3 per hop
                gesetz = r.chunk.metadata.gesetz
                paragraph = r.chunk.metadata.paragraph
                try:
                    refs = await self.qdrant.get_outgoing_references(gesetz, paragraph)
                except Exception:
                    logger.warning("Querverweise fuer %s %s nicht abrufbar", paragraph, gesetz)
                    continue

                for ref in refs[:3]:  # Limit refs followed per result
                    ref_key = f"{ref['gesetz']}_{ref['paragraph']}"
                    if ref_key in visited:
                        logger.debug("Zirkulaerer Querverweis erkannt: %s", ref_key)
                        continue
                    visited.add(ref_key)

                    # Search for the referenced paragraph
                    ref_filter = SearchFilter(gesetz=ref["gesetz"])
                    ref_results = await self.qdrant.hybrid_search(
                        ref["paragraph"], top_k=1, search_filter=ref_filter
                    )
                    for rr in ref_results:
                        via = f"{ref.get('raw', ref['paragraph'] + ' ' + ref['gesetz'])}"
                        all_results.append({
                            "paragraph": rr.chunk.metadata.paragraph,
                            "gesetz": rr.chunk.metadata.gesetz,
                            "titel": rr.chunk.metadata.titel,
                            "text": rr.chunk.text[:500],
                            "score": rr.score,
                            "hop": hop_num,
                            "via_reference": via,
                        })
                        next_hop_results.append(rr)

            actual_hops = hop_num
            current_hop_results = next_hop_results
            if not current_hop_results:
                break  # No more results to follow

        return {
            "query": query,
            "expanded_terms": expanded_terms,
            "hops": actual_hops,
            "results": all_results,
            "total": len(all_results),
            "visited_paragraphs": list(visited),
        }
