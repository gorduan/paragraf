# Bewertungsrubrik

## Dimensionen

### 1. Korrektheit (0-5)

Sind die zitierten Paragraphen tatsaechlich korrekt und existieren sie?

| Score | Beschreibung |
|---|---|
| 0 | Alle Zitate falsch oder halluziniert |
| 1 | Ueberwiegend falsch, vereinzelt korrekt |
| 2 | ~40% korrekt |
| 3 | Mehrheitlich korrekt, einige Fehler |
| 4 | Fast alles korrekt, kleine Ungenauigkeiten |
| 5 | Alle Zitate korrekt und verifizierbar |

**Verifizierung:** Jeder zitierte Paragraph wird via `POST /api/lookup` geprueft. `found: false` = Halluzination.

### 2. Vollstaendigkeit (0-5)

Wurden alle relevanten Paragraphen aus dem Erwartungskatalog gefunden?

| Score | Beschreibung |
|---|---|
| 0 | Kein erwarteter Paragraph gefunden |
| 1 | 1-20% der erwarteten Paragraphen |
| 2 | 21-40% |
| 3 | 41-60% |
| 4 | 61-80% |
| 5 | 81-100% der erwarteten Paragraphen |

**Berechnung:** `gefundene_erwartete / total_erwartete * 5`, gerundet.

### 3. Relevanz (0-5)

Sind die gelieferten Ergebnisse relevant zur gestellten Frage?

| Score | Beschreibung |
|---|---|
| 0 | Komplett irrelevant |
| 1 | Thema grob getroffen, aber falsche Normen |
| 2 | Teilweise relevant |
| 3 | Ueberwiegend relevant |
| 4 | Sehr relevant, kleine Abweichungen |
| 5 | Alle Ergebnisse hochrelevant |

**Berechnung:** Anteil der zitierten Quellen, die in `expected_laws` vorkommen.

### 4. Quellenangabe (0-5)

Sind die Quellen sauber zitiert (Paragraph + Gesetz)?

| Score | Beschreibung |
|---|---|
| 0 | Keine Quellenangaben |
| 1 | Vage Verweise ("laut Gesetz...") |
| 2 | Teilweise mit Paragraph, ohne Gesetz |
| 3 | Meist korrekt formatiert |
| 4 | Fast alle korrekt: "§ X GESETZ" |
| 5 | Alle perfekt formatiert mit Paragraph + Gesetz |

**Pruefung:** Quellen-Array muss `paragraph` und `gesetz` Felder haben.

### 5. Antwortzeit (Sekunden)

Gemessen von Subagent-Start bis JSON-Antwort. Niedrigere Werte sind besser.

| Bewertung | Zeit |
|---|---|
| Exzellent | < 10s |
| Gut | 10-30s |
| Akzeptabel | 30-60s |
| Langsam | 60-120s |
| Zu langsam | > 120s |

### 6. Token-Verbrauch

Input + Output Tokens pro Anfrage. Wird aus `claude -p` Output extrahiert.

## Binaere Checks

Zusaetzlich zu den Scores werden folgende binaere Pruefungen durchgefuehrt:

| Check | Kriterium | Bestanden |
|---|---|---|
| RDG-Disclaimer | `rdg_disclaimer == true` | Ja/Nein |
| Mindest-Confidence | `confidence >= 0.35` | Ja/Nein |
| Keine Halluzination | Alle zitierten Paragraphen via `/api/lookup` gefunden | Ja/Nein |
| JSON-Format | Ausgabe ist valides JSON im erwarteten Schema | Ja/Nein |
| Edge-Case-Handling | Bei Nonsense-Anfragen keine Fake-Paragraphen | Ja/Nein |

## Gesamt-Score

```
gesamt = (korrektheit + vollstaendigkeit + relevanz + quellenangabe) / 4
```

Maximaler Score: 5.0. Token-Verbrauch und Antwortzeit fliessen als separate Metriken in den Bericht ein (nicht in den Gesamt-Score).

## Kosten-Effizienz

```
effizienz = gesamt_score / (tokens / 1000)
```

Hoehere Werte = besseres Qualitaet-pro-Token-Verhaeltnis.

## Kategorien

| Kategorie | Prefix | Beschreibung |
|---|---|---|
| semantische_suche | sem- | Semantische Suche nach Rechtsbegriffen |
| paragraph_nachschlagen | lkp- | Direktes Nachschlagen von Paragraphen |
| vergleich | cmp- | Vergleich von Paragraphen/Gesetzen |
| gesetzesbrowser | brw- | Gesetzesbrowser-Abfragen |
| eutb_beratung | eutb- | EUTB-Beratungsstellensuche |
| leichte_sprache | ls- | Erklaerungen in einfacher Sprache |
| querschnitt | quer- | Querschnittsthemen ueber mehrere Gesetze |
| edge_cases | edge- | Randfaelle und Fehlerbehandlung |
| exam | exam- | Echte Pruefungsfragen (alle schwer) |

### Kategorie: exam (Pruefungsfragen)

Quellenverifizierte Pruefungsfragen aus veroeffentlichten Universitaetsklausuren und juristischen Fachquellen. Alle Tests haben Schwierigkeit "schwer". Rechtsgebiete: Mietrecht, Gesellschaftsrecht, Strafrecht, Verwaltungsrecht, Datenschutz, Erbrecht, Heilerziehungspflege, Arbeitsrecht, Familienrecht, BGB AT, Sachenrecht, Buergschaftsrecht, Querschnitt.

## API-Selbstbewertung

Agenten die die Paragraf API nutzen (api-only, api-web) bewerten die API nach jeder Anfrage. Das Feld `api_bewertung` im JSON-Output enthaelt:
- `staerken` / `schwaechen` – Was gut/schlecht funktioniert hat
- `feature_ideen` – Vorschlaege fuer neue Features
- `einstellungen` – Parameter-Optimierungen
- `fehler` – Aufgetretene Fehler
- `gesamtnote` – Schulnote 1-5 (5=hervorragend)
