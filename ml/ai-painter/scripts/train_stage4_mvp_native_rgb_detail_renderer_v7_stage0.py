from __future__ import annotations

"""Run one bounded 256x192 Stage0 training for the V7 detail renderer."""

from pathlib import Path
import os
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import train_stage4_mvp_native_rgb_renderer_v6_stage0 as base  # noqa: E402
from ai_painter.complete_world.split_release import canonical_bytes, digest, project_file  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_detail_renderer_v7 import (  # noqa: E402
    CAPABILITY_VERSION,
    CONTRACT_PATH,
    build_renderer,
    load_contract,
    native_rgb_objective,
)


SEED = 20260925
PACKAGE_SCHEMA = "ai-painter-stage4-mvp-native-rgb-detail-renderer-v7-formal-stage-execution-package-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-stage0-training-terminal-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-native-rgb-detail-renderer-v7-checkpoint-v1"


def initialization_identity(contract: dict, model_state_sha256: str) -> tuple[dict, str]:
    value = {
        "schemaVersion": "ai-painter-stage4-mvp-stage0-training-initialization-v1",
        "capabilityVersion": CAPABILITY_VERSION,
        "seed": SEED,
        "candidateContract": {
            "path": CONTRACT_PATH,
            "sha256": digest(project_file(ROOT, CONTRACT_PATH).read_bytes()),
        },
        "datasetBinding": contract["datasetBinding"],
        "modelStateSha256": model_state_sha256,
    }
    return value, digest(canonical_bytes(value))


def scalar_components(components: dict) -> dict:
    row = {
        "total": float(components["total"].detach()),
        "fullRgbMae": float(components["fullRgbMae"].detach()),
        "fullRgbGradientMae": float(components["fullRgbGradientMae"].detach()),
        "fullRgbLaplacianMae": float(components["fullRgbLaplacianMae"].detach()),
    }
    for name in (
        "responsibilityRgbMae", "responsibilityGradientMae",
        "responsibilityLumaStructureLoss",
    ):
        row[name] = {
            key: float(value.detach()) for key, value in components[name].items()
        }
    return row


def average_rows(rows: list[dict]) -> dict:
    result = {
        key: sum(row[key] for row in rows) / len(rows)
        for key in ("total", "fullRgbMae", "fullRgbGradientMae", "fullRgbLaplacianMae")
    }
    for name in (
        "responsibilityRgbMae", "responsibilityGradientMae",
        "responsibilityLumaStructureLoss",
    ):
        result[name] = {
            key: sum(row[name][key] for row in rows) / len(rows)
            for key in rows[0][name]
        }
    return result


def run_and_rename(package_binding: dict) -> dict:
    result = base._v7_original_run(package_binding)
    old_binding = result["checkpoint"]
    old_path = project_file(ROOT, old_binding["path"])
    new_logical = old_binding["path"].replace("stage0-native-rgb-v6.pt", "stage0-native-rgb-detail-v7.pt")
    if new_logical == old_binding["path"]:
        raise ValueError("V7 checkpoint rename boundary missing")
    new_path = project_file(ROOT, new_logical)
    if new_path.exists():
        raise FileExistsError(f"V7 checkpoint already exists: {new_logical}")
    os.replace(old_path, new_path)
    result["checkpoint"] = base.bind(new_logical)
    return result


def configure() -> None:
    base.PACKAGE_SCHEMA = PACKAGE_SCHEMA
    base.TERMINAL_SCHEMA = TERMINAL_SCHEMA
    base.CHECKPOINT_SCHEMA = CHECKPOINT_SCHEMA
    base.SEED = SEED
    base.CAPABILITY_VERSION = CAPABILITY_VERSION
    base.build_renderer = build_renderer
    base.load_contract = load_contract
    base.native_rgb_objective = native_rgb_objective
    base.initialization_identity = initialization_identity
    base.scalar_components = scalar_components
    base.average_rows = average_rows
    if not hasattr(base, "_v7_original_run"):
        base._v7_original_run = base.run
    base.run = run_and_rename


def main() -> int:
    configure()
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
