# Paragraf MCP-Server

Paragraf stellt einen MCP-Server (Model Context Protocol) bereit, der jedem MCP-kompatiblen LLM -- Claude, GPT, Gemini und andere -- Zugriff auf eine strukturierte Datenbank deutscher und europaeischer Gesetze gibt. Statt auf unstrukturierte Websuche angewiesen zu sein, erhaelt das LLM sauber geparsete Gesetzestexte mit Metadaten, Querverweisen und Hybrid-Search.

Der MCP-Server ist die zentrale Schnittstelle fuer die Nutzung von Paragraf mit KI-Assistenten.

## Warum MCP statt Websuche?

Wenn ein LLM per Websuche nach Gesetzen sucht, bekommt es unstrukturierte HTML-Seiten, veraltete Forenbeitraege und oft ungenaue Zusammenfassungen. Der Paragraf MCP-Server loest diese Probleme:

- **Strukturierte Datenbank statt Webseiten**: Paragraphen sind sauber geparsed mit Metadaten (Gesetz, Abschnitt, Rechtsgebiet, Hierarchie-Pfad). Das LLM bekommt den exakten Gesetzestext, nicht eine Interpretation davon.
- **Hybrid-Search (Dense + Sparse Vektoren)**: Kombiniert semantische Suche (versteht die Bedeutung der Frage) mit lexikalischer Suche (findet exakte Begriffe und Paragraphennummern). RRF-Fusion verbindet beide Ergebnisse.
- **Cross-Encoder Reranking**: Nach der Vorauswahl sortiert ein Cross-Encoder (BAAI/bge-reranker-v2-m3) die Ergebnisse nach tatsaechlicher Relevanz zur Frage -- nicht nur nach Vektordistanz.
- **Querverweise**: Paragraf erkennt Verweise zwischen Gesetzen automatisch (z.B. "nach Paragraph 2 SGB IX") und kann das Verweisnetzwerk eines Paragraphen anzeigen.
- **Keine Halluzinationen**: Das LLM erhaelt echte Gesetzestexte als Kontext. Es kann keine Paragraphen erfinden, wenn die Quelle direkt mitgeliefert wird.
- **95+ Gesetze**: Deutsche Gesetze (SGB I-XIV, BGG, AGG, BGB, StGB, GG, EStG, KraftStG, und viele weitere) sowie EU-Verordnungen (DSGVO, EU-Barrierefreiheitsrichtlinie, etc.) in einer Datenbank.

## Voraussetzungen

- Paragraf laeuft per Docker: `docker compose up` (siehe [INSTALLATION.md](INSTALLATION.md))
- Ein MCP-kompatibler Client: Claude Desktop, Claude Code, oder ein anderer MCP-Client

## Setup

### Claude Code

```bash
claude mcp add paragraf --url http://localhost:8001/mcp
```

### Claude Desktop

In der Datei `claude_desktop_config.json` (Pfad: `%APPDATA%\Claude\claude_desktop_config.json` auf Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` auf macOS):

```json
{
  "mcpServers": {
    "paragraf": {
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

Claude Desktop danach neustarten.

### Andere MCP-Clients

URL: `http://localhost:8001/mcp` (Streamable HTTP Transport)

Der MCP-Service laeuft als eigener Docker-Container auf Port 8001. Das ist nicht der REST-API-Port 8000 -- der MCP-Server hat einen separaten Endpunkt.

## Verfuegbare Tools

Paragraf stellt 14 MCP-Tools bereit, aufgeteilt in fuenf Kategorien.

### Suche

#### 1. paragraf_search

Hybrid-Suche ueber alle indexierten Gesetze. Kombiniert semantische und lexikalische Suche mit Cross-Encoder Reranking.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `anfrage` | string | ja | Suchanfrage in natuerlicher Sprache |
| `gesetzbuch` | string | nein | Filter nach Gesetzbuch (z.B. "SGB IX", "BGB") |
| `abschnitt` | string | nein | Filter nach Abschnitt/Kapitel |
| `max_ergebnisse` | int | nein | Anzahl Ergebnisse, 1-10 (Standard: 5) |
| `suchmodus` | string | nein | "semantisch" (Standard), "volltext", oder "hybrid" |
| `absatz_von` | int | nein | Minimum Absatz-Nummer (1-basiert) |
| `absatz_bis` | int | nein | Maximum Absatz-Nummer (1-basiert) |
| `cursor` | string | nein | Cursor fuer Paginierung (aus vorheriger Antwort) |

**Beispiel-Prompt:** "Welche Paragraphen regeln den Kuendigungsschutz fuer Schwerbehinderte?"

#### 2. paragraf_lookup

Gibt den vollstaendigen Text eines bestimmten Paragraphen zurueck.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `gesetz` | string | ja | Gesetzbuch-Abkuerzung (z.B. "SGB IX", "BGG") |
| `paragraph` | string | ja | Paragraphen-Nummer (z.B. "Paragraph 152", "Paragraph 35a") |

**Beispiel-Prompt:** "Zeig mir Paragraph 168 SGB IX"

#### 3. paragraf_compare

Vergleicht mehrere Paragraphen nebeneinander. Maximal 5 Paragraphen gleichzeitig.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `paragraphen` | list[string] | ja | Liste von Referenzen, z.B. ["Paragraph 2 SGB IX", "Paragraph 3 BGG"] |

**Beispiel-Prompt:** "Vergleiche Paragraph 2 SGB IX mit Paragraph 3 BGG"

### Entdecken

#### 4. paragraf_similar

Findet aehnliche Paragraphen zu einem gegebenen Paragraphen per Vektordistanz. Gibt standardmaessig Ergebnisse aus anderen Gesetzen zurueck.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `punkt_id` | string | nein | Qdrant Point-ID (UUID). Alternative zu paragraph+gesetz |
| `paragraph` | string | nein | Paragraph-Nummer (z.B. "Paragraph 152") |
| `gesetz` | string | nein | Gesetzbuch-Abkuerzung (z.B. "SGB IX") |
| `gesetzbuch` | string | nein | Ergebnisse auf ein Gesetzbuch einschraenken |
| `abschnitt` | string | nein | Ergebnisse auf einen Abschnitt einschraenken |
| `absatz_von` | int | nein | Minimum Absatz-Nummer (1-basiert) |
| `absatz_bis` | int | nein | Maximum Absatz-Nummer (1-basiert) |
| `max_ergebnisse` | int | nein | Anzahl Ergebnisse, 1-20 (Standard: 10) |
| `gleiches_gesetz_ausschliessen` | bool | nein | Quell-Gesetz ausschliessen (Standard: ja) |

**Beispiel-Prompt:** "Welche Paragraphen sind aehnlich zu Paragraph 81 SGB IX?"

#### 5. paragraf_discover

Explorative Suche mit Positiv/Negativ-Beispielen. Findet Paragraphen, die den positiven Beispielen aehnlich und von den negativen verschieden sind.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `positiv_beispiele` | list[string] | ja | Punkt-IDs (UUID) oder "Paragraph NR GESETZ" Strings. Mindestens 1. |
| `negativ_beispiele` | list[string] | nein | Punkt-IDs oder "Paragraph NR GESETZ" Strings |
| `gesetzbuch` | string | nein | Ergebnisse auf ein Gesetzbuch einschraenken |
| `abschnitt` | string | nein | Ergebnisse auf einen Abschnitt einschraenken |
| `max_ergebnisse` | int | nein | Anzahl Ergebnisse, 1-20 (Standard: 10) |

**Beispiel-Prompt:** "Finde Paragraphen zum Thema Barrierefreiheit am Arbeitsplatz, aehnlich wie Paragraph 164 SGB IX, aber nicht wie Paragraph 1 AGG"

#### 6. paragraf_grouped_search

Sucht Paragraphen und gruppiert die Ergebnisse nach Gesetzbuch. Gibt einen Ueberblick, welche Gesetze ein Thema behandeln.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `anfrage` | string | ja | Suchanfrage in natuerlicher Sprache |
| `gesetzbuch` | string | nein | Ergebnisse auf ein Gesetzbuch einschraenken |
| `abschnitt` | string | nein | Ergebnisse auf einen Abschnitt einschraenken |
| `group_size` | int | nein | Ergebnisse pro Gesetz, 1-10 (Standard: 3) |
| `max_groups` | int | nein | Maximale Anzahl Gesetze, 1-20 (Standard: 10) |

**Beispiel-Prompt:** "In welchen Gesetzen wird Diskriminierung am Arbeitsplatz behandelt?"

#### 7. paragraf_similar_grouped

Findet aehnliche Paragraphen wie `paragraf_similar`, gruppiert die Ergebnisse aber nach Gesetzbuch. Zeigt, welche Gesetze aehnliche Regelungen enthalten.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `punkt_id` | string | nein | Qdrant Point-ID (UUID). Alternative zu paragraph+gesetz |
| `paragraph` | string | nein | Paragraph-Nummer (z.B. "Paragraph 152") |
| `gesetz` | string | nein | Gesetzbuch-Abkuerzung (z.B. "SGB IX") |
| `gesetzbuch` | string | nein | Ergebnisse auf ein Gesetzbuch einschraenken |
| `abschnitt` | string | nein | Ergebnisse auf einen Abschnitt einschraenken |
| `absatz_von` | int | nein | Minimum Absatz-Nummer (1-basiert) |
| `absatz_bis` | int | nein | Maximum Absatz-Nummer (1-basiert) |
| `group_size` | int | nein | Ergebnisse pro Gesetz, 1-10 (Standard: 3) |
| `max_groups` | int | nein | Maximale Anzahl Gesetze, 1-20 (Standard: 10) |
| `gleiches_gesetz_ausschliessen` | bool | nein | Quell-Gesetz ausschliessen (Standard: ja) |

**Beispiel-Prompt:** "Welche Gesetze haben aehnliche Regelungen wie Paragraph 164 SGB IX?"

### Querverweise

#### 8. paragraf_references

Zeigt das Verweisnetzwerk eines Paragraphen: ausgehende Referenzen (was dieser Paragraph zitiert) und eingehende Referenzen (welche Paragraphen auf diesen verweisen).

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `paragraph` | string | ja | Paragraph-Bezeichnung (z.B. "Paragraph 152", "Paragraph 5") |
| `gesetz` | string | ja | Gesetzbuch-Abkuerzung (z.B. "SGB IX", "BGB") |
| `richtung` | string | nein | "ausgehend", "eingehend", oder "beide" (Standard: "beide") |
| `max_ergebnisse` | int | nein | Max. Ergebnisse pro Richtung, 1-50 (Standard: 20) |

**Beispiel-Prompt:** "Welche Paragraphen verweisen auf Paragraph 2 SGB IX?"

### Nachschlagen

#### 9. paragraf_laws

Listet alle verfuegbaren Gesetze mit Beschreibung und Rechtsgebiet auf.

Keine Parameter.

**Beispiel-Prompt:** "Welche Gesetze sind indexiert?"

#### 10. paragraf_counseling

Sucht EUTB-Beratungsstellen (Ergaenzende unabhaengige Teilhabeberatung) fuer Menschen mit Behinderungen. Die Beratung ist kostenlos und unabhaengig.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `ort` | string | nein | Stadt oder Ort (z.B. "Berlin", "Muenchen") |
| `bundesland` | string | nein | Bundesland (z.B. "Nordrhein-Westfalen") |
| `schwerpunkt` | string | nein | Beratungsschwerpunkt (z.B. "psychische Erkrankung") |

**Beispiel-Prompt:** "Gibt es Beratungsstellen fuer Schwerbehindertenrecht in Berlin?"

#### 11. paragraf_status

Gibt den Status des MCP-Servers zurueck: Embedding-Modell, Vektor-Dimension, Device, Qdrant-Status und Anzahl indexierter Chunks.

Keine Parameter.

**Beispiel-Prompt:** "Ist Paragraf bereit? Welche Modelle sind geladen?"

### Verwaltung

#### 12. paragraf_index

Laedt Gesetze von gesetze-im-internet.de herunter, parst die XML-Dateien zu Chunks und erzeugt Embeddings in Qdrant. Erstellt vor jeder Indexierung automatisch einen Sicherungs-Snapshot.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `gesetzbuch` | string | nein | Nur ein Gesetzbuch indexieren (z.B. "SGB IX"). Ohne Angabe: alle Gesetze. |

**Beispiel-Prompt:** "Indexiere das SGB IX"

#### 13. paragraf_index_eutb

Laedt EUTB-Beratungsstellen-Daten von teilhabeberatung.de (Excel-Export) herunter und speichert sie als JSON fuer die lokale Suche.

Keine Parameter.

**Beispiel-Prompt:** "Lade die EUTB-Beratungsstellen-Daten"

#### 14. paragraf_snapshot

Verwaltet Snapshots der Qdrant-Collection fuer Backup und Wiederherstellung.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `aktion` | string | ja | "erstellen", "auflisten", "wiederherstellen", oder "loeschen" |
| `name` | string | nein | Snapshot-Name (erforderlich fuer wiederherstellen und loeschen) |

**Beispiel-Prompt:** "Erstelle ein Backup der Qdrant-Daten"

## Beispiel-Workflows

### Rechtsfrage recherchieren

Eine typische Recherche kombiniert mehrere Tools:

1. **Suchen**: `paragraf_search` mit der Rechtsfrage ("Welche Rechte haben Schwerbehinderte bei der Kuendigung?")
2. **Querverweise pruefen**: `paragraf_references` fuer die gefundenen Paragraphen -- welche anderen Vorschriften werden zitiert?
3. **Details nachschlagen**: `paragraf_lookup` fuer die referenzierten Paragraphen im Detail

### Gesetz erkunden

1. **Ueberblick**: `paragraf_laws` -- welche Gesetze sind verfuegbar?
2. **Indexieren**: `paragraf_index` mit dem gewuenschten Gesetzbuch
3. **Thematisch suchen**: `paragraf_grouped_search` -- in welchen Abschnitten wird das Thema behandelt?

### Paragraphen-Vergleich

1. **Ausgangsparagraph nachschlagen**: `paragraf_lookup` fuer den bekannten Paragraphen
2. **Aehnliche finden**: `paragraf_similar` -- welche Paragraphen in anderen Gesetzen regeln Aehnliches?
3. **Vergleichen**: `paragraf_compare` mit den relevanten Paragraphen nebeneinander

## Rechtlicher Hinweis

Paragraf ist **kein** Rechtsberatungsdienst im Sinne des Rechtsdienstleistungsgesetzes (RDG). LLM-Antworten, die auf Paragraf-Daten basieren, sind allgemeine Rechtsinformationen und ersetzen keine individuelle Rechtsberatung.

Fuer individuelle Rechtsfragen wenden Sie sich an:
- Einen Rechtsanwalt oder eine Rechtsanwaeltin
- Eine [EUTB-Beratungsstelle](https://www.teilhabeberatung.de) (kostenlos, Tel: 0800 11 10 111)
