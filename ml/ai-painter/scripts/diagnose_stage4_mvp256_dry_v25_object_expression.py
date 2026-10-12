"""Two CPU forwards of frozen V24/V25: conditional RGB envelope and head effects.

No weights, data, checkpoint selection, thresholds or registry are changed.
The envelope is conditional on the saved terrain output, NOT a global proof
that the trainable architecture can never represent an object.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import review_stage4_mvp256_dry_v25_cpu as review
import diagnose_stage4_mvp256_dry_v24_selected_object_heads as ablation

files, base, core = review.files, review.base, review.core


def envelope_measurement(terrain, target, masks, core_mask):
    import torch
    files.require(terrain.shape == target.shape == (1, 3, 192, 256)
                  and core_mask.shape == (1, 1, 192, 256)
                  and bool(core_mask.any()), "envelope tensor or core shape differs")
    files.require(len(masks) == 4 and all(mask.shape == core_mask.shape
                  and mask.dtype == torch.bool for mask in masks), "four visible role masks required")
    files.require(bool(torch.isfinite(terrain).all() and torch.isfinite(target).all())
                  and bool(((target >= 0) & (target <= 1)).all()), "nonfinite or invalid RGB")
    count = sum(mask.float() for mask in masks)
    files.require(bool((count[core_mask] > 0).all()), "core has no residual owner")
    logit = torch.logit(terrain.float().clamp(1e-5, 1 - 1e-5))
    lower, upper = torch.sigmoid(logit - count), torch.sigmoid(logit + count)
    error_floor = (lower - target).clamp_min(0) + (target - upper).clamp_min(0)
    rgb_mask = core_mask.expand_as(target)
    violations = (target < lower) | (target > upper)
    required = torch.logit(target.clamp(1e-5, 1 - 1e-5)) - logit
    return {"corePixels": int(core_mask.sum()),
        "targetRgbComponentFractionOutsideEnvelope": float(violations[rgb_mask].float().mean()),
        "targetPixelFractionAnyComponentOutsideEnvelope": float(violations.any(1, keepdim=True)[core_mask].float().mean()),
        "conditionalRgbMaeLowerBound": float(error_floor[rgb_mask].mean()),
        "meanAbsoluteRequiredLogitDelta": float(required[rgb_mask].abs().mean()),
        "maximumAbsoluteRequiredLogitDelta": float(required[rgb_mask].abs().max()),
        "minimumAvailableResidualCount": float(count[core_mask].min()),
        "maximumAvailableResidualCount": float(count[core_mask].max()),
        "meaning": "upper_capacity_bound_at_frozen_terrain_not_global_model_impossibility"}


def execute(comparison_binding):
    import torch
    torch.set_num_threads(2)
    files.require(not torch.cuda.is_initialized(), "CPU-only diagnostic required")
    started = time.monotonic()
    comparison = files.bound_json(comparison_binding)
    ready = review.preflight(comparison["trainingTerminal"])
    files.require(comparison["runId"] == ready["package"]["runId"]
                  and comparison["selectedCheckpoint"] == ready["worker"]["selectedCheckpoint"],
                  "diagnostic comparison differs")
    out = ready["package"]["outputRoot"] + "/dry-review/object-expression-diagnostic.json"
    files.require(not files.project_file(out).exists(), "diagnostic already consumed")
    reader = core.cpu.BoundReader(ROOT)
    observed = {}
    with base.v24.successor_profile(), core.fit.readonly_guard(), patch.object(
            torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")):
        _, order, continuous, rows, _ = core.cpu.select_rows(reader)
        row = rows["validation"]
        sample, identity = core.cpu.load_sample(reader, row, order, continuous)
        files.require(sample["sampleId"] == comparison["subject"]["sampleId"]
                      and identity["conditionPack"] == comparison["subject"]["conditionPack"],
                      "subject source differs")
        source_before = {key: core.cpu.tensor_hash(sample[key]) for key in ("conditions", "image")}
        for label, worker, execution, contract, factory, identity_schema in (
                ("v24", ready["priorWorker"], ready["prior"]["executionPackage"],
                 ready["priorPackage"]["candidateContract"], base.v24.fresh_networks, base.V24_IDENTITY),
                ("v25", ready["worker"], ready["terminal"]["executionPackage"],
                 ready["package"]["candidateContract"], review.v25.fresh_networks, review.v25.IDENTITY)):
            selected = worker["selectedCheckpointRecord"]
            model, critic, states = base.reload_checkpoint_exact(reader.read(selected["checkpoint"]),
                expected_epoch=worker["selectedEpoch"], expected_selection=selected["selection"],
                execution_package=execution, candidate_contract=contract, channel_order=order,
                network_factory=factory, identity=identity_schema)
            files.require(states == selected["stateSha256"], "selected state differs")
            del critic
            model.eval().requires_grad_(False)
            before = base.nested_state_hash(model.state_dict())
            with torch.inference_mode():
                prediction, evidence = model(sample["conditions"][None],
                    sample["objectInstanceTable"], return_evidence=True)
                files.require(files.sha(core.png_bytes(prediction[0])) ==
                    comparison["measurements"][label]["rows"][0]["image"]["sha256"],
                    "diagnostic output differs from reviewed candidate")
                terrain = evidence["terrainRgb"].float().clamp(1e-5, 1 - 1e-5)
                total = evidence["objectResidualSum"].float()
                files.require(bool(torch.allclose(prediction.float(),
                    torch.sigmoid(torch.logit(terrain) + total), atol=1e-6, rtol=0)),
                    "compositor formula differs")
                target = sample["image"][None]
                all_masks = [evidence["visibleObjectSupportMasks"][role].bool() for role in review.ROLES]
                effects = {}
                for role in review.ROLES:
                    residual = evidence["maskedObjectRgbResiduals"][role].float()
                    support = evidence["visibleObjectSupportMasks"][role].bool()
                    core_mask = sample["conditions"][order.index(role)].bool()[None, None]
                    files.require(bool((residual.abs() <= 1).all()), "object residual not bounded")
                    without = torch.sigmoid(torch.logit(terrain) + total - residual)
                    effects[role] = {**ablation.head_effect(prediction, target, without, residual, core_mask, support),
                        "conditionalEnvelope": envelope_measurement(terrain, target, all_masks, core_mask),
                        "residualStdOnCore": float(residual[core_mask.expand_as(residual)].std()),
                        "residualFractionNearTanhBoundOnCore": float(
                            (residual[core_mask.expand_as(residual)].abs() >= .99).float().mean()),
                        "coreFeatureStd": float(evidence["responsibilityFeatures"][role][
                            core_mask.expand_as(evidence["responsibilityFeatures"][role])].std())}
            files.require(before == base.nested_state_hash(model.state_dict())
                          and all(parameter.grad is None for parameter in model.parameters()), "model mutated")
            observed[label] = {"checkpoint": selected["checkpoint"], "stateSha256": states, "roles": effects}
            del model
        files.require(source_before == {key: core.cpu.tensor_hash(sample[key])
                      for key in ("conditions", "image")}, "source tensors mutated")
        reader.unchanged()
    files.require(time.monotonic() - started <= 120, "diagnostic time cap exceeded")
    report = {"schemaVersion": "ai-painter-v25-object-expression-diagnostic-v1",
        "status": "diagnostic_completed_not_formal_qualified", "runId": comparison["runId"],
        "input": comparison_binding, "subject": comparison["subject"], "measurements": observed,
        "program": files.bind(Path(__file__).relative_to(ROOT).as_posix()),
        "boundary": {"cpuOnly": True, "modelForwardCalls": 2, "optimizerSteps": 0,
            "sourceTensorsUnchanged": True, "weightsModified": False, "registryWritten": False,
            "independentChallenge": False, "stage4Advanced": False},
        "interpretationLimit": "conditional envelope and ablation on one historically reviewed validation scene; no causal proof of all model or data failure",
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    files.require(len(encoded) <= 256 * 1024, "diagnostic byte cap exceeded")
    return files.write_exclusive(out, encoded)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comparison", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--execute", action="store_true", required=True)
    args = parser.parse_args()
    print(json.dumps(execute({"path": args.comparison, "sha256": args.sha256}), ensure_ascii=False))
