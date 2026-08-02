#!/usr/bin/env python3
"""Build a privacy-safe severity summary from CodeQL SARIF files."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

CATEGORIES = ("critical", "high", "medium", "low", "other")


def rule_map(run: dict[str, Any]) -> dict[str, dict[str, Any]]:
    tool = run.get("tool", {})
    driver = tool.get("driver", {})
    rules = list(driver.get("rules") or [])
    for extension in tool.get("extensions") or []:
        if isinstance(extension, dict):
            rules.extend(extension.get("rules") or [])
    return {
        rule["id"]: rule
        for rule in rules
        if isinstance(rule, dict) and isinstance(rule.get("id"), str)
    }


def security_score(rule: dict[str, Any]) -> float | None:
    properties = rule.get("properties")
    if not isinstance(properties, dict):
        return None
    value = properties.get("security-severity")
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def category_for_score(score: float | None) -> str:
    if score is None or score <= 0:
        return "other"
    if score >= 9:
        return "critical"
    if score >= 7:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def finding_key(result: dict[str, Any]) -> tuple[Any, ...]:
    location = (
        ((result.get("locations") or [{}])[0].get("physicalLocation") or {})
        if isinstance(result.get("locations"), list)
        else {}
    )
    artifact = location.get("artifactLocation") or {}
    region = location.get("region") or {}
    message = result.get("message") or {}
    return (
        result.get("ruleId"),
        artifact.get("uri"),
        region.get("startLine"),
        message.get("text"),
    )


def summarize_payloads(payloads: list[dict[str, Any]]) -> dict[str, int]:
    findings: dict[tuple[Any, ...], str] = {}
    for payload in payloads:
        for run in payload.get("runs") or []:
            if not isinstance(run, dict):
                continue
            rules = rule_map(run)
            for result in run.get("results") or []:
                if not isinstance(result, dict):
                    continue
                rule = rules.get(str(result.get("ruleId")), {})
                findings[finding_key(result)] = category_for_score(
                    security_score(rule)
                )

    counts = {category: 0 for category in CATEGORIES}
    for category in findings.values():
        counts[category] += 1
    return {"total": len(findings), **counts}


def load_sarif_files(directory: Path) -> list[dict[str, Any]]:
    payloads = []
    for path in sorted(directory.rglob("*.sarif")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError(f"SARIF root must be an object: {path}")
        payloads.append(payload)
    return payloads


def build_report(counts: dict[str, int], branch: str, sha: str) -> str:
    return "\n".join(
        [
            "# 04 · Manual Branch CodeQL",
            "",
            f"- **대상 branch:** `{branch}`",
            f"- **대상 SHA:** `{sha}`",
            "- **언어:** `python`, `javascript-typescript`",
            "",
            "| CodeQL SARIF 결과 | 건수 |",
            "|---|---:|",
            f"| 전체 | {counts['total']} |",
            f"| Critical | {counts['critical']} |",
            f"| High | {counts['high']} |",
            f"| Medium | {counts['medium']} |",
            f"| Low | {counts['low']} |",
            f"| 기타 품질 경고 | {counts['other']} |",
            "",
            "> 상세 파일·경로·수정 가이드는 GitHub Security의 해당 branch "
            "Code scanning 화면에서 확인합니다.",
        ]
    )


def write_github_output(path: str, counts: dict[str, int], report_path: Path) -> None:
    with open(path, "a", encoding="utf-8") as output:
        for key, value in counts.items():
            output.write(f"{key}={value}\n")
        output.write(f"report_path={report_path}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--output", type=Path, default=Path("codeql-report.md"))
    args = parser.parse_args()

    counts = summarize_payloads(load_sarif_files(args.input_dir))
    report = build_report(counts, args.branch, args.sha)
    args.output.write_text(report + "\n", encoding="utf-8")
    print(report)

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        write_github_output(github_output, counts, args.output)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
