"""Eight bound V13 validation frames from one reloaded local Checkpoint; no training."""

from argparse import ArgumentParser
import io
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image
import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml/ai-painter/src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (  # noqa: E402
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from train_stage4_mvp_instance_object_v13_stage0 import (  # noqa: E402
    ARCHITECTURE, CAPABILITY, CHECKPOINT_SCHEMA, PACKAGE_SCHEMA, STAGE,
    TERMINAL_SCHEMA,
)
import materialize_stage4_mvp_native_rgb_renderer_v6_review_candidates as base  # noqa: E402


OBJECT_MASK_ROLES = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)


def materialize(package_binding: dict, terminal_binding: dict, output_dir: str) -> dict:
    package = bound_json(ROOT, package_binding)
    terminal = bound_json(ROOT, terminal_binding)
    base.require(package.get("schemaVersion") == PACKAGE_SCHEMA
                 and package.get("capabilityVersion") == CAPABILITY
                 and package.get("stage") == STAGE
                 and package.get("outputRoot", "").startswith(
                     ".runtime/ai-painter/stage4-mvp-native-rgb-instance-object-v13-formal-executions/")
                 and output_dir == package.get("outputRoot", "") + "/review-candidates",
                 "V13 output is not bound to one Stage0 execution package")
    for program in package["programBindings"]:
        base.require(base.bind(program["path"]) == program,
                     "V13 program changed before candidate inference")
    base.require(terminal.get("schemaVersion") == TERMINAL_SCHEMA
                 and terminal.get("status") == "training_completed_review_pending"
                 and terminal.get("executionState") == "completed"
                 and terminal.get("capabilityVersion") == CAPABILITY
                 and terminal.get("packageId") == package.get("packageId")
                 and terminal.get("runId") == package.get("runId")
                 and terminal.get("executionPackage") == package_binding
                 and terminal.get("datasetManifest") == package["datasetManifest"]
                 and terminal.get("completedEpochs") == 24
                 and terminal.get("optimizerSteps") == 1152
                 and terminal.get("checkpointReloadVerified") is True
                 and terminal.get("checkpoint", {}).get("path", "").startswith(
                     package["outputRoot"] + "/")
                 and terminal.get("challengeRead") is False
                 and terminal.get("regressionRead") is False,
                 "V13 training terminal is not qualified for candidate materialization")
    checkpoint = torch.load(io.BytesIO(read_bound(ROOT, terminal["checkpoint"])),
                            map_location="cpu", weights_only=True)
    base.require(checkpoint.get("schemaVersion") == CHECKPOINT_SCHEMA
                 and checkpoint.get("capabilityVersion") == CAPABILITY
                 and checkpoint.get("architectureId") == ARCHITECTURE
                 and checkpoint.get("executionIdentity", {}).get("executionPackage")
                 == package_binding
                 and checkpoint.get("datasetManifest") == package["datasetManifest"]
                 and checkpoint.get("candidateContract") == package["candidateContract"]
                 and checkpoint.get("reviewContract") == package["reviewContract"]
                 and checkpoint.get("bestEpoch") == terminal["selectedEpoch"]
                 and checkpoint.get("bestValidationMetric") == terminal["selectedScore"]
                 and checkpoint.get("machineReviewPending") is True
                 and state_hash(checkpoint["modelState"])
                 == checkpoint.get("modelStateSha256") == terminal["modelStateSha256"],
                 "V13 Checkpoint identity or selected state invalid")
    validation = SplitReleaseDataset(ROOT, package["datasetManifest"],
                                     "validation", (256, 192))
    base.require(len(validation) == 8, "V13 validation capacity changed")
    order = validation.manifest["identityPayload"]["channelOrder"]
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    model.load_state_dict(checkpoint["modelState"], strict=True)
    before = state_hash(model.state_dict())
    base.require(before == terminal["modelStateSha256"],
                 "V13 model reload changed selected state")
    base.require(torch.cuda.is_available(), "V13 candidate inference CUDA unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(0.7, device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device).eval()
    output_root = project_file(ROOT, output_dir)
    base.require(not output_root.exists(), "V13 review-candidates output already exists")
    image_root = output_root / "images"
    image_root.mkdir(parents=True)
    candidates = []
    with torch.no_grad():
        for index, row in enumerate(validation.rows):
            sample = load_bound_object_sample(validation, index)
            conditions = sample["conditions"].unsqueeze(0).to(device)
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                predicted = model(conditions, sample["objectInstanceTable"])
            pixels = predicted[0].detach().float().clamp(0, 1).mul(255).round().byte()
            array = pixels.permute(1, 2, 0).cpu().numpy()
            base.require(array.shape == (192, 256, 3) and array.dtype == np.uint8,
                         "V13 candidate RGB tensor invalid")
            logical = f"{output_dir}/images/validation-{index:02d}.png"
            buffer = io.BytesIO()
            Image.fromarray(array).save(buffer, format="PNG", optimize=False)
            with project_file(ROOT, logical).open("xb") as stream:
                stream.write(buffer.getvalue())
            rgb = base.bind(logical)
            pack = bound_json(ROOT, row["conditionPack"])
            channels = {item["id"]: {"path": item["path"], "sha256": item["sha256"]}
                        for item in pack["channels"]}
            candidates.append({
                "sampleIndex": index, "sampleId": row["sampleId"],
                "split": "validation", "seed": None,
                "candidateRgb": {**rgb, "width": 256, "height": 192,
                                 "role": "complete_rgb_candidate"},
                "referenceRgb": row["image"],
                "conditionPack": row["conditionPack"],
                "objectMasks": [{"role": role, **channels[role]}
                                for role in OBJECT_MASK_ROLES],
                "artifactIdentity": {
                    "inferenceMode": "bound_instance_objects_to_complete_rgb",
                    "modelStateSha256": terminal["modelStateSha256"],
                    "candidateRgb": rgb,
                },
            })
    after = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    base.require(before == after, "V13 candidate inference modified weights")
    peak = int(torch.cuda.max_memory_reserved(device))
    total_memory = int(torch.cuda.get_device_properties(device).total_memory)
    base.require(peak / total_memory <= 0.7, "V13 candidate inference GPU cap exceeded")
    for program in package["programBindings"]:
        base.require(base.bind(program["path"]) == program,
                     "V13 program changed during candidate inference")
    manifest = {
        "schemaVersion": "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1",
        "status": "candidate_pack_materialized_review_pending",
        "architectureId": CAPABILITY,
        "executionPackageIdentity": package["packageId"],
        "runId": package["runId"], "stage": STAGE,
        "executionPackage": package_binding,
        "trainingTerminal": terminal_binding,
        "datasetManifest": package["datasetManifest"],
        "checkpoint": terminal["checkpoint"],
        "selectedEpoch": terminal["selectedEpoch"],
        "selectedScore": terminal["selectedScore"],
        "modelStateSha256": terminal["modelStateSha256"],
        "candidateCount": 8, "candidateSplit": "validation",
        "candidates": candidates,
        "executionBoundary": {
            "gpuInferenceExecuted": True, "optimizerCreated": False,
            "optimizerSteps": 0, "backwardExecuted": False,
            "weightsModified": False, "challengeRead": False,
            "regressionRead": False, "machineReviewExecuted": False,
            "qualificationGranted": False,
        },
        "peakGpuReservedBytes": peak, "gpuTotalBytes": total_memory,
        "recordedAtUtc": base.utc_now(),
    }
    base.write_exclusive_json(output_root / "manifest.json", manifest)
    return {"status": manifest["status"],
            "manifest": base.bind(output_dir + "/manifest.json"),
            "candidateCount": 8}


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
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
