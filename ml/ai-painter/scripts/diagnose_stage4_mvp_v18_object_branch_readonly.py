"""One CPU-only, zero-update V18 object-feature counterfactual on fixed train data.

The counterfactual is diagnostic output, never a candidate image or review result.
"""
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
import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
import run_stage4_mvp_structured_object_v18_readonly_gpu_qualification as gpu
import train_stage4_mvp_structured_object_v18_dry_stage0 as training
import materialize_stage4_mvp_structured_object_v18_dry_review as materialize

PROGRAM = "ml/ai-painter/scripts/diagnose_stage4_mvp_v18_object_branch_readonly.py"
OUTPUT_PREFIX = ".runtime/ai-painter/stage4-mvp-v18-object-branch-diagnostics"
RUN_ID = "mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898"
RUN_ROOT = (".runtime/ai-painter/stage4-mvp-structured-object-v18-dry-executions/"
            "mvp-v18-dry-batch-6061ccf56942a9bfaec776761e5ec30f6bf52629/stages/" + RUN_ID)
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
MAX_SECONDS = 120


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def binding(path):
    return {"path": path, "sha256": cpu.sha(cpu.project_file(ROOT, path).read_bytes())}


def fixed_train_row(reader, package):
    """Read train pixels only; non-train split membership remains metadata."""
    manifest, order, continuous, _, memberships = cpu.select_rows(reader)
    require(manifest["sourceIndex"] == package["datasetManifest"] or
            manifest == reader.json(package["datasetManifest"]),
            "training dataset manifest differs")
    candidate = reader.json(package["candidateContract"])
    for split in cpu.COUNTS:
        require(memberships[split]["selectionSha256"] ==
                candidate["datasetBinding"][split + "SelectionSha256"],
                "frozen split membership changed")
    source = reader.json(manifest["sourceIndex"])
    train_ids = reader.json(manifest["splits"]["train"])["sampleIds"]
    require(train_ids[gpu.TRAIN_ORDINAL] == gpu.TRAIN_ID, "fixed train membership differs")
    row = next(item for item in source["samples"] if item["sampleId"] == gpu.TRAIN_ID)
    require(row["split"] == "train", "non-train pixels prohibited")
    return row, order, continuous


def region_metrics(normal, counterfactual, original, masks):
    """No acceptance threshold: report measured response and original-RGB error."""
    import torch
    from torch.nn import functional as F
    require(normal.shape == counterfactual.shape == original.shape == (1, 3, 192, 256),
            "RGB dimensions differ")
    delta = (normal - counterfactual).abs().float().mean(dim=1)[0]
    baseline_error = (normal - original).abs().float().mean(dim=1)[0]
    counter_error = (counterfactual - original).abs().float().mean(dim=1)[0]
    results = {}
    for role, mask in masks.items():
        require(mask.shape == (192, 256), "role mask dimensions differ")
        pixels = int(mask.sum())
        require(pixels > 0, "fixed train role absent: " + role)
        expanded = F.max_pool2d(mask.float()[None, None], 25, stride=1, padding=12)[0, 0] > 0
        ring = expanded & ~mask
        require(bool(ring.any()), "role ring is empty: " + role)
        def stats(area):
            return {"pixels": int(area.sum()),
                    "normalVsZeroObjectRgbMae": float(delta[area].mean()),
                    "normalVsOriginalRgbMae": float(baseline_error[area].mean()),
                    "zeroObjectVsOriginalRgbMae": float(counter_error[area].mean())}
        results[role] = {"mask": stats(mask), "ring12px": stats(ring)}
    require(all(torch.isfinite(value).all() for value in
                (normal, counterfactual, original, delta)), "nonfinite diagnostic tensor")
    return results


def run():
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
        build_native_rgb_structured_object_v18_cpu,
    )
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
        build_conditional_texture_discriminator,
    )

    start = time.monotonic()
    reader = cpu.BoundReader()
    package_binding = binding(RUN_ROOT + "/execution-package.json")
    package = reader.json(package_binding)
    ticket = reader.json(package["trainingExecutionTicket"])
    training.validate_package(package, ticket)
    require(package["runId"] == RUN_ID and package["capabilityVersion"] == gpu.CAPABILITY,
            "V18 run identity differs")
    require(package["resourceBudget"]["cpuThreads"] == 2, "CPU thread boundary differs")
    for item in package["programBindings"].values():
        reader.read(item)
    worker_binding = binding(RUN_ROOT + "/phase-terminal.json")
    worker = reader.json(worker_binding)
    final_binding = binding(RUN_ROOT + "/training-finalize.json")
    final = reader.json(final_binding)
    checkpoint = gpu.binding(worker["checkpoint"])
    require(worker["status"] == final["status"] == "training_completed_review_pending"
            and final["checkpoint"] == checkpoint and worker["selectedEpoch"] == 20,
            "frozen successful training selection differs")
    require(cpu.project_file(ROOT, checkpoint["path"]).stat().st_size <= 128 * 1024 * 1024,
            "checkpoint exceeds bounded read")
    row, order, continuous = fixed_train_row(reader, package)
    sample, sample_identity = gpu.positive_train_sample(reader, row, order, continuous)[:2]
    require(sample["sampleId"] == gpu.TRAIN_ID and sample["split"] == "train",
            "fixed train sample differs")
    before_sample = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "GPU already initialized")
    saved = torch.load(io.BytesIO(reader.read(checkpoint)), map_location="cpu", weights_only=True)
    request = {"checkpoint": checkpoint, "executionPackage": package_binding}
    materialize.validate_checkpoint(saved, package, worker, request)
    model = build_native_rgb_structured_object_v18_cpu(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    critic = build_conditional_texture_discriminator()
    model.load_state_dict(saved["modelState"], strict=True)
    critic.load_state_dict(saved["criticState"], strict=True)
    require(cpu.state_hash(model) == worker["modelStateSha256"] and
            cpu.state_hash(critic) == worker["criticStateSha256"],
            "reloaded network state differs")
    del saved, critic
    model.eval().requires_grad_(False)
    before_model = cpu.state_hash(model)
    conditions = sample["conditions"][None]
    table = sample["objectInstanceTable"]
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         torch.inference_mode():
        normal, evidence = model(conditions, table, return_evidence=True)
        captured = []
        def zero_object_features(_module, args):
            require(len(args) == 4 and len(args[2]) == 4, "decoder boundary changed")
            captured.extend(float(value.abs().mean()) for value in args[2])
            return (args[0], args[1], tuple(torch.zeros_like(value) for value in args[2]), args[3])
        handle = model.core.final_rgb_decoder.register_forward_pre_hook(zero_object_features)
        try:
            counterfactual = model(conditions, table)
        finally:
            handle.remove()
    require(len(captured) == 4 and all(value > 0 for value in captured),
            "object branch lacks nonzero learned features")
    require(cpu.state_hash(model) == before_model and all(p.grad is None for p in model.parameters()),
            "diagnosis changed model weights or gradients")
    require(before_sample == {key: cpu.tensor_hash(sample[key]) for key in before_sample},
            "diagnosis changed source sample")
    require(not torch.cuda.is_initialized(), "CPU-only diagnosis initialized GPU")
    masks = {role: sample["conditions"][order.index(role)] > .5 for role in ROLES}
    metrics = region_metrics(normal, counterfactual, sample["image"][None], masks)
    require(time.monotonic() - start <= MAX_SECONDS, "diagnosis exceeded 120-second limit")
    reader.unchanged()
    report = {
        "schemaVersion": "ai-painter-stage4-mvp-v18-object-branch-readonly-diagnostic-v1",
        "status": "diagnostic_measured_no_qualification",
        "runId": RUN_ID, "program": binding(PROGRAM), "executionPackage": package_binding,
        "trainingTerminal": final_binding, "workerTerminal": worker_binding,
        "checkpoint": checkpoint, "modelStateSha256": before_model,
        "sampleIdentity": sample_identity, "sampleSplit": "train",
        "counterfactual": "zero_four_learned_object_feature_tensors_at_final_rgb_decoder_only",
        "authoritativeObjectMasksAndTerrainUnchanged": True,
        "counterfactualIsCandidate": False, "optimizerCreated": False,
        "optimizerSteps": 0, "weightsModified": False, "gpuInitialized": False,
        "challengePixelsRead": False, "regressionPixelsRead": False,
        "validationPixelsRead": False, "formalStage0QualificationGranted": False,
        "stage4ProgressIncreaseGranted": False, "runtimePublicationGranted": False,
        "objectFeatureMeanAbsolute": dict(zip(ROLES, captured)),
        "regions": metrics, "elapsedSeconds": time.monotonic() - start,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    logical = OUTPUT_PREFIX + "/" + RUN_ID + "/report.json"
    target = cpu.project_file(ROOT, logical)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf8") as output:
        json.dump(report, output, indent=2, ensure_ascii=False)
        output.write("\n")
    return {"report": binding(logical), "status": report["status"],
            "elapsedSeconds": report["elapsedSeconds"]}


if __name__ == "__main__":
    print(json.dumps(run()))
