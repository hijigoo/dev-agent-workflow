#!/usr/bin/env python3
"""Build a privacy-safe weekly quality report from aggregate metrics."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

FORBIDDEN_KEYS = {
    "prompt",
    "raw_prompt",
    "transcript",
    "user_id",
    "email",
    "phone",
}


def reject_sensitive_fields(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in FORBIDDEN_KEYS:
                raise ValueError(f"sensitive field is not allowed: {path}.{key}")
            reject_sensitive_fields(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_sensitive_fields(child, f"{path}[{index}]")


def fetch_metrics(url: str, token: str | None) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "cloud-agent-platform-demo",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Metrics API returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Metrics API request failed: {exc.reason}") from exc
    if not isinstance(payload, dict):
        raise ValueError("Metrics API response must be an object")
    return payload


def metric_change(metric: dict[str, Any]) -> float:
    current = metric.get("current")
    baseline = metric.get("baseline")
    if not isinstance(current, (int, float)) or not isinstance(
        baseline, (int, float)
    ):
        raise ValueError("Metric current and baseline must be numeric")
    return current - baseline


def is_regression(metric: dict[str, Any], relative_threshold: float) -> bool:
    current = float(metric["current"])
    baseline = float(metric["baseline"])
    if baseline == 0:
        return False
    change = (current - baseline) / abs(baseline)
    lower_is_bad = metric.get("lower_is_bad")
    if not isinstance(lower_is_bad, bool):
        raise ValueError("Metric lower_is_bad must be boolean")
    return change < -relative_threshold if not lower_is_bad else change > relative_threshold


def build_report(payload: dict[str, Any], threshold: float = 0.1) -> tuple[str, int]:
    reject_sensitive_fields(payload)
    metrics = payload.get("metrics")
    clusters = payload.get("clusters", [])
    if not isinstance(metrics, dict) or not isinstance(clusters, list):
        raise ValueError("Payload requires metrics object and clusters array")

    regressions: list[str] = []
    rows: list[str] = []
    for name, metric in metrics.items():
        if not isinstance(metric, dict):
            raise ValueError(f"Metric {name} must be an object")
        change = metric_change(metric)
        regressed = is_regression(metric, threshold)
        if regressed:
            regressions.append(name)
        rows.append(
            f"| `{name}` | {metric['current']} | {metric['baseline']} | "
            f"{change:+.4g} | {'REGRESSION' if regressed else 'OK'} |"
        )

    cluster_lines = []
    for cluster in sorted(
        clusters,
        key=lambda item: item.get("count", 0) if isinstance(item, dict) else 0,
        reverse=True,
    )[:5]:
        if not isinstance(cluster, dict):
            raise ValueError("Cluster entries must be objects")
        cluster_lines.append(
            f"- **{cluster.get('name', 'unknown')}**: {cluster.get('count', 0)} "
            f"events (`{cluster.get('evidence', 'no-evidence')}`)"
        )

    report = "\n".join(
        [
            "# Weekly agent quality report",
            "",
            f"- Period: `{payload.get('period', 'unknown')}`",
            f"- Baseline: `{payload.get('baseline_period', 'unknown')}`",
            f"- Regressions: **{len(regressions)}**",
            "",
            "| Metric | Current | Baseline | Change | Status |",
            "|---|---:|---:|---:|---|",
            *rows,
            "",
            "## Top aggregate failure clusters",
            "",
            *(cluster_lines or ["- No aggregate failure clusters supplied."]),
            "",
            "## Recommended next step",
            "",
            (
                "Create a review issue for the regressed metrics: "
                + ", ".join(f"`{name}`" for name in regressions)
                if regressions
                else "No threshold breach. Keep the current monitoring cadence."
            ),
            "",
            "> This report accepts aggregate data only. It must not contain raw prompts, "
            "transcripts, user identifiers, email addresses, or phone numbers.",
        ]
    )
    return report, len(regressions)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--url")
    parser.add_argument("--output", type=Path, default=Path("quality-report.md"))
    parser.add_argument("--threshold", type=float, default=0.1)
    args = parser.parse_args()

    url = args.url or os.getenv("QUALITY_METRICS_URL")
    if url:
        payload = fetch_metrics(url, os.getenv("QUALITY_METRICS_TOKEN"))
    elif args.input:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
    else:
        raise ValueError("Provide --input, --url, or QUALITY_METRICS_URL")
    if not isinstance(payload, dict):
        raise ValueError("Metrics payload must be an object")

    report, regression_count = build_report(payload, args.threshold)
    args.output.write_text(report + "\n", encoding="utf-8")
    print(report)
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as output:
            output.write(f"regression_count={regression_count}\n")
            output.write(f"report_path={args.output}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)

