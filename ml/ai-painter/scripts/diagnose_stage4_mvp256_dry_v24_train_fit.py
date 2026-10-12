"""CPU-only selected-checkpoint fit summary over the frozen 48 train rows.

This does not read validation/challenge/regression content, select a checkpoint,
train weights, or change the Stage4/Runtime state.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import math
from pathlib import Path
import statistics
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import materialize_stage4_mvp256_dry_v24_candidate as materialize  # noqa: E402
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (  # noqa: E402
    OBJECT_CHANNELS, original_object_class_spatial_loss,
)

core = materialize.core
worker = materialize.worker
profile = materialize.profile
RUN_ID = "mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2"
REVIEW_ROOT = (".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/"
               + RUN_ID + "/dry-review")
REQUEST = REVIEW_ROOT + "/materialization-request.json"
REPORT = REVIEW_ROOT + "/selected-checkpoint-48-train-fit.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def summarize(rows: list[dict]) -> dict:
    require(len(rows) == 48 and len({r["sampleId"] for r in rows}) == 48,
            "complete unique train rows required")
    result = {}
    for role in OBJECT_CHANNELS:
        values = [r["correlations"][role] for r in rows]
        valid = [v for v in values if v is not None]
        require(all(math.isfinite(v) and -1 <= v <= 1 for v in valid),
                "invalid object correlation")
        result[role] = {
            "applicableCount": len(valid),
            "negativeOrZeroCount": sum(v <= 0 for v in valid),
            "medianCorrelation": statistics.median(valid) if valid else None,
            "minimumCorrelation": min(valid) if valid else None,
        }
    return result


def run(*, execute: bool) -> dict:
    import torch
    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CPU-only diagnostic required")
    request_binding = materialize.bind(REQUEST)
    request, _, _, terminal, candidate = materialize.check_request(request_binding)
    require(request["runId"] == RUN_ID, "run identity differs")
    require(not materialize.project_file(REPORT).exists(), "diagnostic already consumed")
    if not execute:
        return {"status": "cpu_preflight_passed_not_executed",
                "runId": RUN_ID, "reportPath": REPORT, "optimizerSteps": 0}

    started = time.monotonic()
    with profile.successor_profile(), core.fit.readonly_guard(), \
            patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")):
        reader = core.cpu.BoundReader()
        manifest, order, continuous, _, _ = core.cpu.select_rows(reader)
        require(manifest["datasetReleaseIdentity"] == materialize.bound_json(
            candidate["frozenBindings"]["datasetManifest"])["datasetReleaseIdentity"],
            "frozen dataset release differs")
        source = reader.json(manifest["sourceIndex"])
        train_split = reader.json(candidate["frozenBindings"]["trainSplit"])
        sample_ids = train_split["sampleIds"]
        require(len(sample_ids) == len(set(sample_ids)) == 48,
                "frozen train membership differs")
        by_id = {row["sampleId"]: row for row in source["samples"]}
        selected = terminal["selectedCheckpointRecord"]
        model, critic, hashes = worker.reload_checkpoint_exact(
            materialize.read_bound(request["selectedCheckpoint"]),
            expected_epoch=terminal["selectedEpoch"],
            expected_selection=selected["selection"],
            execution_package=request["executionPackage"],
            candidate_contract=request["candidateContract"], channel_order=order)
        require(hashes == selected["stateSha256"], "checkpoint state differs")
        del critic
        model.eval().requires_grad_(False)
        before = worker.nested_state_hash(model.state_dict())
        rows = []
        for sample_id in sample_ids:
            row = by_id[sample_id]
            require(row["split"] == "train", "non-train source row prohibited")
            sample, _ = core.cpu.load_sample(reader, row, order, continuous)
            require(sample["sampleId"] == sample_id and sample["split"] == "train",
                    "decoded train row differs")
            with torch.inference_mode():
                prediction = model(sample["conditions"][None],
                                   sample["objectInstanceTable"])
                _, correlations = original_object_class_spatial_loss(
                    prediction, sample, order, split="train")
            rows.append({"sampleId": sample_id,
                         "correlations": {role: None if correlations.get(role) is None
                                          else float(correlations[role])
                                          for role in OBJECT_CHANNELS}})
        require(worker.nested_state_hash(model.state_dict()) == before
                and all(p.grad is None for p in model.parameters()),
                "train-fit diagnostic mutated model")
        reader.unchanged()
    require(time.monotonic() - started <= 120, "train-fit CPU time cap exceeded")
    report = {
        "schemaVersion": "ai-painter-mvp256-dry-v24-train-fit-diagnostic-v1",
        "status": "train_fit_diagnostic_not_formal_qualified",
        "runId": RUN_ID, "request": request_binding,
        "selectedCheckpoint": request["selectedCheckpoint"],
        "trainSplit": candidate["frozenBindings"]["trainSplit"],
        "rows": rows, "summary": summarize(rows),
        "program": materialize.bind(
            "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v24_train_fit.py"),
        "boundary": {"cpuOnly": True, "trainOnly": True,
                     "optimizerSteps": 0, "weightsModified": False,
                     "checkpointSelectionModified": False, "stage4Advanced": False},
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) < 128 * 1024, "train-fit report exceeds cap")
    binding = materialize.write_exclusive(REPORT, encoded)
    return {"status": report["status"], "report": binding,
            "summary": report["summary"]}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(execute=args.execute), ensure_ascii=False))
