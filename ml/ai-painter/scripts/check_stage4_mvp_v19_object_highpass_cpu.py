"""CPU-only V19 objective go/no-go on two fixed train members, without updates."""
from __future__ import annotations

from datetime import datetime, timezone
import io
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
import run_stage4_mvp_structured_object_v18_readonly_gpu_qualification as gpu
import train_stage4_mvp_structured_object_v18_dry_stage0 as training
import materialize_stage4_mvp_structured_object_v18_dry_review as materialize
from ai_painter.complete_world.native_rgb_object_highpass_v19_cpu import (
    CAPABILITY, CPU_THREADS, FEATURE_STEP_SIZES, MAX_SECONDS, MIN_DESCENT,
    MIN_GRAD_ABS_SUM, MIN_LOSS, TRAIN_ORDINALS, WEIGHT, instance_rgb_highpass_loss,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    original_object_class_spatial_loss,
)

PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp_v19_object_highpass_cpu.py"
OBJECTIVE = "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_highpass_v19_cpu.py"
TEST = "ml/ai-painter/tests/test_native_rgb_object_highpass_v19_cpu.py"
RUN_ID = "mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898"
RUN_ROOT = (".runtime/ai-painter/stage4-mvp-structured-object-v18-dry-executions/"
            "mvp-v18-dry-batch-6061ccf56942a9bfaec776761e5ec30f6bf52629/stages/" + RUN_ID)
OUTPUT = ".runtime/ai-painter/stage4-mvp-v19-object-highpass-cpu-gates/gate-001/report.json"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def binding(path):
    return {"path": path, "sha256": cpu.sha(cpu.project_file(ROOT, path).read_bytes())}


def decide_gate(rows):
    """Thresholds are code-frozen before data evaluation; no adaptive tuning."""
    if len(rows) != len(TRAIN_ORDINALS):
        return "no_go_missing_fixed_train_rows"
    for row in rows:
        if (row["highpassLoss"] <= MIN_LOSS or
                row["appearanceGradientAbsSum"] <= MIN_GRAD_ABS_SUM or
                any(value <= MIN_GRAD_ABS_SUM for value in row["objectFeatureGradientAbsSum"].values()) or
                row["bestVirtualDescent"] < MIN_DESCENT):
            return "no_go_insufficient_train_only_cpu_signal"
    return "go_cpu_signal_only_not_gpu_qualified"


def load_inputs(reader):
    package_binding = binding(RUN_ROOT + "/execution-package.json")
    package = reader.json(package_binding)
    ticket = reader.json(package["trainingExecutionTicket"])
    training.validate_package(package, ticket)
    require(package["runId"] == RUN_ID and package["capabilityVersion"] == gpu.CAPABILITY,
            "V18 source package identity differs")
    for item in package["programBindings"].values():
        reader.read(item)
    worker_binding = binding(RUN_ROOT + "/phase-terminal.json")
    worker = reader.json(worker_binding)
    final_binding = binding(RUN_ROOT + "/training-finalize.json")
    final = reader.json(final_binding)
    checkpoint = gpu.binding(worker["checkpoint"])
    require(worker["status"] == final["status"] == "training_completed_review_pending"
            and final["checkpoint"] == checkpoint and worker["selectedEpoch"] == 20,
            "V18 selected source checkpoint differs")
    manifest, order, continuous, _, memberships = cpu.select_rows(reader)
    require(reader.json(package["datasetManifest"]) == manifest,
            "frozen V18 data manifest differs")
    candidate = reader.json(package["candidateContract"])
    for split in cpu.COUNTS:
        require(memberships[split]["selectionSha256"] ==
                candidate["datasetBinding"][split + "SelectionSha256"],
                "frozen membership differs: " + split)
    train = reader.json(manifest["splits"]["train"])["sampleIds"]
    source = reader.json(manifest["sourceIndex"])
    by_id = {item["sampleId"]: item for item in source["samples"]}
    rows = [by_id[train[index]] for index in TRAIN_ORDINALS]
    require(len(set(item["sampleId"] for item in rows)) == len(rows)
            and all(item["split"] == "train" for item in rows),
            "only distinct fixed train members may be decoded")
    require(cpu.project_file(ROOT, checkpoint["path"]).stat().st_size <= 128 * 1024 * 1024,
            "checkpoint exceeds bounded read")
    return package_binding, package, worker_binding, worker, final_binding, checkpoint, rows, order, continuous


def evaluate_row(model, sample, order):
    import torch
    from ai_painter.complete_world.native_rgb_object_highpass_v19_cpu import instance_rgb_highpass_loss
    require(sample["split"] == "train", "non-train sample reached V19 probe")
    captured = []
    def remember(_module, args):
        require(len(args) == 4 and len(args[2]) == 4, "V18 decoder object boundary differs")
        captured.append(args)
    handle = model.core.final_rgb_decoder.register_forward_pre_hook(remember)
    try:
        predicted, evidence = model(sample["conditions"][None],
                                    sample["objectInstanceTable"], return_evidence=True)
    finally:
        handle.remove()
    require(len(captured) == 1, "decoder was not called exactly once")
    highpass, support = instance_rgb_highpass_loss(predicted, sample, order)
    spatial, correlations = original_object_class_spatial_loss(
        predicted, sample, order, split="train")
    role_features = evidence["responsibilityFeatures"]
    params = model.core.appearance.base.layers[-1].weight
    tensors = [params, *(role_features[role] for role in ROLES)]
    gradients = torch.autograd.grad(highpass, tensors, allow_unused=False)
    values = [float(value.abs().sum()) for value in gradients]
    require(all(torch.isfinite(value).all() for value in gradients), "nonfinite object gradient")
    require(bool(torch.isfinite(predicted).all() and torch.isfinite(spatial)), "nonfinite V18 baseline")
    args = captured[0]
    feature_grads = gradients[1:]
    best_descent = float("-inf")
    best_step = None
    with torch.no_grad():
        for step in FEATURE_STEP_SIZES:
            perturbed = tuple(feature.detach() - step * gradient.detach() /
                              gradient.detach().abs().max().clamp_min(1e-12)
                              for feature, gradient in zip(args[2], feature_grads))
            trial = model.core.final_rgb_decoder(args[0], args[1], perturbed, args[3])
            trial_loss, _ = instance_rgb_highpass_loss(trial, sample, order)
            descent = float(highpass.detach() - trial_loss)
            if descent > best_descent:
                best_descent, best_step = descent, step
    mae = (predicted.detach()[0] - sample["image"]).abs().float()
    role_mae = {}
    for role in ROLES:
        mask = sample["conditions"][order.index(role)] > .5
        if bool(mask.any()):
            role_mae[role] = float(mae[:, mask].mean())
    return {
        "sampleId": sample["sampleId"], "split": "train",
        "highpassLoss": float(highpass.detach()),
        "weightedNewTerm": float(WEIGHT * highpass.detach()),
        "v18ClassLumaSpatialLoss": float(spatial.detach()),
        "v18ClassLumaCorrelations": {key: float(value.detach()) for key, value in correlations.items()},
        "v18NormalRgbMaeByRole": role_mae,
        "instanceSupport": support,
        "appearanceGradientAbsSum": values[0],
        "objectFeatureGradientAbsSum": dict(zip(ROLES, values[1:])),
        "bestVirtualDescent": best_descent, "bestVirtualFeatureStep": best_step,
    }


def run():
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
        build_native_rgb_structured_object_v18_cpu,
    )
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
        build_conditional_texture_discriminator,
    )
    started = time.monotonic()
    reader = cpu.BoundReader()
    (package_binding, package, worker_binding, worker, final_binding, checkpoint,
     rows, order, continuous) = load_inputs(reader)
    torch.set_num_threads(CPU_THREADS)
    require(not torch.cuda.is_initialized(), "GPU already initialized")
    saved = torch.load(io.BytesIO(reader.read(checkpoint)), map_location="cpu", weights_only=True)
    materialize.validate_checkpoint(saved, package, worker,
                                    {"checkpoint": checkpoint, "executionPackage": package_binding})
    model = build_native_rgb_structured_object_v18_cpu(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    critic = build_conditional_texture_discriminator()
    model.load_state_dict(saved["modelState"], strict=True)
    critic.load_state_dict(saved["criticState"], strict=True)
    require(cpu.state_hash(model) == worker["modelStateSha256"] and
            cpu.state_hash(critic) == worker["criticStateSha256"],
            "checkpoint network state differs")
    del saved, critic
    model.eval()
    before_model = cpu.state_hash(model)
    observations = []
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")):
        for ordinal, source in zip(TRAIN_ORDINALS, rows):
            sample, identity = cpu.load_sample(reader, source, order, continuous)
            require(identity["sampleId"] == source["sampleId"] and sample["split"] == "train",
                    "fixed train sample identity differs")
            before = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
            result = evaluate_row(model, sample, order)
            require(before == {key: cpu.tensor_hash(sample[key]) for key in before},
                    "V19 trial modified train input")
            result["trainOrdinal"] = ordinal
            observations.append(result)
            require(time.monotonic() - started <= MAX_SECONDS,
                    "V19 CPU gate exceeded 120-second budget")
    require(cpu.state_hash(model) == before_model and all(param.grad is None for param in model.parameters()),
            "V19 CPU gate changed V18 weights or gradients")
    require(not torch.cuda.is_initialized(), "GPU initialized during CPU gate")
    reader.unchanged()
    status = decide_gate(observations)
    report = {
        "schemaVersion": "ai-painter-stage4-mvp-v19-object-highpass-cpu-gate-v1",
        "status": status, "capabilityVersion": CAPABILITY,
        "sourceV18RunId": RUN_ID, "sourceExecutionPackage": package_binding,
        "sourceTrainingTerminal": final_binding, "sourceWorkerTerminal": worker_binding,
        "sourceCheckpoint": checkpoint, "sourceModelStateSha256": before_model,
        "program": binding(PROGRAM), "objectiveProgram": binding(OBJECTIVE),
        "testProgram": binding(TEST),
        "singleChange": "add_equal_instance_weighted_masked_rgb_3x3_highpass_residual_loss",
        "newTermWeight": WEIGHT,
        "goNoGo": {"trainOrdinals": TRAIN_ORDINALS, "minimumLoss": MIN_LOSS,
                    "minimumAppearanceAndEachObjectFeatureGradientAbsSum": MIN_GRAD_ABS_SUM,
                    "minimumVirtualFeatureDescent": MIN_DESCENT,
                    "fixedFeatureStepSizes": FEATURE_STEP_SIZES,
                    "maxSeconds": MAX_SECONDS, "cpuThreads": CPU_THREADS},
        "observations": observations,
        "counterfactualOnly": True, "optimizerCreated": False, "optimizerSteps": 0,
        "weightsModified": False, "gpuInitialized": False,
        "validationPixelsRead": False, "challengePixelsRead": False,
        "regressionPixelsRead": False, "stage4ProgressIncreaseGranted": False,
        "formalStage0QualificationGranted": False, "runtimePublicationGranted": False,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    target = cpu.project_file(ROOT, OUTPUT)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf8") as output:
        json.dump(report, output, ensure_ascii=False, indent=2)
        output.write("\n")
    return {"status": status, "report": binding(OUTPUT),
            "elapsedSeconds": report["elapsedSeconds"]}


if __name__ == "__main__":
    print(json.dumps(run()))
