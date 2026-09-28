"""Immutable eight-image V16 validation pack from one reloaded local Checkpoint.

This process performs inference only. It neither creates an optimizer nor
selects a Checkpoint, reads challenge/regression, or grants review authority.
"""

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
from train_stage4_mvp_conditional_texture_bf16_v16_stage0 import (  # noqa: E402
    CAPABILITY, CHECKPOINT_SCHEMA, OUTPUT_PREFIX, PACKAGE_SCHEMA, PRECISION_PLAN, STAGE,
    TERMINAL_SCHEMA,
)
import materialize_stage4_mvp_native_rgb_renderer_v6_review_candidates as base  # noqa: E402


OBJECT_MASK_ROLES = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)
PROGRAM_PATH = "ml/ai-painter/scripts/materialize_stage4_mvp_conditional_texture_bf16_v16_review_candidates.py"


def materialize(package_binding: dict, terminal_binding: dict, output_dir: str) -> dict:
    package = bound_json(ROOT, package_binding)
    terminal = bound_json(ROOT, terminal_binding)
    base.require(package.get("schemaVersion") == PACKAGE_SCHEMA
                 and package.get("capabilityVersion") == CAPABILITY
                 and package.get("stage") == STAGE
                 and package.get("outputRoot", "").startswith(OUTPUT_PREFIX)
                 and len(package["outputRoot"]) > len(OUTPUT_PREFIX)
                 and output_dir == package["outputRoot"] + "/review-candidates",
                 "V16 review output is not bound to one Stage0 package")
    base.require(package.get("permittedSplits") == ["train", "validation"]
                 and package.get("forbiddenSplits") == ["challenge", "regression"]
                 and package.get("precisionExecutionPlan") == PRECISION_PLAN
                 and package.get("ticketConsumptionRequired") is True
                 and isinstance(package.get("reviewContract"), dict),
                 "V16 package split or review boundary invalid")
    program_bindings = package.get("programBindings")
    base.require(isinstance(program_bindings, list)
                 and base.bind(PROGRAM_PATH) in program_bindings,
                 "V16 review materializer program not bound")
    for program in program_bindings:
        base.require(base.bind(program["path"]) == program,
                     "V16 program changed before candidate inference")
    candidate_contract = bound_json(ROOT, package["candidateContract"])
    review_contract = bound_json(ROOT, package["reviewContract"])
    base.require(candidate_contract.get("capabilityVersion") == CAPABILITY
                 and candidate_contract.get("status") == "cpu_candidate_not_execution_qualified"
                 and candidate_contract.get("precisionExecutionPlan") == PRECISION_PLAN
                 and candidate_contract.get("reviewBinding", {}).get("alignmentQualified") is True
                 and candidate_contract.get("reviewBinding", {}).get("formalReviewDispatchable") is False
                 and candidate_contract.get("reviewBinding", {}).get("formalContract")
                 == package["reviewContract"]
                 and candidate_contract.get("reviewBinding", {}).get("thresholdLoweringAllowed") is False
                 and candidate_contract.get("datasetBinding", {}).get("manifest")
                 == package.get("datasetManifest"),
                 "V16 candidate contract is not activated or dataset differs")
    base.require(review_contract.get("schemaVersion")
                 == "stage4-mvp-v16-stage0-review-contract-v1"
                 and review_contract.get("status") == "active_for_v16_stage0_machine_review"
                 and review_contract.get("capabilityVersion") == CAPABILITY
                 and review_contract.get("candidateContractPath")
                 == package["candidateContract"]["path"]
                 and review_contract.get("activation", {}).get("formalReviewExecutionAllowed") is True
                 and review_contract.get("activation", {}).get("trainingAllowed") is False,
                 "V16 formal review contract identity or activation invalid")
    base.require(terminal.get("schemaVersion") == TERMINAL_SCHEMA
                 and terminal.get("status") == "training_completed_review_pending"
                 and terminal.get("executionState") == "completed"
                 and terminal.get("capabilityVersion") == CAPABILITY
                 and terminal.get("packageId") == package.get("packageId")
                 and terminal.get("runId") == package.get("runId")
                 and terminal.get("executionPackage") == package_binding
                 and terminal.get("datasetManifest") == package["datasetManifest"]
                 and terminal.get("completedEpochs") == 24
                 and terminal.get("optimizerStepsGenerator") == 1152
                 and terminal.get("optimizerStepsDiscriminator") == 1152
                 and terminal.get("trainingStarted") is True
                 and terminal.get("checkpointReloadVerified") is True
                 and terminal.get("checkpoint", {}).get("path", "").startswith(
                     package["outputRoot"] + "/")
                 and terminal.get("challengeRead") is False
                 and terminal.get("regressionRead") is False
                 and terminal.get("machineReviewPending") is True,
                 "V16 training terminal is not eligible for candidate inference")
    base.require(terminal.get("precisionExecutionPlan") == PRECISION_PLAN
                 and terminal.get("gradientScale") == 1.0,
                 "V16 training terminal precision identity invalid")
    checkpoint = torch.load(io.BytesIO(read_bound(ROOT, terminal["checkpoint"])),
                            map_location="cpu", weights_only=True)
    base.require(checkpoint.get("schemaVersion") == CHECKPOINT_SCHEMA
                 and checkpoint.get("capabilityVersion") == CAPABILITY
                 and checkpoint.get("executionIdentity", {}).get("executionPackage")
                 == package_binding
                 and checkpoint.get("datasetManifest") == package["datasetManifest"]
                 and checkpoint.get("candidateContract") == package["candidateContract"]
                 and checkpoint.get("bestEpoch") == terminal["selectedEpoch"]
                 and checkpoint.get("bestValidationMetric") == terminal["selectedScore"]
                 and checkpoint.get("precisionExecutionPlan") == PRECISION_PLAN
                 and checkpoint.get("gradientScale") == 1.0
                 and checkpoint.get("machineReviewPending") is True
                 and checkpoint.get("formalInferenceEligible") is False
                 and state_hash(checkpoint["modelState"])
                 == checkpoint.get("modelStateSha256") == terminal["modelStateSha256"]
                 and state_hash(checkpoint["discriminatorState"])
                 == checkpoint.get("discriminatorStateSha256")
                 == terminal["discriminatorStateSha256"],
                 "V16 generator or critic Checkpoint identity invalid")
    validation = SplitReleaseDataset(ROOT, package["datasetManifest"],
                                     "validation", (256, 192))
    base.require(len(validation) == 8, "V16 validation capacity changed")
    order = validation.manifest["identityPayload"]["channelOrder"]
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    model.load_state_dict(checkpoint["modelState"], strict=True)
    before = state_hash(model.state_dict())
    base.require(before == terminal["modelStateSha256"],
                 "V16 generator reload changed selected state")
    base.require(torch.cuda.is_available(), "V16 candidate inference CUDA unavailable")
    base.require(torch.cuda.is_bf16_supported(), "V16 candidate inference BF16 unsupported")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(0.7, device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device).eval()
    output_root = project_file(ROOT, output_dir)
    base.require(not output_root.exists(), "V16 review-candidates output already exists")
    image_root = output_root / "images"
    image_root.mkdir(parents=True)
    candidates = []
    with torch.no_grad():
        for index, row in enumerate(validation.rows):
            sample = load_bound_object_sample(validation, index)
            conditions = sample["conditions"].unsqueeze(0).to(device)
            with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
                predicted = model(conditions, sample["objectInstanceTable"])
            pixels = predicted[0].detach().float().clamp(0, 1).mul(255).round().byte()
            array = pixels.permute(1, 2, 0).cpu().numpy()
            base.require(array.shape == (192, 256, 3) and array.dtype == np.uint8,
                         "V16 candidate RGB tensor invalid")
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
                    "inferenceMode": "bound_v16_bf16_generator_only_to_complete_rgb",
                    "precisionExecutionPlan": PRECISION_PLAN,
                    "modelStateSha256": terminal["modelStateSha256"],
                    "candidateRgb": rgb,
                },
            })
    after = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    base.require(before == after, "V16 candidate inference modified generator weights")
    base.require(state_hash(checkpoint["discriminatorState"])
                 == terminal["discriminatorStateSha256"],
                 "V16 inference changed the critic state")
    peak = int(torch.cuda.max_memory_reserved(device))
    total_memory = int(torch.cuda.get_device_properties(device).total_memory)
    base.require(total_memory > 0 and peak / total_memory <= 0.7,
                 "V16 candidate inference GPU cap exceeded")
    for program in program_bindings:
        base.require(base.bind(program["path"]) == program,
                     "V16 program changed during candidate inference")
    manifest = {
        "schemaVersion": "ai-painter-stage4-mvp-conditional-texture-bf16-v16-stage0-review-candidate-pack-v1",
        "status": "candidate_pack_materialized_review_pending",
        "architectureId": CAPABILITY,
        "executionPackageIdentity": package["packageId"],
        "runId": package["runId"], "stage": STAGE,
        "executionPackage": package_binding,
        "trainingTerminal": terminal_binding,
        "datasetManifest": package["datasetManifest"],
        "checkpoint": terminal["checkpoint"],
        "precisionExecutionPlan": PRECISION_PLAN,
        "selectedEpoch": terminal["selectedEpoch"],
        "selectedScore": terminal["selectedScore"],
        "modelStateSha256": terminal["modelStateSha256"],
        "discriminatorStateSha256": terminal["discriminatorStateSha256"],
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
