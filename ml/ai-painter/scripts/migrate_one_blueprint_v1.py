from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path

from ai_painter.blueprint.v0_to_v1 import convert_v0_file_to_v1
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file


def main() -> int:
    parser = ArgumentParser(description="Migrate one accepted v0 scene to a v1 Blueprint draft.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    args = parser.parse_args()
    sample_dir = args.dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    if not sample_dir.is_dir():
        return fail("accepted scene sample does not exist")
    try:
        source = sample_dir / "blueprint.json"
        target = sample_dir / "target.png"
        source_hash = sha256(source.read_bytes()).hexdigest()
        target_hash = sha256(target.read_bytes()).hexdigest()
        v1 = convert_v0_file_to_v1(source)
        path = sample_dir / "blueprint.v1.json"
        path.write_text(json.dumps(v1, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        masks = render_v1_masks_from_file(path, sample_dir / "masks_v1")
        migration = {
            "schemaVersion": "blueprint-v1-migration-record-v0",
            "sampleId": args.sample_id,
            "sourceBlueprintHash": source_hash,
            "targetImageHash": target_hash,
            "requiresManualReview": True,
            "manualReviewReasons": v1["manualReviewReasons"],
            "maskCount": len(masks),
        }
        (sample_dir / "migration.v1.json").write_text(json.dumps(migration, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"status": "migrated", "sampleId": args.sample_id, "maskCount": len(masks)}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        return fail(str(error))


def fail(message: str) -> int:
    print(json.dumps({"status": "failed", "errors": [message]}, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
