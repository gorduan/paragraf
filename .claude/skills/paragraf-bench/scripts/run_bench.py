#!/usr/bin/env python3
"""Paragraf-Bench Orchestrator: startet Subagenten und sammelt Ergebnisse."""

import argparse
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = SKILL_DIR.parent.parent.parent  # .agents/skills/paragraf-bench -> project root
CATALOG_PATH = SKILL_DIR / "references" / "test-catalog.json"
AGENTS_DIR = SKILL_DIR / "agents"
API_REF_PATH = SKILL_DIR / "references" / "api-reference.md"

AGENT_CONFIGS = {
    "api-only": {
        "prompt_file": AGENTS_DIR / "api-only.md",
        "allowed_tools": "Bash",
        "description": "Nur REST-API",
    },
    "api-web": {
        "prompt_file": AGENTS_DIR / "api-web.md",
        "allowed_tools": "Bash,WebSearch,WebFetch",
        "description": "REST-API + Web",
    },
    "web-only": {
        "prompt_file": AGENTS_DIR / "web-only.md",
        "allowed_tools": "WebSearch,WebFetch",
        "description": "Nur Web-Recherche",
    },
    "knowledge-only": {
        "prompt_file": AGENTS_DIR / "knowledge-only.md",
        "allowed_tools": "",
        "description": "Nur LLM-Wissen",
    },
}

API_BASE = os.environ.get("PARAGRAF_API_URL", "http://localhost:8000")


def load_catalog() -> dict:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def check_api_health() -> bool:
    """Prueft ob die Paragraf API erreichbar ist."""
    try:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{API_BASE}/api/health"],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout.strip() == "200"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def filter_tests(catalog: dict, category: str | None, difficulty: str | None, test_id: str | None) -> list[dict]:
    tests = catalog["tests"]
    if test_id:
        tests = [t for t in tests if t["id"] == test_id]
    if category:
        tests = [t for t in tests if t["category"] == category or t["id"].startswith(category)]
    if difficulty:
        tests = [t for t in tests if t["difficulty"] == difficulty]
    return tests


def build_prompt(test: dict, agent_name: str) -> str:
    """Baut den vollstaendigen Prompt fuer einen Subagenten."""
    agent_cfg = AGENT_CONFIGS[agent_name]
    system_prompt = agent_cfg["prompt_file"].read_text(encoding="utf-8")
    api_ref = API_REF_PATH.read_text(encoding="utf-8") if agent_name in ("api-only", "api-web") else ""

    prompt = f"""{system_prompt}

"""
    if api_ref:
        prompt += f"""## API-Referenz

{api_ref}

"""
    prompt += f"""## Aufgabe

Beantworte folgende juristische Frage:

{test["question"]}

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt im vorgegebenen Format. Kein Markdown, kein erklaerener Text drumherum. Nur das JSON."""

    return prompt


def run_single(test: dict, agent_name: str, workspace: Path) -> dict:
    """Fuehrt einen einzelnen Test mit einem Agenten aus."""
    result_dir = workspace / test["id"]
    result_dir.mkdir(parents=True, exist_ok=True)
    result_file = result_dir / f"{agent_name}.json"
    timing_file = result_dir / f"{agent_name}_timing.json"

    prompt = build_prompt(test, agent_name)
    agent_cfg = AGENT_CONFIGS[agent_name]

    cmd = ["claude", "-p", prompt, "--output-format", "json"]
    if agent_cfg["allowed_tools"]:
        cmd.extend(["--allowedTools", agent_cfg["allowed_tools"]])
    else:
        cmd.extend(["--allowedTools", ""])

    start_time = time.time()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(PROJECT_DIR),
        )
        elapsed = time.time() - start_time

        # Parse claude output
        raw_output = proc.stdout.strip()
        claude_result = None
        agent_response = None
        total_input_tokens = 0
        total_output_tokens = 0

        # claude -p --output-format json returns JSON with usage nested
        try:
            claude_result = json.loads(raw_output)
            response_text = claude_result.get("result", raw_output)
            usage = claude_result.get("usage", {})
            total_input_tokens = usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0)
            total_output_tokens = usage.get("output_tokens", 0)
        except json.JSONDecodeError:
            response_text = raw_output

        # Extract the agent's JSON response from the response text
        agent_response = extract_json(response_text)

        timing = {
            "agent": agent_name,
            "test_id": test["id"],
            "elapsed_seconds": round(elapsed, 2),
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "total_tokens": total_input_tokens + total_output_tokens,
            "exit_code": proc.returncode,
        }

        if agent_response:
            # Extract api_bewertung separately for API-using agents
            api_bewertung = agent_response.pop("api_bewertung", None)
            with open(result_file, "w", encoding="utf-8") as f:
                json.dump(agent_response, f, ensure_ascii=False, indent=2)
            if api_bewertung and agent_name in ("api-only", "api-web"):
                bewertung_file = result_dir / f"{agent_name}_api_bewertung.json"
                with open(bewertung_file, "w", encoding="utf-8") as f:
                    json.dump(api_bewertung, f, ensure_ascii=False, indent=2)
        else:
            # Save raw output for debugging
            error_result = {
                "antwort": "",
                "quellen": [],
                "rdg_disclaimer": False,
                "methodik": [],
                "confidence": 0,
                "_error": "Failed to parse agent response",
                "_raw_output": response_text[:2000],
            }
            with open(result_file, "w", encoding="utf-8") as f:
                json.dump(error_result, f, ensure_ascii=False, indent=2)

        with open(timing_file, "w", encoding="utf-8") as f:
            json.dump(timing, f, ensure_ascii=False, indent=2)

        return {
            "test_id": test["id"],
            "agent": agent_name,
            "success": agent_response is not None,
            "elapsed": round(elapsed, 2),
            "tokens": total_input_tokens + total_output_tokens,
        }

    except subprocess.TimeoutExpired:
        elapsed = time.time() - start_time
        error_result = {
            "antwort": "",
            "quellen": [],
            "rdg_disclaimer": False,
            "methodik": [],
            "confidence": 0,
            "_error": "Timeout after 180s",
        }
        with open(result_file, "w", encoding="utf-8") as f:
            json.dump(error_result, f, ensure_ascii=False, indent=2)

        timing = {
            "agent": agent_name,
            "test_id": test["id"],
            "elapsed_seconds": round(elapsed, 2),
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "exit_code": -1,
            "error": "timeout",
        }
        with open(timing_file, "w", encoding="utf-8") as f:
            json.dump(timing, f, ensure_ascii=False, indent=2)

        return {
            "test_id": test["id"],
            "agent": agent_name,
            "success": False,
            "elapsed": round(elapsed, 2),
            "tokens": 0,
            "error": "timeout",
        }


def extract_json(text: str) -> dict | None:
    """Extrahiert ein JSON-Objekt aus Text."""
    # Try direct parse
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "antwort" in obj:
            return obj
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in text
    # Look for ```json ... ``` blocks
    import re
    json_block = re.search(r"```json?\s*\n(.*?)\n\s*```", text, re.DOTALL)
    if json_block:
        try:
            obj = json.loads(json_block.group(1))
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass

    # Try to find { ... } block
    brace_start = text.find("{")
    if brace_start >= 0:
        depth = 0
        for i in range(brace_start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[brace_start:i + 1])
                        if isinstance(obj, dict):
                            return obj
                    except json.JSONDecodeError:
                        pass
                    break
    return None


def main():
    parser = argparse.ArgumentParser(description="Paragraf-Bench Orchestrator")
    parser.add_argument("--all", action="store_true", help="Alle Tests ausfuehren")
    parser.add_argument("--category", type=str, help="Nur Tests einer Kategorie (z.B. sem, lkp, cmp)")
    parser.add_argument("--difficulty", type=str, help="Nur Tests einer Schwierigkeit (einfach, mittel, schwer)")
    parser.add_argument("--test", type=str, help="Einzelnen Test ausfuehren (z.B. sem-01)")
    parser.add_argument("--agents", type=str, default="api-only,api-web,web-only,knowledge-only",
                        help="Kommaseparierte Liste der Agenten")
    parser.add_argument("--parallel", type=int, default=2, help="Parallele Ausfuehrungen (default: 2)")
    parser.add_argument("--workspace", type=str, help="Workspace-Verzeichnis (default: auto-generiert)")
    parser.add_argument("--skip-health", action="store_true", help="API-Health-Check ueberspringen")

    args = parser.parse_args()

    if not args.all and not args.category and not args.difficulty and not args.test:
        parser.error("Mindestens --all, --category, --difficulty oder --test angeben")

    # Load catalog
    catalog = load_catalog()
    tests = filter_tests(catalog, args.category, args.difficulty, args.test)
    agents = [a.strip() for a in args.agents.split(",") if a.strip() in AGENT_CONFIGS]

    if not tests:
        print("Keine Tests gefunden fuer die angegebenen Filter.")
        sys.exit(1)

    if not agents:
        print(f"Keine gueltigen Agenten. Verfuegbar: {', '.join(AGENT_CONFIGS.keys())}")
        sys.exit(1)

    # Check API health (needed for api-only and api-web)
    api_agents = {"api-only", "api-web"}
    if not args.skip_health and api_agents.intersection(agents):
        print(f"Pruefe API-Health: {API_BASE}/api/health ...")
        if not check_api_health():
            print(f"FEHLER: Paragraf API nicht erreichbar unter {API_BASE}")
            print("Starte die API oder nutze --skip-health zum Ueberspringen.")
            sys.exit(1)
        print("API erreichbar.")

    # Setup workspace
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    workspace = Path(args.workspace) if args.workspace else PROJECT_DIR / "workspace" / "results" / run_id
    workspace.mkdir(parents=True, exist_ok=True)

    # Collect git info
    git_info = {}
    try:
        git_info["commit"] = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR),
        ).stdout.strip()
        git_info["branch"] = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR),
        ).stdout.strip()
        git_info["dirty"] = bool(subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_DIR),
        ).stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError):
        git_info = {"commit": "unknown", "branch": "unknown", "dirty": False}

    # Save run metadata
    meta = {
        "run_id": run_id,
        "timestamp": datetime.now().isoformat(),
        "tests": [t["id"] for t in tests],
        "agents": agents,
        "parallel": args.parallel,
        "total_runs": len(tests) * len(agents),
        "api_base": API_BASE,
        "git": git_info,
    }
    with open(workspace / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Paragraf-Bench Run: {run_id}")
    print(f"Tests: {len(tests)} | Agenten: {len(agents)} | Total: {len(tests) * len(agents)} Runs")
    print(f"Workspace: {workspace}")
    print(f"{'=' * 60}\n")

    # Build task list
    tasks = [(t, a) for t in tests for a in agents]
    results = []

    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = {}
        for test, agent in tasks:
            future = pool.submit(run_single, test, agent, workspace)
            futures[future] = (test["id"], agent)

        for future in as_completed(futures):
            test_id, agent = futures[future]
            try:
                result = future.result()
                status = "OK" if result["success"] else "FAIL"
                token_info = f" | {result['tokens']} tokens" if result.get("tokens") else ""
                print(f"  [{status}] {test_id} / {agent} ({result['elapsed']}s{token_info})")
                results.append(result)
            except Exception as e:
                print(f"  [ERR] {test_id} / {agent}: {e}")
                results.append({
                    "test_id": test_id,
                    "agent": agent,
                    "success": False,
                    "error": str(e),
                })

    # Save summary
    summary = {
        "run_id": run_id,
        "total": len(results),
        "success": sum(1 for r in results if r.get("success")),
        "failed": sum(1 for r in results if not r.get("success")),
        "results": results,
    }
    with open(workspace / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Fertig: {summary['success']}/{summary['total']} erfolgreich")
    print(f"Workspace: {workspace}")
    print(f"\nNaechste Schritte:")
    print(f"  python {SKILL_DIR}/scripts/grade_results.py --workspace {workspace}")
    print(f"  python {SKILL_DIR}/scripts/generate_report.py --workspace {workspace}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
