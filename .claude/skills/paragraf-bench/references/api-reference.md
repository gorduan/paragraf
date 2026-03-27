# Paragraf API-Referenz

Basis-URL: `http://localhost:8000`

## Endpunkte

### GET /api/health
Serverstatus pruefen.
```json
{"status": "ok", "embedding_model": "BAAI/bge-m3", "indexierte_chunks": 12345}
```

### POST /api/search
Semantische Suche ueber alle Gesetze.
```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"anfrage": "Kuendigungsschutz Schwerbehinderte", "max_ergebnisse": 5}'
```
**Request:**
- `anfrage` (string, pflicht): Suchanfrage
- `gesetzbuch` (string, optional): Auf ein Gesetz einschraenken (z.B. "SGB IX")
- `abschnitt` (string, optional): Auf einen Abschnitt einschraenken
- `max_ergebnisse` (int, 1-10, default 5): Anzahl Ergebnisse

**Response:**
```json
{
  "query": "Kuendigungsschutz Schwerbehinderte",
  "results": [
    {
      "paragraph": "§ 168",
      "gesetz": "SGB IX",
      "titel": "Erfordernis der Zustimmung",
      "text": "Die Kuendigung des Arbeitsverhaeltnisses...",
      "score": 0.92,
      "abschnitt": "Teil 3 Kapitel 4",
      "hierarchie_pfad": "SGB IX > Teil 3 > Kapitel 4 > § 168",
      "quelle": "gesetze-im-internet.de",
      "chunk_typ": "paragraph"
    }
  ],
  "total": 5,
  "disclaimer": "Hinweis: Diese Informationen..."
}
```

### POST /api/lookup
Direktes Nachschlagen eines Paragraphen.
```bash
curl -X POST http://localhost:8000/api/lookup \
  -H "Content-Type: application/json" \
  -d '{"gesetz": "GG", "paragraph": "Art. 1"}'
```
**Request:**
- `gesetz` (string, pflicht): Gesetzes-Abkuerzung (z.B. "GG", "SGB IX")
- `paragraph` (string, pflicht): Paragraph (z.B. "§ 152", "Art. 1")

**Response:**
```json
{
  "paragraph": "Art. 1",
  "gesetz": "GG",
  "titel": "",
  "text": "(1) Die Wuerde des Menschen ist unantastbar...",
  "found": true,
  "error": null
}
```

### POST /api/compare
Paragraphen vergleichen (2-5 Stueck).
```bash
curl -X POST http://localhost:8000/api/compare \
  -H "Content-Type: application/json" \
  -d '{"paragraphen": ["§ 1 AGG", "§ 1 BGG"]}'
```
**Request:**
- `paragraphen` (list[string], 2-5): Referenzen im Format "§ X GESETZ"

**Response:**
```json
{
  "items": [
    {"referenz": "§ 1 AGG", "paragraph": "§ 1", "gesetz": "AGG", "titel": "Ziel des Gesetzes", "text": "...", "found": true}
  ]
}
```

### GET /api/laws
Alle verfuegbaren Gesetze auflisten.
```bash
curl http://localhost:8000/api/laws
```
**Response:**
```json
{
  "gesetze": [
    {"abkuerzung": "SGB IX", "beschreibung": "Sozialgesetzbuch Neuntes Buch - Rehabilitation und Teilhabe", "rechtsgebiet": "Sozialrecht"}
  ],
  "total_chunks": 12345,
  "db_status": "ok"
}
```

### GET /api/laws/{gesetz}/structure
Struktur eines Gesetzes (Paragraphen-Liste).
```bash
curl http://localhost:8000/api/laws/SGB%20IX/structure
```

### GET /api/laws/{gesetz}/paragraphs
Alle Paragraphen eines Gesetzes mit Volltext.
```bash
curl http://localhost:8000/api/laws/GG/paragraphs
```

### POST /api/counseling
EUTB-Beratungsstellen suchen.
```bash
curl -X POST http://localhost:8000/api/counseling \
  -H "Content-Type: application/json" \
  -d '{"ort": "Berlin", "schwerpunkt": "Mobilität"}'
```
**Request:**
- `ort` (string, optional): Stadt/Ort
- `bundesland` (string, optional): Bundesland
- `schwerpunkt` (string, optional): Beratungsschwerpunkt

## Wichtige Hinweise

- Gesetzes-Abkuerzungen immer mit roemischen Ziffern: "SGB IX" nicht "SGB 9"
- Score-Werte liegen zwischen 0 und 1 (hoeher = relevanter)
- Similarity-Threshold liegt bei 0.35 (Ergebnisse darunter werden gefiltert)
- RDG-Disclaimer muss in jeder Antwort enthalten sein
