"""Read-only CPU gate for one V20 four-role loss; never grants GPU execution."""
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
import check_stage4_mvp_v19_object_highpass_cpu as v19_gate
import materialize_stage4_mvp_structured_object_v18_dry_review as materialize
from diagnose_stage4_mvp_v19_total_gradient_cpu import gradient_comparison
from ai_painter.complete_world.native_rgb_four_role_lowpass_v20_cpu import (
    CAPABILITY, CPU_THREADS, MAX_SECONDS, MIN_AGGREGATE_GRADIENT_RATIO,
    MIN_COMBINED_DESCENT, MIN_COSINE, MIN_NEW_TERM_DESCENT,
    MIN_ROLE_FEATURE_GRADIENT_RATIO, MIN_ROLE_LOSS, MIN_ROLE_PIXELS, ROLES,
    TRAIN_ORDINALS, VIRTUAL_FEATURE_STEP, WEIGHT, four_role_lowpass_rgb_loss,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    train_structured_object_objective,
)

PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp_v20_four_role_lowpass_cpu.py"
OBJECTIVE = "ml/ai-painter/src/ai_painter/complete_world/native_rgb_four_role_lowpass_v20_cpu.py"
TEST = "ml/ai-painter/tests/test_native_rgb_four_role_lowpass_v20_cpu.py"
OUTPUT = ".runtime/ai-painter/stage4-mvp-v20-four-role-lowpass-cpu-gates/gate-001/report.json"


def decide_gate(observations):
    """Frozen before reading the two source train members."""
    if len(observations) != len(TRAIN_ORDINALS):
        return "no_go_missing_fixed_train_rows"
    for item in observations:
        if (set(item["rolePixelCounts"]) != set(ROLES)
                or any(item["rolePixelCounts"][role] < MIN_ROLE_PIXELS
                       or item["roleLosses"][role] < MIN_ROLE_LOSS
                       or item["directRoleFeatureGradientAbsSum"][role] <= 0
                       for role in ROLES)):
            return "no_go_role_coverage_or_direct_gradient_missing"
        for key, minimum in (("appearanceLastConv", MIN_AGGREGATE_GRADIENT_RATIO),
                             ("aggregateObjectFeatures", MIN_AGGREGATE_GRADIENT_RATIO),
                             *((role, MIN_ROLE_FEATURE_GRADIENT_RATIO) for role in ROLES)):
            row = item["gradientComparisons"][key]
            if (row["weightedNewToV18NormRatio"] is None
                    or row["weightedNewToV18NormRatio"] < minimum
                    or row["cosine"] is None or row["cosine"] < MIN_COSINE):
                return "no_go_new_gradient_too_weak_or_conflicting"
        step = item["virtualCombinedFeatureStep"]
        if (step["actualCombinedChange"] > -MIN_COMBINED_DESCENT
                or step["actualNewTermChange"] > -MIN_NEW_TERM_DESCENT):
            return "no_go_combined_local_descent_missing"
    return "go_cpu_signal_only_total_control_review_required"


def evaluate(model, critic, sample, order):
    import torch
    captured = []
    def remember(_module, args):
        if len(args) != 4 or len(args[2]) != 4:
            raise ValueError("V18 decoder object boundary differs")
        captured.append(args)
    handle = model.core.final_rgb_decoder.register_forward_pre_hook(remember)
    try:
        predicted, evidence = model(sample["conditions"][None],
                                    sample["objectInstanceTable"], return_evidence=True)
    finally:
        handle.remove()
    if len(captured) != 1:
        raise ValueError("decoder call count differs")
    base, parts = train_structured_object_objective(
        critic, predicted, sample, sample["objectInstanceTable"], order)
    raw, components, counts = four_role_lowpass_rgb_loss(predicted, sample, order)
    added = WEIGHT * raw
    features = evidence["responsibilityFeatures"]
    tensors = [model.core.appearance.base.layers[-1].weight,
               *(features[role] for role in ROLES)]
    direct = {}
    for role in ROLES:
        gradient = torch.autograd.grad(WEIGHT * components[role], features[role],
                                       retain_graph=True, allow_unused=False)[0]
        direct[role] = float(gradient.abs().sum())
    base_grads = torch.autograd.grad(base, tensors, retain_graph=True, allow_unused=False)
    added_grads = torch.autograd.grad(added, tensors, allow_unused=False)
    comparisons = {role: gradient_comparison(old, new) for role, old, new in
                   zip(("appearanceLastConv", *ROLES), base_grads, added_grads)}
    comparisons["aggregateObjectFeatures"] = gradient_comparison(
        torch.cat([value.flatten() for value in base_grads[1:]]),
        torch.cat([value.flatten() for value in added_grads[1:]]))
    args = captured[0]
    steps = []
    for old, new in zip(base_grads[1:], added_grads[1:]):
        total = old.detach() + new.detach()
        steps.append(VIRTUAL_FEATURE_STEP * total /
                     total.abs().max().clamp_min(1e-12))
    with torch.no_grad():
        trial = model.core.final_rgb_decoder(
            args[0], args[1],
            tuple(feature.detach() - step for feature, step in zip(args[2], steps)),
            args[3])
        next_base, _ = train_structured_object_objective(
            critic, trial, sample, sample["objectInstanceTable"], order)
        next_raw, _, _ = four_role_lowpass_rgb_loss(trial, sample, order)
    return {
        "sampleId": sample["sampleId"], "split": "train",
        "v18GeneratorObjective": float(base.detach()),
        "v18ClassLumaSpatialLoss": float(parts["objectClassSpatialLoss"].detach()),
        "newFourRoleLoss": float(raw.detach()),
        "weightedNewTerm": float(added.detach()),
        "roleLosses": {role: float(components[role].detach()) for role in ROLES},
        "rolePixelCounts": counts,
        "directRoleFeatureGradientAbsSum": direct,
        "gradientComparisons": comparisons,
        "virtualCombinedFeatureStep": {
            "maximumPerTensorAbsoluteStep": VIRTUAL_FEATURE_STEP,
            "actualV18Change": float(next_base - base.detach()),
            "actualNewTermChange": float(WEIGHT * next_raw - added.detach()),
            "actualCombinedChange": float(next_base + WEIGHT * next_raw - base.detach() - added.detach()),
        },
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
     rows, order, continuous) = v19_gate.load_inputs(reader)
    torch.set_num_threads(CPU_THREADS)
    if torch.cuda.is_initialized():
        raise ValueError("GPU already initialized")
    saved = torch.load(io.BytesIO(reader.read(checkpoint)), map_location="cpu", weights_only=True)
    materialize.validate_checkpoint(saved, package, worker,
                                    {"checkpoint": checkpoint, "executionPackage": package_binding})
    model = build_native_rgb_structured_object_v18_cpu(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    critic = build_conditional_texture_discriminator()
    model.load_state_dict(saved["modelState"], strict=True)
    critic.load_state_dict(saved["criticState"], strict=True)
    if (cpu.state_hash(model) != worker["modelStateSha256"] or
            cpu.state_hash(critic) != worker["criticStateSha256"]):
        raise ValueError("frozen model/critic state differs")
    del saved
    model.eval()
    critic.eval().requires_grad_(False)
    before_model, before_critic = cpu.state_hash(model), cpu.state_hash(critic)
    observations = []
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")):
        for ordinal, source in zip(TRAIN_ORDINALS, rows):
            sample, identity = cpu.load_sample(reader, source, order, continuous)
            if sample["split"] != identity["split"] or sample["split"] != "train":
                raise ValueError("non-train sample content prohibited")
            before = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
            result = evaluate(model, critic, sample, order)
            if before != {key: cpu.tensor_hash(sample[key]) for key in before}:
                raise ValueError("source train tensors changed")
            result["trainOrdinal"] = ordinal
            observations.append(result)
            if time.monotonic() - started > MAX_SECONDS:
                raise TimeoutError("V20 CPU gate exceeded 120 seconds")
    if (cpu.state_hash(model) != before_model or cpu.state_hash(critic) != before_critic
            or any(parameter.grad is not None for parameter in model.parameters())
            or torch.cuda.is_initialized()):
        raise ValueError("V20 gate altered model state, gradients or GPU")
    reader.unchanged()
    status = decide_gate(observations)
    report = {
        "schemaVersion": "ai-painter-stage4-mvp-v20-four-role-lowpass-cpu-gate-v1",
        "status": status, "capabilityVersion": CAPABILITY,
        "singleChange": "add_equal_four_role_masked_5x5_lowpass_rgb_residual_loss",
        "program": v19_gate.binding(PROGRAM), "objectiveProgram": v19_gate.binding(OBJECTIVE),
        "testProgram": v19_gate.binding(TEST),
        "sourceV18RunId": v19_gate.RUN_ID,
        "sourceExecutionPackage": package_binding,
        "sourceTrainingTerminal": final_binding, "sourceWorkerTerminal": worker_binding,
        "sourceCheckpoint": checkpoint, "sourceModelStateSha256": before_model,
        "sourceCriticStateSha256": before_critic,
        "goNoGo": {"trainOrdinals": TRAIN_ORDINALS, "weight": WEIGHT,
                    "minimumRolePixels": MIN_ROLE_PIXELS, "minimumRoleLoss": MIN_ROLE_LOSS,
                    "minimumAggregateGradientRatio": MIN_AGGREGATE_GRADIENT_RATIO,
                    "minimumRoleFeatureGradientRatio": MIN_ROLE_FEATURE_GRADIENT_RATIO,
                    "minimumCosine": MIN_COSINE,
                    "minimumCombinedDescent": MIN_COMBINED_DESCENT,
                    "minimumNewTermDescent": MIN_NEW_TERM_DESCENT,
                    "virtualFeatureStep": VIRTUAL_FEATURE_STEP,
                    "maxSeconds": MAX_SECONDS, "cpuThreads": CPU_THREADS},
        "observations": observations,
        "optimizerCreated": False, "optimizerSteps": 0, "weightsModified": False,
        "gpuInitialized": False, "validationPixelsRead": False,
        "challengePixelsRead": False, "regressionPixelsRead": False,
        "formalStage0QualificationGranted": False, "stage4ProgressIncreaseGranted": False,
        "runtimePublicationGranted": False,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    target = cpu.project_file(ROOT, OUTPUT)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf8") as output:
        json.dump(report, output, indent=2, ensure_ascii=False)
        output.write("\n")
    return {"status": status, "report": v19_gate.binding(OUTPUT),
            "elapsedSeconds": report["elapsedSeconds"]}


if __name__ == "__main__":
    print(json.dumps(run()))
