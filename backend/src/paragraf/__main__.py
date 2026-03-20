"""Entry Point – startet den Paragraf MCP-Server oder die REST-API."""

from __future__ import annotations

import argparse
import logging
import sys

from paragraf.config import settings

logger = logging.getLogger(__name__)


def main() -> None:
    """Startet den Paragraf-Server im gewaehlten Modus."""
    parser = argparse.ArgumentParser(description="Paragraf – MCP-Server fuer deutsches Recht")
    parser.add_argument(
        "--mode", choices=["mcp", "api"], default="mcp",
        help="Startmodus: 'mcp' (MCP-Server, Standard) oder 'api' (REST-API fuer Desktop-App)",
    )
    parser.add_argument("--host", default=settings.mcp_host, help="Host (nur API-Modus)")
    parser.add_argument("--port", type=int, default=settings.mcp_port, help="Port (nur API-Modus)")
    args = parser.parse_args()

    if args.mode == "api":
        _run_api(args.host, args.port)
    else:
        _run_mcp()


def _run_mcp() -> None:
    """Startet den MCP-Server (stdio oder streamable-http)."""
    from paragraf.server import create_server

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
        logger.exception("MCP-Server-Fehler")
        sys.exit(1)


def _run_api(host: str, port: int) -> None:
    """Startet die FastAPI REST-API mit Uvicorn."""
    import uvicorn

    from paragraf.api import create_api

    logger.info("Starte Paragraf REST-API auf %s:%d", host, port)

    app = create_api()
    try:
        uvicorn.run(app, host=host, port=port, log_level=settings.log_level.lower())
    except Exception:
        logger.exception("API-Server-Fehler")
        sys.exit(1)


if __name__ == "__main__":
    main()
