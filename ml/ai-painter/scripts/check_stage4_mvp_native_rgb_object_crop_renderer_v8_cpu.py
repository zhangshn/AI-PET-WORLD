from __future__ import annotations

"""Read-only CPU contract and crop-curriculum check for V8."""

import json
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import check_stage4_mvp_native_rgb_renderer_v6_cpu as base  # noqa: E402
from ai_painter.complete_world.native_rgb_detail_renderer import RESPONSIBILITY_IDENTITIES  # noqa: E402
from ai_painter.complete_world.split_release import SplitReleaseDataset  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8 import (  # noqa: E402
    ARCHITECTURE_ID, CAPABILITY_VERSION, CONTRACT_PATH, build_renderer,
    deterministic_object_crop, load_contract, native_rgb_objective,
)


OUTPUT = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-mvp-native-rgb-object-crop-renderer-v8-qualifications" / "cpu-report.json"
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
    model = build_renderer(ROOT)
    train = SplitReleaseDataset(ROOT, report["dataset"], "train", (256, 192))
    crop_rows = []
    for sample_index in range(len(train)):
        sample = train[sample_index]
        cropped, evidence = deterministic_object_crop(
            sample, responsibility_indices=model.responsibility_indices,
            epoch=1, sample_index=sample_index, seed=20260926,
        )
        if tuple(cropped["image"].shape) != (3, 128, 128):
            raise ValueError("V8 CPU crop shape invalid")
        crop_rows.append({"sampleId": sample["sampleId"], **evidence})
    report["schemaVersion"] = (
        "stage4-mvp-native-complete-rgb-object-crop-renderer-v8-cpu-report-v1"
    )
    report["capabilityVersion"] = CAPABILITY_VERSION
    report["architectureId"] = ARCHITECTURE_ID
    report["cropCurriculum"] = {
        "sampleCount": len(crop_rows), "cropSize": [128, 128],
        "allCropsContainTargetObject": all(row["maskNonzero"] > 0 for row in crop_rows),
        "persistentDerivedImagesWritten": False,
        "rows": crop_rows,
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
            "status": "failed_closed", "errorType": type(error).__name__, "error": str(error),
        }, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
