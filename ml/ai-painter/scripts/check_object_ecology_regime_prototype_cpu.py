"""One fixed seven-train, zero-update CPU prototype check (SPEC 9.6.37)."""
from __future__ import annotations
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
import painter_stage4_appearance_regime_probe as metadata
from check_stage4_mvp256_dry_appearance_regime_cpu import Reader
from ai_painter.complete_world.object_ecology_regime_input_cpu import ECOLOGIES, bound_ecology_regime, require
from ai_painter.complete_world.object_ecology_regime_prototype_cpu import (
    build_fresh_object_ecology_regime_prototype_cpu, ecological_parameter, CAPABILITY, ARCHITECTURE,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import original_object_class_spatial_loss

COUNTS = {"forwardAttempted": 0, "forwardCompleted": 0,
          "gradientAttempted": 0, "gradientCompleted": 0}


def persist(reader, logical, value):
    require(logical.startswith(".runtime/ai-painter/ecology-prototype-cpu-t-q4-69/real/"), "output scope differs")
    data = (json.dumps(value, allow_nan=False, separators=(",", ":")) + "\n").encode()
    require(len(data) <= 2 * 1024 * 1024, "single JSON budget exceeded")
    target = reader.path(logical)
    target.parent.mkdir(parents=True, exist_ok=True)
    require(sum(p.stat().st_size for p in target.parent.rglob("*") if p.is_file())
            + len(data) <= 8 * 1024 * 1024 - 65536, "output failure reserve exceeded")
    with target.open("xb") as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())
    return {"path": logical, "sha256": hashlib.sha256(data).hexdigest()}


def execute(request_binding):
    started = time.monotonic()
    torch.set_num_threads(2); torch.set_num_interop_threads(2)
    require(not torch.cuda.is_initialized(), "CPU checker cannot initialize CUDA")
    reader = Reader(ROOT)
    request = reader.json(request_binding)
    output = request["outputRoot"]
    require(output == ".runtime/ai-painter/ecology-prototype-cpu-t-q4-69/real", "real output identity differs")
    require(request["schema"] == "factorized-ecology-cpu-request-v1"
            and request["optimizerUpdates"] == 0 and request["maxWallSeconds"] == 120,
            "CPU request boundary differs")
    persist(reader, output + "/claim.json", {"schema": "factorized-ecology-cpu-claim-v1", "request": request_binding})
    try:
        for source in request["programBindings"]:
            reader.read(source)
        spec = reader.read(request["formalSpecification"])
        require(b"9.6.37" in spec and b"AI-PAINTER-SPEC-1.51" in spec, "prototype specification differs")
        manifest = reader.json(request["datasetManifest"])
        split = reader.json(request["trainSplit"])
        ids = split["sampleIds"]
        require(split["split"] == "train" and len(ids) == len(set(ids)) == 48, "train selection differs")
        require(manifest["sampleCount"] == 64
                and manifest["splitCounts"] == {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
                "fixed dataset capacity differs")
        index = reader.json(manifest["sourceIndex"])
        by_id = {row["sampleId"]: row for row in index["samples"]}
        expected = []
        seen = set()
        for ordinal, sample_id in enumerate(ids):
            row = by_id[sample_id]
            require(row["split"] == "train", "cross-split image prohibited")
            category = reader.json(row["conditionPack"])["categoricalConditions"]["ecologyPlan"]["landscapeType"]
            require(category in ECOLOGIES, "unknown train category")
            if category not in seen:
                expected.append({"sampleId": sample_id, "trainOrdinal": ordinal, "ecology": category})
                seen.add(category)
        require(set(ECOLOGIES) == seen and request["selected"] == expected and len(expected) == 7,
                "selection is not the predeclared first train example per category")
        order = manifest["identityPayload"]["channelOrder"]
        continuous = manifest["identityPayload"]["continuousChannelIds"]
        cpu = metadata.core.cpu
        model = build_fresh_object_ecology_regime_prototype_cpu(condition_channel_order=order).train()
        graph = [{"name": n, "shape": list(p.shape), "elements": p.numel()} for n, p in model.named_parameters()]
        initial_state = cpu.state_hash(model)
        rng = torch.random.get_rng_state().clone()
        backend = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
        weight = ecological_parameter(model)
        cases = []
        for selected in expected:
            require(time.monotonic() - started < 120, "CPU wall limit exceeded")
            row = by_id[selected["sampleId"]]
            sample, identity = cpu.load_sample(reader, row, order, continuous)
            record, _season, _facts = metadata.derive_regime_record(reader, identity)
            season, ecology, facts = bound_ecology_regime(reader, record)
            require(facts["ecology"] == selected["ecology"], "selected ecology differs")
            saved_conditions = sample["conditions"].clone()
            saved_image = sample["image"].clone()
            saved_table = deepcopy(sample["objectInstanceTable"])
            before = cpu.state_hash(model)
            COUNTS["forwardAttempted"] += 1
            predicted = model(sample["conditions"][None], sample["objectInstanceTable"],
                              appearance_regime=season, ecology_regime=ecology)
            COUNTS["forwardCompleted"] += 1
            loss, correlations = original_object_class_spatial_loss(predicted, sample, order, split="train")
            COUNTS["gradientAttempted"] += 1
            gradient, = torch.autograd.grad(loss, (weight,))
            COUNTS["gradientCompleted"] += 1
            require(bool(torch.isfinite(gradient).all()) and float(gradient.double().norm()) > 0,
                    "ecology branch gradient not finite/nonzero")
            active = ECOLOGIES.index(selected["ecology"])
            slice_norms = [float(gradient[:, i].double().norm()) for i in range(7)]
            require(slice_norms[active] > 0 and all(value == 0 for i, value in enumerate(slice_norms) if i != active),
                    "gradient reached an incorrect ecology code slice")
            require(before == cpu.state_hash(model) and all(p.grad is None for p in model.parameters()),
                    "read-only gradient check mutated parameters/grad fields")
            require(torch.equal(saved_conditions, sample["conditions"]) and torch.equal(saved_image, sample["image"])
                    and saved_table == sample["objectInstanceTable"], "sample mutated")
            cases.append({**selected, "season": facts["season"], "sourceIdentity": identity,
                "ecologySources": record, "loss": float(loss.detach()), "gradientL2": float(gradient.double().norm()),
                "ecologySliceL2": slice_norms,
                "untrainedCorrelationsNotQualityQualification": {k: float(v.detach()) for k, v in correlations.items()}})
            print(json.dumps({"stage": "train_gradient_checked", "completed": len(cases), "total": 7}), flush=True)
            del predicted, loss, gradient
        require(COUNTS == {"forwardAttempted": 7, "forwardCompleted": 7, "gradientAttempted": 7, "gradientCompleted": 7},
                "fixed real-call budget differs")
        require(initial_state == cpu.state_hash(model) and torch.equal(rng, torch.random.get_rng_state()),
                "model or RNG changed")
        require(backend == (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled()),
                "backend settings changed")
        require(not torch.cuda.is_initialized(), "unexpected GPU initialization")
        reader.unchanged()
        result = persist(reader, output + "/report.json", {
            "schema": "factorized-ecology-seven-train-cpu-report-v1", "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
            "status": "passed_fixed_train_gradient_reachability_only", "request": request_binding,
            "capability": CAPABILITY, "architecture": ARCHITECTURE, "graph": graph,
            "parameterTensors": len(graph), "parameterElements": sum(x["elements"] for x in graph),
            "cases": cases, "counts": COUNTS.copy(), "initialState": initial_state, "finalState": cpu.state_hash(model),
            "observedSources": [{"path": p, "sha256": h} for p, h in reader.observed.items()],
            "elapsedMs": (time.monotonic() - started) * 1000, "optimizerUpdates": 0,
            "gpuInitialized": False, "modelQualityQualified": False, "productionLifecycleIntegrated": False,
            "autonomousDiagnosisCapabilityReleased": False, "stage4Promoted": False,
        })
        print(json.dumps({"stage": "completed_cpu_prototype_check", "result": result}), flush=True)
        return result
    except BaseException as error:
        failure = persist(reader, output + "/failure.json", {"schema": "factorized-ecology-cpu-failure-v1",
            "status": "failed_closed", "error": repr(error), "counts": COUNTS.copy(), "request": request_binding,
            "optimizerUpdates": 0, "automaticRetries": 0, "qualificationGranted": False})
        print(json.dumps({"stage": "failed_closed", "failure": failure}), flush=True)
        raise


if __name__ == "__main__":
    with patch.object(torch.cuda, "_lazy_init", side_effect=RuntimeError("CPU-only prototype prohibits CUDA")):
        execute({"path": sys.argv[1], "sha256": sys.argv[2]})
