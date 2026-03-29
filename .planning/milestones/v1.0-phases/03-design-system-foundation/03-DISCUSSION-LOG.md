# Phase 3: Design System Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 03-design-system-foundation
**Areas discussed:** Token-Umfang, Primitives-Set, Migrationsstrategie, Komponentenbibliothek

---

## Token-Umfang

| Option | Description | Selected |
|--------|-------------|----------|
| Vollstaendig (Recommended) | Semantic Colors, Spacing-Scale, Typography-Scale, Shadows, Border-Radii | ✓ |
| Minimal + spaeter erweitern | Nur Semantic Colors + Neutral-Toene, Tailwind-Defaults fuer Rest | |
| Du entscheidest | Claude waehlt passenden Umfang | |

**User's choice:** Vollstaendig
**Notes:** None

### Follow-up: Farbschema

| Option | Description | Selected |
|--------|-------------|----------|
| Blau beibehalten (Recommended) | Primary bleibt blue (500: #3b82f6) | |
| Indigo/Dunkelblau | Primary auf Indigo (500: #6366f1) | ✓ |
| Eigene Idee | Benutzerdefiniertes Farbschema | |

**User's choice:** Indigo/Dunkelblau
**Notes:** None

---

## Primitives-Set

| Option | Description | Selected |
|--------|-------------|----------|
| 5 Kern-Primitives (Recommended) | Button, Card, Input, Badge, Dialog | |
| Erweitertes Set (7-8) | +Select/Dropdown, Tooltip, Tabs | ✓ |
| Minimales Set (3) | Nur Button, Card, Input | |

**User's choice:** Erweitertes Set (7-8)
**Notes:** None

### Follow-up: Varianten-Support

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, mit Varianten (Recommended) | 2-4 Varianten pro Primitive via Props | ✓ |
| Einfach, eine Variante | Default-Look, Varianten spaeter | |

**User's choice:** Ja, mit Varianten
**Notes:** None

---

## Migrationsstrategie

| Option | Description | Selected |
|--------|-------------|----------|
| SearchPage + Sidebar (Recommended) | Meistgenutzte Oberflaechen migrieren, Rest in Phase 8-10 | ✓ |
| Alle Pages sofort | Alle 7 Pages in Phase 3 umstellen | |
| Nur SearchPage | Absolutes Minimum | |

**User's choice:** SearchPage + Sidebar
**Notes:** None

---

## Komponentenbibliothek

| Option | Description | Selected |
|--------|-------------|----------|
| Radix UI Primitives (Recommended) | Headless Accessibility-Basis, Styling ueber Tailwind | ✓ |
| Headless UI | Alternative von Tailwind Labs | |
| Alles handgerollt | Kein externes Dependency | |

**User's choice:** Radix UI Primitives
**Notes:** None

---

## Claude's Discretion

- Genaue Indigo-Farbwerte und Semantic Color Paletten
- Spacing-Scale, Typography-Scale, Shadow-Stufen
- Radix-Paketauswahl
- Varianten-Implementierung (cva/clsx vs plain objects)
- cn() Utility-Helper

## Deferred Ideas

None
