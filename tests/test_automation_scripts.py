import importlib.util
import sys
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


quality_report = load_script("build_quality_report")


class QualityReportTests(unittest.TestCase):
    def test_regressions_are_reported(self):
        payload = {
            "period": "week",
            "baseline_period": "baseline",
            "metrics": {
                "success": {
                    "current": 0.8,
                    "baseline": 1.0,
                    "lower_is_bad": False,
                },
                "latency": {
                    "current": 120,
                    "baseline": 100,
                    "lower_is_bad": True,
                },
            },
            "clusters": [],
        }

        report, count = quality_report.build_report(payload, threshold=0.1)

        self.assertEqual(count, 2)
        self.assertIn("`success`", report)
        self.assertIn("`latency`", report)
        self.assertEqual(report.count("⚠️ 기준 대비 저하"), 2)
        self.assertIn("‘기준 대비 저하’란?", report)
        self.assertNotIn("REGRESSION", report)

    def test_known_metrics_are_explained_in_korean(self):
        payload = {
            "period": "week",
            "baseline_period": "previous-4-weeks",
            "metrics": {
                "task_completion_rate": {
                    "current": 0.91,
                    "baseline": 0.94,
                    "lower_is_bad": False,
                },
                "p95_latency_ms": {
                    "current": 4200,
                    "baseline": 3600,
                    "lower_is_bad": True,
                },
            },
            "clusters": [
                {
                    "name": "provider-timeout",
                    "count": 18,
                    "evidence": "aggregate:provider-timeout",
                }
            ],
        }

        report, count = quality_report.build_report(payload, threshold=0.1)

        self.assertEqual(count, 1)
        self.assertIn("작업 완료율", report)
        self.assertIn("응답 지연시간(P95)", report)
        self.assertIn("91.0%", report)
        self.assertIn("+600 ms", report)
        self.assertIn("+16.7%", report)
        self.assertIn("외부 제공자 응답 시간 초과", report)
        self.assertIn("직전 4주 평균", report)
        self.assertIn("✅ 허용 범위", report)

    def test_sensitive_fields_are_rejected(self):
        payload = {
            "metrics": {},
            "clusters": [],
            "raw_prompt": "must not be processed",
        }

        with self.assertRaisesRegex(ValueError, "sensitive field"):
            quality_report.build_report(payload)


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

    def test_codeql_runs_for_pr_and_schedule_but_not_after_merge(self):
        pr = (ROOT / ".github" / "workflows" / "pr-validation.yml").read_text(
            encoding="utf-8"
        )
        deployment = (
            ROOT / ".github" / "workflows" / "production-deployment.yml"
        ).read_text(encoding="utf-8")
        optional = (
            ROOT / ".github" / "workflows" / "weekly-quality-review.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("security:", pr)
        self.assertEqual(pr.count("github/codeql-action/init@v4"), 1)
        self.assertNotIn("github/codeql-action/init@v4", deployment)
        self.assertIn("Scheduled CodeQL security", optional)
        self.assertEqual(optional.count("github/codeql-action/init@v4"), 1)

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
        self.assertIn("python -m pytest", action)
        self.assertIn("npm run test:e2e", action)


if __name__ == "__main__":
    unittest.main()
