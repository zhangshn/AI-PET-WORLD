from __future__ import annotations

import argparse
from pathlib import Path

from ai_painter.quality_learning import register_quality_sample


def main() -> None:
    parser = argparse.ArgumentParser(description="登记项目自有 VJ-B2 质量样本。")
    parser.add_argument("image", type=Path)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--category", required=True)
    parser.add_argument("--label", choices=("acceptable", "unacceptable"), required=True)
    parser.add_argument("--evidence", action="append", required=True)
    parser.add_argument("--source-asset-id", required=True)
    parser.add_argument("--variation-kind", required=True)
    parser.add_argument("--creation-method", required=True)
    parser.add_argument("--dataset-root", type=Path, default=Path("data/ai-painter-quality/vj-b2"))
    args = parser.parse_args()
    result = register_quality_sample(
        args.image.resolve(), args.dataset_root.resolve(), args.sample_id,
        args.category, args.label, args.evidence,
        args.source_asset_id, args.variation_kind, args.creation_method,
    )
    print(f"VJ-B2 样本已登记：{result}")


if __name__ == "__main__":
    main()
