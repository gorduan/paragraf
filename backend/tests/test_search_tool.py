"""Tests fuer paragraf_search MCP Tool -- Suchmodus und Absatz-Parameter."""

from __future__ import annotations

import inspect


class TestSearchToolSignature:
    """Verifies paragraf_search MCP tool has the expected parameters."""

    def _get_source(self) -> str:
        import paragraf.tools.search as mod
        return inspect.getsource(mod)

    def test_tool_has_suchmodus_parameter(self):
        source = self._get_source()
        assert "suchmodus" in source

    def test_tool_has_absatz_parameters(self):
        source = self._get_source()
        assert "absatz_von" in source
        assert "absatz_bis" in source

    def test_mode_map_covers_all_modes(self):
        source = self._get_source()
        assert "semantisch" in source
        assert "volltext" in source
        assert "hybrid" in source

    def test_deduplicate_results_exists(self):
        source = self._get_source()
        assert "_deduplicate_results" in source

    def test_fulltext_skips_reranking(self):
        """Verify fulltext branch calls fulltext_search (per D-02)."""
        source = self._get_source()
        assert "qdrant.fulltext_search" in source

    def test_suchmodus_default_is_semantisch(self):
        """Verify default suchmodus is 'semantisch'."""
        source = self._get_source()
        assert 'suchmodus: str = "semantisch"' in source

    def test_docstring_describes_volltext(self):
        """Verify docstring documents volltext mode."""
        source = self._get_source()
        assert "'volltext' (exakte Begriffe" in source
