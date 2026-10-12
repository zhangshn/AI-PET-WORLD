"""Standalone bounded CPU diagnosis; never selects, trains, reviews or publishes.

Consumes the exact completed current V27-v3 run, not a historical directory scan.
Only a new immutable diagnostic record is written. Production auto-dispatch and
automatic repair are deliberately not claimed by this diagnostic entry point.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
import subprocess
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import review_stage4_mvp256_dry_v27_cpu as review

SCHEMA = "ai-painter-mvp256-dry-v27-generalization-diagnostic-v1"
PROGRAM = "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v27_generalization.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_mvp256_dry_v27_generalization.py"
COUNTS = {"train": 48, "validation": 8}
ROLES = tuple(review.base.OBJECT_CHANNELS)
MAX_SECONDS = 180
MAX_REPORT_BYTES = 2 * 1024 * 1024


def require(value, message):
    if not value:
        raise ValueError(message)


def summarize(rows, split):
    require(split in COUNTS, "diagnostic split prohibited")
    require(len(rows) == COUNTS[split] and len({r["sampleId"] for r in rows}) == len(rows)
            and all(r["split"] == split for r in rows), "complete unique ordered split required")
    require(all(math.isfinite(r["rgbMae"]) and 0 <= r["rgbMae"] <= 1 for r in rows),
            "nonfinite or invalid RGB error")
    result = {"sampleCount": len(rows), "meanRgbMae": statistics.mean(r["rgbMae"] for r in rows),
              "roles": {}}
    for role in ROLES:
        values = [r["correlations"][role] for r in rows if r["correlations"][role] is not None]
        require(all(math.isfinite(v) and -1 <= v <= 1 for v in values), "invalid correlation")
        result["roles"][role] = {"applicableCount": len(values),
            "mean": statistics.mean(values) if values else None,
            "median": statistics.median(values) if values else None,
            "minimum": min(values) if values else None,
            "nonpositiveCount": sum(v <= 0 for v in values)}
    return result


def compare_splits(train, validation):
    # A descriptive gap is evidence, not a causal diagnosis or a new pass gate.
    roles = {}
    for role in ROLES:
        a, b = train["roles"][role]["mean"], validation["roles"][role]["mean"]
        roles[role] = {"trainMeanMinusValidationMean": a - b if a is not None and b is not None else None}
    available = [v["trainMeanMinusValidationMean"] for v in roles.values()]
    return {"roles": roles,
        "pattern": "train_higher_on_all_applicable_roles" if all(v is not None and v > 0 for v in available)
                   else "mixed_or_insufficient_evidence",
        "causalRootCause": "not_identified_by_split_statistics",
        "nextDiagnosticTarget": "condition_target_alignment_and_distribution",
        "trainingRestartRecommended": False, "qualificationGranted": False}


def validate_saved_rows(actual, saved, expected_ids):
    require([r["sampleId"] for r in actual] == [r["sampleId"] for r in saved] == expected_ids,
            "validation identity or order differs")
    for observed, old in zip(actual, saved):
        require(math.isclose(observed["rgbMae"], old["observation"]["fullRgbMae"],
                             abs_tol=1e-7, rel_tol=1e-6), "CPU RGB measurement differs")
        for role in ROLES:
            a, b = observed["correlations"][role], old["observation"]["objectCorrelations"][role]
            require((a is None and b is None) or (a is not None and b is not None
                    and math.isclose(a, b, abs_tol=1e-7, rel_tol=1e-6)), "CPU correlation differs")


def census(sample, order, tensor_hash):
    conditions = sample["conditions"]
    objects = sample["objectInstanceTable"]
    shapes = {}
    for kind in sorted({item["kind"] for item in objects}):
        group = [item["footprint"] for item in objects if item["kind"] == kind]
        shapes[kind] = {"count": len(group),
            "nativeWidths": sorted({p["width"] for p in group}),
            "nativeHeights": sorted({p["height"] for p in group})}
    return {"conditionTensorSha256": tensor_hash(conditions),
        "rgbTargetTensorSha256": tensor_hash(sample["image"]),
        "channelMeans": {name: float(conditions[i].mean()) for i, name in enumerate(order)},
        "objectKinds": dict(Counter(item["kind"] for item in objects)),
        "footprintShapes": shapes,
        "objectTableFields": sorted(set().union(*(set(item) for item in objects))),
        "modelInputs": ["conditions", "objectInstanceTable"], "rgbTargetPassedToModel": False}


def distribution(rows, order):
    result = {}
    for split in COUNTS:
        group = [r for r in rows if r["split"] == split]
        result[split] = {"channelMeanRanges": {name: {
            "minimum": min(r["census"]["channelMeans"][name] for r in group),
            "maximum": max(r["census"]["channelMeans"][name] for r in group),
            "mean": statistics.mean(r["census"]["channelMeans"][name] for r in group)} for name in order},
            "positiveWaterSampleCount": sum(r["census"]["channelMeans"]["terrain_water"] > 0 for r in group),
            "objectKinds": dict(sum((Counter(r["census"]["objectKinds"]) for r in group), Counter()))}
    outside = []
    for row in rows:
        if row["split"] == "validation":
            for name, value in row["census"]["channelMeans"].items():
                interval = result["train"]["channelMeanRanges"][name]
                if not interval["minimum"] <= value <= interval["maximum"]:
                    outside.append({"sampleId": row["sampleId"], "channel": name, "mean": value})
    duplicates = []
    for row in rows:
        if row["split"] == "validation":
            for other in rows:
                if other["split"] == "train" and (other["census"]["conditionTensorSha256"]
                                                  == row["census"]["conditionTensorSha256"]):
                    duplicates.append({"trainSampleId": other["sampleId"], "validationSampleId": row["sampleId"],
                        "sameRgbTarget": other["census"]["rgbTargetTensorSha256"] == row["census"]["rgbTargetTensorSha256"]})
    return {"splits": result, "validationChannelMeanOutsideTrainRange": outside,
        "exactCrossSplitConditionTensorMatches": duplicates,
        "limitation": "channel averages and exact matches do not prove coverage, leakage freedom or conditional identifiability"}


def run(terminal_binding, *, execute=False):
    files, base, core = review.files, review.base, review.core
    ready = review.preflight(terminal_binding)
    package = ready["package"]
    registry_path = files.project_file(".runtime/ai-painter/current-execution-registry/current.json")
    registry_bytes = registry_path.read_bytes()
    registry = json.loads(registry_bytes)
    reader = core.cpu.BoundReader(ROOT)
    closure_binding = registry["terminalEvidence"]
    closure = reader.json(closure_binding)
    require(closure.get("status") == "dry_single_world_review_failed_closed"
            and closure.get("runId") == package["runId"]
            and closure.get("trainingTerminal") == terminal_binding
            and closure.get("selectedCheckpoint") == ready["selected"]["checkpoint"],
            "current failed review closure required")
    comparison = reader.json(closure["cpuComparison"])
    require(comparison["runId"] == package["runId"]
            and comparison["selectedCheckpoint"] == ready["selected"]["checkpoint"]
            and comparison["executionPackage"] == ready["terminal"]["executionPackage"],
            "saved CPU comparison identity differs")
    programs = {"program": files.bind(PROGRAM), "tests": files.bind(TEST)}
    identity = {"trainingTerminal": terminal_binding, "reviewTerminal": closure_binding,
                "selectedCheckpoint": ready["selected"]["checkpoint"], **programs}
    digest = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    out = package["outputRoot"] + "/dry-review/diagnostics/generalization-" + digest
    directory = files.project_file(out)
    require(not directory.exists(), "diagnostic already consumed; no overwrite or retry")
    if not execute:
        return {"status": "preflight_passed_not_executed", "outputRoot": out, **identity}
    directory.mkdir(parents=True, exist_ok=False)
    files.write_exclusive(out + "/claim.json", (json.dumps(identity, indent=2) + "\n").encode())
    started = time.monotonic()

    def deadline():
        require(time.monotonic() - started < MAX_SECONDS, "CPU diagnostic time budget exceeded")
        require(registry_path.read_bytes() == registry_bytes, "current registry changed during diagnosis")

    try:
        import torch
        from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import original_object_class_spatial_loss
        torch.set_num_threads(2)
        require(not torch.cuda.is_initialized(), "CPU-only diagnosis required")
        with base.v24.successor_profile(), core.fit.readonly_guard(), patch.object(
                torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")), \
                patch.object(torch.cuda, "init", side_effect=AssertionError("CUDA prohibited")), \
                patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA prohibited")):
            release, order, continuous, _, _ = core.cpu.select_rows(reader)
            require(package["datasetManifest"] == core.cpu.MANIFEST, "dataset release differs")
            source = reader.json(release["sourceIndex"])
            by_id = {r["sampleId"]: r for r in source["samples"]}
            memberships = {s: reader.json(package[s + "Split"]) for s in COUNTS}
            all_ids = []
            for split, count in COUNTS.items():
                ids = memberships[split]["sampleIds"]
                require(memberships[split]["split"] == split and len(ids) == len(set(ids)) == count
                        and not set(all_ids).intersection(ids), "split membership differs")
                all_ids += ids
            selected = ready["selected"]
            model, critic, states = base.reload_checkpoint_exact(reader.read(selected["checkpoint"]),
                expected_epoch=ready["worker"]["selectedEpoch"], expected_selection=selected["selection"],
                execution_package=ready["terminal"]["executionPackage"], candidate_contract=package["candidateContract"],
                channel_order=order, network_factory=review.v27.fresh_networks, identity=review.v27.IDENTITY)
            require(states == selected["stateSha256"], "checkpoint exact reload differs")
            del critic
            model.eval().requires_grad_(False)
            before = core.cpu.state_hash(model)
            rows = []
            for split in COUNTS:
                for ordinal, sample_id in enumerate(memberships[split]["sampleIds"]):
                    deadline()
                    row = by_id[sample_id]
                    require(row["split"] == split, "decoded split identity differs")
                    sample, sample_identity = core.cpu.load_sample(reader, row, order, continuous)
                    prediction = model(sample["conditions"][None], sample["objectInstanceTable"])
                    _, corr = original_object_class_spatial_loss(prediction, sample, order, split=split)
                    rows.append({"sampleId": sample_id, "split": split, "ordinal": ordinal,
                        "rgbMae": float((prediction[0] - sample["image"]).abs().mean()),
                        "correlations": {r: float(corr[r]) if r in corr else None for r in ROLES},
                        "census": census(sample, order, core.cpu.tensor_hash), "identity": sample_identity})
                    if (ordinal + 1) % 12 == 0 or ordinal + 1 == COUNTS[split]:
                        print(json.dumps({"phase": "cpu_diagnostic", "split": split,
                                          "completed": ordinal + 1, "total": COUNTS[split]}), flush=True)
            require(core.cpu.state_hash(model) == before and all(p.grad is None for p in model.parameters()),
                    "diagnosis mutated model")
            summaries = {s: summarize([r for r in rows if r["split"] == s], s) for s in COUNTS}
            validate_saved_rows([r for r in rows if r["split"] == "validation"],
                                comparison["measurements"]["v27"]["rows"], memberships["validation"]["sampleIds"])
            for item in package["programBindings"].values():
                reader.read(item)
            for item in programs.values():
                reader.read(item)
            reader.unchanged()
            deadline()
            require(not torch.cuda.is_initialized(), "unexpected CUDA initialization")
        report = {"schemaVersion": SCHEMA, "status": "diagnostic_complete_not_formal_qualified",
            "runId": package["runId"], "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
            "elapsedSeconds": time.monotonic() - started, "inputs": identity,
            "cpuComparison": closure["cpuComparison"], "datasetManifest": package["datasetManifest"],
            "trainSplit": package["trainSplit"], "validationSplit": package["validationSplit"],
            "inputBindings": [{"path": p, "sha256": h} for p, h in sorted(reader.observed.items())],
            "summaries": summaries, "splitComparison": compare_splits(summaries["train"], summaries["validation"]),
            "conditionDistribution": distribution(rows, order), "rows": rows,
            "boundary": {"gpuStarted": False, "optimizerSteps": 0, "modelForwardCalls": 56,
                "weightsModified": False, "checkpointSelectionModified": False, "registryModified": False,
                "challengeContentRead": False, "regressionContentRead": False, "imagesWritten": 0,
                "stage4Advanced": False, "automaticRepairImplemented": False,
                "productionAutoDispatchImplemented": False}}
        payload = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode()
        require(len(payload) <= MAX_REPORT_BYTES, "diagnostic report exceeds byte budget")
        evidence = files.write_exclusive(out + "/report.json", payload)
        return {"status": report["status"], "report": evidence,
                "summaries": summaries, "splitComparison": report["splitComparison"]}
    except BaseException as exc:
        files.write_exclusive(out + "/failure.json", (json.dumps({"status": "diagnostic_failed_closed",
            "error": str(exc), "inputs": identity, "recordedAtUtc": datetime.now(timezone.utc).isoformat()}) + "\n").encode())
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--training-terminal", required=True)
    parser.add_argument("--training-terminal-sha256", required=True)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    binding = {"path": args.training_terminal, "sha256": args.training_terminal_sha256}
    if not args.execute or args.worker:
        print(json.dumps(run(binding, execute=args.execute), ensure_ascii=False), flush=True)
        return
    planned = run(binding, execute=False)
    # Local process enforces the cap even if native image decoding stalls. No
    # shell, GPU process, optimizer or automatic restart is involved.
    command = [sys.executable, "-B", "-u", str(Path(__file__)), "--worker", "--execute",
               "--training-terminal", binding["path"], "--training-terminal-sha256", binding["sha256"]]
    try:
        completed = subprocess.run(command, cwd=ROOT, timeout=MAX_SECONDS, check=False)
        if completed.returncode:
            raise SystemExit(completed.returncode)
    except subprocess.TimeoutExpired:
        output = review.files.project_file(planned["outputRoot"])
        if output.exists() and not (output / "failure.json").exists():
            review.files.write_exclusive(planned["outputRoot"] + "/failure.json", (json.dumps({
                "status": "diagnostic_failed_closed", "error": "cpu_wall_time_exceeded",
                "trainingTerminal": binding, "recordedAtUtc": datetime.now(timezone.utc).isoformat()}) + "\n").encode())
        raise SystemExit(124)


if __name__ == "__main__":
    main()
