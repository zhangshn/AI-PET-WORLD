"""CPU-only checks for the current-candidate GPU qualifier's live boundary."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import qualify_stage4_mvp256_dry_v24_gpu as gate  # noqa: E402


class LiveExecutionTests(unittest.TestCase):
    def test_import_is_cpu_only_and_budget_is_bounded(self):
        self.assertFalse(gate.profile.torch.cuda.is_initialized())
        self.assertEqual(gate.SOURCE_CASES, 48)
        self.assertLessEqual(gate.MAX_SECONDS, 600)

    def test_only_current_matching_fresh_execution_survives(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            current = root / ".runtime/ai-painter/current-execution-registry/current.json"
            heartbeat = root / "evidence/heartbeat.json"
            current.parent.mkdir(parents=True)
            heartbeat.parent.mkdir(parents=True)
            package = {"runId": "dry-run-123", "packageId": "dry-package-123"}
            active = {**package, "capabilityVersion": gate.worker.CAPABILITY,
                      "processId": 9357,
                      "heartbeat": {"path": "evidence/heartbeat.json"}}
            state = {"activeExecution": active}

            def save(when):
                current.write_text(json.dumps(state), encoding="utf8")
                heartbeat.write_text(json.dumps({
                    "runId": package["runId"], "processId": 9357,
                    "heartbeatAtUtc": when.isoformat()}), encoding="utf8")

            with patch.object(gate, "ROOT", root):
                save(datetime.now(timezone.utc))
                gate.check_live_execution(package)
                state["activeExecution"]["runId"] = "other"
                save(datetime.now(timezone.utc))
                with self.assertRaises(ValueError):
                    gate.check_live_execution(package)
                state["activeExecution"]["runId"] = package["runId"]
                save(datetime.now(timezone.utc) - timedelta(seconds=121))
                with self.assertRaises(ValueError):
                    gate.check_live_execution(package)


if __name__ == "__main__":
    unittest.main()
