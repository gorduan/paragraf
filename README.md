# Paragraf

RAG-basierte Rechtsrecherche fuer deutsches und europaeisches Recht.

**Status: 0.9-beta** -- Feature-complete fuer den Kernbereich (Hybrid-Suche, Querverweise, Reranking). API kann sich noch aendern.

## Was ist Paragraf?

Paragraf ist eine lokale Anwendung, die 95+ deutsche und europaeische Gesetze als Vektordatenbank vorhaelt und per Hybrid-Search (Dense + Sparse Vektoren) mit Cross-Encoder Reranking durchsuchbar macht.

Die eigentliche Staerke liegt im **MCP-Server**: Jedes MCP-kompatible LLM (Claude, GPT, etc.) erhaelt Zugriff auf eine strukturierte Gesetzes-Datenbank mit Querverweisen -- statt auf unstrukturierte Websuche angewiesen zu sein.

## Zwei Wege, Paragraf zu nutzen

| Variante | Fuer wen | Was wird benoetigt |
|----------|----------|-------------------|
| **Desktop-App** (empfohlen) | Endnutzer ohne CLI-Kenntnisse | Windows-Installer (`Paragraf-Setup-0.9.0-beta.exe`), Docker Desktop |
| **Docker Compose** | Entwickler, Linux/macOS-Nutzer | Git, Docker, Terminal |

Die Desktop-App ist ein Electron-Wrapper, der Docker im Hintergrund verwaltet -- mit grafischem Setup-Wizard, automatischer GPU-Erkennung und Modell-Download. Unter der Haube laufen dieselben Docker-Services.

## Schnellstart

### Desktop-App (Windows, macOS, Linux)

1. Installer von der [Releases-Seite](https://github.com/gorduan/paragraf/releases) herunterladen
2. [Docker Desktop](https://www.docker.com/products/docker-desktop/) installieren und starten
3. Installer ausfuehren
4. Setup-Wizard folgen (Docker-Erkennung, Speicherpfad, GPU-Auswahl)
5. Paragraf oeffnet sich automatisch

| Plattform | Datei |
|-----------|-------|
| Windows (x64) | `Paragraf-Setup-*-win-x64.exe` |
| macOS (Intel) | `Paragraf-*-mac-x64.dmg` |
| macOS (Apple Silicon) | `Paragraf-*-mac-arm64.dmg` |
| Linux (x64) | `Paragraf-*-linux-x64.AppImage` oder `.deb` |

### Docker Compose (alle Plattformen)

```bash
git clone https://github.com/gorduan/paragraf.git
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
| Desktop-App | Electron 41 | Grafische Oberflaeche, Docker-Lifecycle, Setup-Wizard |
| Backend | Python 3.12, FastAPI | REST-API, ML-Pipeline (Embedding, Reranking) |
| MCP-Server | FastMCP | MCP-Protokoll fuer LLM-Integration (14 Tools) |
| Web-Frontend | React 19, Vite, TailwindCSS | Browser-Oberflaeche (auch ohne Desktop-App nutzbar) |
| Vektordatenbank | Qdrant v1.13.2 | Hybrid-Search (Dense + Sparse mit RRF-Fusion) |
| ML-Modelle | BAAI/bge-m3, bge-reranker-v2-m3 | Embedding (1024-dim) + Cross-Encoder Reranking |

Deployment: Docker Compose (3 Services: qdrant, backend, mcp) -- die Desktop-App startet und stoppt Docker automatisch.

## Plattform-Unterstuetzung

| Plattform | Desktop-App | Docker Compose |
|-----------|-------------|----------------|
| **Windows 10/11** (x64) | `.exe` (NSIS-Installer) | `docker compose up` |
| **macOS 12+** (Intel) | `.dmg` | `docker compose up` |
| **macOS 12+** (Apple Silicon) | `.dmg` (arm64) | `docker compose up` |
| **Linux** (x64) | `.AppImage` / `.deb` | `docker compose up` |

Alle Installer auf der [Releases-Seite](https://github.com/gorduan/paragraf/releases).

## Dokumentation

- [Installationsanleitung](INSTALLATION.md) -- Desktop-App, Docker-Setup, GPU, plattformspezifische Hinweise, Troubleshooting
- [REST-API-Referenz](API.md) -- Alle Endpoints mit curl-Beispielen
- [MCP-Integration](MCP.md) -- Setup fuer Claude Desktop/Code, alle 14 MCP-Tools mit Beispiel-Prompts

## Ehrliche Einschaetzung

**Was funktioniert gut:**
- Hybrid-Search mit RRF-Fusion findet relevante Paragraphen zuverlaessig
- Querverweise zwischen Gesetzen werden automatisch erkannt und verfolgt
- MCP-Integration gibt LLMs direkten Zugriff auf strukturierte Gesetzestexte
- 95+ Gesetze verfuegbar (SGB I-XIV, BGG, AGG, BGB, StGB, GG, EU-Recht, etc.)
- Desktop-App mit Setup-Wizard macht die Einrichtung unter Windows zugaenglich

**Was man wissen sollte:**
- Die Suche ist gruendlich, nicht schnell (mehrere Sekunden pro Anfrage durch Reranking)
- ML-Modelle brauchen ca. 4 GB RAM und ca. 4 GB Festplatte
- Erster Start dauert laenger (Modell-Download ~4 GB)
- Docker Desktop muss installiert sein -- auch fuer die Desktop-App
- macOS/Linux-Installer existieren noch nicht

## Rechtlicher Hinweis

Paragraf ist **kein** Rechtsberatungsdienst im Sinne des Rechtsdienstleistungsgesetzes (RDG). Die bereitgestellten Informationen sind allgemeine Rechtsinformationen und ersetzen keine individuelle Rechtsberatung. Bei konkreten Rechtsfragen wenden Sie sich an einen Rechtsanwalt oder eine [EUTB-Beratungsstelle](https://www.teilhabeberatung.de) (Tel: 0800 11 10 111).

## Lizenz

Gesetzestexte sind gemeinfrei (Paragraph 5 UrhG). Der Quellcode dieses Projekts steht unter der MIT-Lizenz.
