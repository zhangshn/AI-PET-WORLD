from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter.assets import judge_single_asset


def main() -> None:
    parser = argparse.ArgumentParser(description="执行单体资产 VJ-A 可计算质量审核。")
    parser.add_argument("asset_dir", type=Path)
    args = parser.parse_args()
    print(json.dumps(judge_single_asset(args.asset_dir.resolve()), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
