from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter.quality_learning import inspect_quality_dataset
from ai_painter.quality_learning.trainer import train_quality_judge


def main() -> None:
    parser = argparse.ArgumentParser(description="训练项目自研 VJ-B2 单体画质分类器。")
    parser.add_argument("--dataset-root", type=Path, default=Path("data/ai-painter-quality/vj-b2"))
    parser.add_argument("--output-dir", type=Path, default=Path(".runtime/ai-painter/vj-b2"))
    parser.add_argument("--check-runtime", action="store_true")
    parser.add_argument("--epochs", type=int, default=30)
    args = parser.parse_args()
    readiness = inspect_quality_dataset(args.dataset_root.resolve())
    if not readiness["ready"]:
        print(json.dumps(readiness, ensure_ascii=False, indent=2))
        raise SystemExit("VJ-B2 数据未就绪，禁止启动训练。")
    try:
        import torch  # noqa: F401
    except ImportError as error:
        raise SystemExit("当前 Python 环境没有安装 PyTorch，无法训练 VJ-B2。") from error
    if args.check_runtime:
        print("VJ-B2 数据与 PyTorch 运行环境已就绪。")
        return
    result = train_quality_judge(args.dataset_root.resolve(), args.output_dir.resolve(), args.epochs)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
