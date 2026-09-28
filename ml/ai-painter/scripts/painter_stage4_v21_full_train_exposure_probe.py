"""One fresh V21 48-train exposure experiment, never formal qualification.

inspect is CPU-only and writes nothing. prepare needs the separately frozen
policy; run needs its exact live existing supervisor. Historical weights are
hashed for comparison identity only, never deserialized or used for training.
The sole optimization change is the maximum exposure per train row: 24 -> 48.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager, nullcontext
from copy import deepcopy
from datetime import datetime, timezone
import io
import json
import math
import os
from pathlib import Path
import random
import shutil
import statistics
import subprocess
import sys
import time
from unittest.mock import patch
from uuid import uuid4

# Count dependency imports/CLI setup as well as authentication and CUDA work.
WORKER_WALL_START = time.monotonic()
WORKER_STARTED_AT_UTC = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import diagnose_stage4_mvp_v21_all_train_fit_readonly as fit
import painter_stage4_v21_train_only_capacity_probe as capacity

v21, cpu, gpu, require = fit.training, fit.cpu, fit.gpu, fit.require
WORKER = "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"
TESTS = "ml/ai-painter/tests/test_stage4_v21_full_train_exposure_probe.py"
CONTROLLER = fit.CONTROLLER
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v3.json"
POLICY_SCHEMA = "stage4-mvp-v21-full-train-exposure-policy-v3"
PACKAGE_SCHEMA = "ai-painter-learning-capacity-experiment-package-v1"
RESULT_SCHEMA = "ai-painter-learning-capacity-experiment-result-v1"
EXPERIMENT_TYPE = "all_train_exposure_only"
SCOPE = "all_train_exposure_only_no_generalization_claim"
TASK_KIND = "bounded_train_only_learning_capacity_experiment"
OUTPUT_PARENT = ".runtime/ai-painter/learning-capacity-experiments"
FIT_ROOT = (".runtime/ai-painter/stage4-mvp-v21-all-train-fit-readonly/"
            "v21-all-train-fit-ede74d7e4fec8e9064a47c4fb5bc7af47d0ee3f891987050")
COMPARE = {
    "result": {"path": FIT_ROOT + "/result.json", "sha256": "65aaa5b354d137a078cbb0be77d84ce649d46bc8e526142017e3e5bd4a444dfc"},
    "terminal": {"path": FIT_ROOT + "/terminal.json", "sha256": "baff9c49625f2c94a43854d98568155b788ab5ad628a20cf4aa9aa47e1920e8b"},
}
OBSERVATION_PLAN = [{"epoch": epoch, "optimizerStep": epoch * 48} for epoch in (0, 24, 48)]
TRAINING = {"epochs": 48, "maxGeneratorOptimizerSteps": 2304, "maxDiscriminatorOptimizerSteps": 2304,
    "sampleOrder": "all_48_once_per_epoch_shuffle_python_random_seed_plus_epoch",
    "freshInitializationOnly": True, "initializationSeed": 20260929,
    "historicalCheckpointLoaded": False, "optimizer": v21.OPTIMIZER_PLAN,
    "checkpointRule": "final_epoch_48_only_no_selection_no_resume_no_promotion",
    "zeroUpdateGpuProbeMaxWallSeconds": 120, "automaticRetries": 0, "maxTrainingAttempts": 1}
RESOURCES = {"maxWallSeconds": 1800, "maxGpuMemoryFraction": .7, "maximumTemperatureC": 85,
    "minimumFreeVramMiB": 2048, "minimumFreeDiskMiB": 2048, "maxOutputMiB": 128,
    "cpuThreads": 2, "automaticRetries": 0}
REPRODUCTION_RULE = {"epoch": 24, "maximumAbsoluteMedianCorrelationDifferenceEachRole": .03,
    "maximumRelativeMeanRgbMaeDifference": .05, "all48CorrelationsRequiredEachRole": True,
    "failureAction": "diagnostic_only_no_early_stop", "invalidEvidenceAction": "fail_closed",
    "formalAuditThreshold": False}
PROGRESS_PUBLICATION_RULE = {"schemaVersion": "bounded_windows_progress_publication_v1",
    "maxReplaceAttempts": 6, "retryDelaySeconds": .05, "retryableWindowsErrors": [5, 32, 33],
    "sameStagedBytesOnly": True, "persistentFailureAction": "fail_closed"}
QUALIFICATION = {"scope": SCOPE, "formalStageQualified": False, "checkpointPromotable": False,
    "runtimeFrameAllowed": False, "worldEntryAllowed": False, "automaticSuccessorTrainingAllowed": False}
IMPLEMENTATION_PATHS = sorted(set(fit.IMPLEMENTATION_PATHS + [WORKER, TESTS, capacity.WORKER]))
bind, now = fit.bind, fit.now


def verify_comparison(reader, selected):
    reference = reader.json(COMPARE["result"])
    terminal = reader.json(COMPARE["terminal"])
    reference_package = reader.json(bind(FIT_ROOT + "/package.json"))
    require(terminal.get("result") == COMPARE["result"]
        and terminal.get("status") == "readonly_train_fit_diagnostic_completed_no_qualification"
        and reference.get("status") == terminal["status"]
        and reference.get("experimentIdentity") == reference_package["experimentIdentity"]
        and reference.get("forwardCalls") == 48 and reference.get("trainingStarted") is False
        and reference.get("optimizerCreated") is False and reference.get("checkpointWritten") is False
        and reference.get("optimizerSteps") == {"generator": 0, "discriminator": 0}
        and reference.get("modelStateUnchanged") is True and reference.get("sourceBytesUnchanged") is True
        and reference.get("modelStateSha256") == fit.MODEL_STATE_SHA
        and reference.get("checkpoint") == fit.SOURCE_INPUTS["checkpoint"]
        and reference_package.get("selectedRows") == selected, "historical all-train comparison differs")
    fit.validate_results(reference["samples"], selected)
    require(reference["trainOnlySummary"] == fit.summarize_correlations(reference["samples"]),
            "historical comparison summary differs")
    for artifact in reference["artifacts"]:
        reader.read(artifact)
    # Exact epoch bytes are bound but are never torch.load inputs in this worker.
    for value in fit.SOURCE_INPUTS.values():
        reader.read(value)
    return reference


def collect_inputs(registry=None):
    reader = cpu.BoundReader()
    manifest = reader.json(cpu.MANIFEST)
    candidate = reader.json(v21.CANDIDATE)
    acceptance = reader.json(v21.CPU_REPORT)
    v21.gate.validate_acceptance(candidate, acceptance, candidate_binding=v21.CANDIDATE)
    source, train = reader.json(manifest["sourceIndex"]), reader.json(manifest["splits"]["train"])
    order, continuous, rows, selection_sha = fit.validate_membership(manifest, source, train,
        candidate, reader.json(cpu.CONDITION_CONTRACT))
    qualification = manifest["qualification"]
    require(all(qualification.get(key) is True for key in ("dataQualifiedForTraining",
        "aiAssistedColdStartRightsVerified", "projectControlledSourceIsolationVerified", "splitMembershipVerified")),
        "current release qualification differs")
    historical = reader.json(manifest["qualificationEvidence"])
    moved = [r["sampleId"] for r in rows if r["sourceSplit"] != "train"]
    require(historical["verified"]["semanticAndAiAssistedRightsVerified"] is True
        and historical["verified"]["projectControlledSourcePairingVerified"] is True
        and moved == historical["verified"]["recordedOptimizerExposureMovedToTrain"], "source qualification differs")
    for row in rows:
        fit.verify_train_source(reader, row, order)
    selected = fit.selected_bindings(rows)
    probe_cases = []
    for ordinal, row in enumerate(rows):
        pack = reader.json(row["conditionPack"])
        probe_cases.append({"sampleId": row["sampleId"], "split": "train", "trainOrdinal": ordinal,
            "image": row["image"], "conditionPack": row["conditionPack"],
            "objectInstanceCount": len(pack["objectInstanceTable"]),
            "coverageReason": "every_frozen_train_condition_case_forward_and_backward_no_update"})
    reference = verify_comparison(reader, selected)
    programs = {"controller": bind(CONTROLLER), "worker": bind(WORKER)}
    implementations = [bind(path) for path in IMPLEMENTATION_PATHS]
    for value in implementations + list(programs.values()):
        reader.read(value)
    baseline = registry if registry is not None else fit.idle_registry()
    require(baseline.get("activeExecution") is None and type(baseline.get("registryRevision")) is int
            and isinstance(baseline.get("registrySha256"), str), "inactive registry baseline required")
    reader.unchanged()
    inputs = {"candidateContract": v21.CANDIDATE, "cpuAcceptance": v21.CPU_REPORT,
        "datasetManifest": cpu.MANIFEST, "sourceIndex": manifest["sourceIndex"],
        "trainSplit": manifest["splits"]["train"], "trainSelectionSha256": selection_sha,
        "selectedRows": selected, "conditionContract": cpu.CONDITION_CONTRACT,
        "sourceQualification": {"release": qualification, "historicalEvidence": manifest["qualificationEvidence"],
            "historicalStatus": historical["status"], "sourceSplitMigration": moved,
            "originalRowUseQualification": [r["useQualification"] for r in rows]},
        "comparisonEvidence": COMPARE, "historicalCheckpointUse": "hash_only_never_deserialized",
        "sourceMetadataBindings": fit.SOURCE_INPUTS, "modelPlan": v21.MODEL_PLAN,
        "precisionExecutionPlan": v21.PRECISION_PLAN, "training": TRAINING,
        "observationPlan": OBSERVATION_PLAN, "reproductionRule": REPRODUCTION_RULE,
        "progressPublicationRule": PROGRESS_PUBLICATION_RULE,
        "resolution": [256, 192], "imageTrainOrdinals": [0, 43], "resources": RESOURCES,
        "imagePlan": [{"sampleId": selected[ordinal]["sampleId"], "split": "train", "trainOrdinal": ordinal,
            "epoch": 48, "optimizerStep": 2304, "purpose": purpose} for ordinal in (0, 43)
            for purpose in ("prediction", "target_final_comparison")],
        "gpuProbeCases": probe_cases,
        "scope": SCOPE, "qualification": QUALIFICATION, "outputParent": OUTPUT_PARENT,
        "programBindings": programs, "implementationBindings": implementations,
        "registryBeforeStart": baseline,
        "inputReceipts": [{"path": path, "sha256": digest} for path, digest in sorted(reader.observed.items())]}
    return {"inputs": inputs, "reader": reader, "rows": rows, "order": order,
        "continuous": continuous, "reference": reference, "acceptance": acceptance, "manifest": manifest}


def validate_policy(policy, inputs):
    require(policy.get("schemaVersion") == POLICY_SCHEMA
        and policy.get("status") == "active_single_bounded_train_only_exposure_experiment"
        and policy.get("scope") == SCOPE and policy.get("inputs") == inputs
        and policy.get("maxAttempts") == 1 and policy.get("automaticRetries") == 0,
        "exact frozen independent exposure policy required")
    require(inputs.get("training") == TRAINING and inputs.get("resources") == RESOURCES
        and inputs.get("observationPlan") == OBSERVATION_PLAN and inputs.get("reproductionRule") == REPRODUCTION_RULE
        and json.dumps(inputs.get("progressPublicationRule"), sort_keys=True)
            == json.dumps(PROGRESS_PUBLICATION_RULE, sort_keys=True)
        and inputs.get("qualification") == QUALIFICATION, "frozen training boundary differs")


def package_from_inputs(inputs, policy_binding, manifest):
    identity = "v21-full-train-exposure-" + cpu.sha(json.dumps({"inputs": inputs, "policy": policy_binding},
        sort_keys=True, separators=(",", ":")).encode())[:48]
    return {"schemaVersion": PACKAGE_SCHEMA, "experimentType": EXPERIMENT_TYPE, "evidenceContractVersion": 1,
        "experimentIdentity": identity, "scope": SCOPE, "purpose": SCOPE, "policy": policy_binding,
        "inputs": inputs, "programBindings": inputs["programBindings"], "selectedRows": inputs["selectedRows"],
        "sourceManifest": cpu.MANIFEST, "datasetManifest": cpu.MANIFEST,
        "sourceDatasetIdentity": manifest["datasetReleaseIdentity"], "inputIdentity": manifest["identityPayload"],
        "inputReceipts": inputs["inputReceipts"], "foundation": None,
        "foundationLimitations": {"freshNativeRgbOnly": True, "autoencoderInGraph": False, "historicalCheckpointLoaded": False},
        "config": {"modelPlan": v21.MODEL_PLAN, "precisionExecutionPlan": v21.PRECISION_PLAN},
        "training": TRAINING, "observationPlan": OBSERVATION_PLAN, "qualification": QUALIFICATION,
        "imagePlan": inputs["imagePlan"],
        "resources": RESOURCES, "resolution": [256, 192], "comparisonEvidence": COMPARE,
        "outputRoot": OUTPUT_PARENT + "/" + identity}


def prepare(policy_path):
    require(policy_path == POLICY_PATH, "wrong exposure policy path")
    context = collect_inputs()
    policy_binding = bind(policy_path)
    validate_policy(context["reader"].json(policy_binding), context["inputs"])
    package = package_from_inputs(context["inputs"], policy_binding, context["manifest"])
    directory = cpu.project_file(ROOT, package["outputRoot"])
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "package.json"
    if target.exists():
        require(json.loads(target.read_bytes()) == package, "package identity collision")
    else:
        require(not any(directory.iterdir()), "exposure output occupied")
        v21.write_exclusive(target, package)
    return bind(package["outputRoot"] + "/package.json")


def active_execution(package, package_binding, reader):
    chain = capacity.active_execution(package, package_binding, reader)
    started = reader.json(bind(package["outputRoot"] + "/controller-started.json"))
    baseline = package["inputs"]["registryBeforeStart"]
    require(started["previousRegistry"] == {"revision": baseline["registryRevision"], "sha256": baseline["registrySha256"]},
            "controller frozen baseline differs")
    return chain


def authenticate(package_binding):
    reader = cpu.BoundReader()
    package = reader.json(package_binding)
    require(package.get("schemaVersion") == PACKAGE_SCHEMA and package.get("experimentType") == EXPERIMENT_TYPE
            and package.get("evidenceContractVersion") == 1 and package["policy"]["path"] == POLICY_PATH,
            "wrong exposure envelope")
    context = collect_inputs(package["inputs"]["registryBeforeStart"])
    require(package["inputs"] == context["inputs"], "actual exposure input bytes differ")
    validate_policy(reader.json(package["policy"]), context["inputs"])
    require(package == package_from_inputs(context["inputs"], package["policy"], context["manifest"])
            and package_binding["path"] == package["outputRoot"] + "/package.json", "exposure package identity differs")
    context["reader"].read(package_binding)
    context["reader"].read(package["policy"])
    context.update(package=package, packageBinding=package_binding,
        processChain=active_execution(package, package_binding, context["reader"]))
    context["reader"].unchanged()
    return context


def epoch_order(epoch):
    require(type(epoch) is int and 1 <= epoch <= 48, "epoch outside bounded exposure")
    indices = list(range(48))
    random.Random(TRAINING["initializationSeed"] + epoch).shuffle(indices)
    return indices


@contextmanager
def preserve_rng_and_modes(*networks):
    import numpy as np
    import torch
    cpu_rng, python_rng, numpy_rng = torch.get_rng_state().clone(), random.getstate(), np.random.get_state()
    cuda_rng = torch.cuda.get_rng_state_all() if torch.cuda.is_initialized() else None
    modes = [(module, module.training) for network in networks for module in network.modules()]
    try:
        yield
    finally:
        torch.set_rng_state(cpu_rng)
        random.setstate(python_rng)
        np.random.set_state(numpy_rng)
        if cuda_rng is not None:
            torch.cuda.set_rng_state_all(cuda_rng)
        for module, mode in modes:
            module.training = mode


@contextmanager
def observation_guard(*networks):
    import torch
    before = [cpu.state_hash(network) for network in networks]
    gradients = [(p, p.requires_grad, cpu.tensor_hash(p.grad) if p.grad is not None else None)
                 for network in networks for p in network.parameters()]
    with preserve_rng_and_modes(*networks):
        for network in networks:
            network.eval()
        with fit.readonly_guard(), patch.object(torch, "load", side_effect=RuntimeError("observation checkpoint load prohibited")):
            try:
                yield
            finally:
                require(before == [cpu.state_hash(network) for network in networks], "observation mutated model state")
                require(all(p.requires_grad == enabled and (cpu.tensor_hash(p.grad) if p.grad is not None else None) == digest
                            for p, enabled, digest in gradients), "observation mutated gradient state")


def fresh_networks(order, acceptance=None):
    import torch
    from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import build_fresh_native_rgb_object_residual_v21_cpu
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
    torch.manual_seed(TRAINING["initializationSeed"])
    model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=order)
    critic = build_conditional_texture_discriminator()
    if acceptance is not None:
        require(all(cpu.state_hash(network) == acceptance["initial" + name + "StateSha256"]
                    for name, network in (("Model", model), ("Critic", critic))), "fresh V21 state differs")
    return model, critic


def summarize(records):
    require(len(records) == 48 and all(x["split"] == "train" and x["trainOrdinal"] == i for i, x in enumerate(records)),
            "observation requires ordered 48 train rows")
    values = [x["metrics"]["rgbMae"] for x in records]
    require(all(type(x) in (int, float) and math.isfinite(x) and x >= 0 for x in values), "invalid observation RGB MAE")
    summary = fit.summarize_correlations(records)
    require(all(value is None or (type(value) in (int, float) and math.isfinite(value) and -1 <= value <= 1)
        for record in records for value in [record["metrics"]["objects"][role]["centeredLumaCorrelation"] for role in fit.ROLES]),
        "invalid per-row correlation")
    for row in summary.values():
        value = row["medianCorrelation"]
        require(value is None or math.isfinite(value), "nonfinite correlation summary")
    return {"meanRgbMae": statistics.mean(values), "medianRgbMae": statistics.median(values), "objects": summary}


def reproduction_facts(records, reference_records):
    require([(x["sampleId"], x["split"], x["trainOrdinal"]) for x in records]
            == [(x["sampleId"], x["split"], x["trainOrdinal"]) for x in reference_records], "reproduction row identity differs")
    actual, reference = summarize(records), summarize(reference_records)
    differences = {}
    evidence_valid = True
    within_tolerance = True
    for role in fit.ROLES:
        left, right = actual["objects"][role], reference["objects"][role]
        available = left["validCorrelationCount"] == right["validCorrelationCount"] == 48
        difference = abs(left["medianCorrelation"] - right["medianCorrelation"]) if available else None
        differences[role] = difference
        evidence_valid = evidence_valid and available
        within_tolerance = within_tolerance and available and difference <= REPRODUCTION_RULE["maximumAbsoluteMedianCorrelationDifferenceEachRole"]
    denominator = reference["meanRgbMae"]
    relative = abs(actual["meanRgbMae"] - denominator) / denominator if denominator > 0 else (
        0.0 if actual["meanRgbMae"] == 0 else None)
    evidence_valid = evidence_valid and relative is not None and math.isfinite(relative)
    return {"evidenceValid": evidence_valid,
        "passed": evidence_valid and within_tolerance and relative <= REPRODUCTION_RULE["maximumRelativeMeanRgbMaeDifference"],
        "medianCorrelationAbsoluteDifferences": differences, "meanRgbMaeRelativeDifference": relative,
        "actual": actual, "reference": reference, "comparisonEvidence": COMPARE, "rule": REPRODUCTION_RULE}


def observation_changes(before_records, after_records):
    before, after = summarize(before_records), summarize(after_records)
    role_changes, instance_changes = {}, {}
    for role in fit.ROLES:
        left, right = before["objects"][role]["medianCorrelation"], after["objects"][role]["medianCorrelation"]
        role_changes[role] = right - left if left is not None and right is not None else None
        previous = [item["supportRgbMae"] for row in before_records for item in row["metrics"]["instanceSupportErrors"] if item["role"] == role]
        current = [item["supportRgbMae"] for row in after_records for item in row["metrics"]["instanceSupportErrors"] if item["role"] == role]
        instance_changes[role] = {"beforeMean": statistics.mean(previous) if previous else None,
            "afterMean": statistics.mean(current) if current else None,
            "afterMinusBefore": statistics.mean(current) - statistics.mean(previous) if previous and current else None,
            "instanceCountBefore": len(previous), "instanceCountAfter": len(current)}
    return {"changeDirection": "after_minus_before_positive_mae_is_deterioration",
        "meanRgbMaeChange": after["meanRgbMae"] - before["meanRgbMae"],
        "medianCorrelationChangeByRole": role_changes,
        "instanceSupportRgbMaeChangeByRoleEqualInstanceWeight": instance_changes}


def exposure_ledger(selected):
    return [{"sampleId": row["sampleId"], "split": "train", "trainOrdinal": row["trainOrdinal"],
             "generator": 0, "discriminator": 0} for row in selected]


def validate_exposures(ledger, counts, epoch):
    require(len(ledger) == 48 and all(x["trainOrdinal"] == i and x["split"] == "train"
            and x["generator"] == x["discriminator"] == epoch for i, x in enumerate(ledger)), "per-row exposure differs")
    require(counts == {"generator": epoch * 48, "discriminator": epoch * 48}, "optimizer/exposure counts differ")


def validate_result_contract(result, package):
    require(result.get("schemaVersion") == RESULT_SCHEMA and result.get("evidenceContractVersion") == 1
        and result.get("experimentType") == EXPERIMENT_TYPE and result.get("experimentIdentity") == package["experimentIdentity"]
        and result.get("completedEpochs") == 48 and result.get("sourceBytesUnchanged") is True
        and result.get("checkpointReloadExact") is True
        and result.get("epoch24ReproductionEvidenceValid") is True
        and type(result.get("epoch24ReproductionPassed")) is bool
        and result.get("reproductionRule") == package["inputs"]["reproductionRule"] == REPRODUCTION_RULE
        and result.get("optimizerSteps") == {"generator": 2304, "discriminator": 2304}
        and all(result.get(key) is False for key in ("stage4QualificationGranted", "checkpointPromotable",
            "validationContentRead", "challengeContentRead", "regressionContentRead", "historicalCheckpointLoaded")),
        "completed exposure result boundary differs")
    expected = [(row["sampleId"], "train", row["trainOrdinal"], point["epoch"], point["optimizerStep"])
        for point in OBSERVATION_PLAN for row in package["selectedRows"]]
    actual = [(row.get("sampleId"), row.get("split"), row.get("trainOrdinal"), row.get("epoch"), row.get("optimizerStep"))
              for row in result.get("trainOnlyObservations", [])]
    require(actual == expected and all(isinstance(row.get("measurements"), dict) for row in result["trainOnlyObservations"]),
            "flat ordered 144 observation identity differs")
    # Recompute from immutable comparison bytes and the committed epoch-24
    # observation/diagnostic. A caller's flag or plausible digest is insufficient.
    reader = cpu.BoundReader()
    def committed_json(name):
        path = package["outputRoot"] + "/" + name
        bindings = [item for item in result.get("artifacts", []) if item.get("path") == path]
        require(len(bindings) == 1, "epoch24 diagnostic evidence missing or duplicated")
        return reader.json(bindings[0])
    observed = committed_json("observation-epoch-24.json")
    rows = result["trainOnlyObservations"][48:96]
    require(observed.get("epoch") == 24 and observed.get("optimizerStep") == 1152
        and observed.get("trainOnly") == rows, "epoch24 committed observation differs")
    facts = reproduction_facts(rows, reader.json(COMPARE["result"])["samples"])
    supplied = result.get("epoch24Reproduction")
    require(isinstance(supplied, dict) and supplied.get("evidenceValid") is True
        and type(supplied.get("passed")) is bool and facts["evidenceValid"] is True
        and supplied == facts and committed_json("epoch-24-reproduction.json") == facts
        and result["epoch24ReproductionPassed"] is facts["passed"], "epoch24 diagnostic evidence invalid")
    reader.unchanged()
    keys = ("sampleId", "split", "trainOrdinal", "epoch", "optimizerStep", "purpose")
    images = result.get("imageArtifacts", [])
    require(len(images) == len(package["imagePlan"]) == 4 and len({x.get("path") for x in images}) == 4
        and [tuple(x.get(k) for k in keys) for x in images] == [tuple(x[k] for k in keys) for x in package["imagePlan"]]
        and all(isinstance(x.get("sourceLabel"), str) and x["sourceLabel"]
                and {k: x[k] for k in ("path", "sha256")} in result["artifacts"] for x in images),
        "endpoint image identity/artifact differs")
    validate_exposures(result["perSampleExposure"], result["optimizerSteps"], 48)


def make_training_progress(epoch, batch_index, counts, raw_generator_loss, elapsed):
    require(type(epoch) is int and 1 <= epoch <= 48 and type(batch_index) is int and 0 <= batch_index <= 48
        and set(counts) == {"generator", "discriminator"}
        and all(type(value) is int and 0 <= value <= 2304 for value in counts.values()), "training progress bounds differ")
    if not any(counts.values()):
        return None
    loss = raw_generator_loss if type(raw_generator_loss) in (int, float) and math.isfinite(raw_generator_loss) and raw_generator_loss >= 0 else None
    throughput = counts["generator"] / elapsed if math.isfinite(elapsed) and elapsed > 0 else None
    return {"epoch": epoch, "batchIndex": batch_index, "batchCount": 48, "optimizationStep": counts["generator"],
        "loss": loss, "learningRate": .0001, "throughputSamplesPerSecond": throughput,
        "estimatedCompletionAtUtc": None, "checkpointIdentity": None}


def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
                 counts, ledger_row, resource, forward, after_update=lambda name, loss: None):
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective
    require(sample["split"] == "train" and sample["sampleId"] == ledger_row["sampleId"], "update source differs")
    device = next(model.parameters()).device
    bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
    autocast = lambda: torch.autocast("cuda", dtype=torch.bfloat16) if device.type == "cuda" else nullcontext()

    def update(optimizer, loss, network, name):
        before = counts[name]
        try:
            v21.update_network(optimizer, loss, network, bound, name, counts, 2304, resource)
        finally:
            # update_network increments immediately after a completed optimizer.step,
            # before post-update finite/resource checks; keep that actual update.
            ledger_row[name] += counts[name] - before
            after_update(name, float(loss.detach()))

    generator_optimizer.zero_grad(set_to_none=True)
    critic.requires_grad_(True)
    capacity.require_critic_mode(critic, trainable=True)
    with torch.no_grad(), autocast():
        detached = forward("training", bound)
    with autocast():
        d_loss, _ = gpu.detached_discriminator_objective(critic, detached, bound)
    update(critic_optimizer, d_loss, critic, "discriminator")
    require(all(p.grad is None for p in model.parameters()), "discriminator leaked generator gradient")
    critic_optimizer.zero_grad(set_to_none=True)
    critic.requires_grad_(False)
    capacity.require_critic_mode(critic, trainable=False)
    with autocast():
        prediction = forward("training", bound)
        g_loss, _ = train_structured_object_objective(critic, prediction, bound, sample["objectInstanceTable"], order)
    update(generator_optimizer, g_loss, model, "generator")
    require(all(p.grad is None for p in critic.parameters()), "generator leaked frozen critic gradient")
    return {"generatorLoss": float(g_loss.detach()), "discriminatorLoss": float(d_loss.detach())}


def zero_update_probe(model, critic, sample, order, resource, forward):
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective
    before = {name: cpu.state_hash(network) for name, network in (("Model", model), ("Critic", critic))}
    enabled = [(p, p.requires_grad) for network in (model, critic) for p in network.parameters()]
    require(all(p.grad is None for p, _ in enabled), "probe requires clean initial gradients")
    with preserve_rng_and_modes(model, critic), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("probe optimizer prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("probe checkpoint load prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("probe checkpoint write prohibited")):
        try:
            model.eval(); critic.eval()
            critic.requires_grad_(False)
            capacity.require_critic_mode(critic, trainable=False)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                predicted = forward("probe", sample)
                loss, _ = train_structured_object_objective(critic, predicted, sample, sample["objectInstanceTable"], order)
            require(bool(torch.isfinite(loss)), "nonfinite generator probe")
            loss.backward()
            generator_facts = gpu.gradient_facts(model, "cuda")
            head_facts = v21.v21gpu._head_gradients(model)
            require(all(p.grad is None for p in critic.parameters()), "probe generator leaked critic gradient")
            resource()
            model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
            critic.requires_grad_(True)
            capacity.require_critic_mode(critic, trainable=True)
            with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                detached = forward("probe", sample)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                d_loss, _ = gpu.detached_discriminator_objective(critic, detached, sample)
            require(bool(torch.isfinite(d_loss)), "nonfinite discriminator probe")
            d_loss.backward()
            discriminator_facts = gpu.gradient_facts(critic, "cuda")
            require(all(p.grad is None for p in model.parameters()), "probe discriminator leaked generator gradient")
            resource()
        finally:
            model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
            for p, flag in enabled:
                p.requires_grad_(flag)
            require(before == {name: cpu.state_hash(network) for name, network in (("Model", model), ("Critic", critic))},
                    "zero-update probe mutated state")
    return {"passed": True, "optimizerCreated": False, "optimizerSteps": {"generator": 0, "discriminator": 0},
        "initialStateSha256": before, "finalStateSha256": before, "generatorGradients": generator_facts,
        "discriminatorGradients": discriminator_facts, "objectHeadGradientAbsoluteSums": head_facts}


def decoded_sample_identity(sample, identity, ordinal):
    """Record tensors actually decoded for this run, before any CUDA transfer."""
    return {**identity, "trainOrdinal": ordinal, "tensorHashes": {
        "image": cpu.tensor_hash(sample["image"]),
        "conditions": cpu.tensor_hash(sample["conditions"]),
    }}


def observation_evidence(observations, image_artifacts, output_root, artifacts):
    """Project only observations/images whose writes completed before termination.

    This is the producer's explicit output naming contract, not a console
    heuristic. A failed write must not appear as a completed observation.
    """
    bound = {item["path"]: item["sha256"] for item in artifacts}
    committed = [obs for obs in observations
        if f'{output_root}/observation-epoch-{obs["epoch"]:02d}.json' in bound]
    images = [item for item in image_artifacts
        if bound.get(item["path"]) == item["sha256"]]
    return {
        "trainOnlyObservations": [row for obs in committed for row in obs["trainOnly"]],
        "observationSummaries": [{"epoch": obs["epoch"], "optimizerStep": obs["optimizerStep"],
            "summary": obs["summary"]} for obs in committed],
        "observationPlan": OBSERVATION_PLAN,
        "rows": [{"sampleId": row["sampleId"], "split": "train", "epoch": row["epoch"],
            "optimizerStep": row["optimizerStep"], "measurements": row}
            for obs in committed for row in obs["trainOnly"]],
        "imageArtifacts": images,
    }


def png_bytes(rgb):
    import numpy as np
    from PIL import Image
    array = (rgb.detach().float().cpu().clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
    stream = io.BytesIO()
    Image.fromarray(array).save(stream, format="PNG")
    return stream.getvalue()


def final_image_bytes(prediction, target):
    from PIL import Image
    predicted, original = png_bytes(prediction), png_bytes(target)
    sheet = Image.new("RGB", (512, 192))
    with Image.open(io.BytesIO(original)) as image:
        sheet.paste(image, (0, 0))
    with Image.open(io.BytesIO(predicted)) as image:
        sheet.paste(image, (256, 0))
    stream = io.BytesIO(); sheet.save(stream, format="PNG")
    return predicted, stream.getvalue()


def reload_final_cpu(payload_bytes, expected, order, package_binding, identity):
    import torch
    saved = torch.load(io.BytesIO(payload_bytes), map_location="cpu", weights_only=True)
    require(saved.get("experimentIdentity") == identity and saved.get("executionPackage") == package_binding
        and saved.get("epoch") == 48 and saved.get("optimizerSteps") == {"generator": 2304, "discriminator": 2304}
        and saved.get("finalStateSha256") == expected and saved.get("checkpointPromotable") is False
        and saved.get("automaticResumeAllowed") is False, "final checkpoint metadata differs")
    with preserve_rng_and_modes():
        model, critic = fresh_networks(order)
        model.load_state_dict(saved["modelState"], strict=True)
        critic.load_state_dict(saved["criticState"], strict=True)
    require({"Model": cpu.state_hash(model), "Critic": cpu.state_hash(critic)} == expected,
            "final checkpoint CPU reload state differs")
    return True


def atomic_progress_json(path, value):
    """Publish one staged snapshot; retry only confirmed Windows replace errors.

    Persistent failure retains both the previous committed bytes and the staged
    bytes. This helper never retries serialization, staging, or training work.
    """
    require(path.name == "progress.json", "bounded publication is progress-only")
    data = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf8")
    temporary = path.with_name(path.name + ".staged-" + uuid4().hex)
    with temporary.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    for attempt in range(PROGRESS_PUBLICATION_RULE["maxReplaceAttempts"]):
        try:
            os.replace(temporary, path)
            return
        except OSError as error:
            code = getattr(error, "winerror", None)
            if (os.name != "nt" or type(code) is not int
                    or code not in PROGRESS_PUBLICATION_RULE["retryableWindowsErrors"]
                    or attempt + 1 == PROGRESS_PUBLICATION_RULE["maxReplaceAttempts"]):
                raise
            time.sleep(PROGRESS_PUBLICATION_RULE["retryDelaySeconds"])


def run(package_binding):
    start = WORKER_WALL_START
    context = authenticate(package_binding)
    package, reader = context["package"], context["reader"]
    directory = cpu.project_file(ROOT, package["outputRoot"])
    require(not any((directory / name).exists() for name in ("worker-started.json", "worker-failure.json", "result.json", "final-step.pt")),
            "single exposure attempt already consumed")
    counts = {"generator": 0, "discriminator": 0}
    ledger = exposure_ledger(package["selectedRows"])
    state = {"schemaVersion": RESULT_SCHEMA, "experimentType": EXPERIMENT_TYPE, "evidenceContractVersion": 1,
        "experimentIdentity": package["experimentIdentity"], "executionState": "executing", "gpuStarted": False,
        "trainingStarted": False, "optimizerCreated": False, "optimizerSteps": counts, "completedEpochs": 0,
        "modelForwardCalls": {"training": 0, "probe": 0, "observation": 0},
        "validationContentRead": False, "challengeContentRead": False, "regressionContentRead": False,
        "historicalCheckpointLoaded": False, "checkpointSelectionAllowed": False, "checkpointPromotable": False,
        "stage4QualificationGranted": False, "runtimeFrameAllowed": False, "worldEntryAllowed": False,
        "automaticResumeAllowed": False, "supervisorProcessChain": context["processChain"], "startedAtUtc": WORKER_STARTED_AT_UTC}
    state.update(runId=package["experimentIdentity"], trainingProgress=None)
    v21.write_exclusive(directory / "worker-started.json", state)
    last_authority, last_thermal, probe_start = 0.0, 0.0, None
    observations, image_artifacts, immutable_names = [], [], ["worker-started.json"]

    def output_budget(extra=0):
        size = sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())
        require(size + extra <= 128 * 1024**2 - 65536, "output budget exhausted")

    def write_json(name, value, mutable=False):
        output_budget(len(json.dumps(value, indent=2).encode("utf8")) + 1)
        if mutable:
            atomic_progress_json(directory / name, value)
        else:
            v21.atomic_json(directory / name, value)
        if not mutable:
            immutable_names.append(name)

    def write_bytes(name, value):
        output_budget(len(value))
        with (directory / name).open("xb") as stream:
            stream.write(value); stream.flush(); os.fsync(stream.fileno())
        immutable_names.append(name)

    def progress(phase):
        write_json("progress.json", {**state, "phase": phase, "optimizerSteps": counts.copy(),
            "perSampleExposure": ledger, "updatedAtUtc": now()}, mutable=True)

    def resource():
        nonlocal last_authority, last_thermal
        import torch
        require(time.monotonic() - start < 1800, "exposure wall time exhausted")
        if probe_start is not None:
            require(time.monotonic() - probe_start < 120, "zero-update GPU probe wall time exhausted")
        if time.monotonic() - last_authority >= 10:
            active_execution(package, package_binding, reader)
            last_authority = time.monotonic()
        require(shutil.disk_usage(directory).free >= 2048 * 1024**2, "free disk below floor")
        output_budget()
        torch.cuda.synchronize(0)
        free, total = torch.cuda.mem_get_info(0)
        require(free >= 2048 * 1024**2, "free VRAM below floor")
        state["memory"] = gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved(0)),
            allocated=int(torch.cuda.max_memory_allocated(0)), device_used=int(total - free), fraction=.7)
        if time.monotonic() - last_thermal >= 10:
            thermal = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(thermal.returncode == 0, "GPU temperature unavailable")
            temperature = int(thermal.stdout.strip().splitlines()[0])
            require(temperature <= 85, "GPU temperature above ceiling")
            state["lastTemperatureC"] = temperature
            last_thermal = time.monotonic()

    try:
        import torch
        torch.set_num_threads(2)
        model, critic = fresh_networks(context["order"], context["acceptance"])
        initial = {"Model": cpu.state_hash(model), "Critic": cpu.state_hash(critic)}
        samples, identities = [], []
        for ordinal, row in enumerate(context["rows"]):
            sample, identity = cpu.load_sample(reader, row, context["order"], context["continuous"])
            require(sample["split"] == identity["split"] == "train" and sample["sampleId"] == row["sampleId"], "loaded source differs")
            samples.append(sample); identities.append(decoded_sample_identity(sample, identity, ordinal))
        write_json("sample-identities.json", identities)
        reader.unchanged()
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        require(time.monotonic() - start < 1800, "wall time exhausted before CUDA")
        torch.cuda.set_device(0); torch.cuda.manual_seed_all(TRAINING["initializationSeed"])
        free, total = torch.cuda.mem_get_info(0)
        allocation = int(total * .7) - (total - free) - 64 * 1024**2
        require(allocation > 0 and free >= 2048 * 1024**2, "insufficient memory below 70 percent")
        torch.cuda.set_per_process_memory_fraction(allocation / total, 0)
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuStarted"] = True
        model.to("cuda:0"); critic.to("cuda:0")
        resource()

        def forward(kind, bound):
            state["modelForwardCalls"][kind] += 1
            return model(bound["conditions"][None].to("cuda:0"), bound["objectInstanceTable"])

        probe_start = time.monotonic()
        probe_reports = []
        progress("gpu_zero_update_gate")
        for ordinal, sample in enumerate(samples):
            resource()
            probe_sample = {**sample, "conditions": sample["conditions"].to("cuda:0"), "image": sample["image"].to("cuda:0")}
            probe = zero_update_probe(model, critic, probe_sample, context["order"], resource, forward)
            probe_reports.append({**probe, "case": package["inputs"]["gpuProbeCases"][ordinal]})
            del probe_sample
        probe_start = None
        state["zeroUpdateGpuProbePassed"] = True
        write_json("zero-update-gpu-probe.json", {"passed": True, "caseCount": 48, "cases": probe_reports,
            "optimizerCreated": False, "optimizerSteps": counts.copy(), "executionPackage": package_binding, "recordedAtUtc": now()})

        def observe(epoch):
            state["trainingProgress"] = None
            progress("train_only_observation")
            before_counts = counts.copy()
            records = []
            with observation_guard(model, critic), torch.autocast("cuda", dtype=torch.bfloat16):
                for ordinal, sample in enumerate(samples):
                    resource()
                    prediction = forward("observation", sample)
                    metrics = fit.fit_metrics(prediction, sample, context["order"])
                    row = {"sampleId": sample["sampleId"], "split": "train", "trainOrdinal": ordinal,
                        "epoch": epoch, "optimizerStep": counts["generator"], "metrics": metrics, "measurements": metrics,
                        "rgbMae": metrics["rgbMae"],
                        "objectRoleLumaCorrelation": {role: metrics["objects"][role]["centeredLumaCorrelation"] for role in fit.ROLES},
                        "instanceSupportErrors": metrics["instanceSupportErrors"],
                        "fixedSeedInferenceSha256": cpu.tensor_hash(prediction[0].float().cpu())}
                    if epoch == 48 and ordinal in (0, 43):
                        predicted, comparison = final_image_bytes(prediction[0], sample["image"])
                        for purpose, suffix, value, label in (("prediction", "prediction", predicted, "第48轮真实模型预测"),
                            ("target_final_comparison", "target-final-comparison", comparison, "左：train原图；右：第48轮模型预测")):
                            name = f"epoch-48-train-{ordinal:02d}-{suffix}.png"
                            write_bytes(name, value)
                            association = {**bind(package["outputRoot"] + "/" + name), "sampleId": sample["sampleId"],
                                "split": "train", "trainOrdinal": ordinal, "epoch": 48, "optimizerStep": 2304, "sourceLabel": label, "purpose": purpose}
                            image_artifacts.append(association)
                            row["predictionPng" if purpose == "prediction" else "targetFinalContactSheetPng"] = {
                                key: association[key] for key in ("path", "sha256")}
                    records.append(row)
                    del prediction
            require(before_counts == counts, "observation changed update counts")
            fit.validate_results(records, package["selectedRows"])
            observation = {"epoch": epoch, "optimizerStep": counts["generator"], "trainOnly": records, "summary": summarize(records)}
            observations.append(observation)
            write_json(f"observation-epoch-{epoch:02d}.json", observation)
            reader.unchanged(); resource()
            return records

        # No checkpoint deserialization can occur before the sole final CPU reload.
        with patch.object(torch, "load", side_effect=RuntimeError("historical checkpoint load prohibited")), \
             patch.object(torch, "save", side_effect=RuntimeError("premature checkpoint write prohibited")):
            observe(0)
            args = {"betas": tuple(v21.OPTIMIZER_PLAN["betas"]), "eps": v21.OPTIMIZER_PLAN["eps"],
                    "weight_decay": v21.OPTIMIZER_PLAN["weightDecay"], "foreach": False, "fused": False}
            generator_optimizer = torch.optim.AdamW(model.parameters(), lr=.0001, **args)
            critic_optimizer = torch.optim.AdamW(critic.parameters(), lr=.0001, **args)
            state["optimizerCreated"] = True
            model.train(); critic.train()
            training_start = time.monotonic()
            for epoch in range(1, 49):
                reader.unchanged()
                for batch_index, ordinal in enumerate(epoch_order(epoch), 1):
                    state["attemptedUpdate"] = {"epoch": epoch, "sampleId": samples[ordinal]["sampleId"], "trainOrdinal": ordinal}
                    def after_update(name, raw_loss):
                        state["trainingStarted"] = any(counts.values())
                        state.setdefault("lastRawLosses", {})[name] = raw_loss
                        g_loss = state["lastRawLosses"].get("generator")
                        state["trainingProgress"] = make_training_progress(epoch, batch_index, counts, g_loss,
                            time.monotonic() - training_start)
                        progress("training")
                    losses = perform_pair(model, critic, samples[ordinal], context["order"], generator_optimizer,
                        critic_optimizer, counts, ledger[ordinal], resource, forward, after_update)
                    state["lastLosses"] = losses
                validate_exposures(ledger, counts, epoch)
                state["completedEpochs"] = epoch
                generator_optimizer.zero_grad(set_to_none=True); critic_optimizer.zero_grad(set_to_none=True)
                if epoch in (24, 48):
                    records = observe(epoch)
                    if epoch == 24:
                        facts = reproduction_facts(records, context["reference"]["samples"])
                        write_json("epoch-24-reproduction.json", facts)
                        state["epoch24Reproduction"] = facts
                        state["epoch24ReproductionEvidenceValid"] = facts["evidenceValid"]
                        state["epoch24ReproductionPassed"] = facts["passed"]
                        require(facts["evidenceValid"] is True, "epoch24 reproduction evidence invalid")
                progress("epoch_completed")
                print(json.dumps({"event": "exposure_epoch_completed", "experimentIdentity": package["experimentIdentity"],
                    "epoch": epoch, "optimizerSteps": counts.copy(), "recordedAtUtc": now()}), flush=True)
            require(state["modelForwardCalls"] == {"training": 4608, "probe": 96, "observation": 144}, "forward accounting differs")
        state["trainingProgress"] = None
        progress("final_checkpoint_reload")
        final = {"Model": cpu.state_hash(model), "Critic": cpu.state_hash(critic)}
        require(all(final[name] != initial[name] for name in initial), "final network did not update")
        reader.unchanged(); resource()
        payload = {"schemaVersion": "ai-painter-learning-capacity-experiment-checkpoint-v1",
            "experimentType": EXPERIMENT_TYPE, "experimentIdentity": package["experimentIdentity"], "executionPackage": package_binding,
            "datasetManifest": cpu.MANIFEST, "trainSelectionSha256": package["inputs"]["trainSelectionSha256"],
            "epoch": 48, "optimizerSteps": counts.copy(), "initialStateSha256": initial, "finalStateSha256": final,
            "checkpointPromotable": False, "automaticResumeAllowed": False,
            "modelState": {key: value.detach().cpu().clone() for key, value in model.state_dict().items()},
            "criticState": {key: value.detach().cpu().clone() for key, value in critic.state_dict().items()}}
        stream = io.BytesIO(); torch.save(payload, stream)
        write_bytes("final-step.pt", stream.getvalue())
        checkpoint = bind(package["outputRoot"] + "/final-step.pt")
        checkpoint_bytes = cpu.project_file(ROOT, checkpoint["path"]).read_bytes()
        require(cpu.sha(checkpoint_bytes) == checkpoint["sha256"], "final checkpoint bytes changed")
        reload_final_cpu(checkpoint_bytes, final, context["order"], package_binding, package["experimentIdentity"])
        validate_exposures(ledger, counts, 48)
        require([{"epoch": x["epoch"], "optimizerStep": x["optimizerStep"]} for x in observations] == OBSERVATION_PLAN
                and len(image_artifacts) == 4, "observation/image contract differs")
        reader.unchanged(); resource()
        artifacts = [bind(package["outputRoot"] + "/" + name) for name in immutable_names]
        final_summary = observations[-1]["summary"]
        strong = all(final_summary["objects"][role]["validCorrelationCount"] == 48
            and final_summary["objects"][role]["medianCorrelation"] >= .60
            and final_summary["objects"][role]["positiveCorrelationCount"] >= 40 for role in ("object_tree", "object_rock"))
        result = {**state, "status": "experiment_executed_not_visual_qualified", "executionState": "completed",
            "optimizerSteps": counts.copy(), "perSampleExposure": ledger, "checkpointReloadExact": True,
            "initialStateSha256": initial, "finalStateSha256": final, "sourceBytesUnchanged": True,
            **observation_evidence(observations, image_artifacts, package["outputRoot"], artifacts),
            "artifacts": artifacts, "checkpoint": checkpoint,
            "trainFitResearchInterpretation": "strong_train_fit_no_generalization_claim" if strong else "train_fit_not_closed",
            "qualification": QUALIFICATION, "comparisonEvidence": COMPARE, "reproductionRule": REPRODUCTION_RULE,
            "epoch48ChangesFromReproducedEpoch24": observation_changes(observations[1]["trainOnly"], observations[2]["trainOnly"]),
            "epoch48ChangesFromHistoricalEpoch24": observation_changes(context["reference"]["samples"], observations[2]["trainOnly"]),
            "elapsedSeconds": time.monotonic() - start, "completedAtUtc": now()}
        validate_result_contract(result, package)
        write_json("result.json", result)
        require(time.monotonic() - start < 1800, "wall time exhausted during final result commit")
        return result
    except BaseException as error:
        failure = {**state, "status": "experiment_failed_closed", "executionState": "failed_closed",
            "optimizerSteps": counts.copy(), "perSampleExposure": ledger, "error": repr(error),
            "qualification": QUALIFICATION, "failedAtUtc": now()}
        v21.write_exclusive(directory / "worker-failure.json", failure)
        if not (directory / "result.json").exists():
            artifacts = [bind(package["outputRoot"] + "/" + name) for name in immutable_names
                if (directory / name).is_file()] + [bind(package["outputRoot"] + "/worker-failure.json")]
            v21.write_exclusive(directory / "result.json", {**failure, "checkpointReloadExact": False,
                **observation_evidence(observations, image_artifacts, package["outputRoot"], artifacts),
                "artifacts": artifacts})
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("inspect", "prepare", "run"))
    parser.add_argument("--policy"); parser.add_argument("--package"); parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.mode == "inspect":
        require(not any((args.policy, args.package, args.sha256)), "inspect accepts no execution arguments")
        context = collect_inputs()
        print(json.dumps({"status": "cpu_inputs_verified_policy_not_frozen_gpu_not_started", "inputs": context["inputs"],
            "policyRequiredFields": {"schemaVersion": POLICY_SCHEMA, "status": "active_single_bounded_train_only_exposure_experiment",
                "scope": SCOPE, "inputs": "exact_this_inspect_inputs", "maxAttempts": 1, "automaticRetries": 0},
            "checkpointDeserialized": False, "samplePixelsDecoded": False, "gpuInitialized": False}, ensure_ascii=False))
    elif args.mode == "prepare":
        require(args.policy and not args.package and not args.sha256, "prepare requires only --policy")
        print(json.dumps(prepare(args.policy)))
    else:
        require(args.package and args.sha256 and not args.policy, "run requires exact package binding")
        run({"path": args.package, "sha256": args.sha256})


if __name__ == "__main__":
    main()
