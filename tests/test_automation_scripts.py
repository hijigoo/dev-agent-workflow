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

    def test_sensitive_fields_are_rejected(self):
        payload = {
            "metrics": {},
            "clusters": [],
            "raw_prompt": "must not be processed",
        }

        with self.assertRaisesRegex(ValueError, "sensitive field"):
            quality_report.build_report(payload)


if __name__ == "__main__":
    unittest.main()
