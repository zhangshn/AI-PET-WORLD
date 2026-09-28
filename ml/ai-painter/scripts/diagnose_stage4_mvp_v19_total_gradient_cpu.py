"""Read-only V19 weighted-gradient contribution against the full V18 generator objective."""
from __future__ import annotations

from datetime import datetime, timezone
import io
import json
import math
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
import check_stage4_mvp_v19_object_highpass_cpu as gate
import materialize_stage4_mvp_structured_object_v18_dry_review as materialize
from ai_painter.complete_world.native_rgb_object_highpass_v19_cpu import (
    CPU_THREADS, MAX_SECONDS, TRAIN_ORDINALS, WEIGHT, instance_rgb_highpass_loss,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    train_structured_object_objective,
)

PROGRAM = "ml/ai-painter/scripts/diagnose_stage4_mvp_v19_total_gradient_cpu.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_mvp_v19_total_gradient_cpu.py"
OUTPUT = ".runtime/ai-painter/stage4-mvp-v19-total-gradient-diagnostics/diagnostic-001/report.json"
ROLES = gate.ROLES
VIRTUAL_STEP = 0.01


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def gradient_comparison(base, added):
    """Report magnitude and cosine without treating either as an approval threshold."""
    import torch
    require(base.shape == added.shape and bool(torch.isfinite(base).all())
            and bool(torch.isfinite(added).all()), "gradient tensor mismatch or nonfinite")
    base = base.detach().float().reshape(-1)
    added = added.detach().float().reshape(-1)
    base_norm = float(torch.linalg.vector_norm(base.double()))
    added_norm = float(torch.linalg.vector_norm(added.double()))
    dot = float(torch.dot(base.double(), added.double()))
    cosine = dot / (base_norm * added_norm) if base_norm > 0 and added_norm > 0 else None
    result = {"v18GradientL2": base_norm, "weightedNewGradientL2": added_norm,
              "weightedNewToV18NormRatio": added_norm / base_norm if base_norm > 0 else None,
              "cosine": cosine, "dot": dot}
    require(all(value is None or math.isfinite(value) for value in result.values()),
            "nonfinite gradient comparison")
    return result


def evaluate(model, critic, sample, order):
    import torch
    captured = []
    def remember(_module, args):
        require(len(args) == 4 and len(args[2]) == 4, "V18 object decoder boundary differs")
        captured.append(args)
    handle = model.core.final_rgb_decoder.register_forward_pre_hook(remember)
    try:
        predicted, evidence = model(sample["conditions"][None],
                                    sample["objectInstanceTable"], return_evidence=True)
    finally:
        handle.remove()
    require(len(captured) == 1, "decoder call count differs")
    base, base_parts = train_structured_object_objective(
        critic, predicted, sample, sample["objectInstanceTable"], order)
    new_raw, support = instance_rgb_highpass_loss(predicted, sample, order)
    added = WEIGHT * new_raw
    tensors = [model.core.appearance.base.layers[-1].weight,
               *(evidence["responsibilityFeatures"][role] for role in ROLES)]
    base_gradients = torch.autograd.grad(base, tensors, retain_graph=True, allow_unused=False)
    added_gradients = torch.autograd.grad(added, tensors, allow_unused=False)
    comparisons = {name: gradient_comparison(old, new) for name, old, new in
                   zip(("appearanceLastConv", *ROLES), base_gradients, added_gradients)}
    base_features, added_features = base_gradients[1:], added_gradients[1:]
    aggregate = gradient_comparison(torch.cat([value.flatten() for value in base_features]),
                                    torch.cat([value.flatten() for value in added_features]))
    args = captured[0]
    normalized_steps = []
    for old, new in zip(base_features, added_features):
        total = old.detach() + new.detach()
        normalized_steps.append(VIRTUAL_STEP * total / total.abs().max().clamp_min(1e-12))
    with torch.no_grad():
        projected_base = -sum(float((old.detach() * step).sum()) for old, step in
                              zip(base_features, normalized_steps))
        projected_new = -sum(float((new.detach() * step).sum()) for new, step in
                             zip(added_features, normalized_steps))
        stepped = model.core.final_rgb_decoder(
            args[0], args[1],
            tuple(feature.detach() - step for feature, step in zip(args[2], normalized_steps)),
            args[3])
        next_base, _ = train_structured_object_objective(
            critic, stepped, sample, sample["objectInstanceTable"], order)
        next_new_raw, _ = instance_rgb_highpass_loss(stepped, sample, order)
        next_new = WEIGHT * next_new_raw
    vals = [base, added, next_base, next_new]
    require(all(bool(torch.isfinite(value)) for value in vals), "nonfinite objective after virtual step")
    return {
        "sampleId": sample["sampleId"], "split": "train", "instanceSupport": support,
        "v18GeneratorObjective": float(base.detach()),
        "v18ObjectClassSpatialLoss": float(base_parts["objectClassSpatialLoss"].detach()),
        "newHighpassRaw": float(new_raw.detach()), "newHighpassWeighted": float(added.detach()),
        "newTermToV18ValueRatio": float(added.detach() / base.detach()),
        "gradients": comparisons, "aggregateObjectFeatureGradients": aggregate,
        "virtualCombinedFeatureStep": {
            "maximumPerTensorAbsoluteStep": VIRTUAL_STEP,
            "predictedFirstOrderV18Change": projected_base,
            "predictedFirstOrderNewTermChange": projected_new,
            "predictedFirstOrderCombinedChange": projected_base + projected_new,
            "actualV18Change": float(next_base - base.detach()),
            "actualNewTermChange": float(next_new - added.detach()),
            "actualCombinedChange": float(next_base + next_new - base.detach() - added.detach()),
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
     rows, order, continuous) = gate.load_inputs(reader)
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
            "reloaded V18 model/critic identity differs")
    del saved
    model.eval()
    critic.eval().requires_grad_(False)
    before_model, before_critic = cpu.state_hash(model), cpu.state_hash(critic)
    results = []
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")):
        for ordinal, source in zip(TRAIN_ORDINALS, rows):
            sample, identity = cpu.load_sample(reader, source, order, continuous)
            require(sample["split"] == identity["split"] == "train", "non-train content prohibited")
            before = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
            item = evaluate(model, critic, sample, order)
            item["trainOrdinal"] = ordinal
            require(before == {key: cpu.tensor_hash(sample[key]) for key in before},
                    "source train tensors changed")
            results.append(item)
            require(time.monotonic() - started <= MAX_SECONDS,
                    "total-gradient diagnosis exceeded 120 seconds")
    require(cpu.state_hash(model) == before_model and cpu.state_hash(critic) == before_critic
            and all(parameter.grad is None for parameter in model.parameters()),
            "diagnosis modified V18 network state or gradients")
    require(not torch.cuda.is_initialized(), "GPU initialized")
    reader.unchanged()
    report = {
        "schemaVersion": "ai-painter-stage4-mvp-v19-total-gradient-readonly-diagnostic-v1",
        "status": "measured_no_training_authority", "program": gate.binding(PROGRAM),
        "testProgram": gate.binding(TEST), "priorV19CpuGate": gate.binding(gate.OUTPUT),
        "sourceV18RunId": gate.RUN_ID, "sourceExecutionPackage": package_binding,
        "sourceTrainingTerminal": final_binding, "sourceWorkerTerminal": worker_binding,
        "sourceCheckpoint": checkpoint, "sourceModelStateSha256": before_model,
        "sourceCriticStateSha256": before_critic,
        "newTermWeight": WEIGHT, "fixedTrainOrdinals": TRAIN_ORDINALS,
        "virtualFeatureStep": VIRTUAL_STEP,
        "observations": results,
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
    return {"status": report["status"], "report": gate.binding(OUTPUT),
            "elapsedSeconds": report["elapsedSeconds"]}


if __name__ == "__main__":
    print(json.dumps(run()))
