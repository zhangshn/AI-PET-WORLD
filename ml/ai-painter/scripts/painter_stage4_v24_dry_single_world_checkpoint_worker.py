"""Bounded V24 training and validation-checkpoint selection for one dry world.

This module is an inactive execution component.  Importing it performs no GPU
initialization, data reads, optimizer creation, or training.  An external
controller must authenticate the frozen candidate and construct the bound
train/validation samples before calling :func:`run_with_terminal_boundary`.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import random
import shutil
import subprocess
import sys
import os
import time

import torch


ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "ml/ai-painter/src"
SCRIPTS = ROOT / "ml/ai-painter/scripts"
for entry in (str(SRC), str(SCRIPTS)):
    if entry not in sys.path:
        sys.path.insert(0, entry)

import painter_stage4_v24_object_head_core_priority_probe as v24  # noqa: E402
import train_stage4_mvp_structured_object_v18_dry_stage0 as managed_worker  # noqa: E402
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (  # noqa: E402
    OBJECT_CHANNELS,
    original_object_class_spatial_loss,
)
from ai_painter.complete_world.split_training import state_hash as nested_state_hash  # noqa: E402


CAPABILITY = "stage4_mvp256_dry_v24_closed_loop_candidate_v1"
CANDIDATE_SCHEMA = "stage4-mvp256-dry-v24-closed-loop-candidate-v1"
CANDIDATE_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
)
WORKER_PATH = (
    "ml/ai-painter/scripts/"
    "painter_stage4_v24_dry_single_world_checkpoint_worker.py"
)
TEST_PATH = (
    "ml/ai-painter/tests/"
    "test_stage4_v24_dry_single_world_checkpoint_worker.py"
)
REQUIRED_PROGRAM_PATHS = (
    WORKER_PATH,
    TEST_PATH,
    "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py",
    "ml/ai-painter/scripts/painter_stage4_v21_object_core_fidelity_probe.py",
    "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py",
    "ml/ai-painter/src/ai_painter/complete_world/"
        "object_head_core_priority_update_v24.py",
    "ml/ai-painter/src/ai_painter/complete_world/"
        "native_rgb_complete_support_partition_v23_cpu.py",
    "ml/ai-painter/src/ai_painter/complete_world/"
        "native_rgb_object_core_fidelity_candidate_cpu.py",
    "ml/ai-painter/src/ai_painter/complete_world/"
        "native_rgb_structured_object_objective_cpu_v17.py",
)
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-checkpoint-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-worker-terminal-v1"
PACKAGE_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-execution-package-v1"
GPU_GATE_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1"
LOCK_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-managed-lock-v1"
LAUNCH_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-launch-identity-v1"
TRAINING_TICKET_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-training-ticket-v1"
V24_IDENTITY = {
    "capability": CAPABILITY,
    "checkpointSchema": CHECKPOINT_SCHEMA,
    "terminalSchema": TERMINAL_SCHEMA,
    "progressSchema": "ai-painter-stage4-mvp256-dry-v24-progress-v1",
}
ELIGIBLE_EPOCHS = (24, 36, 48)
TRAIN_ROWS = 48
VALIDATION_ROWS = 8
MAX_EPOCHS = 48
MAX_STEPS = 2304
MODEL_SEED = 20260929
SUBJECT_ID = "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2"
RESOURCE_CEILING = {
    "trainingAttempts": 1,
    "automaticRetries": 0,
    "epochs": 48,
    "generatorOptimizerSteps": 2304,
    "discriminatorOptimizerSteps": 2304,
    "maxWallSeconds": 2700,
    "maxGpuMemoryFraction": 0.7,
    "maximumTemperatureC": 85,
    "minimumFreeVramMiB": 2048,
    "minimumFreeDiskMiB": 2048,
    "maxOutputMiB": 128,
    "cpuThreads": 2,
}
SELECTION_CONTRACT = {
    "eligibleEpochs": [24, 36, 48],
    "validationRowsPerEligibleEpoch": 8,
    "firstCriterion":
        "maximum_worst_applicable_object_class_masked_luminance_correlation",
    "secondCriterion": "minimum_mean_validation_rgb_mae",
    "thirdCriterion": "earliest_epoch",
    "allFourNaturalObjectClassesMustHaveValidationCoverage": True,
    "validationMayUpdateWeights": False,
    "selectedCheckpointMustReloadExactly": True,
    "historicalV24CheckpointMayInitializeTraining": False,
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def _finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_candidate_contract(candidate):
    """Validate the frozen CPU candidate without granting execution."""
    require(isinstance(candidate, Mapping), "candidate contract missing")
    require(candidate.get("schemaVersion") == CANDIDATE_SCHEMA
            and candidate.get("capabilityVersion") == CAPABILITY
            and candidate.get("status") == "cpu_candidate_not_execution_qualified",
            "candidate identity or inactive status differs")
    scope = candidate.get("scope", {})
    require(scope.get("resolution") == [256, 192]
            and scope.get("worldCount") == 1
            and scope.get("subjectSampleId") == SUBJECT_ID
            and scope.get("subjectSplit") == "validation"
            and scope.get("waterFactPresent") is False
            and scope.get("formalStage4Qualification") is False
            and scope.get("runtimePublication") is False,
            "single dry-world scope differs")
    data_use = candidate.get("dataUse", {})
    require(data_use == {
        "train": 48, "validation": 8, "challenge": 4, "regression": 4,
        "weightUpdatesFrom": ["train"],
        "checkpointSelectionFrom": ["validation"],
        "challengeAndRegressionContentRead": False,
        "sourceImageOrSplitMutation": False,
    }, "candidate split boundary differs")
    require(candidate.get("executionCeiling") == RESOURCE_CEILING,
            "candidate resource ceiling differs")
    require(candidate.get("checkpointSelection") == SELECTION_CONTRACT,
            "candidate checkpoint-selection rule differs")
    activation = candidate.get("activation", {})
    require(activation == {
        "cpuPreflightAllowed": True,
        "gpuQualificationAllowed": False,
        "trainingAllowed": False,
        "reviewExecutionAllowed": False,
        "checkpointPromotionAllowed": False,
        "formalStageAdvancementAllowed": False,
        "runtimePublicationAllowed": False,
    }, "inactive candidate activation boundary differs")
    require(candidate.get("historicalV24")
            == "diagnostic_predecessor_only_not_parent_checkpoint_or_qualification",
            "historical V24 boundary differs")
    bindings = candidate.get("frozenBindings")
    require(isinstance(bindings, Mapping)
            and set(bindings) == {"dryScope", "sourcePolicy", "datasetManifest",
                                  "trainSplit", "validationSplit", "numericReview",
                                  "detailReview"},
            "candidate frozen bindings differ")
    for name, binding in bindings.items():
        require(isinstance(binding, Mapping) and set(binding) == {"path", "sha256"}
                and isinstance(binding["path"], str) and binding["path"]
                and isinstance(binding["sha256"], str)
                and len(binding["sha256"]) == 64
                and all(character in "0123456789abcdef"
                        for character in binding["sha256"]),
                "invalid frozen binding: " + name)
    return candidate


def load_candidate_contract(path=ROOT / CANDIDATE_PATH):
    """Read only the candidate JSON; callers bind its bytes before execution."""
    candidate = json.loads(Path(path).read_bytes())
    return validate_candidate_contract(candidate)


def _binding(value, label):
    require(isinstance(value, Mapping) and set(value) == {"path", "sha256"}
            and isinstance(value["path"], str) and value["path"]
            and isinstance(value["sha256"], str) and len(value["sha256"]) == 64
            and all(character in "0123456789abcdef" for character in value["sha256"]),
            "invalid bound identity: " + label)
    return dict(value)


@dataclass(frozen=True)
class _AuthenticatedTrainingGate:
    package_binding: dict
    candidate_binding: dict
    run_id: str
    package_id: str
    output_root: str
    ticket_binding: dict
    consumption_claim_path: str
    supervisor_process_chain: tuple | None
    qualified_initial_state_sha256: dict
    source_bindings: tuple


@dataclass(frozen=True)
class _ConsumedTrainingGate:
    authenticated: _AuthenticatedTrainingGate
    consumption_claim: dict


def authenticate_training_gate(training_ticket_binding, *, root=ROOT,
                               check_process=True):
    """Rehash an acyclic package -> evidence -> single-use ticket chain.

    The returned private token is the only value accepted by the optimizing
    loop.  Boolean fields supplied by an in-process caller are never enough.
    """
    reader = v24.core.cpu.BoundReader(root)
    ticket_binding = _binding(training_ticket_binding, "training ticket")
    ticket = reader.json(ticket_binding)
    require(ticket.get("schemaVersion") == TRAINING_TICKET_SCHEMA
            and ticket.get("status") == "issued_single_use"
            and ticket.get("capabilityVersion") == CAPABILITY
            and ticket.get("trainingAllowed") is True
            and ticket.get("automaticRetries") == 0,
            "single-use training ticket required")
    package_binding = _binding(ticket.get("executionPackage"), "execution package")
    package = reader.json(package_binding)
    require(package.get("schemaVersion") == PACKAGE_SCHEMA
            and package.get("status") == "issued_single_attempt"
            and package.get("capabilityVersion") == CAPABILITY,
            "current candidate execution package required")
    run_id, package_id = package.get("runId"), package.get("packageId")
    require(all(isinstance(value, str) and 8 <= len(value) <= 128
                and all(character.isalnum() or character in "_-" for character in value)
                for value in (run_id, package_id)),
            "invalid run or package identity")
    require(package.get("resourceBudget") == RESOURCE_CEILING
            and package.get("trainingPlan") == {
                "epochs": 48, "trainRows": 48, "validationRows": 8,
                "eligibleCheckpointEpochs": [24, 36, 48],
                "generatorOptimizerSteps": 2304,
                "discriminatorOptimizerSteps": 2304,
                "historicalCheckpointLoaded": False,
            }
            and package.get("trainingIntent") == "bounded_once"
            and package.get("trainingAllowed") is False
            and package.get("formalStage4QualificationAllowed") is False
            and package.get("runtimePublicationAllowed") is False,
            "execution package training/resource boundary differs")
    programs = package.get("programBindings")
    require(isinstance(programs, Mapping)
            and _binding(programs.get("worker"), "worker")["path"] == WORKER_PATH
            and _binding(programs.get("workerTests"), "worker tests")["path"] == TEST_PATH,
            "worker program bindings differ")
    require(set(REQUIRED_PROGRAM_PATHS).issubset(
                {binding.get("path") for binding in programs.values()
                 if isinstance(binding, Mapping)}),
            "current V24 worker dependency bindings are incomplete")
    for binding in programs.values():
        reader.read(_binding(binding, "program"))

    candidate_binding = _binding(package.get("candidateContract"), "candidate contract")
    candidate = reader.json(candidate_binding)
    validate_candidate_contract(candidate)
    for binding in candidate["frozenBindings"].values():
        reader.read(dict(binding))
    require(package.get("datasetManifest")
            == candidate["frozenBindings"]["datasetManifest"]
            and package.get("trainSplit") == candidate["frozenBindings"]["trainSplit"]
            and package.get("validationSplit")
                == candidate["frozenBindings"]["validationSplit"],
            "execution package dataset/split bindings differ")
    frozen_train = reader.json(candidate["frozenBindings"]["trainSplit"])
    expected_train_ids = frozen_train.get("sampleIds")
    require(isinstance(expected_train_ids, list)
            and len(expected_train_ids) == TRAIN_ROWS
            and len(set(expected_train_ids)) == TRAIN_ROWS,
            "frozen train membership differs")
    output_root = package.get("outputRoot")
    require(isinstance(output_root, str)
            and output_root.startswith(".runtime/ai-painter/")
            and all(part not in ("", ".", "..") for part in output_root.split("/"))
            and "\\" not in output_root,
            "isolated execution output root required")
    consumption_claim_path = ticket.get("consumptionClaimPath")
    require(consumption_claim_path == output_root + "/training-ticket-consumed.json",
            "single-use consumption claim path differs")
    execution = package.get("execution")
    require(isinstance(execution, Mapping)
            and execution.get("reviewPlan") == {
                "boundedDryReviewAllowed": True,
                "formalStage4QualificationAllowed": False,
                "runtimePublicationAllowed": False,
                "numericThresholdContract": candidate["frozenBindings"]["numericReview"],
                "detailThresholdContract": candidate["frozenBindings"]["detailReview"],
            }, "bound dry-review plan differs")
    require(ticket.get("runId") == run_id and ticket.get("packageId") == package_id,
            "training ticket package identity differs")
    gpu_binding = _binding(ticket.get("gpuQualification"), "GPU qualification")
    gpu = reader.json(gpu_binding)
    qualified_states = gpu.get("initialStateSha256")
    probe_cases = gpu.get("cases")
    case_ids = [row.get("case", {}).get("sampleId")
                for row in probe_cases] if isinstance(probe_cases, list) else []
    case_boundaries_valid = (isinstance(probe_cases, list)
        and len(probe_cases) == TRAIN_ROWS and case_ids == expected_train_ids
        and all(isinstance(sample_id, str) and sample_id for sample_id in case_ids)
        and all(row.get("passed") is True
            and row.get("optimizerCreated") is False
            and row.get("optimizerSteps") == {"generator": 0, "discriminator": 0}
            and row.get("generatorCandidate", {}).get("autogradGradCalls") == 4
            and row.get("discriminatorAutogradGradCalls") == 1
            and row.get("sourceTensorsUnchanged") is True
            and row.get("case", {}).get("split") == "train"
            and row.get("case", {}).get("trainOrdinal") == ordinal
            and isinstance(row.get("sourceTensorHashesBeforeAndAfter"), Mapping)
            and set(row["sourceTensorHashesBeforeAndAfter"])
                == {"image", "conditions"}
            and all(isinstance(digest, str) and len(digest) == 64
                    and all(character in "0123456789abcdef" for character in digest)
                    for digest in row["sourceTensorHashesBeforeAndAfter"].values())
            and row.get("initialStateSha256") == qualified_states
            and row.get("finalStateSha256") == qualified_states
            for ordinal, row in enumerate(probe_cases)))
    require(gpu.get("schemaVersion") == GPU_GATE_SCHEMA
            and gpu.get("status") == "current_candidate_zero_update_gpu_qualification_passed"
            and gpu.get("capabilityVersion") == CAPABILITY
            and gpu.get("runId") == run_id and gpu.get("packageId") == package_id
            and gpu.get("executionPackage") == package_binding
            and gpu.get("candidateContract") == candidate_binding
            and gpu.get("historicalV24QualificationReused") is False
            and gpu.get("gpuInitialized") is True
            and gpu.get("optimizerCreated") is False
            and gpu.get("optimizerSteps") == {"generator": 0, "discriminator": 0}
            and gpu.get("checkpointLoaded") is False
            and gpu.get("checkpointWritten") is False
            and gpu.get("weightsModified") is False
            and gpu.get("caseCount") == TRAIN_ROWS
            and gpu.get("generatorAutogradGradCalls") == TRAIN_ROWS * 4
            and gpu.get("discriminatorAutogradGradCalls") == TRAIN_ROWS
            and isinstance(qualified_states, Mapping)
            and set(qualified_states) == {"Model", "Critic"}
            and all(isinstance(value, str) and len(value) == 64
                    and all(character in "0123456789abcdef" for character in value)
                    for value in qualified_states.values())
            and gpu.get("finalStateSha256") == qualified_states
            and case_boundaries_valid
            and gpu.get("trainingAllowedByThisArtifact") is False,
            "same-package current-candidate zero-update GPU qualification differs")

    require(package.get("managedExecutionRequired")
            == "javascript_managed_orchestration",
            "base package must require JS managed execution")
    lock_binding = _binding(ticket.get("managedLock"), "managed lock")
    launch_binding = _binding(ticket.get("launchIdentity"), "launch identity")
    lock, launch = reader.json(lock_binding), reader.json(launch_binding)
    require(lock.get("schemaVersion") == LOCK_SCHEMA
            and lock.get("status") == "active_bound_single_attempt"
            and lock.get("runId") == run_id and lock.get("packageId") == package_id
            and lock.get("executionPackage") == package_binding
            and lock.get("resourceBudget") == RESOURCE_CEILING,
            "managed lock evidence differs")
    require(launch.get("schemaVersion") == LAUNCH_SCHEMA
            and launch.get("status") == "managed_supervisor_identity_verified"
            and launch.get("runId") == run_id and launch.get("packageId") == package_id
            and launch.get("executionPackage") == package_binding
            and launch.get("managedLock") == lock_binding
            and type(launch.get("processId")) is int and launch["processId"] > 0
            and isinstance(launch.get("processStartIdentity"), str)
            and launch["processStartIdentity"].startswith(
                str(launch["processId"]) + ":"),
            "managed worker launch identity differs")
    process_chain = None
    if check_process:
        supervisor_pid = launch["processId"]
        supervisor_identity = launch["processStartIdentity"]
        require(managed_worker.process_identity(supervisor_pid) == supervisor_identity,
                "managed JS supervisor exited or PID was reused")
        rows = managed_worker.read_process_chain(os.getpid(), supervisor_pid)
        managed_worker.validate_process_chain(
            rows, supervisor_pid, supervisor_identity)
        require(rows == managed_worker.read_process_chain(os.getpid(), supervisor_pid),
                "managed supervisor process chain changed during authentication")
        process_chain = tuple(tuple(sorted(row.items())) for row in rows)
    reader.unchanged()
    sources = tuple({"path": path, "sha256": digest}
                    for path, digest in reader.observed.items())
    return _AuthenticatedTrainingGate(package_binding, candidate_binding,
                                      run_id, package_id, output_root,
                                      ticket_binding, consumption_claim_path,
                                      process_chain, qualified_states, sources)


def consume_training_ticket(authenticated, *, root=ROOT,
                            capability=CAPABILITY,
                            claim_schema="ai-painter-stage4-mvp256-dry-v24-ticket-consumption-v1"):
    """Atomically consume a verified ticket before CUDA or optimizer creation."""
    require(isinstance(authenticated, _AuthenticatedTrainingGate),
            "authenticated training ticket required")
    directory = v24.core.cpu.project_file(root, authenticated.output_root)
    require(directory.is_dir(), "managed output directory must already exist")
    terminal = directory / "phase-terminal.json"
    progress = directory / "progress.json"
    claim_path = v24.core.cpu.project_file(root, authenticated.consumption_claim_path)
    require(not terminal.exists() and not progress.exists() and not claim_path.exists(),
            "training ticket already consumed or output already started")
    claim = {"schemaVersion": claim_schema,
        "status": "consumed_no_retry", "capabilityVersion": capability,
        "runId": authenticated.run_id, "packageId": authenticated.package_id,
        "executionPackage": authenticated.package_binding,
        "trainingTicket": authenticated.ticket_binding,
        "optimizerCreatedAtConsumption": False,
        "gpuInitializedAtConsumption": False}
    data = (json.dumps(claim, ensure_ascii=False, indent=2,
                       allow_nan=False) + "\n").encode("utf8")
    # "xb" is the worker-side atomic single-consumer primitive.  The JS layer
    # also owns the managed lock and directory, but repeated Python entry cannot
    # pass this create-new operation even if called in the same process.
    with claim_path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    binding = {"path": authenticated.consumption_claim_path,
               "sha256": hashlib.sha256(data).hexdigest()}
    return _ConsumedTrainingGate(authenticated, binding)


def _validate_order(order):
    require(isinstance(order, Sequence) and not isinstance(order, str)
            and len(order) == 23 and len(set(order)) == 23
            and all(role in order for role in OBJECT_CHANNELS),
            "complete 23-channel order with four natural object roles required")
    return tuple(order)


@contextmanager
def _preserve_rng_and_mode(model):
    torch_state = torch.get_rng_state().clone()
    cuda_states = torch.cuda.get_rng_state_all() if torch.cuda.is_initialized() else None
    flags = tuple((module, bool(module.training)) for module in model.modules())
    try:
        yield
    finally:
        torch.set_rng_state(torch_state)
        if cuda_states is not None:
            torch.cuda.set_rng_state_all(cuda_states)
        for module, training in flags:
            module.training = training


def validation_observation(model, sample, channel_order, *, epoch):
    """Measure one bound validation image without gradients or state changes."""
    require(epoch in ELIGIBLE_EPOCHS, "ineligible validation checkpoint epoch")
    order = _validate_order(channel_order)
    require(isinstance(sample, Mapping) and sample.get("split") == "validation"
            and isinstance(sample.get("sampleId"), str) and sample["sampleId"],
            "checkpoint selection requires a bound validation sample")
    device = next(model.parameters()).device
    before = v24.core.cpu.state_hash(model)
    with _preserve_rng_and_mode(model), torch.no_grad():
        model.eval()
        conditions = sample.get("conditions")
        target = sample.get("image")
        require(isinstance(conditions, torch.Tensor)
                and conditions.shape == (23, 192, 256)
                and isinstance(target, torch.Tensor)
                and target.shape == (3, 192, 256),
                "validation tensors have wrong shape")
        bound = {**sample, "conditions": conditions.detach().to(device),
                 "image": target.detach().to(device)}
        predicted = model(bound["conditions"][None], sample["objectInstanceTable"])
        _, correlations = original_object_class_spatial_loss(
            predicted, bound, order, split="validation")
        rgb_mae = float((predicted[0].float() - bound["image"].float()).abs().mean())
        result_correlations = {}
        for role in OBJECT_CHANNELS:
            value = correlations.get(role)
            result_correlations[role] = None if value is None else float(value)
    require(v24.core.cpu.state_hash(model) == before,
            "validation changed model parameters or buffers")
    require(math.isfinite(rgb_mae) and 0 <= rgb_mae <= 1,
            "invalid validation RGB MAE")
    for role, value in result_correlations.items():
        require(value is None or (math.isfinite(value) and -1 <= value <= 1),
                "invalid validation correlation: " + role)
    return {"sampleId": sample["sampleId"], "split": "validation",
            "epoch": epoch, "fullRgbMae": rgb_mae,
            "objectCorrelations": result_correlations}


def rank_validation_epoch(observations, expected_validation_ids, *, epoch):
    """Apply the frozen three-level rank to exactly eight ordered rows."""
    require(epoch in ELIGIBLE_EPOCHS, "ineligible checkpoint-selection epoch")
    require(isinstance(expected_validation_ids, Sequence)
            and not isinstance(expected_validation_ids, str)
            and len(expected_validation_ids) == VALIDATION_ROWS
            and len(set(expected_validation_ids)) == VALIDATION_ROWS
            and all(isinstance(value, str) and value
                    for value in expected_validation_ids),
            "frozen eight validation identities required")
    require(isinstance(observations, Sequence)
            and len(observations) == VALIDATION_ROWS,
            "exactly eight validation observations required")
    require(all(isinstance(row, Mapping) for row in observations)
            and [row.get("sampleId") for row in observations]
                == list(expected_validation_ids),
            "validation identity or order differs")
    coverage = {role: 0 for role in OBJECT_CHANNELS}
    correlations, maes = [], []
    for row in observations:
        require(row.get("split") == "validation"
                and type(row.get("epoch")) is int and row["epoch"] == epoch,
                "validation split or epoch differs")
        mae = row.get("fullRgbMae")
        require(_finite_number(mae) and 0 <= mae <= 1,
                "invalid validation RGB MAE")
        maes.append(float(mae))
        values = row.get("objectCorrelations")
        require(isinstance(values, Mapping)
                and set(values) == set(OBJECT_CHANNELS),
                "four-class validation correlation map differs")
        for role in OBJECT_CHANNELS:
            value = values[role]
            if value is None:
                continue
            require(_finite_number(value) and -1 <= value <= 1,
                    "invalid applicable object correlation")
            coverage[role] += 1
            correlations.append(float(value))
    require(all(count > 0 for count in coverage.values()),
            "validation lacks one or more natural object classes")
    worst, mean_mae = min(correlations), sum(maes) / VALIDATION_ROWS
    return {"epoch": epoch,
            "worstApplicableObjectCorrelation": worst,
            "meanValidationRgbMae": mean_mae,
            "applicableImageCounts": coverage,
            "rank": [worst, -mean_mae, -epoch],
            "qualificationGranted": False,
            "checkpointPromotionEligible": False}


def _validated_rank(value):
    require(isinstance(value, Mapping)
            and value.get("qualificationGranted") is False
            and value.get("checkpointPromotionEligible") is False,
            "invalid checkpoint rank boundary")
    epoch = value.get("epoch")
    worst = value.get("worstApplicableObjectCorrelation")
    mean_mae = value.get("meanValidationRgbMae")
    coverage = value.get("applicableImageCounts")
    require(epoch in ELIGIBLE_EPOCHS
            and _finite_number(worst) and -1 <= worst <= 1
            and _finite_number(mean_mae) and 0 <= mean_mae <= 1
            and isinstance(coverage, Mapping)
            and set(coverage) == set(OBJECT_CHANNELS)
            and all(type(count) is int and 1 <= count <= VALIDATION_ROWS
                    for count in coverage.values())
            and value.get("rank") == [worst, -mean_mae, -epoch],
            "checkpoint rank fields disagree")
    return tuple(value["rank"])


def prefer_checkpoint(candidate, incumbent):
    """Return true only for a better later eligible candidate."""
    candidate_rank = _validated_rank(candidate)
    if incumbent is None:
        return True
    incumbent_rank = _validated_rank(incumbent)
    require(candidate["epoch"] > incumbent["epoch"],
            "checkpoint candidates must advance through eligible epochs")
    return candidate_rank > incumbent_rank


def validation_epoch(model, samples, channel_order, *, epoch):
    require(isinstance(samples, Sequence) and len(samples) == VALIDATION_ROWS,
            "exactly eight validation samples required")
    identities = [sample.get("sampleId") if isinstance(sample, Mapping) else None
                  for sample in samples]
    require(len(set(identities)) == VALIDATION_ROWS and all(identities),
            "validation identities must be unique")
    before = v24.core.cpu.state_hash(model)
    observations = [validation_observation(model, sample, channel_order, epoch=epoch)
                    for sample in samples]
    require(v24.core.cpu.state_hash(model) == before,
            "validation epoch changed model state")
    return rank_validation_epoch(observations, identities, epoch=epoch), observations


def _cpu_state_dict(network):
    return {name: value.detach().cpu().clone()
            for name, value in network.state_dict().items()}


def serialize_checkpoint(model, critic, *, epoch, selection,
                         execution_package, candidate_contract,
                         identity=V24_IDENTITY):
    """Serialize one non-promotable eligible Checkpoint without optimizer state."""
    _validated_rank(selection)
    require(selection["epoch"] == epoch and epoch in ELIGIBLE_EPOCHS,
            "checkpoint epoch and selection differ")
    require(isinstance(execution_package, Mapping)
            and set(execution_package) == {"path", "sha256"}
            and isinstance(candidate_contract, Mapping)
            and set(candidate_contract) == {"path", "sha256"},
            "bound package and candidate identities required")
    model_state, critic_state = _cpu_state_dict(model), _cpu_state_dict(critic)
    model_hash = nested_state_hash(model_state)
    critic_hash = nested_state_hash(critic_state)
    payload = {"schemaVersion": identity["checkpointSchema"],
        "capabilityVersion": identity["capability"],
        "executionPackage": dict(execution_package),
        "candidateContract": dict(candidate_contract),
        "epoch": epoch,
        "optimizerSteps": {"generator": epoch * TRAIN_ROWS,
                           "discriminator": epoch * TRAIN_ROWS},
        "checkpointSelection": dict(selection),
        "modelStateSha256": model_hash,
        "criticStateSha256": critic_hash,
        "modelState": model_state,
        "criticState": critic_state,
        "historicalCheckpointLoaded": False,
        "checkpointPromotable": False,
        "automaticResumeAllowed": False,
        "qualificationGranted": False}
    stream = io.BytesIO()
    torch.save(payload, stream)
    return stream.getvalue(), {"Model": model_hash, "Critic": critic_hash}


def reload_checkpoint_exact(payload_bytes, *, expected_epoch, expected_selection,
                            execution_package, candidate_contract, channel_order,
                            network_factory=v24.fresh_networks,
                            identity=V24_IDENTITY):
    """Safely reload an eligible Checkpoint into fresh CPU networks and rehash it."""
    saved = torch.load(io.BytesIO(payload_bytes), map_location="cpu", weights_only=True)
    require(saved.get("schemaVersion") == identity["checkpointSchema"]
            and saved.get("capabilityVersion") == identity["capability"]
            and saved.get("executionPackage") == execution_package
            and saved.get("candidateContract") == candidate_contract
            and saved.get("epoch") == expected_epoch
            and saved.get("checkpointSelection") == expected_selection
            and saved.get("optimizerSteps") == {
                "generator": expected_epoch * TRAIN_ROWS,
                "discriminator": expected_epoch * TRAIN_ROWS}
            and saved.get("historicalCheckpointLoaded") is False
            and saved.get("checkpointPromotable") is False
            and saved.get("automaticResumeAllowed") is False
            and saved.get("qualificationGranted") is False,
            "selected checkpoint metadata differs")
    _validated_rank(saved["checkpointSelection"])
    require(saved["checkpointSelection"]["epoch"] == expected_epoch,
            "selected checkpoint rank epoch differs")
    with _preserve_global_rng():
        model, critic = network_factory(_validate_order(channel_order))
    model.load_state_dict(saved["modelState"], strict=True)
    critic.load_state_dict(saved["criticState"], strict=True)
    observed = {"Model": nested_state_hash(_cpu_state_dict(model)),
                "Critic": nested_state_hash(_cpu_state_dict(critic))}
    require(observed == {"Model": saved.get("modelStateSha256"),
                         "Critic": saved.get("criticStateSha256")},
            "selected checkpoint state hash differs after exact reload")
    return model, critic, observed


@contextmanager
def _preserve_global_rng():
    state = torch.get_rng_state().clone()
    cuda_states = torch.cuda.get_rng_state_all() if torch.cuda.is_initialized() else None
    try:
        yield
    finally:
        torch.set_rng_state(state)
        if cuda_states is not None:
            torch.cuda.set_rng_state_all(cuda_states)


def _validate_samples(train_samples, validation_samples):
    require(isinstance(train_samples, Sequence) and len(train_samples) == TRAIN_ROWS
            and isinstance(validation_samples, Sequence)
            and len(validation_samples) == VALIDATION_ROWS,
            "frozen 48 train and 8 validation samples required")
    for split, samples in (("train", train_samples),
                           ("validation", validation_samples)):
        ids = []
        for sample in samples:
            require(isinstance(sample, Mapping) and sample.get("split") == split
                    and isinstance(sample.get("sampleId"), str)
                    and sample["sampleId"], "cross-split or unidentified sample")
            ids.append(sample["sampleId"])
        require(len(set(ids)) == len(ids), "duplicate sample identity: " + split)


def _progress_value(consumed, *, actual_epoch, completed_epochs, counts,
                    phase, selected=None, latest_checkpoint=None,
                    identity=V24_IDENTITY):
    authenticated = consumed.authenticated
    return {"schemaVersion": identity["progressSchema"],
        "status": "bounded_training_progress_not_formal_qualified",
        "executionState": phase,
        "capabilityVersion": identity["capability"],
        "runId": authenticated.run_id, "packageId": authenticated.package_id,
        "actualEpoch": actual_epoch, "completedEpochs": completed_epochs,
        "optimizerStepsGenerator": counts["generator"],
        "optimizerStepsDiscriminator": counts["discriminator"],
        "latestCheckpoint": latest_checkpoint,
        "selectedEpoch": None if selected is None else selected["epoch"],
        "selectedRank": None if selected is None else selected["selection"]["rank"],
        "selectedCheckpoint": None if selected is None else selected["checkpoint"],
        "challengeContentRead": False, "regressionContentRead": False,
        "checkpointPromotable": False,
        "formalStage4QualificationAllowed": False,
        "stage4QualificationGranted": False,
        "runtimePublicationAllowed": False,
        "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


def _publish_progress(consumed, value, *, root=ROOT):
    require(isinstance(consumed, _ConsumedTrainingGate),
            "consumed ticket required for progress publication")
    target = v24.core.cpu.project_file(
        root, consumed.authenticated.output_root + "/progress.json")
    encoded = (json.dumps(value, ensure_ascii=False, indent=2,
                          allow_nan=False) + "\n").encode("utf8")
    temporary = target.with_name(
        target.name + ".staged-" + hashlib.sha256(
            encoded + os.urandom(16)).hexdigest()[:24])
    with temporary.open("xb") as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, target)
    return value


def bounded_training_loop(*, train_samples, validation_samples, channel_order,
                          training_gate, resource_check,
                          checkpoint_sink, device,
                          network_factory=v24.fresh_networks,
                          pair_runner=v24.perform_pair, artifact_root=ROOT,
                          identity=V24_IDENTITY,
                          _progress_state=None):
    """Execute the fixed 48-epoch loop after controller authentication.

    Only train rows reach ``pair_runner``.  Validation is read at epochs
    24/36/48, never supplies a gradient, and only ranks those three snapshots.
    The function has no checkpoint input, so historical V24 weights cannot
    initialize this candidate.
    """
    require(isinstance(training_gate, _ConsumedTrainingGate),
            "atomically consumed same-package training ticket required")
    authenticated = training_gate.authenticated
    execution_package = authenticated.package_binding
    candidate_contract = authenticated.candidate_binding
    _validate_samples(train_samples, validation_samples)
    order = _validate_order(channel_order)
    require(callable(resource_check) and callable(checkpoint_sink),
            "resource and checkpoint sinks required")
    require(isinstance(device, torch.device) and device.type == "cuda",
            "bounded training requires a controller-qualified CUDA device")
    torch.set_num_threads(RESOURCE_CEILING["cpuThreads"])
    with _preserve_global_rng():
        torch.manual_seed(MODEL_SEED)
        model, critic = network_factory(order)
    require({"Model": v24.core.cpu.state_hash(model),
             "Critic": v24.core.cpu.state_hash(critic)}
            == authenticated.qualified_initial_state_sha256,
            "fresh training state differs from current-candidate GPU gate")
    model.to(device)
    critic.to(device)
    optimizer_arguments = {"betas": (0.9, 0.999), "eps": 1e-8,
                           "weight_decay": 0.01, "foreach": False, "fused": False}
    generator_optimizer = torch.optim.AdamW(
        model.parameters(), lr=0.0001, **optimizer_arguments)
    critic_optimizer = torch.optim.AdamW(
        critic.parameters(), lr=0.0001, **optimizer_arguments)
    counts = {"generator": 0, "discriminator": 0}
    if _progress_state is not None:
        _progress_state["optimizerSteps"] = counts
    selected = None
    checkpoint_records = []
    checkpoint_bytes = 0
    artifact_reader = v24.core.cpu.BoundReader(artifact_root)
    source_hashes = {
        split: [{"sampleId": sample["sampleId"],
                 "image": v24.core.cpu.tensor_hash(sample["image"]),
                 "conditions": v24.core.cpu.tensor_hash(sample["conditions"])}
                for sample in samples]
        for split, samples in (("train", train_samples),
                               ("validation", validation_samples))}
    if _progress_state is not None:
        _progress_state.update(actualEpoch=0, completedEpochs=0,
                               selected=None, latestCheckpoint=None)
    initial_progress = _progress_value(
        training_gate, actual_epoch=0, completed_epochs=0, counts=counts,
        phase="executing", identity=identity)
    _publish_progress(training_gate, initial_progress, root=artifact_root)
    if _progress_state is not None:
        _progress_state["latestProgress"] = initial_progress

    def forward(_kind, sample):
        return model(sample["conditions"][None], sample["objectInstanceTable"])

    for epoch in range(1, MAX_EPOCHS + 1):
        if _progress_state is not None:
            _progress_state["actualEpoch"] = epoch
        resource_check()
        indices = list(range(TRAIN_ROWS))
        random.Random(MODEL_SEED + epoch).shuffle(indices)
        for ordinal in indices:
            sample = train_samples[ordinal]
            row = {"sampleId": sample["sampleId"], "generator": 0,
                   "discriminator": 0}
            pair_runner(model, critic, sample, order, generator_optimizer,
                        critic_optimizer, counts, row, resource_check, forward)
            require(row == {"sampleId": sample["sampleId"], "generator": 1,
                            "discriminator": 1},
                    "one-pair optimizer ledger differs")
        require(counts == {"generator": epoch * TRAIN_ROWS,
                           "discriminator": epoch * TRAIN_ROWS},
                "epoch optimizer counts differ")
        if _progress_state is not None:
            _progress_state["completedEpochs"] = epoch
        latest_checkpoint = None
        if epoch in ELIGIBLE_EPOCHS:
            selection, observations = validation_epoch(
                model, validation_samples, order, epoch=epoch)
            payload, state_hashes = serialize_checkpoint(
                model, critic, epoch=epoch, selection=selection,
                execution_package=execution_package,
                candidate_contract=candidate_contract, identity=identity)
            payload_sha = hashlib.sha256(payload).hexdigest()
            checkpoint_bytes += len(payload)
            require(checkpoint_bytes <= RESOURCE_CEILING["maxOutputMiB"] * 1024 * 1024,
                    "checkpoint output budget exhausted")
            checkpoint_binding = _binding(
                checkpoint_sink(epoch, payload, selection, state_hashes),
                "checkpoint")
            require(checkpoint_binding["sha256"] == payload_sha,
                    "checkpoint sink binding SHA differs from serialized bytes")
            require(artifact_reader.read(checkpoint_binding) == payload,
                    "persisted checkpoint bytes differ")
            record = {"epoch": epoch, "selection": selection,
                      "checkpoint": checkpoint_binding, "checkpointSha256": payload_sha,
                      "stateSha256": state_hashes,
                      "validation": observations}
            checkpoint_records.append(record)
            latest_checkpoint = checkpoint_binding
            if prefer_checkpoint(selection, None if selected is None
                                 else selected["selection"]):
                selected = dict(record)
        progress = _progress_value(
            training_gate, actual_epoch=epoch, completed_epochs=epoch,
            counts=counts, phase="executing", selected=selected,
            latest_checkpoint=latest_checkpoint, identity=identity)
        _publish_progress(training_gate, progress, root=artifact_root)
        if _progress_state is not None:
            _progress_state.update(completedEpochs=epoch, selected=selected,
                                   latestCheckpoint=latest_checkpoint,
                                   latestProgress=progress)
    require(counts == {"generator": MAX_STEPS, "discriminator": MAX_STEPS}
            and len(checkpoint_records) == len(ELIGIBLE_EPOCHS)
            and selected is not None,
            "bounded training or checkpoint set incomplete")
    for split, samples in (("train", train_samples),
                           ("validation", validation_samples)):
        require(source_hashes[split] == [
            {"sampleId": sample["sampleId"],
             "image": v24.core.cpu.tensor_hash(sample["image"]),
             "conditions": v24.core.cpu.tensor_hash(sample["conditions"])}
            for sample in samples], "source tensors changed: " + split)
    _, _, reloaded_hashes = reload_checkpoint_exact(
        artifact_reader.read(selected["checkpoint"]),
        expected_epoch=selected["epoch"],
        expected_selection=selected["selection"],
        execution_package=execution_package,
        candidate_contract=candidate_contract, channel_order=order,
        network_factory=network_factory, identity=identity)
    require(reloaded_hashes == selected["stateSha256"],
            "selected checkpoint exact reload differs")
    completed_progress = _progress_value(
        training_gate, actual_epoch=MAX_EPOCHS, completed_epochs=MAX_EPOCHS,
        counts=counts, phase="checkpoint_selected_review_pending",
        selected=selected, latest_checkpoint=selected["checkpoint"],
        identity=identity)
    _publish_progress(training_gate, completed_progress, root=artifact_root)
    if _progress_state is not None:
        _progress_state["latestProgress"] = completed_progress
    return {"status": "training_completed_review_pending",
            "capabilityVersion": identity["capability"],
            "runId": authenticated.run_id,
            "packageId": authenticated.package_id,
            "executionPackage": execution_package,
            "candidateContract": candidate_contract,
            "trainingTicketConsumption": training_gate.consumption_claim,
            "optimizerSteps": counts,
            "optimizerStepsGenerator": counts["generator"],
            "optimizerStepsDiscriminator": counts["discriminator"],
            "completedEpochs": MAX_EPOCHS,
            "eligibleCheckpointEpochs": list(ELIGIBLE_EPOCHS),
            "checkpointBytesWritten": checkpoint_bytes,
            "checkpoints": checkpoint_records,
            "selectedCheckpoint": selected["checkpoint"],
            "selectedCheckpointRecord": selected,
            "selectedEpoch": selected["epoch"],
            "selectedRank": selected["selection"]["rank"],
            "selectedCheckpointBinding": selected["checkpoint"],
            "selectedModelStateSha256": selected["stateSha256"]["Model"],
            "selectedCriticStateSha256": selected["stateSha256"]["Critic"],
            "checkpointReloadVerified": True,
            "challengeContentRead": False,
            "regressionContentRead": False,
            "historicalCheckpointLoaded": False,
            "qualificationGranted": False,
            "checkpointPromotionEligible": False,
            "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False,
            "formalStage4Qualification": False,
            "stage4QualificationGranted": False,
            "runtimePublication": False,
            "runtimePublicationAllowed": False}


def run_with_terminal_boundary(*, terminal_sink, **training_arguments):
    """Emit exactly one completed or failed-closed terminal record."""
    require(callable(terminal_sink), "terminal sink required")
    progress = {"optimizerSteps": {"generator": 0, "discriminator": 0}}
    gate = training_arguments.get("training_gate")
    identity = training_arguments.get("identity", V24_IDENTITY)
    try:
        result = bounded_training_loop(**training_arguments,
                                       _progress_state=progress)
        terminal = {"schemaVersion": identity["terminalSchema"],
                    "executionState": "completed", **result}
    except Exception as error:
        counts = progress["optimizerSteps"]
        latest_progress = progress.get("latestProgress")
        progress_publication_error = None
        if isinstance(gate, _ConsumedTrainingGate):
            failure_progress = _progress_value(
                gate, actual_epoch=progress.get("actualEpoch", 0),
                completed_epochs=min(counts.values()) // TRAIN_ROWS,
                counts=counts, phase="failed_closed",
                selected=progress.get("selected"),
                latest_checkpoint=progress.get("latestCheckpoint"),
                identity=identity)
            try:
                _publish_progress(gate, failure_progress,
                    root=training_arguments.get("artifact_root", ROOT))
                latest_progress = failure_progress
            except Exception as progress_error:
                progress_publication_error = str(progress_error)
        terminal = {"schemaVersion": identity["terminalSchema"],
            "status": "experiment_failed_closed",
            "executionState": "failed_closed",
            "capabilityVersion": identity["capability"],
            "runId": (gate.authenticated.run_id
                      if isinstance(gate, _ConsumedTrainingGate) else None),
            "packageId": (gate.authenticated.package_id
                          if isinstance(gate, _ConsumedTrainingGate) else None),
            "errorType": type(error).__name__, "error": str(error),
            "optimizerSteps": counts,
            "optimizerStepsGenerator": counts["generator"],
            "optimizerStepsDiscriminator": counts["discriminator"],
            "latestProgress": latest_progress,
            "progressPublicationError": progress_publication_error,
            "challengeContentRead": False, "regressionContentRead": False,
            "formalStage4QualificationAllowed": False,
            "formalStage4Qualification": False,
            "stage4QualificationGranted": False,
            "checkpointPromotionEligible": False,
            "checkpointPromotable": False,
            "qualificationGranted": False,
            "runtimePublication": False,
            "runtimePublicationAllowed": False}
    terminal_sink(terminal)
    return terminal


def load_bound_train_and_validation(consumed, *, root=ROOT):
    """Decode only the bound train/validation tensors after ticket consumption."""
    require(isinstance(consumed, _ConsumedTrainingGate),
            "consumed training ticket required before tensor loading")
    authenticated = consumed.authenticated
    reader = v24.core.cpu.BoundReader(root)
    package = reader.json(authenticated.package_binding)
    candidate = reader.json(authenticated.candidate_binding)
    if "predecessorCandidate" in candidate:
        candidate = reader.json(_binding(candidate["predecessorCandidate"],
                                      "predecessor data candidate"))
        validate_candidate_contract(candidate)
    manifest, order, continuous, _, _memberships = v24.core.cpu.select_rows(reader)
    require(package["datasetManifest"] == candidate["frozenBindings"]["datasetManifest"]
            and manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4},
            "bound dataset release differs")
    source = reader.json(manifest["sourceIndex"])
    by_id = {row["sampleId"]: row for row in source["samples"]}
    samples, identities = {}, {}
    for split, expected_count in (("train", TRAIN_ROWS),
                                  ("validation", VALIDATION_ROWS)):
        split_binding = candidate["frozenBindings"][split + "Split"]
        split_release = reader.json(split_binding)
        ids = split_release.get("sampleIds")
        require(isinstance(ids, list) and len(ids) == expected_count
                and len(set(ids)) == expected_count,
                "bound split membership differs: " + split)
        samples[split], identities[split] = [], []
        for ordinal, sample_id in enumerate(ids):
            row = by_id[sample_id]
            require(row.get("split") == split,
                    "cross-split source metadata differs")
            sample, identity = v24.core.cpu.load_sample(
                reader, row, order, continuous)
            require(sample.get("split") == split
                    and sample.get("sampleId") == sample_id,
                    "decoded sample identity differs")
            samples[split].append(sample)
            identities[split].append({**identity, "ordinal": ordinal})
    reader.unchanged()
    return samples["train"], samples["validation"], order, identities


class RuntimeResourceGuard:
    """Worker-side enforcement beneath the JS managed resource contract."""
    def __init__(self, consumed, *, root=ROOT, started=None,
                 authenticator=authenticate_training_gate):
        require(isinstance(consumed, _ConsumedTrainingGate),
                "consumed training ticket required")
        self.consumed = consumed
        self.root = Path(root)
        self.directory = v24.core.cpu.project_file(
            self.root, consumed.authenticated.output_root)
        self.started = time.monotonic() if started is None else started
        self.last_thermal = 0.0
        self.last_process = 0.0
        self.authenticator = authenticator

    def _common(self):
        require(time.monotonic() - self.started
                < RESOURCE_CEILING["maxWallSeconds"],
                "training wall time exhausted")
        require(shutil.disk_usage(self.directory).free
                >= RESOURCE_CEILING["minimumFreeDiskMiB"] * 1024 * 1024,
                "free disk below floor")
        size = sum(path.stat().st_size for path in self.directory.rglob("*")
                   if path.is_file())
        require(size <= RESOURCE_CEILING["maxOutputMiB"] * 1024 * 1024,
                "managed output budget exhausted")
        now = time.monotonic()
        if now - self.last_process >= 10:
            authenticated = self.consumed.authenticated
            require(authenticated.supervisor_process_chain is not None,
                    "live supervisor chain was not authenticated")
            # Re-authenticate the immutable ticket and the live parent process.
            self.authenticator(
                authenticated.ticket_binding, root=self.root, check_process=True)
            self.last_process = now

    def pre_cuda(self):
        self._common()

    def __call__(self):
        self._common()
        torch.cuda.synchronize(0)
        free, total = torch.cuda.mem_get_info(0)
        require(free >= RESOURCE_CEILING["minimumFreeVramMiB"] * 1024 * 1024,
                "free VRAM below floor")
        v24.core.gpu.check_memory(
            total=int(total), reserved=int(torch.cuda.max_memory_reserved(0)),
            allocated=int(torch.cuda.max_memory_allocated(0)),
            device_used=int(total - free),
            fraction=RESOURCE_CEILING["maxGpuMemoryFraction"])
        now = time.monotonic()
        if now - self.last_thermal >= 10:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=temperature.gpu",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(result.returncode == 0 and result.stdout.strip(),
                    "GPU temperature unavailable")
            temperature = int(result.stdout.strip().splitlines()[0])
            require(temperature <= RESOURCE_CEILING["maximumTemperatureC"],
                    "GPU temperature above ceiling")
            self.last_thermal = now


def _write_exclusive_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2,
                       allow_nan=False) + "\n").encode("utf8")
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def run_cli(training_ticket_binding, output_path):
    worker_started = time.monotonic()
    authenticated = authenticate_training_gate(training_ticket_binding)
    expected_output = authenticated.output_root + "/phase-terminal.json"
    require(output_path.replace("\\", "/") == expected_output,
            "CLI terminal path differs from bound output root")
    consumed = consume_training_ticket(authenticated)
    directory = v24.core.cpu.project_file(ROOT, authenticated.output_root)
    terminal_path = v24.core.cpu.project_file(ROOT, expected_output)

    def terminal_sink(value):
        _write_exclusive_json(terminal_path, value)

    try:
        guard = RuntimeResourceGuard(consumed, started=worker_started)
        guard.pre_cuda()
        train, validation, order, _identities = load_bound_train_and_validation(consumed)
        guard.pre_cuda()
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                "CUDA BF16 unavailable")
        device = torch.device("cuda:0")
        torch.cuda.set_device(device)
        torch.cuda.manual_seed_all(MODEL_SEED)
        free, total = torch.cuda.mem_get_info(device)
        allocation = (int(total * RESOURCE_CEILING["maxGpuMemoryFraction"])
                      - (total - free) - 64 * 1024 * 1024)
        require(allocation > 0
                and free >= RESOURCE_CEILING["minimumFreeVramMiB"] * 1024 * 1024,
                "insufficient VRAM below bounded allocation")
        torch.cuda.set_per_process_memory_fraction(allocation / total, device)
        torch.cuda.reset_peak_memory_stats(device)

        checkpoint_directory = directory / "checkpoints"
        checkpoint_directory.mkdir(exist_ok=False)

        def checkpoint_sink(epoch, payload, _selection, _state_hashes):
            relative = authenticated.output_root + f"/checkpoints/epoch-{epoch:02d}.pt"
            path = v24.core.cpu.project_file(ROOT, relative)
            with path.open("xb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            return {"path": relative, "sha256": hashlib.sha256(payload).hexdigest()}

        return run_with_terminal_boundary(
            terminal_sink=terminal_sink, train_samples=train,
            validation_samples=validation, channel_order=order,
            training_gate=consumed, resource_check=guard,
            checkpoint_sink=checkpoint_sink, device=device)
    except Exception as error:
        failure_progress = _progress_value(
            consumed, actual_epoch=0, completed_epochs=0,
            counts={"generator": 0, "discriminator": 0}, phase="failed_closed")
        progress_publication_error = None
        try:
            _publish_progress(consumed, failure_progress)
        except Exception as progress_error:
            failure_progress = None
            progress_publication_error = str(progress_error)
        terminal = {"schemaVersion": TERMINAL_SCHEMA,
            "status": "experiment_failed_closed", "executionState": "failed_closed",
            "capabilityVersion": CAPABILITY, "runId": authenticated.run_id,
            "packageId": authenticated.package_id,
            "executionPackage": authenticated.package_binding,
            "trainingTicketConsumption": consumed.consumption_claim,
            "errorType": type(error).__name__, "error": str(error),
            "optimizerStepsGenerator": 0, "optimizerStepsDiscriminator": 0,
            "latestProgress": failure_progress,
            "progressPublicationError": progress_publication_error,
            "challengeContentRead": False, "regressionContentRead": False,
            "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False,
            "formalStage4Qualification": False,
            "stage4QualificationGranted": False,
            "runtimePublication": False,
            "runtimePublicationAllowed": False}
        terminal_sink(terminal)
        return terminal


def cpu_preflight():
    candidate = load_candidate_contract()
    return {"status": "cpu_preflight_passed_training_not_started",
            "capabilityVersion": CAPABILITY,
            "candidateStatus": candidate["status"],
            "eligibleCheckpointEpochs": list(ELIGIBLE_EPOCHS),
            "trainingStarted": False, "gpuInitialized": False,
            "optimizerCreated": False, "checkpointLoaded": False,
            "checkpointWritten": False, "qualificationGranted": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--run", action="store_true")
    mode.add_argument("--cpu-preflight", action="store_true")
    parser.add_argument("--training-ticket")
    parser.add_argument("--training-ticket-sha256")
    parser.add_argument("--output")
    args = parser.parse_args(argv)
    if not args.run:
        require(not any((args.training_ticket, args.training_ticket_sha256, args.output)),
                "run arguments require --run")
        print(json.dumps(cpu_preflight(), ensure_ascii=False, allow_nan=False))
        return 0
    require(all((args.training_ticket, args.training_ticket_sha256, args.output)),
            "--run requires training ticket path, SHA, and output")
    result = run_cli(
        {"path": args.training_ticket.replace("\\", "/"),
         "sha256": args.training_ticket_sha256},
        args.output)
    print(json.dumps({"status": result["status"], "runId": result.get("runId"),
                      "packageId": result.get("packageId")},
                     ensure_ascii=False, allow_nan=False), flush=True)
    return 0 if result["status"] == "training_completed_review_pending" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed_before_ticket_consumption",
                          "errorType": type(error).__name__, "error": str(error)},
                         ensure_ascii=False, allow_nan=False),
              file=sys.stderr, flush=True)
        raise SystemExit(1)
