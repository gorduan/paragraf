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
