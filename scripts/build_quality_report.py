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

METRIC_LABELS = {
    "task_completion_rate": "작업 완료율",
    "tool_success_rate": "도구 실행 성공률",
    "fallback_rate": "대체 처리 비율",
    "no_answer_rate": "무응답 비율",
    "p95_latency_ms": "응답 지연시간(P95)",
}

CLUSTER_LABELS = {
    "provider-timeout": "외부 제공자 응답 시간 초과",
    "tool-schema-mismatch": "도구 입력 형식 불일치",
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


def format_value(name: str, value: int | float) -> str:
    if name.endswith("_rate"):
        return f"{value * 100:.1f}%"
    if name.endswith("_ms"):
        return f"{value:,.0f} ms"
    return f"{value:,.4g}"


def format_change(name: str, change: float) -> str:
    if name.endswith("_rate"):
        return f"{change * 100:+.1f}%p"
    if name.endswith("_ms"):
        return f"{change:+,.0f} ms"
    return f"{change:+,.4g}"


def format_relative_change(metric: dict[str, Any]) -> str:
    current = float(metric["current"])
    baseline = float(metric["baseline"])
    if baseline == 0:
        return "계산 불가"
    return f"{(current - baseline) / abs(baseline) * 100:+.1f}%"


def format_period(value: Any) -> str:
    labels = {
        "week": "이번 주",
        "baseline": "기준 기간",
        "previous-4-weeks": "직전 4주 평균",
        "unknown": "정보 없음",
    }
    text = str(value)
    return labels.get(text, text)


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
        direction = "낮을수록 좋음" if metric["lower_is_bad"] else "높을수록 좋음"
        label = METRIC_LABELS.get(name, name.replace("_", " "))
        rows.append(
            f"| **{label}**<br><sub>`{name}`</sub> | "
            f"{format_value(name, metric['current'])} | "
            f"{format_value(name, metric['baseline'])} | "
            f"{format_change(name, change)} | {format_relative_change(metric)} | "
            f"{direction} | {'⚠️ 기준 대비 저하' if regressed else '✅ 허용 범위'} |"
        )

    cluster_lines = []
    for cluster in sorted(
        clusters,
        key=lambda item: item.get("count", 0) if isinstance(item, dict) else 0,
        reverse=True,
    )[:5]:
        if not isinstance(cluster, dict):
            raise ValueError("Cluster entries must be objects")
        cluster_name = str(cluster.get("name", "unknown"))
        cluster_label = CLUSTER_LABELS.get(cluster_name, cluster_name.replace("-", " "))
        cluster_lines.append(
            f"- **{cluster_label}**: {cluster.get('count', 0)}건 "
            f"(근거: `{cluster.get('evidence', '근거 없음')}`)"
        )

    threshold_percent = threshold * 100
    report = "\n".join(
        [
            "# 에이전트 품질 리포트",
            "",
            f"- **분석 기간:** {format_period(payload.get('period', 'unknown'))}",
            f"- **비교 기준:** {format_period(payload.get('baseline_period', 'unknown'))}",
            f"- **기준 대비 저하 지표:** **{len(regressions)}개**",
            f"- **판정 기준:** 비교 기준보다 **{threshold_percent:g}% 초과 악화**",
            "",
            "> **‘기준 대비 저하’란?** 현재 값이 비교 기준보다 설정된 허용 범위를 "
            "넘어 나빠졌다는 의미입니다. 테스트 실패를 뜻하지 않으며, 원인 확인이 "
            "필요한 품질 추세를 표시합니다.",
            "",
            "| 품질 지표 | 현재 값 | 기준 값 | 값의 변화 | 기준 대비 변화율 | 좋은 방향 | 판정 |",
            "|---|---:|---:|---:|---:|---|---|",
            *rows,
            "",
            "## 주요 실패 유형",
            "",
            *(cluster_lines or ["- 집계된 실패 유형이 없습니다."]),
            "",
            "## 권장 조치",
            "",
            (
                "다음 저하 지표의 집계 근거와 원인을 검토하세요: "
                + ", ".join(
                    f"**{METRIC_LABELS.get(name, name.replace('_', ' '))}**"
                    for name in regressions
                )
                if regressions
                else "허용 범위를 벗어난 지표가 없습니다. 현재 모니터링 주기를 유지하세요."
            ),
            "",
            "> 이 리포트는 비식별 집계 데이터만 사용합니다. 원문 프롬프트, 대화 내용, "
            "사용자 식별자, 이메일 주소 또는 전화번호를 포함하면 안 됩니다.",
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
