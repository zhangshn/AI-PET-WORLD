"""Materialize V11 validation RGBs from the bound local Checkpoint; no training."""

from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

import materialize_stage4_mvp_native_rgb_renderer_v6_review_candidates as base  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 import (  # noqa: E402
    CAPABILITY_VERSION, build_renderer,
)
from train_stage4_mvp_native_rgb_object_context_renderer_v11_stage0 import (  # noqa: E402
    CHECKPOINT_SCHEMA, PACKAGE_SCHEMA, STAGE, TERMINAL_SCHEMA,
)


def main() -> int:
    if torch.cuda.is_available():
        torch.cuda.set_per_process_memory_fraction(0.7, 0)
    base.PACKAGE_SCHEMA = PACKAGE_SCHEMA
    base.TERMINAL_SCHEMA = TERMINAL_SCHEMA
    base.CHECKPOINT_SCHEMA = CHECKPOINT_SCHEMA
    base.CAPABILITY_VERSION = CAPABILITY_VERSION
    base.STAGE = STAGE
    base.build_renderer = build_renderer
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
