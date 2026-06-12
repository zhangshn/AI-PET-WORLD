from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path

from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data


def main() -> int:
    parser = ArgumentParser(description="Save a v1 Blueprint draft and rebuild 14 v1 masks.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--blueprint", type=Path, required=True)
    args = parser.parse_args()
    sample_dir = args.dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    if not sample_dir.is_dir():
        return fail("accepted scene sample does not exist")
    try:
        data = json.loads(args.blueprint.read_text(encoding="utf-8"))
        data["sceneId"] = args.sample_id
        data = _force_server_review_state(data)
        errors = validate_v1_blueprint_data(data)
        if errors:
            return fail("; ".join(errors))
        target_hash = sha256((sample_dir / "target.png").read_bytes()).hexdigest()
        blueprint_path = sample_dir / "blueprint.v1.json"
        blueprint_path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        masks = render_v1_masks_from_file(blueprint_path, sample_dir / "masks_v1")
        record = {
            "schemaVersion": "blueprint-v1-edit-record-v0",
            "sampleId": args.sample_id,
            "targetImageHash": target_hash,
            "v1BlueprintHash": sha256(blueprint_path.read_bytes()).hexdigest(),
            "maskCount": len(masks),
            "requiresManualReview": data["requiresManualReview"],
            "manualReviewReasons": data["manualReviewReasons"],
        }
        (sample_dir / "migration.v1.json").write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"status": "updated", "sampleId": args.sample_id, "maskCount": len(masks), "requiresManualReview": data["requiresManualReview"]}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        return fail(str(error))


def _force_server_review_state(data: dict[str, object]) -> dict[str, object]:
    structures = data.get("structures")
    reasons: list[str] = []
    if isinstance(data.get("manualReviewReasons"), list):
        reasons.extend(str(item) for item in data["manualReviewReasons"])
    if isinstance(structures, list):
        for item in structures:
            if isinstance(item, dict) and item.get("requiresManualReview"):
                reasons.extend(str(reason) for reason in item.get("manualReviewReasons", []) if isinstance(reason, str))
    if not reasons:
        reasons.append("v1 Blueprint 保存后仍需项目负责人确认，客户端不能伪造审核通过")
    data["requiresManualReview"] = True
    data["manualReviewReasons"] = sorted(set(reasons))
    return data


def fail(message: str) -> int:
    print(json.dumps({"status": "failed", "errors": [message]}, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
