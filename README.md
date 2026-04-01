# Paragraf

Durchsuche 95+ deutsche und europaeische Gesetze mit KI-gestuetzter Suche -- lokal auf deinem Rechner, ohne Cloud.

**Status: 0.9-beta**

---

## Was brauche ich?

- Einen Computer mit **Windows 10/11**, **macOS 12+** oder **Linux**
- Mindestens **8 GB RAM** und **10 GB freien Speicherplatz**
- **Docker Desktop** (kostenlos) -- wird fuer die Datenbank und die KI-Modelle benoetigt

> **Was ist Docker Desktop?** Ein Programm, das die Datenbank und die KI-Modelle von Paragraf im Hintergrund ausfuehrt. Du musst Docker nur installieren und starten -- Paragraf kuemmert sich um den Rest.

---

## Installation

### Schritt 1: Docker Desktop installieren

Docker Desktop wird benoetigt, damit Paragraf funktioniert. Die Installation ist kostenlos.

**Windows:**
1. Gehe zu https://www.docker.com/products/docker-desktop/
2. Klicke auf "Download for Windows"
3. Fuehre die heruntergeladene `.exe`-Datei aus
4. Folge dem Installations-Assistenten (Standardeinstellungen sind in Ordnung)
5. Starte den Computer neu, falls gefragt
6. Starte Docker Desktop -- warte bis das Symbol in der Taskleiste (unten rechts) **gruen** wird

**macOS:**
1. Gehe zu https://www.docker.com/products/docker-desktop/
2. Klicke auf "Download for Mac" (die Seite erkennt automatisch ob du einen Intel- oder Apple-Silicon-Mac hast)
3. Oeffne die heruntergeladene `.dmg`-Datei
4. Ziehe das Docker-Symbol in den Programme-Ordner
5. Starte Docker Desktop aus dem Programme-Ordner
6. Warte bis das Symbol in der Menueleiste (oben rechts) **gruen** wird

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```
Danach ausloggen und wieder einloggen, damit die Aenderung wirksam wird.

---

### Schritt 2: Paragraf herunterladen und installieren

Lade die passende Datei fuer dein Betriebssystem herunter:

| Betriebssystem | Download-Link | Dateityp |
|----------------|---------------|----------|
| **Windows** (64-Bit) | [Paragraf-Setup-0.9.0-beta-win-x64.exe](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-Setup-0.9.0-beta-win-x64.exe) | Installer (.exe) |
| **macOS** (Intel-Prozessor) | [Paragraf-0.9.0-beta-mac-x64.dmg](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-mac-x64.dmg) | Disk Image (.dmg) |
| **macOS** (Apple Silicon M1/M2/M3/M4) | [Paragraf-0.9.0-beta-mac-arm64.dmg](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-mac-arm64.dmg) | Disk Image (.dmg) |
| **Linux** (64-Bit) | [AppImage](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-linux-x64.AppImage) oder [.deb](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-linux-x64.deb) | AppImage oder Debian-Paket |

> **Welchen Mac habe ich?** Klicke oben links auf das Apple-Symbol > "Ueber diesen Mac". Steht dort "Apple M1/M2/M3/M4"? Dann nimm **Apple Silicon**. Steht dort "Intel"? Dann nimm **Intel**.

**Windows -- so installierst du die Datei:**
1. Doppelklick auf die heruntergeladene `.exe`-Datei
2. Falls Windows warnt "Der Computer wurde durch Windows geschuetzt": Klicke auf "Weitere Informationen" > "Trotzdem ausfuehren" (die App ist nicht signiert, aber sicher)
3. Waehle den Installationsordner (oder lasse den Standard)
4. Setze einen Haken bei "Desktop-Verknuepfung erstellen" wenn gewuenscht
5. Klicke auf "Installieren"

**macOS -- so installierst du die Datei:**
1. Doppelklick auf die heruntergeladene `.dmg`-Datei
2. Es oeffnet sich ein Fenster -- ziehe das Paragraf-Symbol auf den Programme-Ordner
3. Oeffne Paragraf aus dem Programme-Ordner (Finder > Programme > Paragraf)
4. Falls macOS warnt "Paragraf kann nicht geoeffnet werden": Gehe zu Systemeinstellungen > Datenschutz & Sicherheit > klicke auf "Trotzdem oeffnen"

**Linux (AppImage) -- so installierst du die Datei:**
```bash
# Datei ausfuehrbar machen
chmod +x Paragraf-0.9.0-beta-linux-x64.AppImage

# Starten
./Paragraf-0.9.0-beta-linux-x64.AppImage
```

**Linux (Debian/Ubuntu) -- so installierst du die Datei:**
```bash
sudo dpkg -i Paragraf-0.9.0-beta-linux-x64.deb
```
Danach findest du Paragraf im Anwendungsmenue.

---

### Schritt 3: Paragraf einrichten

Beim ersten Start fuehrt dich ein Setup-Wizard durch die Einrichtung:

1. **Docker-Pruefung** -- Paragraf prueft ob Docker Desktop laeuft. Falls nicht, wirst du aufgefordert es zu starten.
2. **Speicherpfad** -- Wo sollen die KI-Modelle gespeichert werden? Der Standardpfad ist in Ordnung.
3. **GPU-Einstellung** -- Falls du eine NVIDIA-Grafikkarte hast, kannst du GPU-Beschleunigung aktivieren. Wenn du unsicher bist, lass es aus -- es funktioniert auch ohne.
4. **Fertig** -- Paragraf laedt die KI-Modelle herunter (~4 GB, nur beim ersten Mal) und startet.

> **Der erste Start dauert laenger** (5-15 Minuten), weil die KI-Modelle heruntergeladen werden. Danach startet Paragraf in 15-30 Sekunden.

---

### Schritt 4: Gesetze laden

Nach dem Start musst du mindestens ein Gesetz indexieren, bevor du suchen kannst:

1. Oeffne die Seite "Index-Verwaltung" in der App
2. Waehle ein Gesetz aus (z.B. "SGB IX")
3. Klicke auf "Indexieren"
4. Warte bis der Fortschrittsbalken fertig ist (1-5 Minuten pro Gesetz)

Danach kannst du auf der Suchseite Fragen eingeben, z.B. "Kuendigungsschutz bei Schwerbehinderung".

---

## Fuer Entwickler

Entwickler koennen Paragraf auch ohne die Desktop-App per Docker Compose starten:

```bash
git clone https://github.com/gorduan/paragraf.git
cd paragraf
docker compose up --build
```

- Web-App: http://localhost:3847
- REST-API: http://localhost:3847/api/health
- MCP-Server: http://localhost:8001/mcp

Weitere Dokumentation:
- [Ausfuehrliche Installationsanleitung](INSTALLATION.md) -- Docker-Setup, GPU, lokale Entwicklung, Troubleshooting
- [REST-API-Referenz](API.md) -- Alle Endpoints mit curl-Beispielen
- [MCP-Integration](MCP.md) -- Setup fuer Claude Desktop/Code, alle 14 MCP-Tools

---

## Haeufige Probleme

| Problem | Loesung |
|---------|---------|
| "Docker nicht gefunden" | Docker Desktop installieren und starten. Warten bis das Symbol gruen wird. |
| Erster Start dauert sehr lange | Normal -- KI-Modelle (~4 GB) werden heruntergeladen. Nur beim ersten Mal. |
| App startet, aber Suche findet nichts | Mindestens ein Gesetz indexieren (Seite "Index-Verwaltung"). |
| Windows: "Der Computer wurde geschuetzt" | Auf "Weitere Informationen" > "Trotzdem ausfuehren" klicken. |
| macOS: "App kann nicht geoeffnet werden" | Systemeinstellungen > Datenschutz & Sicherheit > "Trotzdem oeffnen". |
| Nicht genug Arbeitsspeicher | Docker Desktop > Einstellungen > Ressourcen > Speicher auf mindestens 8 GB setzen. |

Mehr Hilfe: [INSTALLATION.md](INSTALLATION.md#troubleshooting)

---

## Was ist Paragraf technisch?

Paragraf ist eine lokale Anwendung mit KI-gestuetzter Hybrid-Suche (semantisch + woertlich) ueber deutsche Gesetze. Die Suchergebnisse werden durch ein zweites KI-Modell (Cross-Encoder) nach Relevanz sortiert.

| Komponente | Technologie |
|------------|-------------|
| Desktop-App | Electron 41 |
| Backend | Python 3.12, FastAPI |
| MCP-Server | FastMCP (14 Tools fuer Claude/GPT) |
| Web-Frontend | React 19, TailwindCSS |
| Datenbank | Qdrant v1.13.2 (Vektordatenbank) |
| KI-Modelle | BAAI/bge-m3 + bge-reranker-v2-m3 |

Die eigentliche Staerke liegt im **MCP-Server**: Jedes MCP-kompatible LLM (Claude, GPT, etc.) erhaelt damit Zugriff auf eine strukturierte Gesetzes-Datenbank -- statt auf unstrukturierte Websuche angewiesen zu sein.

---

## Rechtlicher Hinweis

Paragraf ist **kein** Rechtsberatungsdienst im Sinne des Rechtsdienstleistungsgesetzes (RDG). Die bereitgestellten Informationen sind allgemeine Rechtsinformationen und ersetzen keine individuelle Rechtsberatung. Bei konkreten Rechtsfragen wenden Sie sich an einen Rechtsanwalt oder eine [EUTB-Beratungsstelle](https://www.teilhabeberatung.de) (Tel: 0800 11 10 111).

## Lizenz

Gesetzestexte sind gemeinfrei (Paragraph 5 UrhG). Der Quellcode dieses Projekts steht unter der MIT-Lizenz.
