"""CPU-only materialization/verification of an inactive Stage4 split package."""
from argparse import ArgumentParser
from datetime import datetime, timezone
import json
import os
from pathlib import Path

from ai_painter.complete_world.split_release import (
    build_package, materialize_package, load_package, SplitReleaseDataset,
    canonical_bytes, digest, project_file, COUNTS,
)


def verify_selection(root, binding):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    torch.set_num_threads(1)
    manifest, expected = load_package(root, binding)
    selected, tensors, split_hashes = [], [], {}
    for split in COUNTS:
        dataset = SplitReleaseDataset(root, binding, split, (256, 192))
        selected.extend(dataset.rows)
        split_hashes[split] = dataset.selection_sha256
        for index in range(len(dataset)):
            sample = dataset[index]
            for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
                value = sample[key]
                if value.device.type != "cpu" or tuple(value.shape) != shape or value.dtype != torch.float32:
                    raise ValueError("CPU Dataset tensor contract mismatch")
                if not torch.isfinite(value).all() or value.min() < 0 or value.max() > 1:
                    raise ValueError("CPU Dataset tensor values outside contract")
            tensors.append({"sampleId": sample["sampleId"], "split": sample["split"],
                            "imageTensorSha256": state_hash(sample["image"]),
                            "conditionTensorSha256": state_hash(sample["conditions"])})
    selected.sort(key=lambda row: row["ordinal"])
    if selected != expected:
        raise ValueError("actual Python Dataset rows do not match released membership")
    selection_sha = digest(canonical_bytes(selected))
    if selection_sha != manifest["identityPayload"]["selectionReproductionSha256"]:
        raise ValueError("Python Dataset selection reproduction mismatch")
    report = {
        "schemaVersion": "ai-painter-stage4-split-selection-cpu-evidence-v1",
        "status": "cpu_dataset_selection_passed_training_inactive",
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
        "requirements": ["AP-TRAIN-001", "AP-TRAIN-002"],
        "datasetManifest": binding, "selectedRows": 64, "splitCounts": COUNTS,
        "selectionReproductionSha256": selection_sha, "splitSelectionHashes": split_hashes,
        "samples": tensors, "qualification": manifest["qualification"],
        "gpuStarted": False, "trainingStarted": False,
        "programBindings": [{"path": logical, "sha256": digest(project_file(root, logical).read_bytes())}
                            for logical in (
                                "ml/ai-painter/scripts/materialize_stage4_v2_split_release.py",
                                "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
                                "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
                            )],
    }
    data = canonical_bytes(report) + b"\n"
    relative = f".runtime/ai-painter/dataset-release-checks/{digest(data)}/report.json"
    target = project_file(root, relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    return {"path": relative, "sha256": digest(data)}


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--parent-release", help="Exact immutable source release; creates no training qualification")
    parser.add_argument("--parent-sha256", help="SHA-256 of --parent-release (both arguments are required together)")
    parser.add_argument("--materialize", action="store_true")
    parser.add_argument("--verify-selection", action="store_true",
                        help="Read every real image/channel on CPU and persist selection evidence")
    args = parser.parse_args()
    if (args.parent_release is None) != (args.parent_sha256 is None):
        parser.error("--parent-release and --parent-sha256 must be supplied together")
    parent_binding = None if args.parent_release is None else {
        "path": args.parent_release, "sha256": args.parent_sha256,
    }
    if args.verify_selection and not args.materialize:
        parser.error("--verify-selection requires --materialize")
    root = Path.cwd()
    if args.materialize:
        binding = materialize_package(root, parent_binding=parent_binding)
        manifest, _ = load_package(root, binding)
    else:
        manifest, _ = build_package(root, parent_binding=parent_binding)
        binding = None
    evidence = verify_selection(root, binding) if args.verify_selection else None
    print(json.dumps({"status": "split_candidate_materialized_inactive" if binding else "split_candidate_checked_not_written",
                      "manifest": binding, "datasetReleaseIdentity": manifest["datasetReleaseIdentity"],
                      "sourceRelease": manifest["identityPayload"]["parentRelease"],
                      "sampleCount": manifest["sampleCount"], "splitCounts": manifest["splitCounts"],
                      "qualification": manifest["qualification"],
                      "selectionEvidence": evidence,
                      "gpuStarted": False, "trainingStarted": False}, indent=2))


if __name__ == "__main__":
    main()
