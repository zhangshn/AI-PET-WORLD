from __future__ import annotations

import io
import json
from pathlib import Path
import sys
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[3]
TEST_ROOT = PROJECT_ROOT / "ml/ai-painter/tests"
if str(TEST_ROOT) not in sys.path:
    sys.path.insert(0, str(TEST_ROOT))

from test_stage4_full_backbone_spatial_affine_controlled_smoke_contract import (  # noqa: E402
    FullBackboneControlledSmokeContractTests,
)


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(
        FullBackboneControlledSmokeContractTests
    )
    stream = io.StringIO()
    result = unittest.TextTestRunner(
        stream=stream,
        verbosity=2,
    ).run(suite)
    payload = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-controlled-smoke-cpu-report-v1"
        ),
        "status": (
            "stage4_full_backbone_spatial_affine_controlled_smoke_cpu_gate_passed"
            if result.wasSuccessful()
            else "stage4_full_backbone_spatial_affine_controlled_smoke_cpu_gate_failed"
        ),
        "cpuOnly": True,
        "gpuStarted": False,
        "trainingStarted": False,
        "ownerAuthorizationRequired": False,
        "checks": {
            "total": result.testsRun,
            "positive": 5,
            "negative": 4,
            "failures": len(result.failures),
            "errors": len(result.errors),
        },
        "verifiedBoundaries": [
            "controlled_smoke_mode_spec",
            "complete_trainer_config_derivation",
            "fixed_sample194_validation_seed_resolution_epoch_preview_identity",
            "local_internal_ticket_bounded_actions",
            "preflight_before_ticket",
            "all_preflight_checks_must_pass_before_ticket",
            "half_ticket_transaction_recovery",
            "forged_half_ticket_rejection",
            "consumed_ticket_idempotent_replay",
            "cross_run_output_and_checkpoint_injection_rejection",
        ],
    }
    if not result.wasSuccessful():
        payload["testOutput"] = stream.getvalue()
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
