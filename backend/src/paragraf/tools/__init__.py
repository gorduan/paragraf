"""MCP Tools – die Werkzeuge, die das LLM aufrufen kann."""

from paragraf.tools.ingest import register_ingest_tools
from paragraf.tools.lookup import register_lookup_tools
from paragraf.tools.search import register_search_tools

__all__ = ["register_search_tools", "register_lookup_tools", "register_ingest_tools"]
