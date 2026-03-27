"""Tests fuer MCP Prompt-Templates."""

from __future__ import annotations


class TestPromptModuleImport:
    """Tests dass das Prompts-Modul korrekt importiert werden kann."""

    def test_import_register_prompts(self):
        from paragraf.prompts import register_prompts
        assert callable(register_prompts)

    def test_register_prompts_does_not_raise(self):
        from mcp.server.fastmcp import FastMCP

        from paragraf.prompts import register_prompts

        mcp = FastMCP("test-prompts")
        register_prompts(mcp)


class TestMultiHopPrompts:
    """Tests fuer die drei neuen Multi-Hop Prompt-Templates."""

    def _get_registered_mcp(self):
        from mcp.server.fastmcp import FastMCP

        from paragraf.prompts import register_prompts

        mcp = FastMCP("test-prompts")
        register_prompts(mcp)
        return mcp

    def test_legal_analysis_registered(self):
        """paragraf_legal_analysis ist registriert und enthaelt paragraf_search."""
        mcp = self._get_registered_mcp()
        # Access prompt manager to find the registered prompt
        prompt_mgr = mcp._prompt_manager
        prompt = prompt_mgr._prompts.get("paragraf_legal_analysis")
        assert prompt is not None, "paragraf_legal_analysis not registered"
        result = prompt.fn(thema="GdB")
        assert "paragraf_search" in result

    def test_norm_chain_registered(self):
        """paragraf_norm_chain ist registriert und enthaelt paragraf_references."""
        mcp = self._get_registered_mcp()
        prompt_mgr = mcp._prompt_manager
        prompt = prompt_mgr._prompts.get("paragraf_norm_chain")
        assert prompt is not None, "paragraf_norm_chain not registered"
        result = prompt.fn(start_paragraph="152", start_gesetz="SGB IX")
        assert "paragraf_references" in result

    def test_compare_areas_registered(self):
        """paragraf_compare_areas ist registriert und enthaelt paragraf_search."""
        mcp = self._get_registered_mcp()
        prompt_mgr = mcp._prompt_manager
        prompt = prompt_mgr._prompts.get("paragraf_compare_areas")
        assert prompt is not None, "paragraf_compare_areas not registered"
        result = prompt.fn(thema="Eingliederungshilfe")
        assert "paragraf_search" in result
