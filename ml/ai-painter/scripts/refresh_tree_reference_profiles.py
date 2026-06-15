from __future__ import annotations

import json
from pathlib import Path

from ai_painter.assets import compare_with_reference_profiles, write_tree_profile
from create_quality_tree_batch import PROFILES as BASE_PROFILES
from create_vj_b2_positive_candidate_batch import PROFILES as VJ_B2_PROFILES


CANDIDATE_ROOT = Path("data/ai-painter-assets/candidates")
QUALITY_ROOT = Path("data/ai-painter-quality/vj-b2/samples")
KNOWN_PROFILES = {str(item["asset_id"]): item for item in (*BASE_PROFILES, *VJ_B2_PROFILES)}


def main() -> None:
    profiles = {}
    for asset_dir in sorted(path for path in CANDIDATE_ROOT.iterdir() if path.is_dir()):
        profile = write_tree_profile(asset_dir, _source_spec(asset_dir.name))
        profiles[asset_dir.name] = profile

    accepted_ids = []
    rejected_ids = []
    for sample_dir in sorted(path for path in QUALITY_ROOT.iterdir() if path.is_dir()):
        label_path = sample_dir / "label.json"
        if not label_path.is_file():
            continue
        label = json.loads(label_path.read_text(encoding="utf-8"))
        source_id = label.get("lineage", {}).get("sourceAssetId")
        if label.get("qualityLabel") == "acceptable" and source_id in profiles:
            accepted_ids.append(source_id)
        if label.get("qualityLabel") == "unacceptable" and source_id in profiles:
            rejected_ids.append(source_id)
    references = [profiles[asset_id] for asset_id in sorted(set(accepted_ids))]
    rejected_references = [profiles[asset_id] for asset_id in sorted(set(rejected_ids))]
    for asset_id, profile in profiles.items():
        report = compare_with_reference_profiles(profile, references, rejected_references)
        (CANDIDATE_ROOT / asset_id / "reference-comparison.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
        )
    print(
        f"树木档案已刷新：{len(profiles)} 个；合格参考：{len(references)} 个；"
        f"不合格边界：{len(rejected_references)} 个"
    )


def _source_spec(asset_id: str):
    manifest = Path("data/ai-painter-assets/candidate-source") / asset_id / "manifest.json"
    if manifest.is_file():
        value = json.loads(manifest.read_text(encoding="utf-8")).get("drawingSpec")
        if value:
            return value
    profile = KNOWN_PROFILES.get(asset_id)
    if not profile:
        return None
    return {
        "generator": "project-local-layered-tree-v1",
        "seed": int(profile["seed"]),
        "renderKind": str(profile.get("render_kind", "clustered")),
        "workingCanvas": [64, 64],
        "outputCanvas": [128, 128],
        "trunkWidth": int(profile["trunk_width"]),
        "trunkTop": int(profile["trunk_top"]),
        "crownClusters": [list(box) for box in profile.get("clusters", [])],
        "palette": list(profile["palette"]),
        "scaleMethod": "nearest_neighbor_2x",
        "layerOrder": ["tree_trunk", "tree_crown"],
    }


if __name__ == "__main__":
    main()
