"""One immutable V18 dry-subject visualization; no training or formal review.

Default is read-only CPU preflight. --execute consumes a new dry-review directory
and runs one bounded child. CPU FP32 or CUDA BF16 are explicitly distinguished.
Only frozen validation ordinal zero (slot 189) is decoded or inferred.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import train_stage4_mvp_structured_object_v18_dry_stage0 as training

gpu, cpu = training.gpu, training.cpu
require, exact = gpu.require, gpu.exact
PROGRAM_PATH = "ml/ai-painter/scripts/materialize_stage4_mvp_structured_object_v18_dry_review.py"
TEST_PATH = "ml/ai-painter/tests/test_materialize_stage4_mvp_structured_object_v18_dry_review.py"
SCHEMA = "ai-painter-stage4-mvp-structured-object-v18-dry-review-materialization-v1"
CODEC = {"path": "ml/ai-painter/src/ai_painter/complete_world/stage4_v17_responsibility_artifact.py",
         "sha256": "d675cdc4f9e761ba1d131c40906528d8d6c8eccbb15dea4b8e8f07a55a73fb56"}
INTERFACE = {"path": "data/ai-painter/system-governance/stage4-mvp-structured-object-v17-review-pack-schema-v1.json",
             "sha256": "5bbb8527c272e8f6f44425290569abace6bb86fa81883b54ae5f95f44a84d674"}
SUBJECT_ID = "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2"
MAX_SECONDS = 120
BOUNDARY = {"optimizerCreated": False, "optimizerSteps": 0, "checkpointWritten": False,
    "weightsModified": False, "challengeContentRead": False, "regressionContentRead": False,
    "registryWritten": False, "formalStage0QualificationGranted": False,
    "stage4ProgressIncreaseGranted": False, "runtimePublicationGranted": False,
    "visualQualityGranted": False, "waterAndShorelinePositiveCapability": "unverified_not_passed"}


def validate_terminals(package, terminal, finalized, request):
    root = package["outputRoot"]
    require(request["workerTerminal"]["path"] == root + "/phase-terminal.json"
            and request["trainingTerminal"]["path"] == root + "/training-finalize.json"
            and request["outputRoot"] == root + "/dry-review", "review input/output escaped training run")
    for key in ("capabilityVersion", "runId", "packageId"):
        require(terminal.get(key) == finalized.get(key) == package[key], "terminal run identity differs: " + key)
    require(terminal.get("schemaVersion") == training.TERMINAL_SCHEMA
            and finalized.get("schemaVersion") == "ai-painter-stage4-mvp-v18-dry-training-lifecycle-v1"
            and terminal.get("status") == finalized.get("status") == "training_completed_review_pending"
            and terminal.get("executionState") == finalized.get("executionState") == "completed"
            and exact(terminal.get("executionPackage"), request["executionPackage"])
            and exact(finalized.get("executionPackage"), request["executionPackage"])
            and exact(finalized.get("workerTerminal"), request["workerTerminal"])
            and exact(terminal.get("checkpoint"), request["checkpoint"])
            and exact(finalized.get("checkpoint"), request["checkpoint"]), "training has no matched successful terminal")
    for key, expected in {"completedEpochs": 24, "optimizerStepsGenerator": 1152,
        "optimizerStepsDiscriminator": 1152, "trainingStarted": True, "checkpointReloadVerified": True,
        "machineReviewPending": True, "stagePassed": False, "stage4QualificationGranted": False,
        "runtimePublicationAllowed": False, "automaticRetryStarted": False,
        "challengeContentRead": False, "regressionContentRead": False, "registryWritten": False}.items():
        require(exact(terminal.get(key), expected), "worker terminal boundary differs: " + key)
    for key in ("candidateContract", "cpuQualification", "gpuQualification", "datasetManifest", "dryScope",
                "trainingExecutionTicket", "precisionExecutionPlan", "stage"):
        require(exact(terminal.get(key), package[key]), "worker terminal binding differs: " + key)
    require(finalized.get("trainingStarted") is True and finalized.get("formalStage0QualificationGranted") is False
            and finalized.get("runtimePublicationGranted") is False, "finalizer qualification boundary differs")
    epoch, score = terminal.get("selectedEpoch"), terminal.get("selectedScore")
    require(type(epoch) is int and 8 <= epoch <= 24 and type(score) in (float, int) and math.isfinite(score)
            and isinstance(terminal.get("selectedRank"), list) and len(terminal["selectedRank"]) == 3,
            "selected epoch/score invalid")
    require(request["checkpoint"]["path"] == root + f"/epochs/epoch-{epoch:02d}.pt", "selected checkpoint path differs")


def validate_registry(registry, package, request):
    training.validate_idle_registry(registry)
    latest = registry.get("latestTrainingTerminal", {})
    require(registry.get("executionState") == "completed" and registry.get("runId") == package["runId"]
            and registry.get("packageId") == package["packageId"]
            and registry.get("capabilityVersion") == training.CAPABILITY
            and latest.get("runId") == package["runId"]
            and latest.get("path") == request["trainingTerminal"]["path"]
            and latest.get("sha256") == request["trainingTerminal"]["sha256"]
            and latest.get("status") == "training_completed_review_pending", "registry has not finalized this training run")
    terminal = registry.get("terminalEvidence", {})
    require(terminal.get("path") == request["trainingTerminal"]["path"]
            and terminal.get("sha256") == registry.get("packageSha256") == request["trainingTerminal"]["sha256"]
            and terminal.get("status") == "training_completed_review_pending", "current registry terminal differs")


def validate_selection_history(reader, package, terminal, request, validation_ids):
    """Recompute the V18 fixed-eight validation rank from completed epoch JSON only."""
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import rank_epoch
    require(isinstance(validation_ids, list) and len(validation_ids) == 8
            and len(set(validation_ids)) == 8, "frozen validation order absent")
    best_epoch, best_rank, best_checkpoint, best_score = None, None, None, None
    evidence = []
    for epoch in range(1, 25):
        logical = package["outputRoot"] + f"/epochs/epoch-{epoch:02d}.json"
        raw, binding = reader.snapshot(logical)
        row = json.loads(raw)
        require(type(row.get("epoch")) is int and row["epoch"] == epoch
                and row.get("optimizerStepsGenerator") == epoch * 48
                and row.get("optimizerStepsDiscriminator") == epoch * 48,
                "incomplete or reordered epoch summary")
        checkpoint = gpu.binding(row.get("checkpoint"))
        require(checkpoint["path"] == package["outputRoot"] + f"/epochs/epoch-{epoch:02d}.pt",
                "epoch checkpoint path differs")
        observations = row.get("validation")
        require(isinstance(observations, list) and len(observations) == 8
                and [value.get("sampleId") for value in observations] == validation_ids,
                "frozen validation observation order differs")
        if epoch >= 8:
            selection = rank_epoch(observations, validation_ids, epoch=epoch)
            if best_rank is None or tuple(selection["rank"]) > tuple(best_rank):
                best_epoch, best_rank = epoch, selection["rank"]
                best_checkpoint, best_score = checkpoint, selection["meanExistingValidationObjective"]
        else:
            scores = [value.get("existingValidationObjective") for value in observations]
            require(all(type(value) in (int, float) and math.isfinite(value) for value in scores),
                    "nonfinite pre-eligibility validation objective")
            selection = {"epoch": epoch, "meanExistingValidationObjective": sum(scores) / 8,
                         "rank": None, "eligible": False}
        require(exact(row.get("checkpointSelection"), selection)
                and row.get("bestEpoch") == best_epoch
                and exact(row.get("bestRank"), best_rank), "epoch ranking evidence differs")
        evidence.append(binding)
    require(best_epoch == terminal["selectedEpoch"]
            and exact(best_rank, terminal["selectedRank"])
            and exact(best_score, terminal["selectedScore"])
            and exact(best_checkpoint, request["checkpoint"]),
            "terminal selected checkpoint is not the recomputed V18 rank winner")
    return {"rule": "max_worst_applicable_object_correlation_then_min_mean_validation_objective_then_earliest_epoch",
            "validationSampleIds": validation_ids, "selectedEpoch": best_epoch,
            "selectedRank": best_rank, "epochSummaries": evidence}


def authenticate(request):
    require(request.get("device") in ("cpu", "cuda"), "unsupported inference device")
    reader = cpu.BoundReader()
    for key, path in (("program", PROGRAM_PATH), ("tests", TEST_PATH)):
        require(gpu.binding(request.get(key))["path"] == path, "materializer program binding missing")
        reader.read(request[key])
    reader.read(CODEC)
    schema_bytes = reader.read(INTERFACE)
    package = reader.json(gpu.binding(request["executionPackage"]))
    ticket = reader.json(gpu.binding(package.get("trainingExecutionTicket")))
    training.validate_package(package, ticket)
    for value in package["programBindings"].values():
        reader.read(gpu.binding(value))
    terminal = reader.json(gpu.binding(request["workerTerminal"]))
    finalized = reader.json(gpu.binding(request["trainingTerminal"]))
    validate_terminals(package, terminal, finalized, request)
    candidate = reader.json(package["candidateContract"])
    acceptance = reader.json(package["cpuQualification"])
    gpu.validate_gate(candidate, acceptance, candidate_binding=package["candidateContract"],
        cpu_binding=package["cpuQualification"], attempt_id=candidate["readonlyGpuQualification"]["attemptId"],
        output_root=gpu.OUTPUT_ROOT)
    for key in ("initialModelStateSha256", "initialCriticStateSha256"):
        require(terminal.get(key) == acceptance[key], "training did not start from accepted fresh state")
    for value in gpu.declared_bindings(candidate):
        reader.read(value)
    training.validate_gpu_report(reader.json(package["gpuQualification"]), candidate, acceptance, package)
    scope_verdict = gpu.verify_dry_scope(reader)
    scope = reader.json(gpu.SCOPE)
    manifest, order, continuous, rows, memberships = cpu.select_rows(reader)
    for split in cpu.COUNTS:
        require(memberships[split]["selectionSha256"] == candidate["datasetBinding"][split + "SelectionSha256"],
                "frozen selection changed: " + split)
    row = rows["validation"]
    require(row["sampleId"] == scope["preselectedSubject"]["sampleId"] == SUBJECT_ID
            and row["split"] == "validation" and scope["preselectedSubject"]["validationOrdinal"] == 0,
            "preselected dry validation subject differs")
    raw_registry, registry_binding = reader.snapshot(training.REGISTRY_PATH)
    validate_registry(json.loads(raw_registry), package, request)
    validation_ids = reader.json(manifest["splits"]["validation"])["sampleIds"]
    selection_audit = validate_selection_history(reader, package, terminal, request, validation_ids)
    # Bound size before restricted deserialization; preflight never calls torch.load.
    path = cpu.project_file(ROOT, request["checkpoint"]["path"])
    require(0 < path.stat().st_size <= 128 * 1024 * 1024, "checkpoint size exceeds read-only budget")
    reader.read(gpu.binding(request["checkpoint"]))
    reader.unchanged()
    return {"reader": reader, "package": package, "terminal": terminal, "scope": scope,
        "scopeVerdict": scope_verdict, "row": row, "order": order, "continuous": continuous,
        "schemaBytes": schema_bytes, "registryBinding": registry_binding,
        "selectionAudit": selection_audit}


def validate_checkpoint(saved, package, terminal, request):
    require(isinstance(saved, dict) and saved.get("schemaVersion") == training.CHECKPOINT_SCHEMA,
            "selected checkpoint schema differs")
    for key in ("capabilityVersion", "runId", "packageId", "candidateContract", "cpuQualification",
                "gpuQualification", "datasetManifest", "dryScope", "trainingExecutionTicket", "precisionExecutionPlan", "modelPlan"):
        require(exact(saved.get(key), package[key]), "checkpoint lineage differs: " + key)
    require(exact(saved.get("executionPackage"), request["executionPackage"])
            and saved.get("epoch") == terminal["selectedEpoch"]
            and exact(saved.get("validationScore"), terminal["selectedScore"])
            and exact(saved.get("checkpointSelection", {}).get("rank"), terminal["selectedRank"])
            and type(saved.get("epoch")) is int, "checkpoint selection differs")
    for key in ("optimizerStepsGenerator", "optimizerStepsDiscriminator"):
        require(exact(saved.get(key), saved["epoch"] * 48), "checkpoint update count differs")
    for key in ("formalInferenceEligible", "checkpointPromotionEligible", "automaticResumeAllowed"):
        require(saved.get(key) is False, "checkpoint authority differs")
    for key in ("modelStateSha256", "criticStateSha256", "initialModelStateSha256", "initialCriticStateSha256"):
        require(isinstance(saved.get(key), str) and saved[key] == terminal.get(key), "checkpoint network state differs: " + key)


def load_subject(context):
    row = context["row"]
    require(row.get("sampleId") == SUBJECT_ID and row.get("split") == "validation", "other subject content prohibited")
    sample, identity = cpu.load_sample(context["reader"], row, context["order"], context["continuous"])
    subject = context["scope"]["preselectedSubject"]
    for key in ("worldId", "tick", "factHash", "conditionPack"):
        require(exact(identity[key], subject[key]), "subject source identity differs: " + key)
    require(identity["visualFactManifestContentSha256"] == subject["visualFactManifestSha256"], "visual facts differ")
    for role in ("terrain_water", "terrain_shoreline"):
        require(int((sample["conditions"][context["order"].index(role)] > .5).sum()) == 0, "dry subject contains water/shoreline")
    return sample, identity


def to_rgb_pixels(predicted):
    import numpy as np
    import torch
    require(isinstance(predicted, torch.Tensor) and tuple(predicted.shape) == (1, 3, 192, 256)
            and bool(torch.isfinite(predicted).all()) and bool(((predicted >= 0) & (predicted <= 1)).all()),
            "RGB prediction shape, finite range or dtype invalid")
    result = predicted[0].detach().float().mul(255).round().byte().permute(1, 2, 0).cpu().numpy()
    require(result.shape == (192, 256, 3) and result.dtype == np.uint8, "RGB encoding differs")
    return result


def diagnostic_metrics(predicted, sample, order):
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import validation_structured_object_score
    require(sample.get("split") == "validation" and sample.get("sampleId") == SUBJECT_ID, "diagnostic subject differs")
    with torch.no_grad():
        score, parts = validation_structured_object_score(predicted, sample, sample["objectInstanceTable"], order)
        encoded = predicted[0].float().mul(255).round().div(255)
        error = (encoded - sample["image"]).abs()
        mse = float((encoded - sample["image"]).square().mean())
        roles = {}
        for role in gpu.ROLES:
            mask = sample["conditions"][order.index(role)] > .5
            count = int(mask.sum())
            roles[role] = {"conditionPixelCount": count, "rgbMae": float(error[:, mask].mean()) if count else None,
                           "applicability": "diagnostic_only" if count else "empty_no_positive_capability_evidence"}
        values = {key: float(value.detach()) if isinstance(value, torch.Tensor) else value for key, value in parts.items()}
        require(all(type(value) in (int, float) and math.isfinite(value) for value in values.values()), "nonfinite diagnostic metric")
        return {"meaning": "pixel_and_objective_diagnostics_not_semantic_aesthetic_or_stage_qualification",
            "validationObjectiveScore": float(score), "objectiveParts": values,
            "encodedRgbMae": float(error.mean()), "encodedRgbMse": mse,
            "encodedRgbPsnrDb": -10 * math.log10(mse) if mse > 0 else None,
            "psnrExactMatch": mse == 0, "responsibilities": roles}


def image_bytes(array):
    from PIL import Image
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG", optimize=False)
    return buffer.getvalue()


def visualizations(sample, predicted_pixels, order):
    import numpy as np
    from PIL import Image, ImageDraw
    reference = sample["image"].mul(255).round().byte().permute(1, 2, 0).numpy()
    channels = sample["conditions"].mul(255).round().byte().numpy()
    grid = Image.new("RGB", (256 * 6, 216 * 4), "#20252a")
    draw = ImageDraw.Draw(grid)
    for index, role in enumerate(order):
        x, y = (index % 6) * 256, (index // 6) * 216
        draw.text((x + 4, y + 5), role, fill="white")
        grid.paste(Image.fromarray(channels[index]).convert("RGB"), (x, y + 24))
    palette = {"terrain_path_ground": (167, 123, 78), "terrain_water": (48, 136, 220),
        "terrain_shoreline": (240, 214, 151), "object_footprints": (168, 116, 176),
        "object_tree": (44, 125, 62), "object_rock": (151, 161, 168), "object_vegetation": (136, 192, 62)}
    composite = np.full((192, 256, 3), (47, 58, 45), dtype=np.uint8)
    for role, color in palette.items():
        composite[channels[order.index(role)] > 127] = color
    compare = Image.new("RGB", (768, 224), "#20252a")
    labels = ("Original (256 x 192)", "Condition roles (diagnostic)", "Local model (256 x 192)")
    draw = ImageDraw.Draw(compare)
    for i, (label, array) in enumerate(zip(labels, (reference, composite, predicted_pixels))):
        draw.text((i * 256 + 6, 8), label, fill="white")
        compare.paste(Image.fromarray(array), (i * 256, 32))
    return {"reference-256.png": image_bytes(reference), "conditions-composite.png": image_bytes(composite),
            "conditions-23.png": image_bytes(np.asarray(grid)), "comparison.png": image_bytes(np.asarray(compare))}


def write_artifact(directory, name, data, output_root):
    path = directory / name
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    return {"path": output_root + "/" + name, "sha256": cpu.sha(data)}


def infer(context, request, report):
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import build_native_rgb_structured_object_v18_cpu
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
    from ai_painter.complete_world.stage4_v17_responsibility_artifact import encode_responsibility_artifact, decode_responsibility_artifact
    reader, terminal = context["reader"], context["terminal"]
    torch.set_num_threads(2)
    saved = torch.load(io.BytesIO(reader.read(request["checkpoint"])), map_location="cpu", weights_only=True)
    validate_checkpoint(saved, context["package"], terminal, request)
    model = build_native_rgb_structured_object_v18_cpu(condition_channel_order=context["order"], base_channels=48, patch_channels=32)
    critic = build_conditional_texture_discriminator()
    model.load_state_dict(saved["modelState"], strict=True)
    critic.load_state_dict(saved["criticState"], strict=True)
    require(cpu.state_hash(model) == terminal["modelStateSha256"] and cpu.state_hash(critic) == terminal["criticStateSha256"],
            "selected checkpoint tensor states failed recomputation")
    del saved, critic
    model.eval().requires_grad_(False)
    sample, identity = load_subject(context)
    before_tensors = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
    before_model = cpu.state_hash(model)
    report["modelStateSha256Before"] = before_model
    device = torch.device("cuda:0" if request["device"] == "cuda" else "cpu")
    def measure():
        reader.read(context["registryBinding"])
        if device.type == "cuda":
            torch.cuda.synchronize(device)
            available, total = torch.cuda.mem_get_info(device)
            report["memory"] = gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved(device)),
                allocated=int(torch.cuda.max_memory_allocated(device)), device_used=int(total - available), fraction=.7)
    if device.type == "cuda":
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        torch.cuda.set_device(device)
        free, total = torch.cuda.mem_get_info(device)
        allocator = int(total * .7) - (total - free) - 64 * 1024 * 1024
        require(allocator > 0, "insufficient VRAM below 70 percent")
        torch.cuda.set_per_process_memory_fraction(allocator / total, device)
        torch.cuda.reset_peak_memory_stats(device)
        report.update(gpuInitialized=True, allocatorBudgetBytes=allocator)
    model.to(device)
    bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
    measure()
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), torch.inference_mode():
        with torch.autocast(device.type, dtype=torch.bfloat16, enabled=device.type == "cuda"):
            prediction, evidence = model(bound["conditions"][None], sample["objectInstanceTable"], return_evidence=True)
        report["forwardCalls"] = 1
        measure()
        pixels = to_rgb_pixels(prediction)
        metrics = diagnostic_metrics(prediction, bound, context["order"])
        features = {**evidence["terrainResponsibilityFeatures"], **evidence["responsibilityFeatures"]}
        expected = {"worldId": identity["worldId"], "regionId": context["scope"]["preselectedSubject"]["regionId"],
            "tick": identity["tick"], "factHash": identity["factHash"],
            "visualFactManifestSha256": identity["visualFactManifestContentSha256"],
            "conditionPackSha256": identity["conditionPack"]["sha256"], "modelStateSha256": before_model}
        schema = json.loads(context["schemaBytes"])
        codec_args = {"schema_bytes": context["schemaBytes"], "schema_sha256": INTERFACE["sha256"],
                      "candidate_pack_schema_version": schema["candidatePackSchemaVersion"]}
        archive, responsibility = encode_responsibility_artifact({key: value.detach().float().cpu() for key, value in features.items()},
            identity=expected, archive_path=request["outputRoot"] + "/responsibilities.f32.zlib", **codec_args)
        decode_responsibility_artifact(archive, responsibility, expected_identity=expected, **codec_args)
        measure()
    report["modelStateSha256After"] = cpu.state_hash(model)
    require(report["modelStateSha256After"] == before_model and all(p.grad is None for p in model.parameters()), "inference modified model")
    report.update(weightsModified=False, weightsUnmodifiedVerified=True)
    require(before_tensors == {key: cpu.tensor_hash(sample[key]) for key in before_tensors}, "inference modified source tensors")
    reader.unchanged()
    return sample, identity, pixels, metrics, archive, responsibility


def materialize(request):
    started = time.monotonic()
    directory = cpu.project_file(ROOT, request["outputRoot"])
    report = {"schemaVersion": SCHEMA, "status": "failed_closed", **BOUNDARY,
        "executionPackage": request["executionPackage"], "workerTerminal": request["workerTerminal"],
        "trainingTerminal": request["trainingTerminal"], "checkpoint": request["checkpoint"],
        "program": request["program"], "tests": request["tests"], "codec": CODEC, "responsibilityInterface": INTERFACE,
        "device": request["device"], "precision": "bfloat16" if request["device"] == "cuda" else "float32",
        "cpuThreads": 2, "maxWallSeconds": MAX_SECONDS, "maxGpuMemoryFraction": .7,
        "gpuInitialized": False, "forwardCalls": 0, "candidateCount": 1, "candidateSplit": "validation",
        "weightsModified": None, "weightsUnmodifiedVerified": False}
    try:
        context = authenticate(request)
        require(exact(json.loads((directory / "request.json").read_bytes()), request), "missing/mismatched parent claim")
        training.write_exclusive(directory / "worker-started.json", {"pid": os.getpid(), "recordedAtUtc": training.utc_now()})
        sample, identity, pixels, metrics, archive, responsibility = infer(context, request, report)
        artifacts = {}
        payloads = {"original-native.png": context["reader"].read(context["row"]["image"]),
            "generated.png": image_bytes(pixels), **visualizations(sample, pixels, context["order"]),
            "responsibilities.f32.zlib": archive}
        for name, data in payloads.items():
            artifacts[name] = write_artifact(directory, name, data, request["outputRoot"])
        pack = context["reader"].json(context["row"]["conditionPack"])
        masks = [{"role": item["id"], "path": item["path"], "sha256": item["sha256"]}
            for item in pack["channels"] if item["id"] in ("object_footprints", "object_tree", "object_rock", "object_vegetation")]
        candidate = {"sampleIndex": 0, "sampleId": SUBJECT_ID, "split": "validation",
            "candidateRgb": {**artifacts["generated.png"], "width": 256, "height": 192, "role": "complete_rgb_candidate"},
            "referenceRgb": context["row"]["image"], "conditionPack": context["row"]["conditionPack"],
            "objectMasks": masks, "responsibilityEvidence": responsibility,
            "artifactIdentity": {"inferenceMode": "bound_v18_" + report["precision"] + "_generator_only_to_complete_rgb",
                "modelStateSha256": context["terminal"]["modelStateSha256"], "candidateRgb": artifacts["generated.png"]}}
        report.update(runId=context["package"]["runId"], packageId=context["package"]["packageId"],
            capabilityVersion=training.CAPABILITY, dryScope=gpu.SCOPE, scopePreflight=context["scopeVerdict"],
            sampleIdentity=identity, candidate=candidate, artifacts=artifacts, metrics=metrics,
            selectionAudit=context["selectionAudit"],
            modelStateSha256=context["terminal"]["modelStateSha256"], criticStateSha256=context["terminal"]["criticStateSha256"],
            selectedEpoch=context["terminal"]["selectedEpoch"], selectedScore=context["terminal"]["selectedScore"],
            selectedRank=context["terminal"]["selectedRank"],
            status="dry_review_materialized_pending_independent_audit")
        context["reader"].unchanged()
        require(time.monotonic() - started <= MAX_SECONDS, "inference wall-time limit exceeded")
    except Exception as error:
        report.update(status="failed_closed", errorType=type(error).__name__, error=str(error))
    if "context" in locals():
        report["sourceBindingsRecomputed"] = [{"path": path, "sha256": digest} for path, digest in context["reader"].observed.items()]
    report.update(elapsedSeconds=time.monotonic() - started, recordedAtUtc=training.utc_now())
    return report


def claim(request):
    directory = cpu.project_file(ROOT, request["outputRoot"])
    directory.mkdir(parents=False, exist_ok=False)
    training.write_exclusive(directory / "request.json", request)
    return directory


def run_child(command, *, timeout=MAX_SECONDS):
    """Kill our entire Windows venv launcher tree if the bounded child expires."""
    process = subprocess.Popen(command, cwd=ROOT,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2"},
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        stdout, stderr = process.communicate(timeout=timeout)
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    except subprocess.TimeoutExpired:
        # Popen.pid is the process created by this call, never a supplied PID.
        if os.name == "nt":
            killed = subprocess.run(["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                capture_output=True, text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
            require(killed.returncode == 0 or process.poll() is not None, "timed-out child tree could not be terminated")
        else:
            process.kill()
        stdout, stderr = process.communicate(timeout=10)
        raise subprocess.TimeoutExpired(command, timeout, output=stdout, stderr=stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("execution-package", "worker-terminal", "training-terminal", "checkpoint"):
        parser.add_argument("--" + flag, required=True)
        parser.add_argument("--" + flag + "-sha256", required=True)
    for flag in ("program-sha256", "tests-sha256", "output-root"):
        parser.add_argument("--" + flag, required=True)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    request = {key: {"path": getattr(args, attr).replace("\\", "/"), "sha256": getattr(args, attr + "_sha256")}
        for key, attr in (("executionPackage", "execution_package"), ("workerTerminal", "worker_terminal"),
                         ("trainingTerminal", "training_terminal"), ("checkpoint", "checkpoint"))}
    request.update(program={"path": PROGRAM_PATH, "sha256": args.program_sha256},
        tests={"path": TEST_PATH, "sha256": args.tests_sha256}, outputRoot=args.output_root.replace("\\", "/"), device=args.device)
    if args.worker:
        require(args.execute, "child requires execute and parent claim")
        report = materialize(request)
        print(json.dumps(report, allow_nan=False), flush=True)
        return 0 if report["status"] == "dry_review_materialized_pending_independent_audit" else 1
    authenticate(request)
    if not args.execute:
        print(json.dumps({"status": "cpu_preflight_passed_inference_not_started", "sampleId": SUBJECT_ID,
                          "sampleTensorsDecoded": False, "gpuInitialized": False, **BOUNDARY}))
        return 0
    directory = claim(request)
    stdout, stderr = "", ""
    try:
        result = run_child([sys.executable, "-B", str(Path(__file__).resolve()), *sys.argv[1:], "--worker"])
        stdout, stderr = result.stdout, result.stderr
        report = json.loads(stdout)
        require(result.returncode == 0 or report.get("status") == "failed_closed", "child exit/report conflict")
    except Exception as error:
        if isinstance(error, subprocess.TimeoutExpired):
            stdout = error.stdout.decode(errors="replace") if isinstance(error.stdout, bytes) else error.stdout or ""
            stderr = error.stderr.decode(errors="replace") if isinstance(error.stderr, bytes) else error.stderr or ""
        report = {"schemaVersion": SCHEMA, "status": "failed_closed", "errorType": type(error).__name__, "error": str(error),
                  "executionState": "child_did_not_return_complete_evidence", "request": request, **BOUNDARY,
                  "weightsModified": None, "weightsUnmodifiedVerified": False}
    write_artifact(directory, "worker-stdout.log", stdout.encode("utf8"), request["outputRoot"])
    write_artifact(directory, "worker-stderr.log", stderr.encode("utf8"), request["outputRoot"])
    training.write_exclusive(directory / "report.json", report)
    print(json.dumps({"status": report["status"], "report": training.bind(request["outputRoot"] + "/report.json")}))
    return 0 if report["status"] == "dry_review_materialized_pending_independent_audit" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed_before_materialization", "errorType": type(error).__name__, "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
