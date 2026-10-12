"""Read-only gradient balance for one frozen train row at the selected checkpoint.

No optimizer, weight update, validation gradient, GPU, or Stage4 authority.
This one-row measurement is diagnostic, not proof of generalization.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import math
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import materialize_stage4_mvp256_dry_v24_candidate as materialize  # noqa: E402
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import (  # noqa: E402
    train_object_core_fidelity_candidate_objective,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (  # noqa: E402
    SPATIAL_WEIGHT,
)

core = materialize.core
worker = materialize.worker
profile = materialize.profile
RUN_ID = "mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2"
REVIEW_ROOT = (".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/"
               + RUN_ID + "/dry-review")
REQUEST = REVIEW_ROOT + "/materialization-request.json"
MANIFEST = REVIEW_ROOT + "/candidate-manifest.json"
HEAD_REPORT = REVIEW_ROOT + "/selected-object-head-ablation.json"
REPORT = REVIEW_ROOT + "/selected-spatial-gradient-diagnostic.json"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def gradient_relation(left, right):
    import torch
    require(len(left) == len(right) and len(left) > 0
            and all(isinstance(x, torch.Tensor) and isinstance(y, torch.Tensor)
                    and x.shape == y.shape for x, y in zip(left, right)),
            "gradient set differs or object head was unused")
    a = torch.cat([x.reshape(-1) for x in left]).double()
    b = torch.cat([y.reshape(-1) for y in right]).double()
    require(bool(torch.isfinite(a).all()) and bool(torch.isfinite(b).all()),
            "nonfinite gradient")
    a_norm, b_norm = float(torch.linalg.vector_norm(a)), float(torch.linalg.vector_norm(b))
    dot = float(torch.dot(a, b))
    require(all(math.isfinite(value) for value in (a_norm, b_norm, dot)),
            "nonfinite gradient reduction")
    return {"spatialWeightedL2": a_norm, "coreRgbL2": b_norm,
            "spatialToCoreL2Ratio": None if b_norm == 0 else a_norm / b_norm,
            "dot": dot, "cosine": None if a_norm == 0 or b_norm == 0
            else dot / (a_norm * b_norm)}


def run(*, execute: bool) -> dict:
    import torch
    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CPU-only diagnostic required")
    request_binding = materialize.bind(REQUEST)
    request, _, _, terminal, _ = materialize.check_request(request_binding)
    manifest_binding = materialize.bind(MANIFEST)
    manifest = materialize.bound_json(manifest_binding)
    head_binding = materialize.bind(HEAD_REPORT)
    head = materialize.bound_json(head_binding)
    require(request["runId"] == RUN_ID == manifest["runId"] == head["runId"]
            and request["selectedCheckpoint"] == manifest["selectedCheckpoint"]
            and head["selectedCheckpoint"] == request["selectedCheckpoint"],
            "selected checkpoint evidence differs")
    require(not materialize.project_file(REPORT).exists(), "diagnostic already consumed")
    if not execute:
        return {"status": "cpu_preflight_passed_not_executed",
                "runId": RUN_ID, "optimizerSteps": 0, "reportPath": REPORT}

    started = time.monotonic()
    with profile.successor_profile(), \
            patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")), \
            patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("optimizer prohibited")), \
            patch.object(torch, "save", side_effect=AssertionError("checkpoint write prohibited")), \
            patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward prohibited")):
        reader = core.cpu.BoundReader()
        _, order, continuous, rows, _ = core.cpu.select_rows(reader)
        row = rows["train"]
        require(row["split"] == "train", "train diagnostic subject differs")
        sample, _ = core.cpu.load_sample(reader, row, order, continuous)
        selected = terminal["selectedCheckpointRecord"]
        model, critic, hashes = worker.reload_checkpoint_exact(
            materialize.read_bound(request["selectedCheckpoint"]),
            expected_epoch=terminal["selectedEpoch"],
            expected_selection=selected["selection"],
            execution_package=request["executionPackage"],
            candidate_contract=request["candidateContract"], channel_order=order)
        require(hashes == selected["stateSha256"], "checkpoint state differs")
        model.eval().requires_grad_(True)
        critic.eval().requires_grad_(False)
        before = worker.nested_state_hash(model.state_dict())
        with profile.generator_full_fp32_backend():
            prediction = model(sample["conditions"][None], sample["objectInstanceTable"])
            _, parts = train_object_core_fidelity_candidate_objective(
                critic, prediction, sample, sample["objectInstanceTable"], order)
            spatial = SPATIAL_WEIGHT * parts["objectClassSpatialLoss"]
            core_rgb = parts["objectCoreRgbWeighted"]
            relations = {}
            for index, role in enumerate(ROLES):
                parameters = tuple(model.object_rgb_heads[role].parameters())
                spatial_grad = torch.autograd.grad(
                    spatial, parameters, retain_graph=True, allow_unused=True)
                core_grad = torch.autograd.grad(
                    core_rgb, parameters, retain_graph=index < len(ROLES) - 1,
                    allow_unused=True)
                relations[role] = gradient_relation(spatial_grad, core_grad)
        require(worker.nested_state_hash(model.state_dict()) == before
                and all(parameter.grad is None for parameter in model.parameters())
                and all(parameter.grad is None for parameter in critic.parameters()),
                "gradient probe mutated model")
        reader.unchanged()
    require(time.monotonic() - started <= 120, "CPU diagnostic exceeded time cap")
    report = {
        "schemaVersion": "ai-painter-mvp256-dry-v24-spatial-gradient-diagnostic-v1",
        "status": "diagnostic_completed_not_formal_qualified",
        "runId": RUN_ID, "trainSampleId": sample["sampleId"],
        "request": request_binding, "candidateManifest": manifest_binding,
        "headAblation": head_binding,
        "selectedCheckpoint": request["selectedCheckpoint"],
        "spatialWeight": SPATIAL_WEIGHT, "relations": relations,
        "program": materialize.bind(
            "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v24_spatial_gradient.py"),
        "boundary": {"cpuOnly": True, "trainRowOnly": True,
                     "optimizerCreated": False, "optimizerSteps": 0,
                     "weightsModified": False, "stage4Advanced": False},
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) < 128 * 1024, "diagnostic report exceeds cap")
    binding = materialize.write_exclusive(REPORT, encoded)
    return {"status": report["status"], "report": binding,
            "relations": relations}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(execute=args.execute), ensure_ascii=False))
