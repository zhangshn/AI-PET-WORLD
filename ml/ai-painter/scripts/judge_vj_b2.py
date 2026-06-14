from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter.quality_learning.inference import judge_with_learned_model


def main() -> None:
    parser = argparse.ArgumentParser(description="使用项目自研 VJ-B2 模型审核单体图片。")
    parser.add_argument("image", type=Path)
    parser.add_argument("--model-dir", type=Path, default=Path(".runtime/ai-painter/vj-b2"))
    args = parser.parse_args()
    result = judge_with_learned_model(args.image.resolve(), args.model_dir.resolve())
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
