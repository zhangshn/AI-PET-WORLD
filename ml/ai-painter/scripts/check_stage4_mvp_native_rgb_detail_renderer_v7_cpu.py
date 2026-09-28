from __future__ import annotations

"""Run the read-only CPU contract check for the V7 multiscale detail renderer."""

import json
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import check_stage4_mvp_native_rgb_renderer_v6_cpu as base  # noqa: E402
from ai_painter.complete_world.native_rgb_detail_renderer import (  # noqa: E402
    RESPONSIBILITY_IDENTITIES,
)
from ai_painter_stage4_mvp_native_rgb_detail_renderer_v7 import (  # noqa: E402
    ARCHITECTURE_ID,
    CAPABILITY_VERSION,
    CONTRACT_PATH,
    build_renderer,
    load_contract,
    native_rgb_objective,
)


OUTPUT = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-mvp-native-rgb-detail-renderer-v7-qualifications" / "cpu-report.json"
)


def run() -> dict:
    base.ARCHITECTURE_ID = ARCHITECTURE_ID
    base.CAPABILITY_VERSION = CAPABILITY_VERSION
    base.CONTRACT_PATH = CONTRACT_PATH
    base.RESPONSIBILITY_IDENTITIES = RESPONSIBILITY_IDENTITIES
    base.build_renderer = build_renderer
    base.load_contract = load_contract
    base.native_rgb_objective = native_rgb_objective
    report = base.run()
    report["schemaVersion"] = (
        "stage4-mvp-native-complete-rgb-detail-renderer-v7-cpu-report-v1"
    )
    report["capabilityVersion"] = CAPABILITY_VERSION
    report["architectureId"] = ARCHITECTURE_ID
    report["structuralAssertions"] = {
        "decoderIncludesHalfResolutionStage": True,
        "fullResolutionDetailRefinement": True,
        "objectMaskLocalShapeEncoder": True,
    }
    return report


def main() -> int:
    try:
        report = run()
        base.write_atomic(OUTPUT, report)
        print(json.dumps({"status": report["status"], "output": str(OUTPUT)}, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({
            "status": "failed_closed", "errorType": type(error).__name__,
            "error": str(error),
        }, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
