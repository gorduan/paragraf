# Paragraf-Bench

Benchmark-Skill fuer das Paragraf-Rechtsrecherche-System. Vergleicht 4 Agenten mit unterschiedlichen Werkzeugen gegen einen standardisierten Testkatalog von 50 juristischen Fragen (28 Basis + 22 Pruefungsfragen).

## Zweck

Systematische Qualitaetsmessung: Wie gut sind Paragrafs Suchergebnisse im Vergleich zu Web-Recherche und reinem LLM-Wissen?

## Agenten

| Agent | Werkzeuge | Zweck |
|---|---|---|
| `api-only` | REST-API (curl) | Misst reine Paragraf-Qualitaet |
| `api-web` | REST-API + WebSearch + WebFetch | API + Web-Ergaenzung |
| `web-only` | WebSearch + WebFetch | Baseline: Web-Recherche allein |
| `knowledge-only` | Keine | Baseline: reines LLM-Wissen |

## Workflow

### 1. Benchmark starten

```bash
cd "E:/Claude Projekte/Tobias/paragraf"
python .agents/skills/paragraf-bench/scripts/run_bench.py --all
```

### 2. Optionen

```bash
# Nur bestimmte Kategorie
python .agents/skills/paragraf-bench/scripts/run_bench.py --category sem

# Nur bestimmte Schwierigkeit
python .agents/skills/paragraf-bench/scripts/run_bench.py --difficulty schwer

# Nur bestimmte Agenten
python .agents/skills/paragraf-bench/scripts/run_bench.py --agents api-only,web-only

# Parallelitaet steuern
python .agents/skills/paragraf-bench/scripts/run_bench.py --all --parallel 4

# Einzelner Test
python .agents/skills/paragraf-bench/scripts/run_bench.py --test sem-01 --agents api-only
```

### 3. Ergebnisse bewerten

```bash
python .agents/skills/paragraf-bench/scripts/grade_results.py --workspace workspace/results/<run-id>
```

### 4. Bericht erstellen

```bash
python .agents/skills/paragraf-bench/scripts/generate_report.py --workspace workspace/results/<run-id>
```

## Bewertungsdimensionen

| Dimension | Skala | Beschreibung |
|---|---|---|
| Korrektheit | 0-5 | Sind zitierte Paragraphen korrekt? |
| Vollstaendigkeit | 0-5 | Alle relevanten Paragraphen gefunden? |
| Relevanz | 0-5 | Ergebnisse relevant zur Frage? |
| Quellenangabe | 0-5 | Saubere Zitation (Paragraph + Gesetz)? |
| Antwortzeit | Sekunden | Niedrigere = besser |
| Token-Verbrauch | Anzahl | Input+Output Tokens (Kosten-Effizienz) |

## Agent-Ausgabeformat

Alle Agenten muessen JSON im folgenden Format liefern:

```json
{
  "antwort": "Zusammenfassende Antwort...",
  "quellen": [
    {"paragraph": "§ 152", "gesetz": "SGB IX", "score": 0.87, "snippet": "..."}
  ],
  "rdg_disclaimer": true,
  "methodik": ["POST /api/search"],
  "confidence": 0.9
}
```

API-nutzende Agenten (api-only, api-web) liefern zusaetzlich ein `api_bewertung`-Feld mit Staerken, Schwaechen, Feature-Ideen, Einstellungsvorschlaegen und einer Gesamtnote (1-5).

## Testkategorien

| Kategorie | Tests | Schwierigkeit |
|---|---|---|
| semantische_suche (sem-) | 5 | einfach-schwer |
| paragraph_nachschlagen (lkp-) | 4 | einfach-mittel |
| vergleich (cmp-) | 3 | mittel-schwer |
| gesetzesbrowser (brw-) | 3 | einfach-mittel |
| eutb_beratung (eutb-) | 2 | einfach-mittel |
| leichte_sprache (ls-) | 2 | einfach-mittel |
| querschnitt (quer-) | 5 | mittel-schwer |
| edge_cases (edge-) | 4 | einfach-schwer |
| exam (exam-) | 22 | alle schwer |

## Run-History

Jeder Benchmark-Run wird in `workspace/history.json` gespeichert. Enthaelt Git-Commit, Scores pro Agent, Performance-Metriken. Ermoeglicht historischen Vergleich nach Code-Aenderungen.

## Voraussetzungen

- Paragraf API muss laufen (`GET /api/health` erreichbar)
- `claude` CLI muss installiert sein (fuer Subagenten via `claude -p`)
- Python 3.11+

## Dateien

- `references/test-catalog.json` – 50 Testfaelle mit erwarteten Antworten (28 Basis + 22 exam)
- `references/grading-rubric.md` – Bewertungskriterien im Detail
- `references/api-reference.md` – API-Referenz fuer Agenten
- `agents/*.md` – System-Prompts der 4 Agenten
- `scripts/run_bench.py` – Orchestrator
- `scripts/grade_results.py` – Bewertungslogik
- `scripts/generate_report.py` – Berichtsgenerierung
