# Paragraf

RAG-basierte Rechtsrecherche fuer deutsches und europaeisches Recht.

**Status: 0.9-beta** -- Feature-complete fuer den Kernbereich (Hybrid-Suche, Querverweise, Reranking). API kann sich noch aendern.

## Was ist Paragraf?

Paragraf ist eine lokale Anwendung, die 95+ deutsche und europaeische Gesetze als Vektordatenbank vorhaelt und per Hybrid-Search (Dense + Sparse Vektoren) mit Cross-Encoder Reranking durchsuchbar macht.

Die eigentliche Staerke liegt im **MCP-Server**: Jedes MCP-kompatible LLM (Claude, GPT, etc.) erhaelt Zugriff auf eine strukturierte Gesetzes-Datenbank mit Querverweisen -- statt auf unstrukturierte Websuche angewiesen zu sein. Das Web-Frontend dient als Demo-Oberflaeche.

## Schnellstart

```bash
git clone https://github.com/your-username/paragraf.git
cd paragraf
docker compose up --build
```

- Web-App: http://localhost:3847
- API: http://localhost:3847/api/health
- MCP: http://localhost:8001/mcp

Ausfuehrliche Anleitung: [INSTALLATION.md](INSTALLATION.md)

## Architektur

| Komponente | Technologie | Funktion |
|------------|-------------|----------|
| Backend | Python 3.12, FastAPI | REST-API, ML-Pipeline (Embedding, Reranking) |
| MCP-Server | FastMCP | MCP-Protokoll fuer LLM-Integration (14 Tools) |
| Frontend | React 19, Vite, TailwindCSS | Demo-Oberflaeche (Web-App) |
| Vektordatenbank | Qdrant v1.13.2 | Hybrid-Search (Dense + Sparse mit RRF-Fusion) |
| ML-Modelle | BAAI/bge-m3, bge-reranker-v2-m3 | Embedding (1024-dim) + Cross-Encoder Reranking |

Deployment: Docker Compose (4 Services: qdrant, backend, mcp, frontend)

## Dokumentation

- [Installationsanleitung](INSTALLATION.md) -- Docker-Setup, GPU-Konfiguration, lokale Entwicklung, Troubleshooting
- [REST-API-Referenz](API.md) -- Alle Endpoints mit curl-Beispielen
- [MCP-Integration](MCP.md) -- Setup fuer Claude Desktop/Code, alle 14 MCP-Tools mit Beispiel-Prompts

## Ehrliche Einschaetzung

**Was funktioniert gut:**
- Hybrid-Search mit RRF-Fusion findet relevante Paragraphen zuverlaessig
- Querverweise zwischen Gesetzen werden automatisch erkannt und verfolgt
- MCP-Integration gibt LLMs direkten Zugriff auf strukturierte Gesetzestexte
- 95+ Gesetze verfuegbar (SGB I-XIV, BGG, AGG, BGB, StGB, GG, EU-Recht, etc.)

**Was man wissen sollte:**
- Die Suche ist gruendlich, nicht schnell (mehrere Sekunden pro Anfrage durch Reranking)
- Das Frontend ist eine Demo-Oberflaeche, kein ausgereiftes Produkt
- ML-Modelle brauchen ca. 4 GB RAM und ca. 4 GB Festplatte
- Erster Start dauert laenger (Modell-Download)

## Rechtlicher Hinweis

Paragraf ist **kein** Rechtsberatungsdienst im Sinne des Rechtsdienstleistungsgesetzes (RDG). Die bereitgestellten Informationen sind allgemeine Rechtsinformationen und ersetzen keine individuelle Rechtsberatung. Bei konkreten Rechtsfragen wenden Sie sich an einen Rechtsanwalt oder eine [EUTB-Beratungsstelle](https://www.teilhabeberatung.de) (Tel: 0800 11 10 111).

## Lizenz

Gesetzestexte sind gemeinfrei (Paragraph 5 UrhG). Der Quellcode dieses Projekts steht unter der MIT-Lizenz.
