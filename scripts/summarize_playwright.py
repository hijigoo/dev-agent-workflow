#!/usr/bin/env python3
"""Summarize this repository's Playwright scenarios for a job report."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Iterator


def iter_specs(suites: list[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    for suite in suites:
        for spec in suite.get("specs") or []:
            if isinstance(spec, dict):
                yield spec
        nested = suite.get("suites") or []
        if nested:
            yield from iter_specs(nested)


def scenario_status(spec: dict[str, Any]) -> str:
    tests = spec.get("tests") or []
    if not tests:
        return "failed"

    final_statuses = []
    for test in tests:
        if not isinstance(test, dict):
            continue
        results = test.get("results") or []
        final = results[-1].get("status") if results else test.get("status")
        if test.get("status") == "unexpected":
            final = "failed"
        final_statuses.append(final)

    if any(
        status in {"failed", "timedOut", "interrupted"} for status in final_statuses
    ):
        return "failed"
    if final_statuses and all(status == "skipped" for status in final_statuses):
        return "skipped"
    return "passed"


def summarize_payload(
    payload: dict[str, Any], runner_outcome: str
) -> list[dict[str, str]]:
    scenarios = []
    for spec in iter_specs(payload.get("suites") or []):
        title = spec.get("title")
        if not isinstance(title, str):
            continue
        scenarios.append({"title": title, "status": scenario_status(spec)})

    stats = payload.get("stats") or {}
    unexpected = stats.get("unexpected", 0) if isinstance(stats, dict) else 0
    runner_failed = (
        runner_outcome != "success"
        or bool(payload.get("errors"))
        or (isinstance(unexpected, int) and unexpected > 0)
    )

    if not scenarios:
        if runner_outcome == "success":
            raise ValueError("Playwright report contains no scenarios")
        return [{"title": "Playwright 실행", "status": "failed"}]
    if runner_failed and not any(item["status"] == "failed" for item in scenarios):
        scenarios.append({"title": "Playwright runner", "status": "failed"})
    return scenarios


def format_status(status: str) -> str:
    return {
        "passed": "✅ 성공",
        "failed": "❌ 실패",
        "skipped": "⏭️ 미실행",
    }.get(status, status)


def build_report(
    scenarios: list[dict[str, str]], sha: str, runner_outcome: str
) -> tuple[str, int]:
    failed_count = sum(item["status"] == "failed" for item in scenarios)
    rows = [
        f"| {item['title']} | {format_status(item['status'])} |"
        for item in scenarios
    ]
    report = "\n".join(
        [
            "# 06 · Manual Project E2E",
            "",
            f"- **실행 SHA:** `{sha}`",
            f"- **Playwright step:** `{runner_outcome}`",
            f"- **실패 scenario:** {failed_count}개",
            "",
            "| 프로젝트 E2E scenario | 결과 |",
            "|---|---|",
            *rows,
            "",
            "> Meeting API와 Web을 runner에서 실제 기동하고 Chromium으로 검증한 결과입니다.",
        ]
    )
    return report, failed_count


def write_github_output(path: str, failed_count: int, report_path: Path) -> None:
    with open(path, "a", encoding="utf-8") as output:
        output.write(f"failed_count={failed_count}\n")
        output.write(f"report_path={report_path}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--runner-outcome", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--output", type=Path, default=Path("e2e-report.md"))
    args = parser.parse_args()

    if args.input.exists():
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Playwright report root must be an object")
    else:
        payload = {"suites": []}

    scenarios = summarize_payload(payload, args.runner_outcome)
    report, failed_count = build_report(
        scenarios, args.sha, args.runner_outcome
    )
    args.output.write_text(report + "\n", encoding="utf-8")
    print(report)

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        write_github_output(github_output, failed_count, args.output)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
