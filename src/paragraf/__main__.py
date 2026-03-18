"""Entry Point – startet den Paragraf MCP-Server."""

from __future__ import annotations

import logging
import sys

from paragraf.config import settings
from paragraf.server import create_server

logger = logging.getLogger(__name__)


def main() -> None:
    """Startet den Paragraf MCP-Server."""
    server = create_server()

    transport = settings.mcp_transport
    logger.info("Starte Paragraf MCP-Server (Transport: %s)", transport)

    try:
        if transport == "streamable-http":
            server.run(
                transport="streamable-http",
                host=settings.mcp_host,
                port=settings.mcp_port,
            )
        else:
            server.run(transport="stdio")
    except Exception:
        logger.exception("Server-Fehler")
        sys.exit(1)


if __name__ == "__main__":
    main()
