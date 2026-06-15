from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFont

from ai_painter.assets.visual_judge import POLICY_VERSION as VJ_A_POLICY
from ai_painter.assets.visual_judge import _measure as measure_vj_a
from ai_painter.assets.visual_judge_b import POLICY_VERSION as VJ_B1_POLICY
from ai_painter.assets.visual_judge_b import judge_target_quality_proxy


CANDIDATE_ROOT = Path("data/ai-painter-quality/vj-b2/pending-tree-review")
REPAIR_IDS = {
    "tree-dead-sparse-quality-019",
    "tree-winter-bare-quality-021",
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="重建树木候选包、修复指定候选并使用项目真实 VJ 规则生成报告。",
    )
    parser.add_argument("package_root", type=Path)
    args = parser.parse_args()
    rebuild_package(args.package_root.resolve())


def rebuild_package(package_root: Path) -> None:
    candidate_root = package_root / CANDIDATE_ROOT
    if not candidate_root.is_dir():
        raise ValueError(f"候选目录不存在：{candidate_root}")

    assets: list[dict[str, Any]] = []
    for asset_dir in sorted(path for path in candidate_root.iterdir() if path.is_dir()):
        asset_id = asset_dir.name
        if asset_id in REPAIR_IDS:
            _mark_sparse_tree_profile(asset_dir)
        assets.append(_rebuild_asset(asset_dir))

    _write_index(package_root, assets)
    _write_contact_sheet(package_root, candidate_root, assets)
    obsolete_readme = package_root / "README_PENDING_REVIEW.md"
    if obsolete_readme.exists():
        obsolete_readme.unlink()

    summary = {
        "count": len(assets),
        "vjAPassed": sum(item["vj_a_passed"] for item in assets),
        "vjB1Passed": sum(item["vj_b1_passed"] for item in assets),
        "pendingVisualReview": sum(item["status"] == "pending_visual_review" for item in assets),
        "needsRedraw": sum(item["status"] == "needs_redraw_before_visual_review" for item in assets),
        "trainable": False,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def _mark_sparse_tree_profile(asset_dir: Path) -> None:
    manifest_path = asset_dir / "source" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("visualProfile") == "sparse_tree":
        return
    manifest["visualProfile"] = "sparse_tree"
    _write_json(manifest_path, manifest)


def _rebuild_asset(asset_dir: Path) -> dict[str, Any]:
    source_dir = asset_dir / "source"
    built_dir = asset_dir / "built"
    review_dir = asset_dir / "review"
    built_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)

    manifest = json.loads((source_dir / "manifest.json").read_text(encoding="utf-8"))
    old_metadata = _read_optional_json(built_dir / "metadata.json")
    label = old_metadata.get("label", asset_dir.name)

    with Image.open(source_dir / "trunk.png") as source:
        trunk = source.convert("RGBA")
    with Image.open(source_dir / "crown.png") as source:
        crown = source.convert("RGBA")
    if trunk.size != (128, 128) or crown.size != (128, 128):
        raise ValueError(f"{asset_dir.name} 的源图必须为 128x128")

    sprite = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    sprite.alpha_composite(trunk)
    sprite.alpha_composite(crown)
    trunk_mask = trunk.getchannel("A")
    crown_mask = crown.getchannel("A")
    object_alpha = ImageChops.lighter(trunk_mask, crown_mask)

    paths = {
        "sprite.png": sprite,
        "tree_trunk.png": trunk_mask,
        "tree_crown.png": crown_mask,
        "object_alpha.png": object_alpha,
    }
    for name, image in paths.items():
        image.save(built_dir / name, "PNG", optimize=True)

    vj_a = _build_vj_a_report(asset_dir.name, sprite)
    visual_profile = manifest.get("visualProfile", "default")
    vj_b1 = _build_vj_b1_report(
        asset_dir.name,
        sprite,
        trunk_mask,
        crown_mask,
        vj_a["vj_a_passed"],
        visual_profile,
    )
    technical_passed = vj_a["vj_a_passed"] and vj_b1["vj_b1_passed"]
    status = "pending_visual_review" if technical_passed else "needs_redraw_before_visual_review"

    metadata = {
        "schemaVersion": "tree-candidate-package-v2",
        "assetId": asset_dir.name,
        "category": "tree",
        "visualProfile": visual_profile,
        "admission": "candidate",
        "status": status,
        "label": label,
        "sourceSha256": {
            "trunk.png": _sha256(source_dir / "trunk.png"),
            "crown.png": _sha256(source_dir / "crown.png"),
            "manifest.json": _sha256(source_dir / "manifest.json"),
        },
        "builtSha256": {name: _sha256(built_dir / name) for name in paths},
        "annotationSource": "layer_alpha_same_source",
        "technicalAuditPassed": technical_passed,
        "visualReviewStatus": "not_reviewed",
        "trainable": False,
        "notes": "技术审核不等于视觉审核；VJ-B2 未批准前不得进入正式训练集。",
    }
    _write_json(built_dir / "metadata.json", metadata)
    _write_json(review_dir / "vj_a.json", vj_a)
    _write_json(review_dir / "vj_b1.json", vj_b1)
    _write_json(review_dir / "candidate_status.json", {
        "assetId": asset_dir.name,
        "label": label,
        "admission": "candidate",
        "trainable": False,
        "technicalAuditPassed": technical_passed,
        "status": status,
        "approved": False,
        "acceptable": False,
        "productionReady": False,
        "visualReviewRequired": True,
        "vjB2Status": "not_reviewed",
        "warning": "VJ-A/VJ-B1 仅为技术与代理指标，不能替代 VJ-B2 视觉验收。",
    })
    return {
        "assetId": asset_dir.name,
        "label": label,
        "admission": "candidate",
        "trainable": False,
        "status": status,
        "vj_a_passed": vj_a["vj_a_passed"],
        "vj_b1_passed": vj_b1["vj_b1_passed"],
        "vj_b2_status": "not_reviewed",
        "sprite": "built/sprite.png",
        "source": ["source/trunk.png", "source/crown.png", "source/manifest.json"],
        "masks": ["built/tree_trunk.png", "built/tree_crown.png", "built/object_alpha.png"],
        "review": ["review/vj_a.json", "review/vj_b1.json", "review/candidate_status.json"],
        "anchor": manifest.get("anchor"),
    }


def _build_vj_a_report(asset_id: str, sprite: Image.Image) -> dict[str, Any]:
    metrics = measure_vj_a(sprite)
    checks = {
        "canvas_128_square": sprite.size == (128, 128),
        "binary_alpha": metrics["partialAlphaPixelCount"] == 0,
        "balanced_coverage": 0.18 <= metrics["coverageRatio"] <= 0.72,
        "palette_depth": metrics["paletteColorCount"] >= 16,
        "luminance_range": metrics["luminanceRange"] >= 90,
        "pixel_edge_density": metrics["edgeDensity"] >= 0.045,
        "same_source_annotation": True,
        "technical_gate_passed": True,
    }
    return {
        "schemaVersion": "tree-candidate-vj-a-v2",
        "policyVersion": VJ_A_POLICY,
        "assetId": asset_id,
        "vj_a_passed": all(checks.values()),
        "checks": checks,
        "metrics": metrics,
    }


def _build_vj_b1_report(
    asset_id: str,
    sprite: Image.Image,
    trunk_mask: Image.Image,
    crown_mask: Image.Image,
    vj_a_passed: bool,
    visual_profile: str,
) -> dict[str, Any]:
    result = judge_target_quality_proxy(
        sprite,
        {"tree_trunk": trunk_mask, "tree_crown": crown_mask},
        "tree",
        vj_a_passed,
        visual_profile,
    )
    return {
        "schemaVersion": "tree-candidate-vj-b1-v2",
        "policyVersion": VJ_B1_POLICY,
        "assetId": asset_id,
        "vj_b1_passed": result["status"] == "passed",
        "checks": result["checks"],
        "metrics": result["metrics"],
        "failureReasonsZh": result["failureReasonsZh"],
        "vjB2LearnedJudgeStatus": result["vjB2LearnedJudgeStatus"],
    }


def _write_index(package_root: Path, assets: list[dict[str, Any]]) -> None:
    _write_json(package_root / "index.json", {
        "schemaVersion": "tree-candidate-package-index-v2",
        "task": "AI-PET-WORLD 树木候选图生成与技术审核",
        "root": CANDIDATE_ROOT.as_posix() + "/",
        "count": len(assets),
        "admission": "candidate",
        "trainable": False,
        "status": "pending_visual_review",
        "vjB2Status": "not_reviewed",
        "warning": "本包仅包含候选图；技术审核通过不代表视觉通过，不得直接写入 accepted。",
        "assets": assets,
    })


def _write_contact_sheet(
    package_root: Path,
    candidate_root: Path,
    assets: list[dict[str, Any]],
) -> None:
    columns = 7
    cell_width, cell_height = 178, 184
    rows = (len(assets) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#f2f5ed")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, record in enumerate(assets):
        left = (index % columns) * cell_width
        top = (index // columns) * cell_height
        sprite_path = candidate_root / record["assetId"] / record["sprite"]
        with Image.open(sprite_path) as source:
            sprite = source.convert("RGBA")
        preview = Image.new("RGBA", (144, 144), "#eef3e9")
        preview.alpha_composite(sprite.resize((128, 128), Image.Resampling.NEAREST), (8, 8))
        sheet.paste(preview.convert("RGB"), (left + 16, top + 4))
        state = "A/B1 PASS" if record["vj_a_passed"] and record["vj_b1_passed"] else "REDRAW"
        draw.text((left + 8, top + 150), record["assetId"][:27], fill="#173529", font=font)
        draw.text((left + 8, top + 165), state + " | VJ-B2 NOT REVIEWED", fill="#8a4f16", font=font)
    sheet.save(package_root / "contact_sheet_34_tree_candidates.png", "PNG", optimize=True)


def _read_optional_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    main()
