"""Single frozen V21 epoch-12 fit/generalization probe; no training or review.

Default --preflight hashes metadata, source images/conditions and checkpoint on
CPU without decoding pixels. --execute claims one output and runs a bounded
CUDA BF16 child for train ordinals 0/43 and validation slot 199 only.
"""
from __future__ import annotations

import argparse
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
import train_stage4_mvp_object_residual_v21_dry_stage0 as training
import materialize_stage4_mvp_object_residual_v21_dry_review as review

cpu, gpu = training.cpu, training.gpu
RUN_ID = review.RUN_ID
RUN_ROOT = (".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/"
    "mvp-v21-dry-batch-123c625425ce959dbc0a8d5065bf158ecf97c164/stages/" + RUN_ID)
OUTPUT = ".runtime/ai-painter/stage4-mvp-v21-selected-fit-readonly/diagnostic-001"
PROGRAM = "ml/ai-painter/scripts/diagnose_stage4_mvp_v21_selected_fit_readonly.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_mvp_v21_selected_fit_readonly.py"
TRAIN_IDS = (
    "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
    "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v7",
)
VALIDATION_ID = "ai-cold-start-v7-v7-capacity-slot-199-grassland-forest-transition-v1"
SUBJECTS = (("train", 0, TRAIN_IDS[0]), ("train", 43, TRAIN_IDS[1]),
            ("validation", 5, VALIDATION_ID))
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation",
         "terrain_path_ground")
MAX_SECONDS = 180
TRAINING_SHA = "e4d981d2a3c197e878670dbefcc6076ae3bd0f161fbf960ad1cdebf126770e18"
WORKER_SHA = "9f6cfecc136a863beb6449dd0179e3924fe9408114f6fc0ca2da809ae567c8fb"
CHECKPOINT_SHA = "3ea4bdb543f02310b83bbc292b8324e52c99d77d11144ea911ce41df0c596115"
MATERIALIZATION_SHA = "7e5cb08af4be30f47c9a7f46065ecffd7a27af2f54e517cc4f04fed4bd3a164f"
AUDIT_SHA = "eef04665b1f92dfae7bcb57f900c8539cfac33ff650d508341414b1297fa29b9"
REGISTRY_PATH = training.REGISTRY_PATH
REGISTRY_SHA = "1bb1080a3c9cd89d4c645a042bdc91eed4f956463cd16805da6f3dbe34b6ee5b"
REVIEW_TERMINAL_SHA = "69577a16b49bb76f8657189df6acf062b2541ab5fc9eaca144029716ad543de4"


def require(value, reason):
    if not value:
        raise ValueError(reason)


def binding(path, digest=None):
    result = {"path": path, "sha256": digest or cpu.sha(cpu.project_file(ROOT, path).read_bytes())}
    return gpu.binding(result)


def select_fixed_rows(reader, package):
    manifest, order, continuous, _, memberships = cpu.select_rows(reader)
    require(manifest == reader.json(package["datasetManifest"]), "V21 dataset manifest differs")
    candidate = reader.json(package["candidateContract"])
    for split in cpu.COUNTS:
        require(memberships[split]["selectionSha256"] ==
                candidate["datasetBinding"][split + "SelectionSha256"],
                "frozen split selection differs: " + split)
    source = reader.json(manifest["sourceIndex"])
    by_id = {row["sampleId"]: row for row in source["samples"]}
    rows = []
    for split, ordinal, expected in SUBJECTS:
        members = reader.json(manifest["splits"][split])["sampleIds"]
        require(members[ordinal] == expected and by_id[expected]["split"] == split,
                "fixed train/validation ordinal differs")
        row = by_id[expected]
        pack = reader.json(row["conditionPack"])
        cpu.validate_pack(row, pack, order)
        reader.read(row["image"])
        for channel in pack["channels"]:
            reader.read(channel)
        rows.append((split, ordinal, row))
    return manifest, order, continuous, rows


def preflight(*, worker=False):
    reader = cpu.BoundReader()
    program, tests = binding(PROGRAM), binding(TEST)
    reader.read(program); reader.read(tests)
    package_binding = binding(RUN_ROOT + "/execution-package.json")
    package = reader.json(package_binding)
    ticket = reader.json(package["trainingExecutionTicket"])
    training.validate_package(package, ticket)
    require(package["runId"] == RUN_ID and package["outputRoot"] == RUN_ROOT,
            "V21 run root differs")
    for value in package["programBindings"].values():
        reader.read(value)
    worker_binding = binding(RUN_ROOT + "/phase-terminal.json", WORKER_SHA)
    training_binding = binding(RUN_ROOT + "/training-finalize.json", TRAINING_SHA)
    checkpoint = binding(RUN_ROOT + "/epochs/epoch-12.pt", CHECKPOINT_SHA)
    terminal = reader.json(worker_binding)
    final = reader.json(training_binding)
    require(terminal["status"] == final["status"] == "training_completed_review_pending"
            and terminal["runId"] == final["runId"] == RUN_ID
            and terminal["selectedEpoch"] == 12
            and terminal["checkpoint"] == final["checkpoint"] == checkpoint
            and final["workerTerminal"] == worker_binding
            and terminal["checkpointReloadVerified"] is True
            and terminal["stagePassed"] is False, "V21 frozen selected terminal differs")
    report_binding = binding(RUN_ROOT + "/dry-review/report.json", MATERIALIZATION_SHA)
    audit_binding = binding(RUN_ROOT + "/dry-review/independent-audit.json", AUDIT_SHA)
    materialized = reader.json(report_binding)
    audit = reader.json(audit_binding)
    require(materialized["runId"] == audit["runId"] == RUN_ID
            and materialized["checkpoint"] == checkpoint
            and materialized["trainingTerminal"] == training_binding
            and audit["materialization"] == report_binding
            and audit["status"] == "dry_single_world_visual_slice_failed_closed"
            and audit["alignment"]["passed"] is False,
            "V21 failed review context differs")
    raw_registry, registry_binding = reader.snapshot(REGISTRY_PATH)
    registry = json.loads(raw_registry)
    require(registry_binding["sha256"] == REGISTRY_SHA
            and registry["registryRevision"] == 323
            and registry["runId"] == RUN_ID and registry["capabilityVersion"] == training.CAPABILITY
            and registry["taskKind"] == "dry_single_world_independent_review"
            and registry["executionState"] == "failed_closed"
            and registry["activity"] == "review_failed"
            and registry["activeExecution"] is None
            and registry["latestTrainingTerminal"]["sha256"] == TRAINING_SHA
            and registry["terminalEvidence"]["sha256"] == REVIEW_TERMINAL_SHA
            and registry["nextMachineAction"] is None,
            "V21 failed-review registry differs")
    closure = reader.json(registry["terminalEvidence"])
    require(closure["schemaVersion"] == "ai-painter-stage4-mvp-v21-dry-review-terminal-v1"
            and closure["status"] == "review_failed"
            and closure["runId"] == RUN_ID
            and closure["materialization"] == report_binding
            and closure["independentAudit"] == audit_binding,
            "V21 review closure binding differs")
    manifest, order, continuous, rows = select_fixed_rows(reader, package)
    path = cpu.project_file(ROOT, checkpoint["path"])
    require(0 < path.stat().st_size <= 128 * 1024 * 1024,
            "selected checkpoint exceeds bounded read")
    reader.read(checkpoint)  # SHA-only preflight; no torch.load.
    output = cpu.project_file(ROOT, OUTPUT)
    require(output.exists() if worker else not output.exists(),
            "diagnostic output claim state differs")
    reader.unchanged()
    return {"reader": reader, "package": package, "packageBinding": package_binding,
        "terminal": terminal, "workerTerminal": worker_binding,
        "trainingTerminal": training_binding, "checkpoint": checkpoint,
        "materialization": report_binding, "independentAudit": audit_binding,
        "registry": registry_binding, "manifest": package["datasetManifest"],
        "order": order, "continuous": continuous, "rows": rows,
        "program": program, "tests": tests}


def region_metrics(predicted, target, conditions, order):
    import torch
    from torch.nn import functional as F
    require(predicted.shape == target.shape == (1, 3, 192, 256)
            and conditions.shape == (23, 192, 256), "diagnostic RGB/condition shape differs")
    a, b = predicted.float(), target.float()
    require(bool(torch.isfinite(a).all() and torch.isfinite(b).all()), "nonfinite RGB")
    error = (a - b).abs()[0]
    edge_x = ((a[:, :, :, 1:] - a[:, :, :, :-1]) -
              (b[:, :, :, 1:] - b[:, :, :, :-1])).abs()[0]
    edge_y = ((a[:, :, 1:, :] - a[:, :, :-1, :]) -
              (b[:, :, 1:, :] - b[:, :, :-1, :])).abs()[0]
    weights = a.new_tensor((.2126, .7152, .0722))[None, :, None, None]
    luma_a, luma_b = (a * weights).sum(1)[0], (b * weights).sum(1)[0]
    result = {}
    for role in ROLES:
        mask = conditions[order.index(role)] > .5
        pixels = int(mask.sum())
        if not pixels:
            result[role] = {"conditionPixelCount": 0, "applicability": "empty_no_positive_evidence",
                            "rgbMae": None, "signedEdgeDifferenceMae": None,
                            "centeredLumaCorrelation": None}
            continue
        x, y = luma_a[mask], luma_b[mask]
        x, y = x - x.mean(), y - y.mean()
        energy = x.square().sum() * y.square().sum()
        correlation = float((x * y).sum() / energy.sqrt()) if float(energy) > 1e-8 else None
        edge_parts = []
        if bool(mask[:, 1:].any()):
            edge_parts.append(edge_x[:, mask[:, 1:]].mean())
        if bool(mask[1:, :].any()):
            edge_parts.append(edge_y[:, mask[1:, :]].mean())
        edge = torch.stack(edge_parts).mean() if edge_parts else None
        values = {"rgbMae": float(error[:, mask].mean()),
                  "signedEdgeDifferenceMae": float(edge) if edge is not None else None,
                  "centeredLumaCorrelation": correlation}
        require(all(value is None or math.isfinite(value) for value in values.values()),
                "nonfinite diagnostic metric")
        result[role] = {"conditionPixelCount": pixels,
            "applicability": "diagnostic_only" if correlation is not None else "constant_luma_no_correlation",
            **values}
    return result


def run_probe(context):
    import torch
    from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
        build_fresh_native_rgb_object_residual_v21_cpu,
    )
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
        build_conditional_texture_discriminator,
    )
    started = time.monotonic()
    torch.set_num_threads(2)
    saved = torch.load(io.BytesIO(context["reader"].read(context["checkpoint"])),
                       map_location="cpu", weights_only=True)
    review.validate_checkpoint(saved, context["package"], context["terminal"],
        {"checkpoint": context["checkpoint"], "executionPackage": context["packageBinding"]})
    model = build_fresh_native_rgb_object_residual_v21_cpu(
        condition_channel_order=context["order"])
    critic = build_conditional_texture_discriminator()
    model.load_state_dict(saved["modelState"], strict=True)
    critic.load_state_dict(saved["criticState"], strict=True)
    require(cpu.state_hash(model) == context["terminal"]["modelStateSha256"]
            and cpu.state_hash(critic) == context["terminal"]["criticStateSha256"],
            "selected model/critic state hash differs")
    del saved, critic
    model.eval().requires_grad_(False)
    before = cpu.state_hash(model)
    require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    free, total = torch.cuda.mem_get_info(device)
    allocation = int(total * .7) - (total - free) - 64 * 1024 * 1024
    require(allocation > 0, "insufficient VRAM under 70 percent")
    torch.cuda.set_per_process_memory_fraction(allocation / total, device)
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    observations, panels = [], []
    output = cpu.project_file(ROOT, OUTPUT)
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         torch.inference_mode():
        for split, ordinal, row in context["rows"]:
            sample, identity = cpu.load_sample(context["reader"], row,
                                               context["order"], context["continuous"])
            require(sample["split"] == identity["split"] == split
                    and sample["sampleId"] == row["sampleId"], "diagnostic sample identity differs")
            sample_hash = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
            conditions = sample["conditions"].to(device)
            target = sample["image"].to(device)[None]
            with torch.autocast("cuda", dtype=torch.bfloat16):
                predicted = model(conditions[None], sample["objectInstanceTable"])
            require(bool(torch.isfinite(predicted).all() and ((predicted >= 0) & (predicted <= 1)).all()),
                    "V21 inference RGB invalid")
            metrics = region_metrics(predicted, target, conditions, context["order"])
            pixels = review.to_rgb_pixels(predicted)
            comparison = review.visualizations(sample, pixels, context["order"])["comparison.png"]
            stem = f"{split}-ordinal-{ordinal:02d}"
            image = review.write_artifact(output, stem + "-comparison.png", comparison, OUTPUT)
            candidate = review.write_artifact(output, stem + "-candidate.png",
                                              review.image_bytes(pixels), OUTPUT)
            panels.append({"split": split, "ordinal": ordinal, "comparison": image,
                           "candidate": candidate})
            observations.append({"split": split, "ordinal": ordinal,
                "sampleId": sample["sampleId"], "sampleIdentity": identity,
                "sourceImage": row["image"], "conditionPack": row["conditionPack"],
                "metrics": metrics})
            require(sample_hash == {key: cpu.tensor_hash(sample[key]) for key in sample_hash},
                    "diagnosis modified source tensors")
            require(time.monotonic() - started <= MAX_SECONDS, "diagnostic timeout")
    torch.cuda.synchronize(device)
    memory = gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved(device)),
        allocated=int(torch.cuda.max_memory_allocated(device)),
        device_used=int(total - torch.cuda.mem_get_info(device)[0]), fraction=.7)
    require(cpu.state_hash(model) == before and all(p.grad is None for p in model.parameters()),
            "diagnosis modified checkpoint weights")
    context["reader"].unchanged()
    return {"schemaVersion": "ai-painter-stage4-mvp-v21-selected-fit-readonly-diagnostic-v1",
        "status": "train_validation_fit_metrics_recorded_no_qualification",
        "runId": RUN_ID, "program": context["program"], "tests": context["tests"],
        "executionPackage": context["packageBinding"],
        "workerTerminal": context["workerTerminal"],
        "trainingTerminal": context["trainingTerminal"],
        "checkpoint": context["checkpoint"],
        "modelStateSha256": before, "registryAtPreflight": context["registry"],
        "sourceMaterialization": context["materialization"],
        "sourceIndependentAudit": context["independentAudit"],
        "samplePlan": [{"split": split, "ordinal": ordinal, "sampleId": row["sampleId"]}
                       for split, ordinal, row in context["rows"]],
        "observations": observations, "comparisonPanels": panels,
        "sourceBindingsRecomputed": [{"path": path, "sha256": digest}
                                     for path, digest in context["reader"].observed.items()],
        "device": "cuda", "precision": "bfloat16", "memory": memory,
        "gpuInitialized": True, "forwardCalls": len(observations),
        "validationUsedForCheckpointSelection": False,
        "checkpointSelectionChanged": False, "optimizerCreated": False,
        "optimizerSteps": 0, "weightsModified": False, "registryWritten": False,
        "challengePixelsRead": False, "regressionPixelsRead": False,
        "formalStage0QualificationGranted": False, "stage4ProgressIncreaseGranted": False,
        "runtimePublicationGranted": False, "visualQualityGranted": False,
        "meaning": "train_fit_vs_validation_generalization_diagnostic_not_acceptance",
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preflight", action="store_true")
    group.add_argument("--execute", action="store_true")
    group.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    context = preflight(worker=args.worker)
    if args.preflight:
        print(json.dumps({"status": "cpu_preflight_passed_no_pixels_decoded",
            "runId": RUN_ID, "checkpoint": context["checkpoint"],
            "samplePlan": [{"split": split, "ordinal": ordinal, "sampleId": row["sampleId"]}
                           for split, ordinal, row in context["rows"]],
            "sourceMaterialization": context["materialization"],
            "sourceIndependentAudit": context["independentAudit"],
            "samplePixelsDecoded": False, "checkpointDeserialized": False,
            "gpuInitialized": False, "registryWritten": False}))
        return 0
    output = cpu.project_file(ROOT, OUTPUT)
    if args.worker:
        require(json.loads((output / "claim.json").read_bytes()) ==
                {"runId": RUN_ID, "checkpoint": context["checkpoint"],
                 "program": context["program"], "tests": context["tests"]},
                "parent diagnostic claim differs")
        result = run_probe(context)
        training.write_exclusive(output / "report.json", result)
        print(json.dumps({"status": result["status"], "report": binding(OUTPUT + "/report.json")}))
        return 0
    output.mkdir(parents=True, exist_ok=False)
    training.write_exclusive(output / "claim.json", {"runId": RUN_ID,
        "checkpoint": context["checkpoint"], "program": context["program"], "tests": context["tests"]})
    try:
        completed = review.run_child([sys.executable, "-B", str(Path(__file__).resolve()), "--worker"],
                                     timeout=MAX_SECONDS)
        review.write_artifact(output, "worker-stdout.log", completed.stdout.encode(), OUTPUT)
        review.write_artifact(output, "worker-stderr.log", completed.stderr.encode(), OUTPUT)
        require(completed.returncode == 0, "bounded diagnostic child failed; see worker-stderr.log")
        print(completed.stdout.strip())
        return 0
    except Exception as error:
        training.write_exclusive(output / "failure.json", {
            "schemaVersion": "ai-painter-stage4-mvp-v21-selected-fit-readonly-failure-v1",
            "status": "failed_closed", "runId": RUN_ID,
            "checkpoint": context["checkpoint"], "sourceRegistry": context["registry"],
            "errorType": type(error).__name__, "error": str(error),
            "optimizerCreated": False, "registryWritten": False,
            "formalStage0QualificationGranted": False, "stage4ProgressIncreaseGranted": False,
            "runtimePublicationGranted": False})
        raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
