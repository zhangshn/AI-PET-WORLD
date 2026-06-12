from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path

from ai_painter.blueprint.masks import render_blueprint_masks
from ai_painter.blueprint.schema import load_blueprint


def main() -> int:
    parser = ArgumentParser(description="Update one accepted scene Blueprint and rebuild masks.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--blueprint", type=Path, required=True)
    args = parser.parse_args()

    sample_dir = args.dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    if not sample_dir.is_dir():
        return fail("accepted scene sample does not exist")

    blueprint_data = json.loads(args.blueprint.read_text(encoding="utf-8"))
    blueprint_data["sceneId"] = args.sample_id
    pending = sample_dir / ".blueprint.pending.json"
    pending.write_text(json.dumps(blueprint_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        blueprint = load_blueprint(pending)
        blueprint_path = sample_dir / "blueprint.json"
        blueprint_path.write_text(json.dumps(blueprint_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        mask_paths = render_blueprint_masks(blueprint, sample_dir / "masks")
        metadata_path = sample_dir / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["files"]["structure"] = record(blueprint_path, args.dataset_root)
        metadata["files"]["masks"] = {
            name: record(file, args.dataset_root) for name, file in sorted(mask_paths.items())
        }
        metadata["review"]["blueprintApproved"] = True
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": "updated", "sampleId": args.sample_id, "maskCount": len(mask_paths)}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        return fail(str(error))
    finally:
        pending.unlink(missing_ok=True)


def record(file: Path, root: Path) -> dict[str, object]:
    return {
        "path": file.relative_to(root.resolve()).as_posix(),
        "sha256": sha256(file.read_bytes()).hexdigest(),
        "byteLength": file.stat().st_size,
    }


def fail(message: str) -> int:
    print(json.dumps({"status": "failed", "errors": [message]}, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
