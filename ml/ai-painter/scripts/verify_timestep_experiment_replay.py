"""CPU replay adapter: recompute all recorded metrics, not training or release."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time

import painter_timestep_ab_experiment as trial
from painter_learning_capacity_experiment import bound_json, canonical_bytes, digest, read_bound, require


def verify_replay(source, rows):
    require(source.get("schemaVersion") == "ai-painter-timestep-ab-result-v1", "unsupported source schema")
    require(source.get("executionState") == "completed" and source.get("status") == "experiment_executed_not_visual_qualified",
            "source experiment did not complete")
    require(source.get("optimizerSteps") == 2000 and source.get("checkpointReloadExact") is True, "source training incomplete")
    expected_qualification = dict.fromkeys(("formalDatasetQualified", "formalGpuQualified", "formalTrainingAllowed",
        "checkpointPromotable", "formalInferenceEligible", "worldEntryAllowed"), False)
    require(source.get("qualification") == expected_qualification, "source qualification scope changed")
    require(rows == source.get("rows"), "CPU metric replay differs")
    summary = trial.summarize(rows)
    require(summary == source.get("summary"), "source summary differs from actual rows")
    require(all(r.get("split") == "train" and r.get("targetUsedForInitialization") is False for r in rows), "source sample use changed")
    return summary


def replay_bound_trial(root, source_binding):
    import torch
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "explicit CPU isolation required")
    torch.set_num_threads(4)
    started = time.monotonic()
    def check():
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(time.monotonic()-started < 210, "CPU replay timeout")
    source = bound_json(root, source_binding)
    # Exact model package adjacent to the current bound result, never latest/scanning.
    package_path = str(Path(source_binding["path"]).parent / "experiment.json").replace("\\", "/")
    package = trial.materialize(root)
    require(source_binding["path"] == trial.previous.ROOT+"/"+package["experimentIdentity"]+"/result.json", "source namespace changed")
    binding = trial.file_binding(root,package_path)
    require(bound_json(root,binding) == package and source.get("experimentIdentity") == package["experimentIdentity"], "package identity changed")
    verify_replay(source,source.get("rows"))  # Reject invalid terminal before loading model weights.
    for b in source["artifacts"]: read_bound(root,b)
    check()
    rows = trial.evaluate(root,package,None,source["arms"],check,lambda *args,**kwargs:check(),save_images=False)
    summary = verify_replay(source,rows)
    for b in [*package["inputReceipts"],*source["artifacts"],source_binding,binding]:
        read_bound(root,b);check()
    return {"schemaVersion":"ai-painter-timestep-result-replay-v1","status":"metrics_replayed_exactly",
        "sourceResult":source_binding,"sourcePackage":binding,"summary":summary,
        "rowsSha256":digest(canonical_bytes(rows)),"rowsReplayed":len(rows),"fixedSeedRollouts":12,
        "inputBindingsReverified":len(package["inputReceipts"]),"sourceArtifactsReverified":len(source["artifacts"]),
        "cudaInitialized":torch.cuda.is_initialized(),"optimizerSteps":0,"imagesWritten":0,"checkpointsWritten":0,
        "limitations":["All stored metric fields are recomputed exactly; saved PNG file hashes are verified, not regenerated pixel comparisons.",
            "Two previously used train scenes, not independent evaluation or visual approval."],
        "elapsedSeconds":time.monotonic()-started}


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",required=True);parser.add_argument("--source-sha256",required=True)
    args=parser.parse_args()
    print(json.dumps(replay_bound_trial(Path.cwd(),{"path":args.source,"sha256":args.source_sha256}),allow_nan=False),flush=True)
