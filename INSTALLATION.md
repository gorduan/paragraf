# Paragraf -- Installationsanleitung

Paragraf kann auf zwei Wegen installiert werden: als **Desktop-App** (Windows, mit grafischem Installer) oder per **Docker Compose** (Windows, macOS, Linux).

Beide Varianten benoetigen Docker Desktop bzw. Docker Engine -- die Desktop-App verwaltet Docker automatisch im Hintergrund, bei Docker Compose wird es manuell gestartet.

## Voraussetzungen

| Anforderung | Minimum | Empfohlen |
|-------------|---------|-----------|
| Arbeitsspeicher (RAM) | 8 GB | 16 GB |
| Freier Festplattenspeicher | 10 GB | 20 GB |
| Docker Desktop (Windows/macOS) oder Docker Engine (Linux) | 4.x / 24+ | Aktuelle Version |

**Warum 8 GB RAM?** Die ML-Modelle (BAAI/bge-m3 ~2 GB, BAAI/bge-reranker-v2-m3 ~2 GB) werden beim ersten Start in den Speicher geladen. Mit weniger RAM kann es zu Out-of-Memory-Fehlern kommen.

**Warum 10 GB Festplatte?** Docker Images (~3 GB) + ML-Modelle (~4 GB) + Qdrant-Daten (abhaengig von Anzahl indexierter Gesetze).

---

## Variante 1: Desktop-App (Windows)

Die Desktop-App ist ein Electron-basierter Wrapper mit grafischem Setup-Wizard. Sie startet und stoppt Docker im Hintergrund -- ohne dass man ein Terminal oeffnen muss.

### Plattform-Anforderungen

| Anforderung | Details |
|-------------|---------|
| Betriebssystem | Windows 10/11 (x64), macOS 12+ (Intel/Apple Silicon), Linux (x64) |
| Docker Desktop | Muss installiert und gestartet sein |
| Installer | Von der [Releases-Seite](https://github.com/gorduan/paragraf/releases) herunterladen |

### Verfuegbare Installer

| Plattform | Download |
|-----------|----------|
| Windows (x64) | [Paragraf-Setup-0.9.0-beta-win-x64.exe](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-Setup-0.9.0-beta-win-x64.exe) |
| macOS (Intel) | [Paragraf-0.9.0-beta-mac-x64.dmg](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-mac-x64.dmg) |
| macOS (Apple Silicon) | [Paragraf-0.9.0-beta-mac-arm64.dmg](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-mac-arm64.dmg) |
| Linux (x64) | [AppImage](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-linux-x64.AppImage) / [.deb](https://github.com/gorduan/paragraf/releases/download/v0.9.0-beta/Paragraf-0.9.0-beta-linux-x64.deb) |

### Installation

1. **Docker Desktop installieren** (falls noch nicht vorhanden):

   **Windows:**
   - Herunterladen von https://www.docker.com/products/docker-desktop/
   - Installer ausfuehren, Neustart falls noetig
   - Docker Desktop starten und warten bis das Symbol in der Taskleiste gruen wird

   **macOS:**
   - Herunterladen von https://www.docker.com/products/docker-desktop/
   - `.dmg` oeffnen, Docker in den Programme-Ordner ziehen
   - Docker Desktop starten, warten bis das Menueleisten-Symbol gruen wird

   **Linux:**
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install docker.io docker-compose-v2
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER  # Ausloggen/Einloggen noetig
   ```

2. **Installer von der [Releases-Seite](https://github.com/gorduan/paragraf/releases) herunterladen und ausfuehren:**

   **Windows:** `.exe` starten, Installationsordner waehlen, optional Desktop-Verknuepfung erstellen.

   **macOS:** `.dmg` oeffnen, Paragraf in den Programme-Ordner ziehen.

   **Linux (AppImage):** Ausfuehrbar machen und starten:
   ```bash
   chmod +x Paragraf-*-linux-x64.AppImage
   ./Paragraf-*-linux-x64.AppImage
   ```

   **Linux (deb):**
   ```bash
   sudo dpkg -i Paragraf-*-linux-x64.deb
   ```

4. **Setup-Wizard durchlaufen:**
   Der Wizard startet beim ersten Oeffnen der App und fuehrt durch folgende Schritte:
   - **Docker-Erkennung:** Prueft ob Docker Desktop installiert und gestartet ist
   - **Speicherpfad:** Wo ML-Modelle gespeichert werden (Standard: `C:\ProgramData\Paragraf\models`)
   - **GPU-Auswahl:** Falls eine NVIDIA-Grafikkarte erkannt wird, kann GPU-Beschleunigung aktiviert werden
   - **Zusammenfassung:** Uebersicht der gewaehlten Einstellungen

5. **Paragraf startet automatisch:**
   Nach Abschluss des Wizards startet die App die Docker-Container im Hintergrund. Beim ersten Start werden ML-Modelle (~4 GB) heruntergeladen -- das dauert je nach Internetverbindung 5-15 Minuten.

### Desktop-App verwenden

- **Starten:** Paragraf ueber Desktop-Verknuepfung oder Startmenue oeffnen. Die App startet Docker automatisch.
- **Beenden:** App-Fenster schliessen. Docker-Container werden automatisch gestoppt.
- **GPU umschalten:** In der App verfuegbar -- startet die Backend-Container mit GPU-Overlay neu.
- **Modell-Cache loeschen:** In der App verfuegbar -- loescht heruntergeladene ML-Modelle und setzt den Setup-Wizard zurueck.

### Desktop-App deinstallieren

Ueber Windows-Einstellungen > Apps > Paragraf deinstallieren. Die Docker-Volumes (Qdrant-Daten, ML-Modelle) bleiben erhalten. Zum vollstaendigen Entfernen:

```bash
docker compose -f docker-compose.desktop.yml down -v
```

---

## Variante 2: Docker Compose (Windows, macOS, Linux)

Fuer Entwickler und Nutzer auf macOS/Linux. Erfordert Git und ein Terminal.

### Plattform-Anforderungen

| Plattform | Docker | Git | Terminal |
|-----------|--------|-----|----------|
| **Windows 10/11** | Docker Desktop 4.x | Git for Windows | PowerShell / Git Bash |
| **macOS 12+** (Intel/Apple Silicon) | Docker Desktop 4.x | Vorinstalliert oder `xcode-select --install` | Terminal.app |
| **Linux** (Ubuntu 22+, Debian 12+, Fedora 38+) | Docker Engine 24+ + Docker Compose v2 | `apt install git` / `dnf install git` | Beliebig |

### Installation

1. **Docker installieren und starten:**

   **Windows:**
   - Docker Desktop von https://www.docker.com/products/docker-desktop/ herunterladen und installieren
   - Docker Desktop starten, warten bis das Taskleisten-Symbol gruen wird

   **macOS:**
   - Docker Desktop von https://www.docker.com/products/docker-desktop/ herunterladen und installieren
   - Docker Desktop starten, warten bis das Menueleisten-Symbol gruen wird
   - Apple Silicon (M1/M2/M3/M4): Docker Desktop nutzt automatisch ARM-Images wo verfuegbar

   **Linux:**
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install docker.io docker-compose-v2
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER  # Ausloggen/Einloggen noetig
   ```

   ```bash
   # Fedora
   sudo dnf install docker docker-compose-plugin
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   ```

2. **Repository klonen:**

   ```bash
   git clone https://github.com/gorduan/paragraf.git
   cd paragraf
   ```

3. **Environment konfigurieren (optional):**

   ```bash
   cp .env.example .env
   ```

   Die Standardwerte in `docker-compose.yml` funktionieren ohne `.env`-Datei. Nur bei Bedarf anpassen.

4. **Starten:**

   ```bash
   docker compose up --build
   ```

   Beim ersten Start werden Docker-Images gebaut und ML-Modelle heruntergeladen. Das dauert je nach Internetverbindung 5-15 Minuten. Folgestarts sind deutlich kuerzer.

5. **Web-App oeffnen:**

   ```
   http://localhost:3847
   ```

6. **Gesetze indexieren:**

   Ueber die Web-Oberflaeche (Seite "Index-Verwaltung") oder per API:

   ```bash
   curl -X POST http://localhost:3847/api/index \
     -H "Content-Type: application/json" \
     -d '{"gesetzbuch": "SGB IX"}'
   ```

   Die Indexierung laeuft als SSE-Stream mit Fortschrittsanzeige. Pro Gesetz dauert es 1-5 Minuten (abhaengig von Groesse und Hardware).

### Stoppen und Neustarten

```bash
# Stoppen (Daten bleiben erhalten)
docker compose down

# Neustarten
docker compose up

# Stoppen und alle Daten loeschen
docker compose down -v
```

---

## Ports und Services

| Service | Port | URL | Funktion |
|---------|------|-----|----------|
| Frontend (nginx) | 3847 | http://localhost:3847 | Web-App + API-Reverse-Proxy |
| Backend (FastAPI) | 8000 | http://localhost:8000 | REST-API direkt |
| MCP-Server | 8001 | http://localhost:8001/mcp | MCP-Protokoll fuer Claude Desktop/Code |
| Qdrant | 6333 | http://localhost:6333 | Vektordatenbank |

Der Frontend-Service (nginx) leitet alle Anfragen an `/api/*` automatisch an das Backend weiter. Fuer die Nutzung genuegt daher `http://localhost:3847`.

**Hinweis Desktop-App:** Die Desktop-App nutzt `docker-compose.desktop.yml` (ohne Frontend-Service, da Electron die UI bereitstellt). Das Backend ist direkt auf Port 8000 erreichbar.

---

## GPU-Setup (NVIDIA)

GPU-Beschleunigung ist optional, verkuerzt aber die Embedding-Berechnung bei der Indexierung.

### Voraussetzungen

- NVIDIA-Grafikkarte mit CUDA-Unterstuetzung
- Aktuelle NVIDIA-Treiber installiert
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installiert (nur Linux -- Docker Desktop fuer Windows/macOS bringt GPU-Support mit)

### Desktop-App

GPU-Unterstuetzung wird im Setup-Wizard konfiguriert und kann spaeter in der App umgeschaltet werden.

### Docker Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Das GPU-Overlay setzt `EMBEDDING_DEVICE=cuda` und reserviert die GPU fuer den Backend-Container.

### GPU-Erkennung pruefen

```bash
curl -s http://localhost:3847/api/settings/gpu | jq .
```

Erwartete Ausgabe bei erkannter GPU:

```json
{
  "nvidia_smi_available": true,
  "cuda_available": true,
  "gpu_name": "NVIDIA GeForce RTX 3070",
  "vram_total_mb": 8192,
  "current_device": "cuda"
}
```

Wenn `cuda_available` auf `false` steht, ist das NVIDIA Container Toolkit nicht korrekt installiert oder der Treiber veraltet.

---

## Konfiguration

Alle Konfiguration erfolgt ueber Environment-Variablen in `docker-compose.yml` (bzw. `docker-compose.desktop.yml` fuer die Desktop-App). Die Settings-Seite in der Web-App zeigt die aktuelle Konfiguration an, ist aber read-only.

### Wichtige Variablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant-Verbindungs-URL (Docker-intern) |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | Embedding-Modell (nicht aendern) |
| `EMBEDDING_DEVICE` | `cpu` | Geraet fuer Embedding-Berechnung (`cpu` oder `cuda`) |
| `RERANKER_MODEL` | `BAAI/bge-reranker-v2-m3` | Reranker-Modell (nicht aendern) |
| `RERANKER_TOP_K` | `5` | Anzahl Ergebnisse nach Reranking |
| `RETRIEVAL_TOP_K` | `20` | Anzahl Kandidaten vor Reranking |
| `SIMILARITY_THRESHOLD` | `0.35` | Minimaler Relevanz-Score (0-1) |
| `LOG_LEVEL` | `INFO` | Log-Level: DEBUG, INFO, WARNING, ERROR |
| `HF_HOME` | `/models` | Pfad fuer ML-Modell-Cache (im Container) |
| `DATA_DIR` | `/data` | Pfad fuer heruntergeladene Gesetzestexte (im Container) |

Die vollstaendige Liste aller Variablen steht in `.env.example`.

### Daten-Volumes

Docker Compose erstellt drei persistente Volumes:

| Volume | Mount-Pfad | Inhalt |
|--------|-----------|--------|
| `qdrant_data` | `/qdrant/storage` | Qdrant-Datenbank und Snapshots |
| `model_cache` | `/models` | Heruntergeladene ML-Modelle (~4 GB) |
| `law_data` | `/data` | Gesetzestexte als XML/JSON |

Die Volumes bleiben auch nach `docker compose down` erhalten. Zum vollstaendigen Zuruecksetzen:

```bash
docker compose down -v
```

**Desktop-App:** Der Modell-Cache-Pfad wird im Setup-Wizard festgelegt (Standard: `C:\ProgramData\Paragraf\models`). Dieser Pfad wird als Docker-Volume gemountet.

---

## Lokale Entwicklung

Fuer die Entwicklung ohne Docker koennen Backend und Frontend separat gestartet werden. Qdrant muss trotzdem als Container laufen.

### Qdrant starten

```bash
docker compose up qdrant
```

### Backend

Voraussetzung: Python 3.12+

```bash
cd backend
pip install -e ".[dev]"
python -m paragraf --mode api --port 8000
```

Beim ersten Start werden die ML-Modelle (~4 GB) nach `~/.cache/huggingface/` heruntergeladen.

### Web-Frontend

Voraussetzung: Node.js 22+

```bash
cd frontend
npm install
npm run dev
```

Der Vite-Dev-Server laeuft auf `http://localhost:5173` und leitet `/api`-Anfragen automatisch an `http://localhost:8000` weiter (konfiguriert in `vite.config.ts`).

### Desktop-App (Entwicklung)

Voraussetzung: Node.js 22+, Docker Desktop gestartet

```bash
cd desktop
npm install
npm run dev
```

Startet Electron im Entwicklungsmodus. Das Frontend wird per Vite-Dev-Server geladen (`http://localhost:5173`), daher muss das Web-Frontend parallel laufen:

```bash
# Terminal 1: Frontend
cd frontend && npm install && npm run dev

# Terminal 2: Desktop-App
cd desktop && npm install && npm run dev
```

### Desktop-App bauen (Windows-Installer)

```bash
cd desktop
npm run prebuild:dist  # Kompiliert Electron + Frontend
npm run dist           # Erstellt Paragraf-Setup-0.9.0-beta.exe in desktop/release/
```

### Tests ausfuehren

```bash
# Backend (im Docker-Container)
docker compose exec backend python -m pytest tests/ -v

# Backend (lokal)
cd backend && python -m pytest tests/ -v

# Desktop-App
cd desktop && npm test

# Linting und Typpruefung (Backend)
cd backend
ruff check src/
ruff format --check src/
mypy src/paragraf/
```

---

## Troubleshooting

### Port bereits belegt (3847, 8000, 6333)

Ein anderer Prozess nutzt den Port.

**Windows:**
```bash
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**macOS:**
```bash
lsof -i :8000
kill <PID>
```

**Linux:**
```bash
ss -tlnp | grep :8000
kill <PID>
```

Alternativ: Port in `docker-compose.yml` aendern, z.B. `"9000:8000"`.

### Docker nicht gestartet

Fehlermeldung: `Cannot connect to the Docker daemon`

**Windows/macOS:** Docker Desktop starten und warten bis das Symbol gruen wird.

**Linux:**
```bash
sudo systemctl start docker
```

### Desktop-App zeigt "Docker nicht gefunden"

Die Desktop-App prueft Docker in mehreren Stufen:
1. `docker info` (Docker-Daemon laeuft?)
2. `docker --version` (Docker installiert?)
3. Windows-Registry (Docker Desktop installiert aber nicht im PATH?)

**Loesung:** Docker Desktop installieren und starten. Falls installiert aber nicht erkannt: Docker Desktop einmal manuell oeffnen, dann Paragraf neustarten.

### Nicht genug RAM

Fehlermeldung: `Killed` oder `OOMKilled` im Container-Log.

Die ML-Modelle brauchen ~4 GB RAM im Backend-Container.

**Windows/macOS:** Docker Desktop > Settings > Resources > Memory auf mindestens 8 GB setzen.

**Linux:** Docker nutzt den vollen Host-RAM, daher reicht es wenn der Rechner insgesamt 8 GB hat.

### Langsamer erster Start

Der erste Start dauert laenger, weil:
- Docker-Images gebaut werden (einmalig, ~5 Min)
- ML-Modelle heruntergeladen werden (~4 GB, einmalig)
- Modelle in den Speicher geladen werden (~30 Sek)

Folgestarts dauern 15-30 Sekunden.

### GPU wird nicht erkannt

1. Pruefen ob `nvidia-smi` auf dem Host funktioniert:
   ```bash
   nvidia-smi
   ```

2. Pruefen ob das NVIDIA Container Toolkit installiert ist:
   ```bash
   docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
   ```

3. Sicherstellen dass das GPU-Overlay verwendet wird:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
   ```

### Windows: MAX_PATH Problem

Windows hat ein Limit von 260 Zeichen fuer Dateipfade. Klonen Sie das Repository nicht in tief verschachtelte Ordner.

**Empfohlen:** `C:\projekte\paragraf` statt `C:\Users\Name\Documents\Projekte\Recht\paragraf-app\`.

Alternativ: Lange Pfade in Windows aktivieren (Registry: `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` auf `1`).

### macOS: Docker-Images langsam auf Apple Silicon

Docker Desktop emuliert x86-Images auf Apple Silicon (M1/M2/M3/M4) per Rosetta 2. Das Backend-Image (Python + PyTorch) wird als x86 gebaut, daher kann die Indexierung langsamer sein als auf nativen x86-Rechnern.

### Linux: Permission Denied bei Docker

```bash
# Nutzer zur docker-Gruppe hinzufuegen
sudo usermod -aG docker $USER

# Ausloggen und wieder einloggen, dann pruefen:
docker info
```

### Backend-Container startet nicht (Qdrant nicht erreichbar)

Fehlermeldung: `Qdrant nicht erreichbar` oder `Connection refused`

Der Backend-Container wartet per Healthcheck auf Qdrant. Wenn Qdrant nicht hochfaehrt:

```bash
docker compose logs qdrant
```

Haeufige Ursache: Der Port 6333 ist belegt oder das Volume `qdrant_data` ist korrupt. Loesung:

```bash
docker compose down
docker volume rm paragraf_qdrant_data
docker compose up --build
```

---

## Aktualisierung

### Docker Compose

```bash
git pull
docker compose up --build
```

### Desktop-App

Neuen Installer (`Paragraf-Setup-x.y.z.exe`) ausfuehren. Die vorherige Version wird ueberschrieben, Daten (Qdrant-Volumes, ML-Modelle) bleiben erhalten.

---

## Deinstallation

### Desktop-App

**Windows:** Windows-Einstellungen > Apps > Paragraf > Deinstallieren

**macOS:** Paragraf aus dem Programme-Ordner in den Papierkorb ziehen

**Linux (deb):** `sudo apt remove paragraf-desktop`

**Linux (AppImage):** Die `.AppImage`-Datei loeschen

Optional -- Docker-Volumes und Modell-Cache loeschen (alle Plattformen):
```bash
docker compose -f docker-compose.desktop.yml down -v
```

### Docker Compose

```bash
# Container stoppen und Volumes loeschen
docker compose down -v

# Docker-Images loeschen
docker rmi $(docker images -q paragraf*)
```
