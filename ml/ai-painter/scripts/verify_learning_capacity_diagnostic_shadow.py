"""Read-only CPU replay for the existing autonomous closed-loop phase adapter.

Consumes one explicitly bound layer diagnostic, not a directory's newest run.
No optimizer, new rollout, image output, qualification or repair application.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time

import diagnose_learning_capacity_layers as layers
from painter_learning_capacity_experiment import bound_json, read_bound, require

REPLAY_FIELDS = (
    "rows", "reconstructionControls", "geometry", "modelStatesUnchanged",
    "modelStateSha256BeforeAndAfter", "newRollouts", "targetReconstructionCount", "limitations",
)


def verify_replay(original, replay):
    require(original.get("schemaVersion") == "ai-painter-layer-diagnosis-result-v1", "unsupported source schema")
    require(original.get("executionState") == "completed", "source did not complete")
    for key in ("gpuStarted", "trainingStarted", "formalQualificationAllowed"):
        require(original.get(key) is False, "source scope violation: " + key)
    require(original.get("optimizerSteps") == 0, "source optimized weights")
    for key in REPLAY_FIELDS:
        require(key in original and key in replay and replay[key] == original[key], "replay differs: " + key)
    require(replay["modelStatesUnchanged"] is True and replay["newRollouts"] == 0, "replay mutated model or sampled")
    require(len(replay["rows"]) == 6 and len(replay["reconstructionControls"]) == 2, "fixed two-scene replay required")
    require(all(row["targetEncodedForGeneration"] is False for row in replay["rows"]), "target entered generation")
    return list(REPLAY_FIELDS)


def replay_bound_diagnostic(root, source_binding):
    import torch
    started = time.monotonic()
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "explicit CPU isolation required")
    torch.set_num_threads(4)

    def check():
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(time.monotonic() - started < 90, "CPU replay timeout")

    source = bound_json(root, source_binding)
    plan = bound_json(root, source["plan"])
    require(plan == layers.materialize(root), "source plan no longer reproduces")
    check()
    reproduced = layers.analyze(root, plan, check, lambda *args, **kwargs: check())
    fields = verify_replay(source, reproduced)
    for binding in plan["inputReceipts"]:
        read_bound(root, binding)
        check()
    read_bound(root, source_binding)
    return {
        "schemaVersion": "ai-painter-diagnostic-shadow-replay-v1", "status": "replayed_exactly",
        "sourceResult": source_binding, "sourcePlan": source["plan"], "verifiedFields": fields,
        "inputBindingsReverified": len(plan["inputReceipts"]), "rowsReplayed": len(reproduced["rows"]),
        "reconstructionControlsReplayed": len(reproduced["reconstructionControls"]),
        "modelStateSha256BeforeAndAfter": reproduced["modelStateSha256BeforeAndAfter"],
        "cudaInitialized": torch.cuda.is_initialized(), "optimizerSteps": 0, "newRollouts": 0,
        "elapsedSeconds": time.monotonic() - started,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-sha256", required=True)
    args = parser.parse_args()
    result = replay_bound_diagnostic(Path.cwd(), {"path": args.source, "sha256": args.source_sha256})
    print(json.dumps(result, allow_nan=False), flush=True)
