import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_script(name: str):
    path = ROOT / "scripts" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


oss_updates = load_script("check_oss_updates")
codeql_summary = load_script("summarize_codeql_sarif")
playwright_summary = load_script("summarize_playwright")


class OssUpgradeTests(unittest.TestCase):
    def test_manifest_versions_are_compared_with_stable_releases(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pyproject = root / "pyproject.toml"
            package_lock = root / "package-lock.json"
            pyproject.write_text(
                """
[project]
dependencies = ["fastapi>=0.110,<1", "pydantic>=2.6,<3"]
""".strip(),
                encoding="utf-8",
            )
            package_lock.write_text(
                json.dumps(
                    {
                        "packages": {
                            "node_modules/react": {"version": "19.1.1"},
                            "node_modules/react-dom": {"version": "19.1.1"},
                        }
                    }
                ),
                encoding="utf-8",
            )

            current = oss_updates.current_versions(pyproject, package_lock)
            latest = {
                "fastapi": {
                    "latest_version": "0.120.0",
                    "release_url": "https://example.test/fastapi",
                },
                "react": {
                    "latest_version": "19.2.0",
                    "release_url": "https://example.test/react",
                },
                "react-dom": {
                    "latest_version": "19.1.1",
                    "release_url": "https://example.test/react-dom",
                },
            }

            updates = oss_updates.find_updates(current, latest)

            self.assertEqual(
                [item["package"] for item in updates], ["fastapi", "react"]
            )
            report = oss_updates.build_report(current, latest, updates)
            self.assertIn("업데이트 대상:** 2개", report)
            self.assertIn("minimum supported version", report)
            self.assertIn("package-lock", report)

    def test_prerelease_versions_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "stable numeric"):
            oss_updates.version_key("20.0.0-rc.1")


class CodeqlSarifSummaryTests(unittest.TestCase):
    def test_findings_are_deduplicated_and_classified_from_extension_rules(self):
        result = {
            "ruleId": "py/sql-injection",
            "message": {"text": "unsafe query"},
            "locations": [
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": "demo.py"},
                        "region": {"startLine": 12},
                    }
                }
            ],
        }
        payload = {
            "runs": [
                {
                    "tool": {
                        "driver": {"rules": []},
                        "extensions": [
                            {
                                "rules": [
                                    {
                                        "id": "py/sql-injection",
                                        "properties": {"security-severity": "8.8"},
                                    }
                                ]
                            }
                        ],
                    },
                    "results": [result],
                }
            ]
        }

        counts = codeql_summary.summarize_payloads([payload, payload])

        self.assertEqual(counts["total"], 1)
        self.assertEqual(counts["high"], 1)
        self.assertEqual(counts["other"], 0)

    def test_quality_findings_without_security_score_are_other(self):
        payload = {
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "rules": [{"id": "js/style", "properties": {}}]
                        }
                    },
                    "results": [{"ruleId": "js/style", "message": {"text": "style"}}],
                }
            ]
        }

        counts = codeql_summary.summarize_payloads([payload])

        self.assertEqual(counts["total"], 1)
        self.assertEqual(counts["other"], 1)


class PlaywrightSummaryTests(unittest.TestCase):
    def test_project_scenarios_report_pass_and_failure(self):
        payload = {
            "suites": [
                {
                    "specs": [
                        {
                            "title": "reserves a room through the real meeting API",
                            "tests": [
                                {
                                    "status": "expected",
                                    "results": [{"status": "passed"}],
                                }
                            ],
                        },
                        {
                            "title": "runs the deterministic Mini Agent",
                            "tests": [
                                {
                                    "status": "unexpected",
                                    "results": [{"status": "failed"}],
                                }
                            ],
                        },
                    ]
                }
            ]
        }

        scenarios = playwright_summary.summarize_payload(payload, "failure")
        report, failed_count = playwright_summary.build_report(
            scenarios, "abc123", "failure"
        )

        self.assertEqual(failed_count, 1)
        self.assertIn("reserves a room", report)
        self.assertIn("✅ 성공", report)
        self.assertIn("❌ 실패", report)

    def test_missing_report_is_a_failure_when_runner_failed(self):
        scenarios = playwright_summary.summarize_payload({"suites": []}, "failure")
        self.assertEqual(
            scenarios, [{"title": "Playwright 실행", "status": "failed"}]
        )

    def test_runner_failure_cannot_be_hidden_by_passed_scenarios(self):
        payload = {
            "errors": [{"message": "global reporter failure"}],
            "suites": [
                {
                    "specs": [
                        {
                            "title": "scenario passed before reporter failed",
                            "tests": [
                                {
                                    "status": "expected",
                                    "results": [{"status": "passed"}],
                                }
                            ],
                        }
                    ]
                }
            ],
        }

        scenarios = playwright_summary.summarize_payload(payload, "failure")
        _, failed_count = playwright_summary.build_report(
            scenarios, "abc123", "failure"
        )

        self.assertEqual(failed_count, 1)
        self.assertEqual(scenarios[-1]["title"], "Playwright runner")


class DeliveryWorkflowTests(unittest.TestCase):
    def test_delivery_notifies_closing_issue_before_deployment(self):
        workflow = (
            ROOT / ".github" / "workflows" / "production-deployment.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("notify-approval:", workflow)
        self.assertIn(
            "github.rest.repos.listPullRequestsAssociatedWithCommit", workflow
        )
        self.assertIn("closingIssuesReferences(first: 20)", workflow)
        self.assertIn("github.rest.issues.createComment", workflow)
        self.assertIn("<!-- aca-deployment-approval:", workflow)
        self.assertIn("needs: [evaluate, notify-approval]", workflow)
        self.assertIn("if: github.ref == 'refs/heads/main'", workflow)


class PullRequestWorkflowTests(unittest.TestCase):
    def test_validation_waits_until_pull_request_is_ready(self):
        workflow = (
            ROOT / ".github" / "workflows" / "pr-validation.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("ready_for_review", workflow)
        self.assertNotIn("synchronize", workflow)
        self.assertNotIn("github.event.pull_request.draft", workflow)
        self.assertIn("needs: quality", workflow)
        self.assertIn('name: "PR 1/2 · Quality validation"', workflow)
        self.assertIn('name: "PR 2/2 · CodeQL security"', workflow)
        self.assertNotIn("push:", workflow)

    def test_codeql_runs_for_pr_and_manual_branch_but_not_after_merge(self):
        pr = (ROOT / ".github" / "workflows" / "pr-validation.yml").read_text(
            encoding="utf-8"
        )
        deployment = (
            ROOT / ".github" / "workflows" / "production-deployment.yml"
        ).read_text(encoding="utf-8")
        manual = (
            ROOT / ".github" / "workflows" / "manual-codeql-remediation.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("security:", pr)
        self.assertEqual(pr.count("github/codeql-action/init@v4"), 1)
        self.assertNotIn("github/codeql-action/init@v4", deployment)
        self.assertEqual(manual.count("github/codeql-action/init@v4"), 1)
        self.assertFalse(
            (ROOT / ".github" / "workflows" / "weekly-quality-review.yml").exists()
        )

    def test_quality_validation_is_reused_for_pr_and_main(self):
        pr = (ROOT / ".github" / "workflows" / "pr-validation.yml").read_text(
            encoding="utf-8"
        )
        deployment = (
            ROOT / ".github" / "workflows" / "production-deployment.yml"
        ).read_text(encoding="utf-8")
        action = (
            ROOT / ".github" / "actions" / "quality-validation" / "action.yml"
        ).read_text(encoding="utf-8")

        self.assertEqual(pr.count("uses: ./.github/actions/quality-validation"), 1)
        self.assertEqual(
            deployment.count("uses: ./.github/actions/quality-validation"), 1
        )
        self.assertIn('summary-title: "PR 1/2 · Quality validation"', pr)
        self.assertIn(
            'summary-title: "Main 1/3 · Post-merge evaluation"', deployment
        )
        self.assertIn("python -m pytest", action)
        self.assertIn("npm run test:e2e", action)
        self.assertIn("Write validation summary", action)
        self.assertIn("$GITHUB_STEP_SUMMARY", action)
        self.assertNotIn("quality-report.md", action)


class ManualAgentWorkflowTests(unittest.TestCase):
    def read_workflow(self, name: str) -> str:
        return (ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")

    def assert_manual_only(self, workflow: str):
        self.assertIn("workflow_dispatch:", workflow)
        self.assertNotIn("schedule:", workflow)
        self.assertNotIn("pull_request:", workflow)
        self.assertNotIn("\n  push:", workflow)

    def test_oss_upgrade_workflow_is_manual_and_deduplicates_issue(self):
        workflow = self.read_workflow("manual-oss-upgrade-intake.yml")

        self.assert_manual_only(workflow)
        self.assertIn("python scripts/check_oss_updates.py", workflow)
        self.assertIn("group: manual-oss-upgrade-intake", workflow)
        self.assertIn("manual-oss-upgrade-intake", workflow)
        self.assertIn("github.rest.issues.update", workflow)
        self.assertIn("github.rest.issues.create", workflow)
        self.assertIn('labels: ["agent-ready", "enhancement"]', workflow)

    def test_codeql_workflow_scans_selected_branch_and_creates_one_issue(self):
        workflow = self.read_workflow("manual-codeql-remediation.yml")

        self.assert_manual_only(workflow)
        self.assertIn("target_branch:", workflow)
        self.assertIn("github.rest.repos.getBranch", workflow)
        self.assertIn("ref: ${{ steps.target.outputs.sha }}", workflow)
        self.assertIn("source-root: target", workflow)
        self.assertIn("post-processed-sarif-path: codeql-sarif", workflow)
        self.assertIn("python automation/scripts/summarize_codeql_sarif.py", workflow)
        self.assertIn("manual-codeql-remediation", workflow)
        self.assertNotIn("dependabot", workflow.lower())

    def test_codeql_security_query_command_handles_branch_name(self):
        workflow = self.read_workflow("manual-codeql-remediation.yml")
        command = workflow.split('          query="$(\n', 1)[1].split(
            '\n          )"', 1
        )[0]
        environment = {**os.environ, "TARGET_BRANCH": "feature/security-fix"}

        result = subprocess.run(
            [
                "bash",
                "-c",
                f'set -o pipefail\nquery="$(\n{command}\n)"\nprintf %s "$query"',
            ],
            check=True,
            capture_output=True,
            env=environment,
            text=True,
        )

        self.assertEqual(
            result.stdout,
            "ref%3Arefs/heads/feature/security-fix%20tool%3ACodeQL%20is%3Aopen",
        )

    def test_project_e2e_runs_existing_scenarios_and_fails_after_reporting(self):
        workflow = self.read_workflow("manual-project-e2e.yml")

        self.assert_manual_only(workflow)
        self.assertIn("npx playwright test --reporter=html,json", workflow)
        self.assertIn("group: manual-project-e2e-${{ github.ref }}", workflow)
        self.assertIn("continue-on-error: true", workflow)
        self.assertIn("python scripts/summarize_playwright.py", workflow)
        self.assertIn("actions/upload-artifact@v7", workflow)
        self.assertIn("Fail workflow when project E2E failed", workflow)
        self.assertNotIn("build_quality_report.py", workflow)


if __name__ == "__main__":
    unittest.main()
