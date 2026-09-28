from __future__ import annotations

"""Read-only CUDA qualification for the V8 object-crop candidate."""

import json
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import run_stage4_mvp_native_rgb_detail_renderer_v7_readonly_gpu_qualification as base  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8 import (  # noqa: E402
    CAPABILITY_VERSION, build_renderer, load_contract,
)


POLICY_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-object-crop-renderer-v8-gpu-qualification-policy.json"
)
POLICY_SCHEMA = "stage4-mvp-native-complete-rgb-object-crop-renderer-v8-gpu-qualification-policy-v1"
SEED = 20260926
OUTPUT = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-mvp-native-rgb-object-crop-renderer-v8-qualifications" / "gpu-report.json"
)


def run() -> dict:
    base.POLICY_PATH = POLICY_PATH
    base.POLICY_SCHEMA = POLICY_SCHEMA
    base.SEED = SEED
    base.CAPABILITY_VERSION = CAPABILITY_VERSION
    base.build_renderer = build_renderer
    base.load_contract = load_contract
    report = base.run()
    report["schemaVersion"] = (
        "stage4-mvp-native-complete-rgb-object-crop-renderer-v8-readonly-gpu-report-v1"
    )
    report["capabilityVersion"] = CAPABILITY_VERSION
    return report


def main() -> int:
    try:
        report = run()
        base.write_atomic(OUTPUT, report)
        print(json.dumps({"status": report["status"], "output": str(OUTPUT)}, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({
            "status": "failed_closed", "errorType": type(error).__name__, "error": str(error),
        }, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
