from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter.assets import build_layered_asset


def main() -> None:
    parser = argparse.ArgumentParser(description="从分层 RGBA 单体生成精灵与同源 Mask。")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output-root", type=Path, default=Path("data/ai-painter-assets/accepted"))
    args = parser.parse_args()
    result = build_layered_asset(args.manifest.resolve(), args.output_root.resolve())
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
