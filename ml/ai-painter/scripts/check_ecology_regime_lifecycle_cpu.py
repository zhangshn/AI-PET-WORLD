"""Fixed seven-train, full-gradient ecology CPU gate; zero weight updates."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
import torch
import painter_stage4_ecology_regime_training_profile as profile
import diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu as metadata
from check_stage4_mvp256_dry_appearance_regime_cpu import Reader, verify_loaded_sources
from ai_painter.complete_world.object_ecology_regime_input_cpu import ECOLOGIES, require

COUNTS = {"forwardAttempted": 0, "forwardCompleted": 0, "generatorAttempted": 0,
          "generatorCompleted": 0, "discriminatorAttempted": 0, "discriminatorCompleted": 0}
LIMITS = {"forward": 7, "generator": 28, "discriminator": 7}


def persist(reader, logical, value):
    require(logical.startswith(".runtime/ai-painter/ecology-lifecycle-cpu-t-q4-70/real/"), "CPU output scope differs")
    raw = (json.dumps(value, allow_nan=False, separators=(",", ":")) + "\n").encode()
    require(len(raw) <= 2097152, "single JSON ceiling")
    target = reader.path(logical); target.parent.mkdir(parents=True, exist_ok=True)
    require(sum(p.stat().st_size for p in target.parent.rglob("*") if p.is_file()) + len(raw)
            <= 8 * 1024**2 - 65536, "CPU evidence reserve exhausted")
    with target.open("xb") as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    return {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}


def execute(binding):
    started = time.monotonic()
    torch.set_num_threads(2); torch.set_num_interop_threads(2)
    reader = Reader(ROOT); request = reader.json(binding); output = request["outputRoot"]
    require(request["schema"] == "ecology-lifecycle-seven-train-cpu-request-v1"
            and output == ".runtime/ai-painter/ecology-lifecycle-cpu-t-q4-70/real"
            and request["maxWallSeconds"] == 120 and request["optimizerUpdates"] == 0,
            "CPU request boundaries differ")
    persist(reader, output + "/claim.json", {"request": binding, "automaticRetries": 0})
    try:
        for source in request["programBindings"]: reader.read(source)
        verify_loaded_sources(reader, [s["path"] for s in request["programBindings"] if s["path"].endswith(".py")])
        spec = reader.read(request["formalSpecification"])
        require(b"AI-PAINTER-SPEC-1.52" in spec and b"9.6.38" in spec, "formal CPU integration specification differs")
        manifest = reader.json(request["datasetManifest"])
        require(manifest["sampleCount"] == 64 and manifest["splitCounts"] == {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
                "dataset capacity differs")
        prepared = profile.prepare_metadata(reader, metadata.DIAGNOSTIC, metadata.CONDITION)
        require(prepared["metadataCounts"] == {"train": 48, "validation": 8}, "full metadata not bound")
        ids = reader.json(request["trainSplit"])["sampleIds"]
        require(prepared["splitSampleIds"]["train"] == ids, "metadata/train membership differs")
        index = reader.json(manifest["sourceIndex"]); by_id = {r["sampleId"]: r for r in index["samples"]}
        selected = []; seen = set()
        for ordinal, sample_id in enumerate(ids):
            ecology = prepared["records"][("train", ordinal)]["ecology"]
            if ecology not in seen:
                seen.add(ecology); selected.append({"sampleId": sample_id, "trainOrdinal": ordinal, "ecology": ecology})
        require(selected == request["selected"] and seen == set(ECOLOGIES), "fixed train selection differs")
        order = prepared["order"]; continuous = prepared["continuous"]; cpu = profile.core.cpu
        model, critic = profile.fresh_networks(order)
        initial = {"generator": cpu.state_hash(model), "discriminator": cpu.state_hash(critic)}
        rng = torch.random.get_rng_state().clone(); backend = profile._backend_snapshot()
        def resource():
            require(time.monotonic() - started < 120 and torch.get_num_threads() <= 2, "CPU resource ceiling")
        def event(stage, kind, values):
            key = kind + ("Attempted" if stage == "attempt" else "Completed")
            COUNTS[key] += 1
            require(COUNTS[key] <= LIMITS[kind], "CPU computation budget exceeded: " + key)
            if stage == "complete": require(COUNTS[key] <= COUNTS[kind + "Attempted"], "completion without attempt")
        cases = []
        for case in selected:
            resource(); row = by_id[case["sampleId"]]
            require(row["split"] == "train", "non-train pixels prohibited")
            sample, identity = cpu.load_sample(reader, row, order, continuous)
            record = prepared["records"][("train", case["trainOrdinal"])]["regimeRecord"]
            bound = profile.bind_sample_ecology(reader, sample, identity, record)
            result = profile.zero_update_probe(model, critic, bound, order, resource, event=event)
            require(result["fourHeadUpdate"]["parameterIdentity"]["modelParameterTensorCount"] == 108,
                    "own complete108 gradient graph missing")
            cases.append({**case, "identity": identity, "facts": result})
            print(json.dumps({"stage": "full_gradient_checked", "completed": len(cases), "total": 7}), flush=True)
        final = {"generator": cpu.state_hash(model), "discriminator": cpu.state_hash(critic)}
        require(initial == final and torch.equal(rng, torch.random.get_rng_state())
                and backend == profile._backend_snapshot() and not torch.cuda.is_initialized(), "CPU state/RNG/backend changed")
        require(COUNTS == {k + suffix: n for k, n in LIMITS.items() for suffix in ("Attempted", "Completed")}, "CPU actual count mismatch")
        reader.unchanged()
        result = persist(reader, output + "/report.json", {"schema": "ecology-lifecycle-seven-train-cpu-report-v1",
            "status": "own_seven_ecology_cpu_passed_not_gpu_qualified", "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
            "request": binding, "capabilityVersion": profile.CAPABILITY, "architecture": profile.ARCHITECTURE,
            "metadataCounts": prepared["metadataCounts"], "metadataRows": [
                {"split": split, "splitOrdinal": ordinal, "sampleId": r["identity"]["sampleId"], "season": r["season"], "ecology": r["ecology"]}
                for (split, ordinal), r in prepared["records"].items()],
            "cases": cases, "actualCounts": COUNTS, "initialState": initial, "finalState": final,
            "observedSources": [{"path": p, "sha256": h} for p, h in reader.observed.items()],
            "optimizerUpdates": 0, "gpuInitialized": False, "validationRgbRead": False,
            "challengeContentRead": False, "regressionContentRead": False,
            "productionLifecycleIntegrated": False, "gpuQualified": False, "stage4Promoted": False})
        print(json.dumps({"stage": "completed_cpu_check", "result": result}), flush=True)
        return result
    except BaseException as error:
        persist(reader, output + "/failure.json", {"status": "failed_closed", "error": repr(error),
            "request": binding, "actualCounts": COUNTS, "optimizerUpdates": 0, "automaticRetries": 0})
        raise


if __name__ == "__main__":
    with patch.object(torch.cuda, "_lazy_init", side_effect=RuntimeError("CPU only")), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("real CPU check cannot create optimizer")):
        execute({"path": sys.argv[1], "sha256": sys.argv[2]})
