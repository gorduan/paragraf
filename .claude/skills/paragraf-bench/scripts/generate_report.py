#!/usr/bin/env python3
"""Paragraf-Bench Berichtsgenerierung: erzeugt Markdown-Vergleichsbericht."""

import argparse
import json
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = SKILL_DIR.parent.parent.parent


def load_grading(workspace: Path) -> dict:
    grading_file = workspace / "grading.json"
    if not grading_file.exists():
        print(f"FEHLER: grading.json nicht gefunden. Zuerst grade_results.py ausfuehren.")
        sys.exit(1)
    with open(grading_file, "r", encoding="utf-8") as f:
        return json.load(f)


def agent_averages(gradings: list[dict]) -> dict[str, dict]:
    """Berechnet Durchschnitts-Scores pro Agent."""
    by_agent = defaultdict(list)
    for g in gradings:
        by_agent[g["agent"]].append(g)

    averages = {}
    for agent, items in by_agent.items():
        n = len(items)
        avg_scores = {}
        for dim in ["korrektheit", "vollstaendigkeit", "relevanz", "quellenangabe"]:
            avg_scores[dim] = round(sum(i["scores"][dim] for i in items) / n, 2)
        avg_scores["gesamt"] = round(sum(i["gesamt"] for i in items) / n, 2)

        avg_perf = {
            "avg_elapsed": round(sum(i["performance"]["elapsed_seconds"] for i in items) / n, 1),
            "avg_tokens": round(sum(i["performance"]["total_tokens"] for i in items) / n),
            "avg_effizienz": round(sum(i["performance"]["effizienz"] for i in items) / n, 3),
        }

        # Binary check pass rates
        binary_pass = defaultdict(int)
        binary_total = defaultdict(int)
        for i in items:
            for check, val in i.get("binary_checks", {}).items():
                if isinstance(val, bool):
                    binary_total[check] += 1
                    if val:
                        binary_pass[check] += 1
        binary_rates = {k: f"{binary_pass[k]}/{binary_total[k]}" for k in binary_total}

        averages[agent] = {
            "count": n,
            "scores": avg_scores,
            "performance": avg_perf,
            "binary_checks": binary_rates,
        }
    return averages


def category_scores(gradings: list[dict]) -> dict[str, dict[str, float]]:
    """Berechnet Durchschnitt pro Kategorie und Agent."""
    by_cat_agent = defaultdict(lambda: defaultdict(list))
    for g in gradings:
        by_cat_agent[g["category"]][g["agent"]].append(g["gesamt"])

    result = {}
    for cat, agents in by_cat_agent.items():
        result[cat] = {}
        for agent, scores in agents.items():
            result[cat][agent] = round(sum(scores) / len(scores), 2)
    return result


def difficulty_scores(gradings: list[dict]) -> dict[str, dict[str, float]]:
    """Berechnet Durchschnitt pro Schwierigkeit und Agent."""
    by_diff_agent = defaultdict(lambda: defaultdict(list))
    for g in gradings:
        by_diff_agent[g["difficulty"]][g["agent"]].append(g["gesamt"])

    result = {}
    for diff, agents in by_diff_agent.items():
        result[diff] = {}
        for agent, scores in agents.items():
            result[diff][agent] = round(sum(scores) / len(scores), 2)
    return result


def load_api_bewertungen(workspace: Path) -> list[dict]:
    """Laedt alle api_bewertung JSON-Dateien aus dem Workspace."""
    bewertungen = []
    for f in workspace.rglob("*_api_bewertung.json"):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                data["_agent"] = f.stem.replace("_api_bewertung", "")
                data["_test_id"] = f.parent.name
                bewertungen.append(data)
        except (json.JSONDecodeError, OSError):
            pass
    return bewertungen


def aggregate_api_feedback(bewertungen: list[dict]) -> dict:
    """Aggregiert API-Bewertungen: haeufigste Staerken/Schwaechen, Top-Ideen, Durchschnittsnote."""
    if not bewertungen:
        return {}

    staerken = Counter()
    schwaechen = Counter()
    feature_ideen = Counter()
    einstellungen = Counter()
    fehler = Counter()
    noten = []

    for b in bewertungen:
        for s in b.get("staerken", []):
            staerken[s] += 1
        for s in b.get("schwaechen", []):
            schwaechen[s] += 1
        for s in b.get("feature_ideen", []):
            feature_ideen[s] += 1
        for s in b.get("einstellungen", []):
            einstellungen[s] += 1
        for s in b.get("fehler", []):
            fehler[s] += 1
        if "gesamtnote" in b:
            noten.append(b["gesamtnote"])

    return {
        "anzahl_bewertungen": len(bewertungen),
        "durchschnittsnote": round(sum(noten) / len(noten), 1) if noten else None,
        "top_staerken": staerken.most_common(10),
        "top_schwaechen": schwaechen.most_common(10),
        "top_feature_ideen": feature_ideen.most_common(10),
        "top_einstellungen": einstellungen.most_common(10),
        "fehler": fehler.most_common(10),
    }


def load_history(history_path: Path) -> dict:
    """Laedt die Run-History."""
    if history_path.exists():
        try:
            with open(history_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"runs": []}


def append_to_history(history_path: Path, run_entry: dict):
    """Haengt einen Run an die History an."""
    history = load_history(history_path)
    history["runs"].append(run_entry)
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def get_git_info() -> dict:
    """Sammelt Git-Informationen."""
    info = {}
    try:
        info["commit"] = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR),
        ).stdout.strip()
        info["branch"] = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR),
        ).stdout.strip()
        info["dirty"] = bool(subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR),
        ).stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError):
        info = {"commit": "unknown", "branch": "unknown", "dirty": False}
    return info


def find_failures(gradings: list[dict]) -> list[dict]:
    """Findet Tests mit niedrigen Scores oder Fehlern."""
    failures = []
    for g in gradings:
        if g["gesamt"] < 2.0 or g.get("error"):
            failures.append({
                "test_id": g["test_id"],
                "agent": g["agent"],
                "gesamt": g["gesamt"],
                "notes": g.get("notes", {}),
                "error": g.get("error"),
            })
    return failures


def generate_markdown(grading_data: dict, workspace: Path) -> str:
    """Erzeugt den Markdown-Bericht."""
    gradings = grading_data["gradings"]
    run_id = grading_data["run_id"]
    timestamp = grading_data["timestamp"]

    averages = agent_averages(gradings)
    cat_scores = category_scores(gradings)
    diff_scores = difficulty_scores(gradings)
    failures = find_failures(gradings)

    agents = sorted(averages.keys())
    dimensions = ["korrektheit", "vollstaendigkeit", "relevanz", "quellenangabe", "gesamt"]

    lines = []
    lines.append(f"# Paragraf-Bench Bericht")
    lines.append(f"")
    lines.append(f"**Run:** {run_id}  ")
    lines.append(f"**Datum:** {timestamp}  ")
    lines.append(f"**Tests:** {grading_data['summary']['total_tests']} | "
                 f"**Agenten:** {grading_data['summary']['total_agents']} | "
                 f"**Bewertungen:** {grading_data['summary']['total_gradings']}")
    lines.append("")

    # === Score Matrix ===
    lines.append("## Score-Matrix (Durchschnitt)")
    lines.append("")
    header = "| Dimension | " + " | ".join(agents) + " |"
    separator = "|---|" + "|".join(["---"] * len(agents)) + "|"
    lines.append(header)
    lines.append(separator)
    for dim in dimensions:
        row = f"| **{dim.capitalize()}** | "
        row += " | ".join(f"{averages[a]['scores'][dim]:.2f}" for a in agents)
        row += " |"
        lines.append(row)
    lines.append("")

    # Winner
    best_agent = max(agents, key=lambda a: averages[a]["scores"]["gesamt"])
    best_score = averages[best_agent]["scores"]["gesamt"]
    lines.append(f"**Gesamtsieger:** {best_agent} ({best_score:.2f}/5.00)")
    lines.append("")

    # === Performance ===
    lines.append("## Performance")
    lines.append("")
    header = "| Metrik | " + " | ".join(agents) + " |"
    lines.append(header)
    lines.append(separator)

    row = "| Avg. Antwortzeit (s) | "
    row += " | ".join(f"{averages[a]['performance']['avg_elapsed']:.1f}" for a in agents) + " |"
    lines.append(row)

    row = "| Avg. Tokens | "
    row += " | ".join(f"{averages[a]['performance']['avg_tokens']}" for a in agents) + " |"
    lines.append(row)

    row = "| Avg. Effizienz (Score/kToken) | "
    row += " | ".join(f"{averages[a]['performance']['avg_effizienz']:.3f}" for a in agents) + " |"
    lines.append(row)
    lines.append("")

    # === Scores nach Kategorie ===
    lines.append("## Scores nach Kategorie")
    lines.append("")
    header = "| Kategorie | " + " | ".join(agents) + " | Gewinner |"
    separator_ext = "|---|" + "|".join(["---"] * len(agents)) + "|---|"
    lines.append(header)
    lines.append(separator_ext)
    for cat in sorted(cat_scores.keys()):
        row = f"| {cat} | "
        scores_row = cat_scores[cat]
        row += " | ".join(f"{scores_row.get(a, 0):.2f}" for a in agents)
        winner = max(agents, key=lambda a: scores_row.get(a, 0))
        row += f" | {winner} |"
        lines.append(row)
    lines.append("")

    # === Scores nach Schwierigkeit ===
    lines.append("## Scores nach Schwierigkeit")
    lines.append("")
    header = "| Schwierigkeit | " + " | ".join(agents) + " |"
    lines.append(header)
    lines.append(separator)
    for diff in ["einfach", "mittel", "schwer"]:
        if diff in diff_scores:
            row = f"| {diff} | "
            row += " | ".join(f"{diff_scores[diff].get(a, 0):.2f}" for a in agents)
            row += " |"
            lines.append(row)
    lines.append("")

    # === Binary Checks ===
    lines.append("## Binary Checks (Bestanden/Total)")
    lines.append("")
    all_checks = set()
    for a in agents:
        all_checks.update(averages[a].get("binary_checks", {}).keys())
    if all_checks:
        header = "| Check | " + " | ".join(agents) + " |"
        lines.append(header)
        lines.append(separator)
        for check in sorted(all_checks):
            row = f"| {check} | "
            row += " | ".join(averages[a].get("binary_checks", {}).get(check, "-") for a in agents)
            row += " |"
            lines.append(row)
    lines.append("")

    # === Fehleranalyse ===
    if failures:
        lines.append("## Fehleranalyse")
        lines.append("")
        lines.append(f"**{len(failures)} Tests mit Score < 2.0 oder Fehlern:**")
        lines.append("")
        for f in failures:
            lines.append(f"- **{f['test_id']}** / {f['agent']}: Score {f['gesamt']:.1f}")
            if f.get("error"):
                lines.append(f"  - Fehler: {f['error']}")
            for dim, notes in f.get("notes", {}).items():
                if notes:
                    lines.append(f"  - {dim}: {'; '.join(notes)}")
        lines.append("")

    # === Verbesserungsvorschlaege ===
    lines.append("## Verbesserungsvorschlaege")
    lines.append("")

    # Analyze weaknesses
    api_only = averages.get("api-only", {}).get("scores", {})
    web_only = averages.get("web-only", {}).get("scores", {})
    knowledge = averages.get("knowledge-only", {}).get("scores", {})

    if api_only and web_only:
        if api_only.get("gesamt", 0) < web_only.get("gesamt", 0):
            lines.append("- **API-Qualitaet:** Web-Recherche liefert bessere Ergebnisse als die Paragraf API. "
                         "Moeglicherweise muessen Embedding-Qualitaet oder Reranking verbessert werden.")
        else:
            lines.append("- **API-Staerke:** Paragraf API liefert bessere Ergebnisse als reine Web-Recherche. "
                         "Das System bietet Mehrwert gegenueber generischer Suche.")

    if api_only:
        if api_only.get("vollstaendigkeit", 0) < 3:
            lines.append("- **Vollstaendigkeit verbessern:** Die API findet nicht alle relevanten Paragraphen. "
                         "Retrieval-Top-K erhoehen oder Chunking-Strategie ueberpruefen.")
        if api_only.get("korrektheit", 0) < 4:
            lines.append("- **Korrektheit verbessern:** Einige zitierte Paragraphen sind falsch. "
                         "Similarity-Threshold anpassen oder Reranker-Qualitaet pruefen.")

    if knowledge:
        if knowledge.get("gesamt", 0) > 3:
            lines.append("- **Hinweis:** LLM-Wissen allein ist bereits recht gut. "
                         "Der Mehrwert der API zeigt sich vor allem bei spezifischen/aktuellen Normen.")

    lines.append("")

    # === API-Feedback ===
    bewertungen = load_api_bewertungen(workspace)
    if bewertungen:
        feedback = aggregate_api_feedback(bewertungen)
        lines.append("## API-Feedback (Selbstbewertung durch Agenten)")
        lines.append("")
        if feedback.get("durchschnittsnote") is not None:
            lines.append(f"**Durchschnittsnote:** {feedback['durchschnittsnote']}/5 "
                         f"({feedback['anzahl_bewertungen']} Bewertungen)")
            lines.append("")

        if feedback.get("top_staerken"):
            lines.append("### Staerken")
            lines.append("")
            for item, count in feedback["top_staerken"]:
                lines.append(f"- {item} ({count}x)")
            lines.append("")

        if feedback.get("top_schwaechen"):
            lines.append("### Schwaechen")
            lines.append("")
            for item, count in feedback["top_schwaechen"]:
                lines.append(f"- {item} ({count}x)")
            lines.append("")

        if feedback.get("top_feature_ideen"):
            lines.append("### Feature-Ideen")
            lines.append("")
            for item, count in feedback["top_feature_ideen"]:
                lines.append(f"- {item} ({count}x)")
            lines.append("")

        if feedback.get("top_einstellungen"):
            lines.append("### Einstellungsvorschlaege")
            lines.append("")
            for item, count in feedback["top_einstellungen"]:
                lines.append(f"- {item} ({count}x)")
            lines.append("")

        if feedback.get("fehler"):
            lines.append("### Aufgetretene Fehler")
            lines.append("")
            for item, count in feedback["fehler"]:
                lines.append(f"- {item} ({count}x)")
            lines.append("")

    # === Vergleich mit letztem Run ===
    history_path = PROJECT_DIR / "workspace" / "history.json"
    history = load_history(history_path)
    if history["runs"]:
        last_run = history["runs"][-1]
        lines.append(f"## Vergleich mit letztem Run ({last_run['run_id']}, commit {last_run.get('git_commit', '?')})")
        lines.append("")
        cmp_agents = sorted(set(agents) & set(last_run.get("scores", {}).keys()))
        if cmp_agents:
            header = "| Agent | Gesamt | Delta | Korrektheit | Delta | Vollst. | Delta |"
            sep = "|---|---|---|---|---|---|---|"
            lines.append(header)
            lines.append(sep)
            for a in cmp_agents:
                cur = averages[a]["scores"]
                prev = last_run["scores"].get(a, {})
                g_cur = cur.get("gesamt", 0)
                g_prev = prev.get("gesamt", 0)
                k_cur = cur.get("korrektheit", 0)
                k_prev = prev.get("korrektheit", 0)
                v_cur = cur.get("vollstaendigkeit", 0)
                v_prev = prev.get("vollstaendigkeit", 0)
                g_delta = g_cur - g_prev
                k_delta = k_cur - k_prev
                v_delta = v_cur - v_prev
                lines.append(
                    f"| {a} | {g_cur:.2f} | {g_delta:+.2f} | {k_cur:.2f} | {k_delta:+.2f} | {v_cur:.2f} | {v_delta:+.2f} |"
                )
            lines.append("")
        else:
            lines.append("*Keine ueberlappenden Agenten mit letztem Run.*")
            lines.append("")

    # === Einzelergebnisse ===
    lines.append("## Einzelergebnisse")
    lines.append("")
    lines.append("| Test | Agent | Korr. | Voll. | Rel. | Quell. | Gesamt | Zeit | Tokens |")
    lines.append("|---|---|---|---|---|---|---|---|---|")
    for g in sorted(gradings, key=lambda x: (x["test_id"], x["agent"])):
        s = g["scores"]
        p = g["performance"]
        lines.append(
            f"| {g['test_id']} | {g['agent']} | "
            f"{s['korrektheit']} | {s['vollstaendigkeit']} | {s['relevanz']} | {s['quellenangabe']} | "
            f"**{g['gesamt']:.1f}** | {p['elapsed_seconds']:.0f}s | {p['total_tokens']} |"
        )
    lines.append("")

    lines.append("---")
    lines.append("*Generiert von Paragraf-Bench*")

    return "\n".join(lines)


def generate_benchmark_json(grading_data: dict) -> dict:
    """Erzeugt benchmark.json im skill-creator Schema."""
    gradings = grading_data["gradings"]
    averages = agent_averages(gradings)

    return {
        "name": "paragraf-bench",
        "version": "1.0",
        "run_id": grading_data["run_id"],
        "timestamp": grading_data["timestamp"],
        "agents": {
            agent: {
                "scores": data["scores"],
                "performance": data["performance"],
                "binary_checks": data["binary_checks"],
            }
            for agent, data in averages.items()
        },
        "category_scores": dict(category_scores(gradings)),
        "difficulty_scores": dict(difficulty_scores(gradings)),
        "total_tests": grading_data["summary"]["total_tests"],
        "total_agents": grading_data["summary"]["total_agents"],
    }


def main():
    parser = argparse.ArgumentParser(description="Paragraf-Bench Berichtsgenerierung")
    parser.add_argument("--workspace", type=str, required=True, help="Workspace-Verzeichnis mit grading.json")

    args = parser.parse_args()
    workspace = Path(args.workspace)

    grading_data = load_grading(workspace)

    # Generate Markdown report
    markdown = generate_markdown(grading_data, workspace)
    md_file = workspace / "benchmark.md"
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(markdown)
    print(f"Bericht: {md_file}")

    # Generate JSON report
    benchmark = generate_benchmark_json(grading_data)
    json_file = workspace / "benchmark.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(benchmark, f, ensure_ascii=False, indent=2)
    print(f"JSON: {json_file}")

    # Append to history
    averages = agent_averages(grading_data["gradings"])
    git_info = get_git_info()

    # Load meta.json for filter info
    meta_path = workspace / "meta.json"
    meta = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

    history_entry = {
        "run_id": grading_data["run_id"],
        "timestamp": grading_data["timestamp"],
        "git_commit": git_info.get("commit", "unknown"),
        "git_branch": git_info.get("branch", "unknown"),
        "git_dirty": git_info.get("dirty", False),
        "tests_count": grading_data["summary"]["total_tests"],
        "agents_count": grading_data["summary"]["total_agents"],
        "filter": meta.get("filter", {"category": None, "difficulty": None}),
        "scores": {
            agent: data["scores"]
            for agent, data in averages.items()
        },
        "performance": {
            agent: data["performance"]
            for agent, data in averages.items()
        },
    }
    history_path = PROJECT_DIR / "workspace" / "history.json"
    append_to_history(history_path, history_entry)
    print(f"History: {history_path}")

    # Print summary
    print(f"\n{'=' * 50}")
    print("Zusammenfassung:")
    for agent in sorted(averages.keys()):
        score = averages[agent]["scores"]["gesamt"]
        tokens = averages[agent]["performance"]["avg_tokens"]
        print(f"  {agent:20s}: {score:.2f}/5.00  ({tokens} avg tokens)")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
