# Paragraf -- Installationsanleitung

Diese Anleitung beschreibt die Installation und Konfiguration von Paragraf als Docker-basierte Anwendung.

## Voraussetzungen

| Anforderung | Minimum | Empfohlen |
|-------------|---------|-----------|
| Docker Desktop (Windows/macOS) oder Docker Engine (Linux) | 4.x / 24+ | Aktuelle Version |
| Git | 2.x | Aktuelle Version |
| Arbeitsspeicher (RAM) | 8 GB | 16 GB |
| Freier Festplattenspeicher | 10 GB | 20 GB |
| Betriebssystem | Windows 10, macOS 12+, Linux mit Docker | - |

**Warum 8 GB RAM?** Die ML-Modelle (BAAI/bge-m3 ~2 GB, BAAI/bge-reranker-v2-m3 ~2 GB) werden beim ersten Start in den Speicher geladen. Mit weniger RAM kann es zu Out-of-Memory-Fehlern kommen.

**Warum 10 GB Festplatte?** Docker Images (~3 GB) + ML-Modelle (~4 GB) + Qdrant-Daten (abhaengig von Anzahl indexierter Gesetze).

## Schnellstart (Docker)

1. **Repository klonen:**

   ```bash
   git clone https://github.com/your-username/paragraf.git
   cd paragraf
   ```

2. **Environment konfigurieren (optional):**

   ```bash
   cp .env.example .env
   ```

   Die Standardwerte in `docker-compose.yml` funktionieren ohne `.env`-Datei. Nur bei Bedarf anpassen.

3. **Starten:**

   ```bash
   docker compose up --build
   ```

   Beim ersten Start werden Docker-Images gebaut und ML-Modelle heruntergeladen. Das dauert je nach Internetverbindung 5-15 Minuten. Folgestarts sind deutlich kuerzer.

4. **Web-App oeffnen:**

   ```
   http://localhost:3847
   ```

5. **Gesetze indexieren:**

   Ueber die Web-Oberflaeche (Seite "Index-Verwaltung") oder per API:

   ```bash
   curl -X POST http://localhost:3847/api/index \
     -H "Content-Type: application/json" \
     -d '{"gesetzbuch": "SGB IX"}'
   ```

   Die Indexierung laeuft als SSE-Stream mit Fortschrittsanzeige. Pro Gesetz dauert es 1-5 Minuten (abhaengig von Groesse und Hardware).

## Ports und Services

| Service | Port | URL | Funktion |
|---------|------|-----|----------|
| Frontend (nginx) | 3847 | http://localhost:3847 | Web-App + API-Reverse-Proxy |
| Backend (FastAPI) | 8000 | http://localhost:8000 | REST-API direkt |
| MCP-Server | 8001 | http://localhost:8001/mcp | MCP-Protokoll fuer Claude Desktop/Code |
| Qdrant | 6333 | http://localhost:6333 | Vektordatenbank |

Der Frontend-Service (nginx) leitet alle Anfragen an `/api/*` automatisch an das Backend weiter. Fuer die Nutzung genuegt daher `http://localhost:3847`.

## GPU-Setup (NVIDIA)

GPU-Beschleunigung ist optional, verkuerzt aber die Embedding-Berechnung bei der Indexierung.

### Voraussetzungen

- NVIDIA-Grafikkarte mit CUDA-Unterstuetzung
- Aktuelle NVIDIA-Treiber installiert
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installiert

### Starten mit GPU

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

## Konfiguration

Alle Konfiguration erfolgt ueber Environment-Variablen in `docker-compose.yml`. Die Settings-Seite in der Web-App zeigt die aktuelle Konfiguration an, ist aber read-only.

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

### Frontend

Voraussetzung: Node.js 22+

```bash
cd frontend
npm install
npm run dev
```

Der Vite-Dev-Server laeuft auf `http://localhost:5173` und leitet `/api`-Anfragen automatisch an `http://localhost:8000` weiter (konfiguriert in `vite.config.ts`).

### Tests ausfuehren

Im Docker-Container:

```bash
docker compose exec backend python -m pytest tests/ -v
```

Lokal:

```bash
cd backend
python -m pytest tests/ -v
```

### Linting und Typpruefung

```bash
cd backend
ruff check src/
ruff format --check src/
mypy src/paragraf/
```

## Troubleshooting

### Port bereits belegt (3847, 8000, 6333)

Ein anderer Prozess nutzt den Port.

**Windows:**
```bash
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Linux/macOS:**
```bash
lsof -i :8000
kill <PID>
```

Alternativ: Port in `docker-compose.yml` aendern, z.B. `"9000:8000"`.

### Docker nicht gestartet

Fehlermeldung: `Cannot connect to the Docker daemon`

Docker Desktop muss laufen bevor `docker compose up` funktioniert. Unter Windows/macOS: Docker Desktop starten. Unter Linux: `sudo systemctl start docker`.

### Nicht genug RAM

Fehlermeldung: `Killed` oder `OOMKilled` im Container-Log.

Die ML-Modelle brauchen ~4 GB RAM im Backend-Container. Docker Desktop hat ein Standard-RAM-Limit von 2 GB.

**Loesung:** Docker Desktop > Settings > Resources > Memory auf mindestens 8 GB setzen.

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

### Windows MAX_PATH Problem

Windows hat ein Limit von 260 Zeichen fuer Dateipfade. Klonen Sie das Repository nicht in tief verschachtelte Ordner.

**Empfohlen:** `C:\projekte\paragraf` statt `C:\Users\Name\Documents\Projekte\Recht\paragraf-app\v2\`.

Alternativ: Lange Pfade in Windows aktivieren (Registry: `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` auf `1`).

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

## Aktualisierung

```bash
git pull
docker compose up --build
```

Die Daten-Volumes (Qdrant-Datenbank, ML-Modelle, Gesetzestexte) bleiben erhalten. Nur die Docker-Images werden neu gebaut.

## Deinstallation

```bash
docker compose down -v
docker rmi $(docker images -q paragraf*)
```

Der erste Befehl stoppt alle Container und loescht die Volumes. Der zweite loescht die Docker-Images.
