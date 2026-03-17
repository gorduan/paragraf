"""Entry Point – startet den Paragraf MCP-Server."""

from __future__ import annotations

from paragraf.config import settings
from paragraf.server import create_server


def main() -> None:
    """Startet den Paragraf MCP-Server."""
    server = create_server()

    if settings.mcp_transport == "streamable-http":
        server.run(
            transport="streamable-http",
            host=settings.mcp_host,
            port=settings.mcp_port,
        )
    else:
        server.run(transport="stdio")


if __name__ == "__main__":
    main()
