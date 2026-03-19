#!/usr/bin/env python3
"""Paragraf-Bench Berichtsgenerierung: erzeugt Markdown-Vergleichsbericht."""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent


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

    # Print summary
    averages = agent_averages(grading_data["gradings"])
    print(f"\n{'=' * 50}")
    print("Zusammenfassung:")
    for agent in sorted(averages.keys()):
        score = averages[agent]["scores"]["gesamt"]
        tokens = averages[agent]["performance"]["avg_tokens"]
        print(f"  {agent:20s}: {score:.2f}/5.00  ({tokens} avg tokens)")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
