# Phase 1: Snapshot Safety Net - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 01-snapshot-safety-net
**Areas discussed:** Snapshot-Speicherung, Quantization-Strategie, API-Design

---

## Snapshot-Speicherung

### Speicherort

| Option | Description | Selected |
|--------|-------------|----------|
| Qdrant-intern | Snapshots im Qdrant-eigenen /qdrant/snapshots Verzeichnis (bereits im qdrant_data Volume) | ✓ |
| Separates Volume | Eigenes Docker-Volume fuer Snapshots (qdrant_snapshots:/qdrant/snapshots) | |
| Host-Pfad | Snapshots auf den Host-Rechner mappen (./backups:/qdrant/snapshots) | |

**User's choice:** Qdrant-intern (Recommended)
**Notes:** Einfachste Loesung, kein Extra-Volume noetig. Bereits im qdrant_data Volume enthalten.

### Aufbewahrung

| Option | Description | Selected |
|--------|-------------|----------|
| Letzten 3 | Maximal 3 Snapshots behalten, aelteste automatisch loeschen | ✓ |
| Alle behalten | Kein automatisches Loeschen | |
| Nur letzten | Immer nur den neuesten Snapshot behalten | |

**User's choice:** Letzten 3 (Recommended)
**Notes:** Spart Speicher bei ausreichender Backup-Tiefe.

### Auto-Snapshot

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, automatisch | Index-Endpoint erstellt automatisch Snapshot vor Daten-Schreibvorgang | ✓ |
| Nein, nur manuell | Nur ueber expliziten Snapshot-Button/MCP-Tool | |

**User's choice:** Ja, automatisch (Recommended)
**Notes:** Sicherheitsnetz ohne Extra-Klick.

---

## Quantization-Strategie

### Quantization-Typ

| Option | Description | Selected |
|--------|-------------|----------|
| Scalar | Float32 -> Int8. ~4x weniger RAM, minimaler Qualitaetsverlust mit Rescore | ✓ |
| Binary | Float32 -> 1-bit. ~32x weniger RAM, aber deutlicher Qualitaetsverlust | |
| Product (PQ) | Segmentbasiert. Fuer 1024-dim eher Overkill | |

**User's choice:** Scalar (Recommended)
**Notes:** Bewaehrt fuer 1024-dim Vektoren.

### Aktivierung

| Option | Description | Selected |
|--------|-------------|----------|
| Nachtraeglich | Per update_collection nachtraeglich aktivieren. Kein Re-Index noetig. | ✓ |
| Bei Neuerstellen | Nur bei neuer Collection in ensure_collection() | |

**User's choice:** Nachtraeglich (Recommended)
**Notes:** Collection existiert bereits.

### Rescore

| Option | Description | Selected |
|--------|-------------|----------|
| Immer | rescore=True, oversampling=1.5. Quantized Pre-Filter + Original-Vektor Rescore | ✓ |
| Nur bei Bedarf | Default ohne Rescore, optional per Query-Parameter aktivierbar | |

**User's choice:** Immer (Recommended)
**Notes:** Beste Qualitaet.

---

## API-Design

### REST-API

| Option | Description | Selected |
|--------|-------------|----------|
| Unter /api/snapshots | Eigener Namespace: POST, GET, POST restore, DELETE | ✓ |
| Unter /api/index/* | Eingebettet in bestehende Index-Endpunkte | |
| You decide | Claude waehlt Pattern | |

**User's choice:** Unter /api/snapshots (Recommended)
**Notes:** Saubere Trennung.

### MCP-Tool

| Option | Description | Selected |
|--------|-------------|----------|
| Ein Tool, mehrere Aktionen | paragraf_snapshot(aktion, name?) mit 4 Aktionen | ✓ |
| Separate Tools | paragraf_snapshot_create(), _list(), _restore(), _delete() | |

**User's choice:** Ein Tool, mehrere Aktionen (Recommended)
**Notes:** Einfach fuer Claude zu nutzen.

### Fortschritt

| Option | Description | Selected |
|--------|-------------|----------|
| Synchron mit Status | Synchrone Response genuegt | ✓ |
| SSE-Stream | Wie Index-Endpoint, aber Overkill | |

**User's choice:** Synchron mit Status (Recommended)
**Notes:** Snapshots sind schnell (Sekunden).

---

## Claude's Discretion

- Error handling strategy for failed snapshots/restores
- Naming convention for auto-created snapshots
- Whether to log quantization status in health endpoint

## Deferred Ideas

None.
