from __future__ import annotations

"""Materialize eight immutable validation frames from a trained V6 checkpoint."""

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import sys

import numpy as np
from PIL import Image
import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, digest, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (  # noqa: E402
    CAPABILITY_VERSION, build_renderer,
)


PACKAGE_SCHEMA = "ai-painter-stage4-mvp-native-rgb-renderer-v6-formal-stage-execution-package-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-terminal-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-native-rgb-renderer-v6-checkpoint-v1"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
OBJECT_MASK_ROLES = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)


def require(value, message: str) -> None:
    if not value:
        raise ValueError(message)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(logical: str) -> dict:
    data = project_file(ROOT, logical).read_bytes()
    return {"path": logical, "sha256": digest(data)}


def write_exclusive_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def materialize(package_binding: dict, terminal_binding: dict, output_dir: str) -> dict:
    package = bound_json(ROOT, package_binding)
    terminal = bound_json(ROOT, terminal_binding)
    require(package.get("schemaVersion") == PACKAGE_SCHEMA
            and package.get("capabilityVersion") == CAPABILITY_VERSION
            and package.get("stage") == STAGE, "V6 execution package invalid")
    require(terminal.get("schemaVersion") == TERMINAL_SCHEMA
            and terminal.get("status") == "training_completed_review_pending"
            and terminal.get("executionState") == "completed"
            and terminal.get("executionPackage") == package_binding
            and terminal.get("datasetManifest") == package["datasetManifest"]
            and terminal.get("checkpointReloadVerified") is True
            and terminal.get("challengeRead") is False
            and terminal.get("regressionRead") is False,
            "V6 training terminal invalid")
    checkpoint = torch.load(io.BytesIO(read_bound(ROOT, terminal["checkpoint"])),
                            map_location="cpu", weights_only=True)
    require(checkpoint.get("schemaVersion") == CHECKPOINT_SCHEMA
            and checkpoint.get("executionIdentity", {}).get("executionPackage") == package_binding
            and checkpoint.get("datasetManifest") == package["datasetManifest"]
            and checkpoint.get("bestEpoch") == terminal["selectedEpoch"]
            and checkpoint.get("bestValidationMetric") == terminal["selectedScore"]
            and checkpoint.get("machineReviewPending") is True,
            "V6 checkpoint identity invalid")
    require(state_hash(checkpoint["modelState"]) == terminal["modelStateSha256"],
            "V6 checkpoint model state invalid")

    validation = SplitReleaseDataset(ROOT, package["datasetManifest"], "validation", (256, 192))
    require(len(validation) == 8, "V6 validation capacity changed")
    model = build_renderer(ROOT)
    model.load_state_dict(checkpoint["modelState"], strict=True)
    before = state_hash(model.state_dict())
    require(before == terminal["modelStateSha256"], "V6 loaded model identity mismatch")
    require(torch.cuda.is_available(), "V6 candidate generation CUDA unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device).eval()
    output_root = project_file(ROOT, output_dir)
    require(not (output_root / "manifest.json").exists(), "V6 candidate manifest already exists")
    image_root = output_root / "images"
    image_root.mkdir(parents=True, exist_ok=True)
    candidates = []
    with torch.no_grad():
        for sample_index, source_row in enumerate(validation.rows):
            sample = validation[sample_index]
            conditions = sample["conditions"].unsqueeze(0).to(device)
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                predicted = model(conditions)
            pixels = predicted[0].detach().float().clamp(0, 1).mul(255).round().byte()
            array = pixels.permute(1, 2, 0).cpu().numpy()
            require(array.shape == (192, 256, 3) and array.dtype == np.uint8,
                    "V6 candidate tensor invalid")
            logical = output_dir.rstrip("/") + f"/images/validation-{sample_index:02d}.png"
            target = project_file(ROOT, logical)
            Image.fromarray(array).save(target, format="PNG", optimize=False)
            with Image.open(target) as image:
                require(image.mode == "RGB" and image.size == (256, 192),
                        "V6 candidate image invalid")
            rgb_binding = bind(logical)
            condition_pack = bound_json(ROOT, source_row["conditionPack"])
            channels = {item["id"]: {"path": item["path"], "sha256": item["sha256"]}
                        for item in condition_pack["channels"]}
            candidates.append({
                "sampleIndex": sample_index, "sampleId": source_row["sampleId"],
                "split": "validation", "seed": None,
                "candidateRgb": {**rgb_binding, "width": 256, "height": 192,
                                 "role": "complete_rgb_candidate"},
                "referenceRgb": source_row["image"],
                "conditionPack": source_row["conditionPack"],
                "objectMasks": [{"role": role, **channels[role]} for role in OBJECT_MASK_ROLES],
                "artifactIdentity": {
                    "inferenceMode": "deterministic_condition_to_complete_rgb",
                    "modelStateSha256": terminal["modelStateSha256"],
                    "candidateRgb": rgb_binding,
                },
            })
            del conditions, predicted, pixels
    after = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    require(before == after == terminal["modelStateSha256"], "V6 candidate inference mutated weights")
    manifest = {
        "schemaVersion": "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1",
        "status": "candidate_pack_materialized_review_pending",
        "architectureId": CAPABILITY_VERSION,
        "executionPackageIdentity": package["packageId"], "runId": package["runId"],
        "stage": STAGE, "executionPackage": package_binding,
        "trainingTerminal": terminal_binding, "datasetManifest": package["datasetManifest"],
        "checkpoint": terminal["checkpoint"], "selectedEpoch": terminal["selectedEpoch"],
        "selectedScore": terminal["selectedScore"],
        "modelStateSha256": terminal["modelStateSha256"],
        "candidateCount": len(candidates), "candidateSplit": "validation",
        "candidates": candidates,
        "executionBoundary": {
            "gpuInferenceExecuted": True, "optimizerCreated": False,
            "optimizerSteps": 0, "backwardExecuted": False, "weightsModified": False,
            "challengeRead": False, "regressionRead": False,
            "machineReviewExecuted": False, "qualificationGranted": False,
        },
        "peakGpuReservedBytes": int(torch.cuda.max_memory_reserved(device)),
        "gpuTotalBytes": int(torch.cuda.get_device_properties(device).total_memory),
        "recordedAtUtc": utc_now(),
    }
    require(len(candidates) == 8, "V6 all validation candidates are required")
    write_exclusive_json(output_root / "manifest.json", manifest)
    manifest_logical = output_dir.rstrip("/") + "/manifest.json"
    return {"status": manifest["status"], "manifest": bind(manifest_logical),
            "candidateCount": len(candidates)}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--training-terminal", required=True)
    parser.add_argument("--training-terminal-sha256", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    try:
        result = materialize(
            {"path": args.execution_package.replace("\\", "/"),
             "sha256": args.execution_package_sha256},
            {"path": args.training_terminal.replace("\\", "/"),
             "sha256": args.training_terminal_sha256},
            args.output_dir.replace("\\", "/"),
        )
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
