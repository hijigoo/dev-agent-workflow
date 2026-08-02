#!/usr/bin/env python3
"""Compare repository FastAPI and React versions with stable registry releases."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

JsonFetcher = Callable[[str], dict[str, Any]]

PYPI_FASTAPI_URL = "https://pypi.org/pypi/fastapi/json"
NPM_LATEST_URL = "https://registry.npmjs.org/{package}/latest"


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "dev-agent-workflow-oss-upgrade",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Registry returned HTTP {exc.code}: {url}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Registry request failed: {exc.reason}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"Registry response must be an object: {url}")
    return payload


def read_fastapi_floor(pyproject_path: Path) -> str:
    text = pyproject_path.read_text(encoding="utf-8")
    block = re.search(
        r"(?ms)^\s*dependencies\s*=\s*\[(.*?)\]",
        text,
    )
    if not block:
        raise ValueError("pyproject project.dependencies must be an array")

    for dependency in re.findall(r"""["']([^"']+)["']""", block.group(1)):
        if dependency.lower().startswith("fastapi"):
            match = re.search(r">=\s*([0-9]+(?:\.[0-9]+){1,3})", dependency)
            if not match:
                raise ValueError("FastAPI dependency requires a >= version floor")
            return match.group(1)
    raise ValueError("FastAPI dependency was not found")


def read_locked_npm_version(package_lock_path: Path, package: str) -> str:
    lock = json.loads(package_lock_path.read_text(encoding="utf-8"))
    packages = lock.get("packages")
    if not isinstance(packages, dict):
        raise ValueError("package-lock packages must be an object")
    entry = packages.get(f"node_modules/{package}")
    if not isinstance(entry, dict) or not isinstance(entry.get("version"), str):
        raise ValueError(f"Locked npm package was not found: {package}")
    return entry["version"]


def current_versions(
    pyproject_path: Path, package_lock_path: Path
) -> dict[str, dict[str, str]]:
    return {
        "fastapi": {
            "display_name": "FastAPI",
            "current_version": read_fastapi_floor(pyproject_path),
            "version_source": "minimum supported version",
            "manifest": str(pyproject_path),
        },
        "react": {
            "display_name": "React",
            "current_version": read_locked_npm_version(package_lock_path, "react"),
            "version_source": "package-lock",
            "manifest": str(package_lock_path),
        },
        "react-dom": {
            "display_name": "React DOM",
            "current_version": read_locked_npm_version(package_lock_path, "react-dom"),
            "version_source": "package-lock",
            "manifest": str(package_lock_path),
        },
    }


def latest_versions(fetcher: JsonFetcher = fetch_json) -> dict[str, dict[str, str]]:
    fastapi = fetcher(PYPI_FASTAPI_URL)
    fastapi_info = fastapi.get("info")
    if not isinstance(fastapi_info, dict) or not isinstance(
        fastapi_info.get("version"), str
    ):
        raise ValueError("PyPI FastAPI response is missing info.version")

    releases = {
        "fastapi": {
            "latest_version": fastapi_info["version"],
            "release_url": (
                f"https://pypi.org/project/fastapi/{fastapi_info['version']}/"
            ),
        }
    }
    for package in ("react", "react-dom"):
        npm = fetcher(NPM_LATEST_URL.format(package=package))
        version = npm.get("version")
        if not isinstance(version, str):
            raise ValueError(f"npm {package} response is missing version")
        releases[package] = {
            "latest_version": version,
            "release_url": f"https://www.npmjs.com/package/{package}/v/{version}",
        }
    return releases


def version_key(value: str) -> tuple[int, ...]:
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", value):
        raise ValueError(f"Only stable numeric versions are supported: {value}")
    return tuple(int(part) for part in value.split("."))


def find_updates(
    current: dict[str, dict[str, str]], latest: dict[str, dict[str, str]]
) -> list[dict[str, str]]:
    updates: list[dict[str, str]] = []
    for package, current_data in current.items():
        latest_data = latest.get(package)
        if latest_data is None:
            raise ValueError(f"Latest release is missing: {package}")
        current_version = current_data["current_version"]
        latest_version = latest_data["latest_version"]
        if version_key(latest_version) <= version_key(current_version):
            continue
        updates.append(
            {
                "package": package,
                **current_data,
                **latest_data,
            }
        )
    return updates


def build_report(
    current: dict[str, dict[str, str]],
    latest: dict[str, dict[str, str]],
    updates: list[dict[str, str]],
) -> str:
    rows = []
    update_names = {update["package"] for update in updates}
    for package, current_data in current.items():
        latest_data = latest[package]
        result = "⬆️ 업데이트 필요" if package in update_names else "✅ 최신"
        rows.append(
            f"| {current_data['display_name']} | "
            f"`{current_data['current_version']}` ({current_data['version_source']}) | "
            f"`{latest_data['latest_version']}` | {result} |"
        )

    return "\n".join(
        [
            "# 03 · OSS Upgrade Intake",
            "",
            "| 오픈소스 | 현재 기준 | 최신 stable | 판정 |",
            "|---|---|---|---|",
            *rows,
            "",
            f"- **업데이트 대상:** {len(updates)}개",
            "- **대상 manifest:** `apps/api/pyproject.toml`, "
            "`apps/web/package.json`, `apps/web/package-lock.json`",
            "",
            "> FastAPI는 현재 manifest의 최소 지원 버전을 기준으로 비교하며, "
            "React와 React DOM은 package-lock의 실제 잠금 버전을 기준으로 비교합니다.",
        ]
    )


def write_github_output(
    path: str, updates: list[dict[str, str]], report_path: Path
) -> None:
    compact = json.dumps(updates, ensure_ascii=False, separators=(",", ":"))
    with open(path, "a", encoding="utf-8") as output:
        output.write(f"update_count={len(updates)}\n")
        output.write(f"updates={compact}\n")
        output.write(f"report_path={report_path}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pyproject", type=Path, default=Path("apps/api/pyproject.toml")
    )
    parser.add_argument(
        "--package-lock", type=Path, default=Path("apps/web/package-lock.json")
    )
    parser.add_argument(
        "--output", type=Path, default=Path("oss-upgrade-report.md")
    )
    args = parser.parse_args()

    current = current_versions(args.pyproject, args.package_lock)
    latest = latest_versions()
    updates = find_updates(current, latest)
    report = build_report(current, latest, updates)
    args.output.write_text(report + "\n", encoding="utf-8")
    print(report)

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        write_github_output(github_output, updates, args.output)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
