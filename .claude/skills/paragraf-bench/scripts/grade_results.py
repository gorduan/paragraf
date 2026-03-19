#!/usr/bin/env python3
"""Paragraf-Bench Bewertung: bewertet Agent-Ergebnisse gegen erwartete Antworten."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = SKILL_DIR / "references" / "test-catalog.json"
API_BASE = os.environ.get("PARAGRAF_API_URL", "http://localhost:8000")


def load_catalog() -> dict:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_result(workspace: Path, test_id: str, agent: str) -> dict | None:
    result_file = workspace / test_id / f"{agent}.json"
    if not result_file.exists():
        return None
    with open(result_file, "r", encoding="utf-8") as f:
        return json.load(f)


def load_timing(workspace: Path, test_id: str, agent: str) -> dict:
    timing_file = workspace / test_id / f"{agent}_timing.json"
    if not timing_file.exists():
        return {}
    with open(timing_file, "r", encoding="utf-8") as f:
        return json.load(f)


def verify_paragraph_exists(gesetz: str, paragraph: str) -> bool:
    """Prueft via API ob ein Paragraph existiert."""
    try:
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", f"{API_BASE}/api/lookup",
             "-H", "Content-Type: application/json",
             "-d", json.dumps({"gesetz": gesetz, "paragraph": paragraph})],
            capture_output=True, text=True, timeout=10,
        )
        data = json.loads(result.stdout)
        return data.get("found", False)
    except Exception:
        return True  # Bei Fehler nicht als Halluzination werten


def grade_korrektheit(result: dict, test: dict) -> tuple[int, list[str]]:
    """Bewertet Korrektheit der zitierten Paragraphen (0-5)."""
    quellen = result.get("quellen", [])
    if not quellen:
        # Keine Quellen: bei Edge Cases OK, sonst schlecht
        if test["verification_checks"].get("expect_no_results"):
            return 5, ["Korrekt: keine Quellen bei Nonsense-Anfrage"]
        return 0, ["Keine Quellen angegeben"]

    halluzinationen = []
    korrekt = 0
    total = len(quellen)

    for q in quellen:
        gesetz = q.get("gesetz", "")
        paragraph = q.get("paragraph", "")
        if gesetz and paragraph:
            if verify_paragraph_exists(gesetz, paragraph):
                korrekt += 1
            else:
                halluzinationen.append(f"{paragraph} {gesetz}")

    if total == 0:
        return 0, ["Keine Quellen"]

    ratio = korrekt / total
    score = round(ratio * 5)
    notes = []
    if halluzinationen:
        notes.append(f"Halluzinationen: {', '.join(halluzinationen)}")
    notes.append(f"{korrekt}/{total} Quellen verifiziert")
    return score, notes


def grade_vollstaendigkeit(result: dict, test: dict) -> tuple[int, list[str]]:
    """Bewertet Vollstaendigkeit: wurden erwartete Paragraphen gefunden? (0-5)"""
    expected = test.get("expected_paragraphs", [])
    if not expected:
        # Kein spezifischer Paragraph erwartet (z.B. Browser-Tests)
        expected_laws = test.get("expected_laws", [])
        if not expected_laws:
            return 5, ["Keine spezifischen Erwartungen"]

        # Pruefe ob erwartete Gesetze erwaehnt werden
        quellen = result.get("quellen", [])
        found_laws = {q.get("gesetz", "") for q in quellen}
        antwort = result.get("antwort", "")
        for law in expected_laws:
            if law in antwort:
                found_laws.add(law)

        matched = len(found_laws.intersection(expected_laws))
        ratio = matched / len(expected_laws) if expected_laws else 1
        score = round(ratio * 5)
        return score, [f"{matched}/{len(expected_laws)} erwartete Gesetze gefunden"]

    quellen = result.get("quellen", [])
    found_paragraphs = set()
    for q in quellen:
        p = q.get("paragraph", "")
        found_paragraphs.add(p)

    # Also check answer text for paragraph mentions
    antwort = result.get("antwort", "")
    for exp in expected:
        if exp in antwort:
            found_paragraphs.add(exp)

    matched = sum(1 for exp in expected if any(exp in fp for fp in found_paragraphs))
    ratio = matched / len(expected) if expected else 1
    score = round(ratio * 5)
    return score, [f"{matched}/{len(expected)} erwartete Paragraphen gefunden"]


def grade_relevanz(result: dict, test: dict) -> tuple[int, list[str]]:
    """Bewertet Relevanz der Ergebnisse (0-5)."""
    expected_laws = set(test.get("expected_laws", []))
    quellen = result.get("quellen", [])

    if not quellen:
        if test["verification_checks"].get("expect_no_results"):
            return 5, ["Korrekt: keine Ergebnisse bei Edge Case"]
        if not expected_laws:
            return 3, ["Keine Quellen, aber auch keine spezifischen Erwartungen"]
        return 0, ["Keine Quellen angegeben"]

    if not expected_laws:
        return 3, ["Keine erwarteten Gesetze definiert, Relevanz nicht pruefbar"]

    relevant = sum(1 for q in quellen if q.get("gesetz", "") in expected_laws)
    ratio = relevant / len(quellen) if quellen else 0
    score = round(ratio * 5)
    return score, [f"{relevant}/{len(quellen)} Quellen aus erwarteten Gesetzen"]


def grade_quellenangabe(result: dict, test: dict) -> tuple[int, list[str]]:
    """Bewertet Qualitaet der Quellenangaben (0-5)."""
    quellen = result.get("quellen", [])

    if not quellen:
        if test["verification_checks"].get("expect_no_results"):
            return 5, ["Edge Case: keine Quellen erwartet"]
        return 0, ["Keine Quellen"]

    proper = 0
    for q in quellen:
        has_paragraph = bool(q.get("paragraph", "").strip())
        has_gesetz = bool(q.get("gesetz", "").strip())
        if has_paragraph and has_gesetz:
            proper += 1

    ratio = proper / len(quellen) if quellen else 0
    score = round(ratio * 5)
    return score, [f"{proper}/{len(quellen)} mit Paragraph + Gesetz"]


def check_binary(result: dict, test: dict) -> dict:
    """Fuehrt binaere Checks durch."""
    checks = {}

    # RDG Disclaimer
    checks["rdg_disclaimer"] = result.get("rdg_disclaimer", False) is True

    # Minimum confidence
    checks["min_confidence"] = result.get("confidence", 0) >= 0.35

    # JSON format valid
    checks["valid_json"] = "_error" not in result

    # Hallucination check (already done in korrektheit, but as binary)
    quellen = result.get("quellen", [])
    has_hallucination = False
    for q in quellen:
        gesetz = q.get("gesetz", "")
        paragraph = q.get("paragraph", "")
        if gesetz and paragraph and not verify_paragraph_exists(gesetz, paragraph):
            has_hallucination = True
            break
    checks["no_hallucination"] = not has_hallucination

    # Edge case handling
    if test["verification_checks"].get("expect_no_results") or test["verification_checks"].get("expect_not_found"):
        checks["edge_case_handled"] = len(quellen) == 0 or result.get("confidence", 1) < 0.5
    elif test["verification_checks"].get("must_not_invent_law"):
        checks["edge_case_handled"] = len(quellen) == 0

    # Must-mention check
    must_mention = test["verification_checks"].get("must_mention", [])
    if must_mention:
        antwort = result.get("antwort", "").lower()
        mentioned = sum(1 for term in must_mention if term.lower() in antwort)
        checks["must_mention_ratio"] = f"{mentioned}/{len(must_mention)}"

    return checks


def grade_test(workspace: Path, test: dict, agent: str) -> dict:
    """Bewertet einen einzelnen Test-Run."""
    result = load_result(workspace, test["id"], agent)
    timing = load_timing(workspace, test["id"], agent)

    if result is None:
        return {
            "test_id": test["id"],
            "agent": agent,
            "error": "No result file found",
            "scores": {"korrektheit": 0, "vollstaendigkeit": 0, "relevanz": 0, "quellenangabe": 0},
            "gesamt": 0.0,
        }

    korr_score, korr_notes = grade_korrektheit(result, test)
    voll_score, voll_notes = grade_vollstaendigkeit(result, test)
    rel_score, rel_notes = grade_relevanz(result, test)
    quel_score, quel_notes = grade_quellenangabe(result, test)

    gesamt = round((korr_score + voll_score + rel_score + quel_score) / 4, 2)

    binary = check_binary(result, test)

    elapsed = timing.get("elapsed_seconds", 0)
    tokens = timing.get("total_tokens", 0)
    effizienz = round(gesamt / (tokens / 1000), 3) if tokens > 0 else 0

    return {
        "test_id": test["id"],
        "agent": agent,
        "category": test["category"],
        "difficulty": test["difficulty"],
        "scores": {
            "korrektheit": korr_score,
            "vollstaendigkeit": voll_score,
            "relevanz": rel_score,
            "quellenangabe": quel_score,
        },
        "gesamt": gesamt,
        "notes": {
            "korrektheit": korr_notes,
            "vollstaendigkeit": voll_notes,
            "relevanz": rel_notes,
            "quellenangabe": quel_notes,
        },
        "binary_checks": binary,
        "performance": {
            "elapsed_seconds": elapsed,
            "total_tokens": tokens,
            "input_tokens": timing.get("input_tokens", 0),
            "output_tokens": timing.get("output_tokens", 0),
            "effizienz": effizienz,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Paragraf-Bench Bewertung")
    parser.add_argument("--workspace", type=str, required=True, help="Workspace-Verzeichnis mit Ergebnissen")
    parser.add_argument("--skip-verification", action="store_true",
                        help="Paragraph-Verifikation via API ueberspringen")

    args = parser.parse_args()
    workspace = Path(args.workspace)

    if not workspace.exists():
        print(f"FEHLER: Workspace nicht gefunden: {workspace}")
        sys.exit(1)

    # Load metadata
    meta_file = workspace / "meta.json"
    if not meta_file.exists():
        print(f"FEHLER: meta.json nicht gefunden in {workspace}")
        sys.exit(1)

    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    catalog = load_catalog()
    tests_by_id = {t["id"]: t for t in catalog["tests"]}

    if args.skip_verification:
        global verify_paragraph_exists
        verify_paragraph_exists = lambda g, p: True  # noqa: E731

    gradings = []
    for test_id in meta["tests"]:
        test = tests_by_id.get(test_id)
        if not test:
            continue
        for agent in meta["agents"]:
            grading = grade_test(workspace, test, agent)
            gradings.append(grading)
            status = f"{grading['gesamt']:.1f}/5.0"
            print(f"  {test_id} / {agent}: {status}")

    # Save grading results
    grading_output = {
        "run_id": meta["run_id"],
        "timestamp": meta["timestamp"],
        "gradings": gradings,
        "summary": {
            "total_tests": len(meta["tests"]),
            "total_agents": len(meta["agents"]),
            "total_gradings": len(gradings),
        },
    }

    output_file = workspace / "grading.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(grading_output, f, ensure_ascii=False, indent=2)

    print(f"\nBewertung gespeichert: {output_file}")
    print(f"\nNaechster Schritt:")
    print(f"  python {SKILL_DIR}/scripts/generate_report.py --workspace {workspace}")


if __name__ == "__main__":
    main()
