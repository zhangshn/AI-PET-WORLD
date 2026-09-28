from __future__ import annotations

"""Bounded V9 Stage0 training wired through the proven V8 lifecycle worker."""

from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import train_stage4_mvp_native_rgb_object_crop_renderer_v8_stage0 as worker  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_detail_recovery_renderer_v9 import (  # noqa: E402
    CAPABILITY_VERSION, CONTRACT_PATH, OBJECT_CROP_IDENTITIES, build_renderer,
    detail_recovery_objective, deterministic_object_crop, load_contract,
)


SEED = 20260927
PACKAGE_SCHEMA = (
    "ai-painter-stage4-mvp-native-rgb-detail-recovery-renderer-v9-"
    "formal-stage-execution-package-v1"
)
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-stage0-training-terminal-v1"
CHECKPOINT_SCHEMA = (
    "ai-painter-stage4-mvp-native-rgb-detail-recovery-renderer-v9-checkpoint-v1"
)
EPOCH_SCHEMA = "ai-painter-stage4-mvp-detail-recovery-renderer-v9-epoch-v1"
CHECKPOINT_FILENAME = "stage0-native-rgb-detail-recovery-v9.pt"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 24}
OPTIMIZER_STEP_TARGET = 2304
_BASE_SCALAR_COMPONENTS = worker.scalar_components
_BASE_AVERAGE_ROWS = worker.average_rows
_DETAIL_COMPONENTS = (
    "baseTotal", "detailTextureEnergyLoss", "detailGradientEnergyLoss",
    "detailLocalVarianceLoss",
)


def scalar_components(components: dict) -> dict:
    row = _BASE_SCALAR_COMPONENTS(components)
    for name in _DETAIL_COMPONENTS:
        row[name] = float(components[name].detach())
    return row


def average_rows(rows: list[dict]) -> dict:
    result = _BASE_AVERAGE_ROWS(rows)
    for name in _DETAIL_COMPONENTS:
        result[name] = sum(row[name] for row in rows) / len(rows)
    return result


def configure() -> None:
    worker.SEED = SEED
    worker.PACKAGE_SCHEMA = PACKAGE_SCHEMA
    worker.TERMINAL_SCHEMA = TERMINAL_SCHEMA
    worker.CHECKPOINT_SCHEMA = CHECKPOINT_SCHEMA
    worker.EPOCH_SCHEMA = EPOCH_SCHEMA
    worker.CHECKPOINT_FILENAME = CHECKPOINT_FILENAME
    worker.STAGE = STAGE
    worker.OPTIMIZER_STEP_TARGET = OPTIMIZER_STEP_TARGET
    worker.CAPABILITY_VERSION = CAPABILITY_VERSION
    worker.CONTRACT_PATH = CONTRACT_PATH
    worker.OBJECT_CROP_IDENTITIES = OBJECT_CROP_IDENTITIES
    worker.build_renderer = build_renderer
    worker.deterministic_object_crop = deterministic_object_crop
    worker.load_contract = load_contract
    worker.native_rgb_objective = detail_recovery_objective
    worker.scalar_components = scalar_components
    worker.average_rows = average_rows

    worker.base.PACKAGE_SCHEMA = PACKAGE_SCHEMA
    worker.base.TERMINAL_SCHEMA = TERMINAL_SCHEMA
    worker.base.CHECKPOINT_SCHEMA = CHECKPOINT_SCHEMA
    worker.base.STAGE = STAGE
    worker.base.SEED = SEED
    worker.base.CAPABILITY_VERSION = CAPABILITY_VERSION
    worker.base.run = worker.run


def main() -> int:
    configure()
    return worker.base.main()


if __name__ == "__main__":
    raise SystemExit(main())
