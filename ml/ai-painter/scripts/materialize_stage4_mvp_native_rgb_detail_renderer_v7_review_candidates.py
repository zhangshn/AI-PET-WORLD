from __future__ import annotations

"""Materialize immutable V7 validation frames without modifying model weights."""

from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import materialize_stage4_mvp_native_rgb_renderer_v6_review_candidates as base  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_detail_renderer_v7 import (  # noqa: E402
    CAPABILITY_VERSION,
    build_renderer,
)
from train_stage4_mvp_native_rgb_detail_renderer_v7_stage0 import (  # noqa: E402
    CHECKPOINT_SCHEMA,
    PACKAGE_SCHEMA,
    TERMINAL_SCHEMA,
)


def configure() -> None:
    base.PACKAGE_SCHEMA = PACKAGE_SCHEMA
    base.TERMINAL_SCHEMA = TERMINAL_SCHEMA
    base.CHECKPOINT_SCHEMA = CHECKPOINT_SCHEMA
    base.CAPABILITY_VERSION = CAPABILITY_VERSION
    base.build_renderer = build_renderer


def main() -> int:
    configure()
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
