#!/usr/bin/env python3
"""Compare tracked upstream versions with the latest GitHub releases."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def latest_release(repository: str, token: str | None = None) -> dict[str, Any]:
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/releases/latest",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "cloud-agent-platform-demo",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"GitHub Releases API returned HTTP {exc.code} for {repository}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"GitHub Releases API request failed for {repository}: {exc.reason}"
        ) from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("tag_name"), str):
        raise RuntimeError(f"Latest release for {repository} omitted tag_name")
    return payload


def compare_versions(
    configuration: dict[str, Any], releases: dict[str, dict[str, Any]]
) -> list[dict[str, str]]:
    updates: list[dict[str, str]] = []
    for dependency, settings in configuration.items():
        if not isinstance(settings, dict):
            raise ValueError(f"{dependency} configuration must be an object")
        repository = settings.get("repository")
        installed = settings.get("installed_version")
        if not isinstance(repository, str) or not isinstance(installed, str):
            raise ValueError(
                f"{dependency} requires repository and installed_version strings"
            )
        release = releases[dependency]
        latest = release["tag_name"]
        if latest != installed:
            updates.append(
                {
                    "dependency": dependency,
                    "repository": repository,
                    "installed_version": installed,
                    "latest_version": latest,
                    "release_url": str(release.get("html_url", "")),
                    "published_at": str(release.get("published_at", "")),
                }
            )
    return updates


def write_github_output(path: str, updates: list[dict[str, str]]) -> None:
    compact = json.dumps(updates, separators=(",", ":"))
    with open(path, "a", encoding="utf-8") as output:
        output.write(f"updates={compact}\n")
        output.write(f"update_count={len(updates)}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config", default="dependencies/upstream-versions.json", type=Path
    )
    parser.add_argument(
        "--releases-file",
        type=Path,
        help="Use deterministic release data instead of the GitHub API",
    )
    args = parser.parse_args()

    configuration = json.loads(args.config.read_text(encoding="utf-8"))
    if not isinstance(configuration, dict):
        raise ValueError("Upstream configuration must be a JSON object")

    if args.releases_file:
        releases = json.loads(args.releases_file.read_text(encoding="utf-8"))
    else:
        token = os.getenv("GITHUB_TOKEN")
        releases = {
            name: latest_release(settings["repository"], token)
            for name, settings in configuration.items()
        }

    updates = compare_versions(configuration, releases)
    output = {"updates": updates, "update_count": len(updates)}
    print(json.dumps(output, ensure_ascii=False, indent=2))

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        write_github_output(github_output, updates)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)

