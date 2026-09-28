"""Fail-closed, bounded V16 Stage0 worker; this file grants no execution rights.

Only a separately activated immutable contract, independent CPU/GPU evidence,
and the current local execution registry can admit an optimizer. Train changes
both fresh networks; validation selects a checkpoint only. This worker never
reads challenge/regression or writes the registry/review/release state.
"""

from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import random
import sys
import time
from uuid import uuid4

import torch
import numpy as np
from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml/ai-painter/src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (  # noqa: E402
    build_conditional_texture_discriminator, discriminator_train_objective,
    generator_train_objective, validation_candidate_score,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
)
from ai_painter.complete_world.object_instance_supervision_cpu import iter_object_views  # noqa: E402
from ai_painter.complete_world.split_release import (  # noqa: E402
    bound_json, canonical_bytes, digest, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402


CAPABILITY = "stage4_mvp_native_rgb_conditional_texture_bf16_v16"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract.json"
)
CONTRACT_SCHEMA = "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract-v1"
PACKAGE_SCHEMA = "ai-painter-stage4-mvp-conditional-texture-bf16-v16-formal-stage-execution-package-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-conditional-texture-bf16-v16-checkpoint-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-conditional-texture-bf16-v16-training-terminal-v1"
OUTPUT_PREFIX = ".runtime/ai-painter/stage4-mvp-native-rgb-conditional-texture-bf16-v16-formal-executions/"
WORKER_PATH = "ml/ai-painter/scripts/train_stage4_mvp_conditional_texture_bf16_v16_stage0.py"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 24}
BUDGET = {"maxGpuMemoryFraction": 0.7, "maxEpochs": 24,
          "maxGeneratorSteps": 1152, "maxDiscriminatorSteps": 1152,
          "timeoutSeconds": 43200}
MODEL_PLAN = {"generatorBaseChannels": 48, "generatorPatchChannels": 32,
              "discriminatorConditionChannels": 23, "discriminatorBaseChannels": 24,
              "freshInitializationSeed": 20260927}
OPTIMIZER_PLAN = {"name": "AdamW", "generatorLearningRate": 0.0001,
                  "discriminatorLearningRate": 0.0001, "automaticMixedPrecision": True}
PRECISION_PLAN = {
    "generatorAutocast": "bfloat16", "discriminatorAutocast": "bfloat16",
    "gradientScaler": "disabled",
    "nonfiniteGradient": "fail_closed_with_network_parameter_sample_and_step",
    "optimizerUpdateSkipAllowed": False, "optimizer": "AdamW",
    "generatorLearningRate": 0.0001, "discriminatorLearningRate": 0.0001,
}
GRADIENT_SCALE = 1.0
RESPONSIBILITIES = {"road", "hydrology", "shoreline", "footprints",
                    "tree", "rock", "vegetation"}
CPU_STATUS = "cpu_readonly_accepted_execution_disabled"
GPU_STATUS = "readonly_gpu_qualification_passed_training_still_disabled"
CPU_QUALIFIER_PATH = "ml/ai-painter/scripts/check_stage4_mvp_conditional_texture_bf16_v16_cpu_acceptance.py"
GPU_QUALIFIER_PATH = "ml/ai-painter/scripts/run_stage4_mvp_conditional_texture_bf16_v16_readonly_gpu_qualification.py"
GPU_POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-conditional-texture-bf16-v16-readonly-gpu-policy-v1.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


class TrainingNumericsError(ValueError):
    """An exact, serializable fail-closed reason for one attempted update."""

    def __init__(self, *, network: str, parameter: str, sample_id: str,
                 attempted_step: int, kind: str):
        self.detail = {"network": network, "parameter": parameter,
                       "sampleId": sample_id, "attemptedStep": attempted_step,
                       "scale": GRADIENT_SCALE, "kind": kind}
        super().__init__("V16 " + kind + ": " + json.dumps(self.detail, sort_keys=True))


def failure_context(error: Exception, attempted: dict | None) -> dict | None:
    if attempted is None:
        return None
    return ({**attempted, **error.detail}
            if isinstance(error, TrainingNumericsError) else dict(attempted))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(logical: str) -> dict:
    return {"path": logical, "sha256": digest(project_file(ROOT, logical).read_bytes())}


def _sha(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(
        char in "0123456789abcdef" for char in value)


def write_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".staged-" + uuid4().hex)
    try:
        with temporary.open("x", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def write_exclusive(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def _program_bindings(package: dict, contract: dict) -> None:
    entries = package.get("programBindings")
    require(isinstance(entries, list) and entries, "V16 program bindings missing")
    paths = [entry.get("path") for entry in entries if isinstance(entry, dict)]
    require(len(paths) == len(entries) == len(set(paths))
            and WORKER_PATH in paths, "V16 worker binding missing or duplicated")
    required = contract.get("programBindings", {})
    require(isinstance(required, dict) and required, "V16 candidate program roles missing")
    for item in entries:
        require(item == bind(item["path"]), "V16 program bytes changed")
    for item in required.values():
        require(item == bind(item["path"]),
                "V16 candidate program bytes changed: " + item["path"])


def _review_alignment(contract: dict) -> None:
    review = contract.get("reviewBinding", {})
    require(review.get("alignmentQualified") is True
            and review.get("formalReviewDispatchable") is False
            and review.get("thresholdLoweringAllowed") is False,
            "V16 formal review alignment is not qualified")
    for key in ("thresholds", "minimumDetail"):
        read_bound(ROOT, review[key])
    require(isinstance(review.get("formalContract"), dict),
            "V16 independent formal review contract missing")
    read_bound(ROOT, review["formalContract"])
    rows = contract.get("trainingReviewAlignment")
    require(isinstance(rows, list) and len(rows) >= len(RESPONSIBILITIES)
            and {row.get("responsibilityId") for row in rows
                 if isinstance(row, dict)} >= RESPONSIBILITIES,
            "V16 seven review responsibilities not aligned")
    for row in rows:
        require(isinstance(row, dict)
                and isinstance(row.get("conditionChannelIds"), list)
                and row["conditionChannelIds"]
                and isinstance(row.get("objectiveTermIds"), list)
                and row["objectiveTermIds"]
                and row.get("formulaSha256") ==
                contract.get("lossContract", {}).get("formulaSha256")
                and row.get("responsibilityOutputIdentity")
                and row.get("formalReviewContractIdentity") ==
                "stage4-mvp-v16-stage0-review-contract-v1"
                and row.get("formalReviewContractSha256") ==
                review["formalContract"]["sha256"]
                and row.get("reviewMetricIds")
                and row.get("failureCodes")
                and row.get("positiveAlignmentTests")
                and row.get("negativeAlignmentTests"),
                "V16 review alignment has an incomplete responsibility")


def _qualification(package: dict, contract: dict, candidate_binding: dict) -> dict:
    cpu_binding, gpu_binding = package.get("cpuQualification"), package.get("gpuQualification")
    require(isinstance(cpu_binding, dict) and isinstance(gpu_binding, dict)
            and cpu_binding != gpu_binding
            and cpu_binding.get("path", "").startswith(
                ".runtime/ai-painter/stage4-mvp-conditional-texture-bf16-v16-cpu-acceptances/")
            and gpu_binding.get("path", "").startswith(
                ".runtime/ai-painter/stage4-mvp-conditional-texture-bf16-v16-gpu-qualifications/"),
            "V16 independent CPU/GPU bindings missing")
    cpu, gpu = bound_json(ROOT, cpu_binding), bound_json(ROOT, gpu_binding)
    manifest = contract["datasetBinding"]["manifest"]
    initials = ("initialModelStateSha256", "initialDiscriminatorStateSha256")
    require(cpu.get("schemaVersion") ==
            "stage4-mvp-conditional-texture-bf16-v16-formal-cpu-acceptance-v1"
            and gpu.get("schemaVersion") ==
            "stage4-mvp-conditional-texture-bf16-v16-readonly-gpu-report-v1"
            and cpu.get("status") == CPU_STATUS and gpu.get("status") == GPU_STATUS
            and cpu.get("capabilityVersion") == gpu.get("capabilityVersion") == CAPABILITY
            and cpu.get("precisionExecutionPlan") ==
            gpu.get("precisionExecutionPlan") == PRECISION_PLAN
            and cpu.get("candidateContract") == gpu.get("candidateContract") == candidate_binding
            and cpu.get("datasetManifest") == gpu.get("datasetManifest") == manifest
            and gpu.get("cpuQualification") == cpu_binding
            and cpu.get("formalReviewContract") == package.get("reviewContract")
            and cpu.get("acceptanceProgram") == bind(CPU_QUALIFIER_PATH)
            and cpu.get("acceptanceTests") == contract["programBindings"]["objectiveTests"]
            and cpu.get("alignmentRoles") ==
            ["road", "hydrology", "shoreline", "footprints", "tree", "rock", "vegetation"]
            and cpu.get("formulaSha256") == contract["lossContract"]["formulaSha256"]
            and cpu.get("trainSelectionSha256") ==
            contract["datasetBinding"]["trainSelectionSha256"]
            and cpu.get("validationSelectionSha256") ==
            contract["datasetBinding"]["validationSelectionSha256"]
            and cpu.get("independentAcceptance") is True
            and cpu.get("formalReviewAlignmentPassed") is True
            and cpu.get("cpuTestsPassed") is True
            and cpu.get("validationContentRead") is False
            and cpu.get("gpuUsed") is False
            and cpu.get("optimizerSteps") == gpu.get("optimizerSteps") == 0
            and cpu.get("trainingStarted") is False
            and gpu.get("trainingStarted") is False
            and gpu.get("weightsModified") is False
            and gpu.get("trainingAllowedByThisArtifact") is False
            and gpu.get("optimizerCreated") is False
            and gpu.get("checkpointWritten") is False
            and gpu.get("validationRead") is False
            and gpu.get("challengeRead") is False
            and gpu.get("regressionRead") is False
            and gpu.get("sampleIdentity", {}).get("split") == "train"
            and gpu.get("peakGpuReservedFraction", 1) <= BUDGET["maxGpuMemoryFraction"]
            and gpu.get("peakGpuReservedFraction", 0) > 0
            and all(_sha(cpu.get(key)) and cpu.get(key) == gpu.get(key)
                    for key in initials), "V16 independent CPU/GPU qualification invalid")
    require(package.get("formalInitializationSha256") == gpu[initials[0]]
            and package.get("formalDiscriminatorInitializationSha256") == gpu[initials[1]]
            and gpu.get("finalModelStateSha256") == gpu[initials[0]]
            and gpu.get("finalDiscriminatorStateSha256") == gpu[initials[1]],
            "V16 formal initialization differs from independent qualification")
    policy = bound_json(ROOT, gpu["policy"])
    require(gpu["policy"]["path"] == GPU_POLICY_PATH
            and policy.get("candidateContract") == candidate_binding
            and policy.get("cpuQualification") == cpu_binding
            and policy.get("datasetManifest") == manifest
            and policy.get("program") == bind(GPU_QUALIFIER_PATH)
            and policy.get("precisionExecutionPlan") == PRECISION_PLAN
            and policy.get("execution", {}).get("trainingAllowed") is False,
            "V16 read-only GPU policy identity invalid")
    return gpu


def _active_lock_and_heartbeat(active: dict, package: dict) -> None:
    output_root = package["outputRoot"]
    lock_binding = active.get("lock")
    require(isinstance(lock_binding, dict)
            and lock_binding.get("path") == output_root + "/execution-lock.json",
            "V16 active execution lock binding invalid")
    lock = bound_json(ROOT, lock_binding)
    heartbeat_binding = active.get("heartbeat")
    require(isinstance(heartbeat_binding, dict)
            and heartbeat_binding.get("path") == output_root + "/heartbeat.json"
            and heartbeat_binding.get("ttlSeconds") == 120,
            "V16 active execution heartbeat binding invalid")
    heartbeat = json.loads(project_file(ROOT, heartbeat_binding["path"])
                           .read_text(encoding="utf-8"))
    identity = ("capabilityVersion", "packageId", "runId",
                "processId", "processStartIdentity")
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
            and heartbeat.get("schemaVersion") ==
            "ai-painter-current-active-execution-heartbeat-v1"
            and all(lock.get(key) == heartbeat.get(key) == active.get(key)
                    for key in identity)
            and lock.get("runId") == package["runId"]
            and lock.get("packageId") == package["packageId"]
            and heartbeat.get("executionState") == "executing"
            and heartbeat.get("ttlSeconds") == 120
            and type(active.get("processId")) is int
            and active["processId"] > 0
            and isinstance(active.get("processStartIdentity"), str)
            and active["processStartIdentity"].startswith(str(active["processId"]) + ":"),
            "V16 active lock and heartbeat identity differ")
    try:
        recorded = datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - recorded).total_seconds()
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("V16 active heartbeat timestamp invalid") from error
    require(-5 <= age <= 120, "V16 active heartbeat expired or from future")


def authenticate(package_binding: dict) -> tuple[dict, dict, dict, tuple[str, ...]]:
    package = bound_json(ROOT, package_binding)
    candidate = package.get("candidateContract")
    require(isinstance(candidate, dict) and candidate.get("path") == CONTRACT_PATH,
            "V16 candidate contract identity invalid")
    contract = bound_json(ROOT, candidate)
    require(contract.get("schemaVersion") == CONTRACT_SCHEMA
            and contract.get("capabilityVersion") == CAPABILITY
            and contract.get("status") == "cpu_candidate_not_execution_qualified"
            and contract.get("precisionExecutionPlan") == PRECISION_PLAN
            and contract.get("activationGates") == {
                "cpuReadOnlyNow": True, "gpuReadOnlyNow": True,
                "gpuNow": False, "optimizerNow": False,
                "trainingNow": False, "formalReviewNow": False,
                "runtimeFrameNow": False,
            }, "V16 candidate does not permit the independent read-only gates")
    _review_alignment(contract)
    require(contract.get("trainingBoundNotActivated") == {
                "resolution": [256, 192], "trainSamples": 48,
                "validationSamplesForCheckpointOnly": 8,
                "maxGeneratorSteps": 1152, "maxDiscriminatorSteps": 1152,
                "maxGpuMemoryFraction": 0.7, "automaticRetries": 0,
            }, "V16 fixed data or training bounds changed")
    dataset = contract.get("datasetBinding", {})
    manifest_binding = dataset.get("manifest")
    require(isinstance(manifest_binding, dict), "V16 dataset release missing")
    manifest = bound_json(ROOT, manifest_binding)
    require(manifest.get("datasetReleaseIdentity") == dataset.get("datasetReleaseIdentity")
            and manifest.get("sourceIndex") == dataset.get("sourceIndex")
            and manifest.get("splits") == dataset.get("splits")
            and manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4,
            } and manifest.get("qualification", {}).get("dataQualifiedForTraining") is True,
            "V16 dataset release identity or qualification invalid")
    for item in (dataset["sourceIndex"], *dataset["splits"].values(),
                 contract["conditionContract"]):
        read_bound(ROOT, item)
    require(set(dataset["splits"]) == {"train", "validation", "challenge", "regression"},
            "V16 split binding incomplete")
    foundation = contract.get("foundationAssetBinding", {})
    require(foundation.get("candidateRole") == "fresh_native_rgb_neural_renderer_and_critic"
            and foundation.get("autoencoderLoadedByThisRenderer") is False
            and foundation.get("failedCheckpointLoaded") is False
            and foundation.get("initializationSeed") == MODEL_PLAN["freshInitializationSeed"]
            and manifest.get("foundationCheckpoint") ==
            foundation.get("qualifiedFoundationRecordedByDataset"),
            "V16 parent asset role invalid")
    require(package.get("schemaVersion") == PACKAGE_SCHEMA
            and package.get("capabilityVersion") == CAPABILITY
            and package.get("precisionExecutionPlan") == PRECISION_PLAN
            and package.get("stage") == STAGE
            and package.get("resourceBudget") == BUDGET
            and package.get("datasetManifest") == manifest_binding
            and package.get("reviewContract") ==
            contract.get("reviewBinding", {}).get("formalContract")
            and isinstance(package.get("reviewContract"), dict)
            and package.get("permittedSplits") == ["train", "validation"]
            and package.get("forbiddenSplits") == ["challenge", "regression"]
            and package.get("ticketConsumptionRequired") is True
            and package.get("outputTerminalPath") ==
            package.get("outputRoot", "") + "/phase-terminal.json",
            "V16 execution package identity or bounds invalid")
    output_root = package.get("outputRoot", "")
    require(isinstance(output_root, str) and output_root.startswith(OUTPUT_PREFIX)
            and len(output_root) > len(OUTPUT_PREFIX)
            and not output_root.endswith("/")
            and isinstance(package.get("runId"), str) and package["runId"]
            and isinstance(package.get("packageId"), str) and package["packageId"]
            and isinstance(package.get("batchRunId"), str) and package["batchRunId"],
            "V16 output or task identity invalid")
    project_file(ROOT, output_root + "/phase-terminal.json")
    _program_bindings(package, contract)
    gpu = _qualification(package, contract, candidate)
    registry = json.loads(project_file(
        ROOT, ".runtime/ai-painter/current-execution-registry/current.json"
    ).read_text(encoding="utf-8"))
    active = registry.get("activeExecution")
    require(isinstance(active, dict)
            and registry.get("executionState") == "executing"
            and registry.get("capabilityVersion") == CAPABILITY
            and registry.get("runId") == active.get("runId") == package["runId"]
            and registry.get("packageId") == active.get("packageId") == package["packageId"]
            and active.get("capabilityVersion") == CAPABILITY
            and active.get("executionState") == "executing",
            "V16 package is not the registered active execution")
    _active_lock_and_heartbeat(active, package)
    order = tuple(manifest["identityPayload"]["channelOrder"])
    require(len(order) == len(set(order)) == 23,
            "V16 condition channel order invalid")
    return package, contract, gpu, order


def _scalar_parts(parts: dict) -> dict:
    return {key: float(value.detach()) for key, value in parts.items()
            if isinstance(value, torch.Tensor) and value.numel() == 1}


def _load_bound_split(contract: dict, manifest: dict, split: str) -> tuple[list[dict], str]:
    """Decode only train/validation rows; other splits stay metadata-only."""
    require(split in ("train", "validation"), "V16 forbidden split decode")
    dataset = contract["datasetBinding"]
    source = bound_json(ROOT, dataset["sourceIndex"])
    membership = bound_json(ROOT, dataset["splits"][split])
    rows = source.get("samples")
    require(isinstance(rows, list) and len(rows) == 64
            and membership.get("split") == split
            and isinstance(membership.get("sampleIds"), list),
            "V16 source or split membership invalid")
    by_id = {row["sampleId"]: row for row in rows}
    ids = membership["sampleIds"]
    require(len(by_id) == 64 and len(ids) == len(set(ids))
            and len(ids) == (48 if split == "train" else 8)
            and all(key in by_id and by_id[key]["split"] == split for key in ids),
            "V16 selected split rows invalid")
    selected = [by_id[key] for key in ids]
    selection = digest(canonical_bytes(selected))
    require(selection == dataset[split + "SelectionSha256"],
            "V16 selected split row hash changed")
    order = manifest["identityPayload"]["channelOrder"]
    continuous = manifest["identityPayload"]["continuousChannelIds"]

    def pixels(binding: dict, mode: str, resampling) -> np.ndarray:
        with Image.open(io.BytesIO(read_bound(ROOT, binding))) as image:
            require(image.size == (1024, 768), "V16 original image size changed")
            return np.asarray(image.convert(mode).resize((256, 192),
                              resample=resampling), dtype=np.uint8).copy()

    samples = []
    for row in selected:
        pack = bound_json(ROOT, row["conditionPack"])
        channels = pack.get("channels", [])
        require([channel["id"] for channel in channels] == order,
                "V16 23-channel condition order changed")
        rgb = pixels(row["image"], "RGB", Image.Resampling.LANCZOS)
        planes = [pixels(channel, "L", Image.Resampling.BILINEAR
                         if channel["id"] in continuous else Image.Resampling.NEAREST)
                  for channel in channels]
        conditions = torch.stack([
            torch.from_numpy(plane).float().div(255.0) for plane in planes
        ])
        table = pack.get("objectInstanceTable")
        require(isinstance(table, list), "V16 object instance table missing")
        list(iter_object_views(conditions, table, order))
        samples.append({
            "sampleId": row["sampleId"], "split": split,
            "image": torch.from_numpy(rgb).permute(2, 0, 1).float().div(255.0),
            "conditions": conditions, "objectInstanceTable": table,
        })
    return samples, selection


def _mean(rows: list[dict]) -> dict:
    require(bool(rows), "V16 empty metric rows")
    return {key: sum(row[key] for row in rows) / len(rows) for key in rows[0]}


def _check_resource(device: torch.device, start: float) -> None:
    require(time.monotonic() - start < BUDGET["timeoutSeconds"],
            "V16 Stage0 wall-time budget exceeded")
    reserved = int(torch.cuda.max_memory_reserved(device))
    total = int(torch.cuda.get_device_properties(device).total_memory)
    require(total > 0 and reserved / total <= BUDGET["maxGpuMemoryFraction"],
            "V16 GPU reserved memory cap exceeded")


def _step(optimizer, loss, network, name: str, sample_id: str,
          attempted_step: int) -> None:
    if not bool(torch.isfinite(loss).all()):
        raise TrainingNumericsError(network=name, parameter="<loss>",
                                    sample_id=sample_id, attempted_step=attempted_step,
                                    kind="nonfinite_loss")
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    found = False
    for parameter_name, parameter in network.named_parameters():
        if not parameter.requires_grad or parameter.grad is None:
            continue
        found = True
        if not bool(torch.isfinite(parameter.grad).all()):
            raise TrainingNumericsError(network=name, parameter=parameter_name,
                                        sample_id=sample_id, attempted_step=attempted_step,
                                        kind="nonfinite_gradient")
    if not found:
        raise TrainingNumericsError(network=name,
                                    parameter="<all_trainable_parameters>",
                                    sample_id=sample_id, attempted_step=attempted_step,
                                    kind="missing_gradient")
    optimizer.step()
    for parameter_name, parameter in network.named_parameters():
        if parameter.requires_grad and not bool(torch.isfinite(parameter).all()):
            raise TrainingNumericsError(network=name, parameter=parameter_name,
                                        sample_id=sample_id, attempted_step=attempted_step,
                                        kind="nonfinite_parameter_after_step")


def run(package_binding: dict) -> dict:
    package, contract, gpu, order = authenticate(package_binding)
    start = time.monotonic()
    output_root = package["outputRoot"]
    terminal_path = project_file(ROOT, output_root + "/phase-terminal.json")
    progress_path = project_file(ROOT, output_root + "/progress.json")
    epochs_root = project_file(ROOT, output_root + "/epochs")
    checkpoint_path = project_file(ROOT, output_root + "/stage0-conditional-texture-bf16-v16.pt")
    require(not any(path.exists() for path in
                    (terminal_path, progress_path, checkpoint_path, epochs_root)),
            "V16 output already consumed; automatic retry forbidden")
    steps_generator = steps_discriminator = 0
    gpu_started = False
    attempted = None
    try:
        manifest = bound_json(ROOT, package["datasetManifest"])
        train, train_selection = _load_bound_split(contract, manifest, "train")
        validation, validation_selection = _load_bound_split(
            contract, manifest, "validation",
        )
        require(len(train) == 48 and len(validation) == 8
                and train_selection == contract["datasetBinding"]["trainSelectionSha256"]
                and validation_selection ==
                contract["datasetBinding"]["validationSelectionSha256"],
                "V16 selected train/validation rows changed")
        torch.manual_seed(MODEL_PLAN["freshInitializationSeed"])
        random.seed(MODEL_PLAN["freshInitializationSeed"])
        model = build_native_rgb_instance_object_prototype(
            condition_channel_order=order,
            base_channels=MODEL_PLAN["generatorBaseChannels"],
            patch_channels=MODEL_PLAN["generatorPatchChannels"],
        )
        critic = build_conditional_texture_discriminator()
        initial_model = state_hash(model.state_dict())
        initial_critic = state_hash(critic.state_dict())
        require(initial_model == gpu["initialModelStateSha256"]
                and initial_critic == gpu["initialDiscriminatorStateSha256"],
                "V16 fresh generator/critic differs from CPU/GPU qualification")
        require(not any(parameter.requires_grad for role in
                        ("object_tree", "object_rock", "object_vegetation")
                        for parameter in model.core.responsibility_heads[role].parameters()),
                "V16 replaced typed heads became trainable")
        # Only train and validation were decoded; challenge/regression stay unread.
        _check_programs_again(package, contract, package_binding)
        require(torch.cuda.is_available(), "V16 CUDA unavailable")
        require(torch.cuda.is_bf16_supported(), "V16 CUDA BF16 unsupported")
        device = torch.device("cuda:0")
        torch.cuda.set_device(device)
        torch.cuda.set_per_process_memory_fraction(BUDGET["maxGpuMemoryFraction"], device)
        torch.cuda.reset_peak_memory_stats(device)
        gpu_started = True
        torch.cuda.manual_seed_all(MODEL_PLAN["freshInitializationSeed"])
        model.to(device)
        critic.to(device)
        _check_resource(device, start)
        optimizer_generator = torch.optim.AdamW(
            (p for p in model.parameters() if p.requires_grad),
            lr=OPTIMIZER_PLAN["generatorLearningRate"],
        )
        optimizer_discriminator = torch.optim.AdamW(
            critic.parameters(), lr=OPTIMIZER_PLAN["discriminatorLearningRate"],
        )
        best_score, best_epoch, best_model, best_critic = float("inf"), None, None, None
        epochs_root.mkdir(parents=True, exist_ok=False)
        for epoch in range(1, STAGE["epochCount"] + 1):
            model.train()
            critic.train()
            indices = list(range(48))
            random.Random(MODEL_PLAN["freshInitializationSeed"] + epoch).shuffle(indices)
            generator_rows, discriminator_rows = [], []
            for index in indices:
                _check_resource(device, start)
                require(steps_generator < BUDGET["maxGeneratorSteps"]
                        and steps_discriminator < BUDGET["maxDiscriminatorSteps"],
                        "V16 optimizer step limit reached")
                sample = train[index]
                conditions = sample["conditions"].unsqueeze(0).to(device)
                bound = {**sample, "conditions": conditions[0],
                         "image": sample["image"].to(device)}
                critic.requires_grad_(True)
                attempted = {"network": "generator_inference_for_discriminator",
                             "parameter": "<forward>",
                             "sampleId": sample["sampleId"],
                             "attemptedStep": steps_discriminator + 1,
                             "scale": GRADIENT_SCALE, "epoch": epoch}
                with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                    detached_rgb = model(conditions, sample["objectInstanceTable"])
                attempted["network"] = "discriminator"
                attempted["parameter"] = "<loss>"
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    critic_loss, critic_parts = discriminator_train_objective(
                        critic, detached_rgb, bound,
                    )
                _step(optimizer_discriminator, critic_loss, critic, "discriminator",
                      sample["sampleId"], steps_discriminator + 1)
                steps_discriminator += 1
                discriminator_rows.append(_scalar_parts(critic_parts)
                                           | {"total": float(critic_loss.detach())})
                optimizer_discriminator.zero_grad(set_to_none=True)
                critic.requires_grad_(False)
                attempted = {"network": "generator", "parameter": "<forward>",
                             "sampleId": sample["sampleId"],
                             "attemptedStep": steps_generator + 1,
                             "scale": GRADIENT_SCALE, "epoch": epoch}
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    predicted = model(conditions, sample["objectInstanceTable"])
                    attempted["parameter"] = "<loss>"
                    generator_loss, generator_parts = generator_train_objective(
                        critic, predicted, bound, sample["objectInstanceTable"], order,
                    )
                _step(optimizer_generator, generator_loss, model, "generator",
                      sample["sampleId"], steps_generator + 1)
                steps_generator += 1
                attempted = None
                generator_rows.append(_scalar_parts(generator_parts))
                _check_resource(device, start)
                if steps_generator % 8 == 0:
                    write_atomic(progress_path, {
                        "schemaVersion": "ai-painter-stage4-mvp-conditional-texture-bf16-v16-progress-v1",
                        "capabilityVersion": CAPABILITY, "runId": package["runId"],
                        "precisionExecutionPlan": PRECISION_PLAN,
                        "phase": "training", "epoch": epoch, "epochTarget": 24,
                        "optimizerStepsGenerator": steps_generator,
                        "optimizerStepsDiscriminator": steps_discriminator,
                        "optimizerStepTargetEachNetwork": 1152,
                        "updatedAtUtc": utc_now(),
                    })
            model.eval()
            critic.eval()
            validation_rows = []
            with torch.no_grad():
                for sample in validation:
                    _check_resource(device, start)
                    attempted = {"network": "validation", "parameter": "<score>",
                                 "sampleId": sample["sampleId"],
                                 "attemptedStep": 0, "scale": GRADIENT_SCALE,
                                 "epoch": epoch}
                    conditions = sample["conditions"].unsqueeze(0).to(device)
                    bound = {**sample, "conditions": conditions[0],
                             "image": sample["image"].to(device)}
                    with torch.autocast("cuda", dtype=torch.bfloat16):
                        predicted = model(conditions, sample["objectInstanceTable"])
                        score, parts = validation_candidate_score(
                            predicted, bound, sample["objectInstanceTable"], order,
                        )
                    require(bool(torch.isfinite(score)), "V16 non-finite validation score")
                    validation_rows.append(_scalar_parts(parts))
                    attempted = None
            metrics = _mean(validation_rows)
            require(set(metrics) >= {"total", "coarseRgbMae", "instanceSupportRgbMae",
                                     "factRegionCoarseRgbMae", "localTextureMoments"},
                    "V16 validation score incomplete")
            if metrics["total"] < best_score:
                best_score, best_epoch = metrics["total"], epoch
                best_model = {key: value.detach().cpu().clone()
                              for key, value in model.state_dict().items()}
                best_critic = {key: value.detach().cpu().clone()
                               for key, value in critic.state_dict().items()}
            write_atomic(epochs_root / f"epoch-{epoch:02d}.json", {
                "schemaVersion": "ai-painter-stage4-mvp-conditional-texture-bf16-v16-epoch-v1",
                "runId": package["runId"], "epoch": epoch,
                "precisionExecutionPlan": PRECISION_PLAN,
                "optimizerStepsGenerator": steps_generator,
                "optimizerStepsDiscriminator": steps_discriminator,
                "trainGenerator": _mean(generator_rows),
                "trainDiscriminator": _mean(discriminator_rows),
                "validation": metrics, "checkpointSelectionScore": metrics["total"],
                "bestEpochSoFar": best_epoch, "bestScoreSoFar": best_score,
                "challengeRead": False, "regressionRead": False,
                "recordedAtUtc": utc_now(),
            })
            write_atomic(progress_path, {
                "schemaVersion": "ai-painter-stage4-mvp-conditional-texture-bf16-v16-progress-v1",
                "capabilityVersion": CAPABILITY, "runId": package["runId"],
                "precisionExecutionPlan": PRECISION_PLAN,
                "phase": "training", "epoch": epoch, "epochTarget": STAGE["epochCount"],
                "optimizerStepsGenerator": steps_generator,
                "optimizerStepsDiscriminator": steps_discriminator,
                "optimizerStepTargetEachNetwork": 1152,
                "bestEpoch": best_epoch, "bestScore": best_score,
                "updatedAtUtc": utc_now(),
            })
        require(steps_generator == steps_discriminator == 1152
                and best_model is not None and best_critic is not None,
                "V16 bounded training did not complete")
        model.load_state_dict(best_model, strict=True)
        critic.load_state_dict(best_critic, strict=True)
        selected_model, selected_critic = state_hash(model.state_dict()), state_hash(critic.state_dict())
        checkpoint = {
            "schemaVersion": CHECKPOINT_SCHEMA, "capabilityVersion": CAPABILITY,
            "executionIdentity": {key: package[key]
                                  for key in ("batchRunId", "runId", "packageId")}
                                 | {"executionPackage": package_binding},
            "stage": STAGE, "datasetManifest": package["datasetManifest"],
            "precisionExecutionPlan": PRECISION_PLAN, "gradientScale": GRADIENT_SCALE,
            "candidateContract": package["candidateContract"],
            "reviewContract": package["reviewContract"],
            "cpuQualification": package["cpuQualification"],
            "gpuQualification": package["gpuQualification"],
            "initialModelStateSha256": initial_model,
            "initialDiscriminatorStateSha256": initial_critic,
            "modelState": best_model, "modelStateSha256": selected_model,
            "discriminatorState": best_critic,
            "discriminatorStateSha256": selected_critic,
            "bestEpoch": best_epoch, "bestValidationMetric": best_score,
            "optimizerStepsGenerator": steps_generator,
            "optimizerStepsDiscriminator": steps_discriminator,
            "machineReviewPending": True, "formalInferenceEligible": False,
            "checkpointPromotionEligible": False, "automaticRetryStarted": False,
        }
        buffer = io.BytesIO()
        torch.save(checkpoint, buffer)
        write_exclusive(checkpoint_path, buffer.getvalue())
        reloaded = torch.load(io.BytesIO(checkpoint_path.read_bytes()),
                              map_location="cpu", weights_only=True)
        require(reloaded.get("schemaVersion") == CHECKPOINT_SCHEMA
                and reloaded.get("executionIdentity") == checkpoint["executionIdentity"]
                and reloaded.get("precisionExecutionPlan") == PRECISION_PLAN
                and reloaded.get("gradientScale") == GRADIENT_SCALE
                and state_hash(reloaded["modelState"]) == selected_model
                and state_hash(reloaded["discriminatorState"]) == selected_critic,
                "V16 safe Checkpoint reload identity mismatch")
        _check_resource(device, start)
        _check_programs_again(package, contract, package_binding)
        result = {
            "schemaVersion": TERMINAL_SCHEMA,
            "status": "training_completed_review_pending", "executionState": "completed",
            "capabilityVersion": CAPABILITY,
            "batchRunId": package["batchRunId"],
            "runId": package["runId"], "packageId": package["packageId"],
            "stage": STAGE,
            "precisionExecutionPlan": PRECISION_PLAN, "gradientScale": GRADIENT_SCALE,
            "executionPackage": package_binding,
            "datasetManifest": package["datasetManifest"],
            "cpuQualification": package["cpuQualification"],
            "gpuQualification": package["gpuQualification"],
            "checkpoint": bind(output_root + "/stage0-conditional-texture-bf16-v16.pt"),
            "checkpointReloadVerified": True,
            "initialModelStateSha256": initial_model,
            "initialDiscriminatorStateSha256": initial_critic,
            "modelStateSha256": selected_model,
            "discriminatorStateSha256": selected_critic,
            "selectedEpoch": best_epoch, "selectedScore": best_score,
            "completedEpochs": 24,
            "optimizerStepsGenerator": steps_generator,
            "optimizerStepsDiscriminator": steps_discriminator,
            "challengeRead": False, "regressionRead": False,
            "gpuStarted": gpu_started, "trainingStarted": True,
            "peakGpuReservedBytes": int(torch.cuda.max_memory_reserved(device)),
            "gpuTotalBytes": int(torch.cuda.get_device_properties(device).total_memory),
            "machineReviewPending": True, "stagePassed": False,
            "automaticRetryStarted": False, "recordedAtUtc": utc_now(),
        }
        write_atomic(progress_path, {
            "schemaVersion": "ai-painter-stage4-mvp-conditional-texture-bf16-v16-progress-v1",
            "capabilityVersion": CAPABILITY, "runId": package["runId"],
            "precisionExecutionPlan": PRECISION_PLAN,
            "phase": "completed", "epoch": 24, "epochTarget": 24,
            "optimizerStepsGenerator": steps_generator,
            "optimizerStepsDiscriminator": steps_discriminator,
            "bestEpoch": best_epoch, "bestScore": best_score,
            "updatedAtUtc": utc_now(),
        })
        write_exclusive(terminal_path, (json.dumps(result, ensure_ascii=False,
                                                     indent=2, allow_nan=False) + "\n").encode("utf-8"))
        return result
    except Exception as error:
        # Authenticated run only. Pre-auth failures cannot safely choose a
        # project terminal path; the local orchestrator records those itself.
        if not terminal_path.exists():
            context = failure_context(error, attempted)
            failure = {
                "schemaVersion": TERMINAL_SCHEMA, "status": "failed_closed",
                "executionState": "failed_closed", "capabilityVersion": CAPABILITY,
                "runId": package["runId"], "packageId": package["packageId"],
                "executionPackage": package_binding,
                "errorType": type(error).__name__, "error": str(error),
                "precisionExecutionPlan": PRECISION_PLAN, "gradientScale": GRADIENT_SCALE,
                "failureContext": context,
                "failedNetwork": context.get("network") if context else None,
                "failedParameter": context.get("parameter") if context else None,
                "failedSampleId": context.get("sampleId") if context else None,
                "failedAttemptedStep": context.get("attemptedStep") if context else None,
                "failedScale": context.get("scale") if context else None,
                "optimizerStepsGenerator": steps_generator,
                "optimizerStepsDiscriminator": steps_discriminator,
                "gpuStarted": gpu_started, "trainingStarted": steps_generator > 0 or steps_discriminator > 0,
                "automaticRetryStarted": False, "recordedAtUtc": utc_now(),
            }
            write_exclusive(terminal_path, (json.dumps(failure, ensure_ascii=False,
                                                         indent=2, allow_nan=False) + "\n").encode("utf-8"))
        raise


def _check_programs_again(package: dict, contract: dict,
                          package_binding: dict) -> None:
    require(bind(package_binding["path"]) == package_binding
            and bind(CONTRACT_PATH) == package["candidateContract"]
            and bind(package["reviewContract"]["path"]) == package["reviewContract"]
            and bind(package["cpuQualification"]["path"]) == package["cpuQualification"]
            and bind(package["gpuQualification"]["path"]) == package["gpuQualification"],
            "V16 package or candidate contract changed during execution")
    _program_bindings(package, contract)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    binding = {"path": args.execution_package.replace("\\", "/"),
               "sha256": args.execution_package_sha256}
    try:
        package = bound_json(ROOT, binding)
        require(args.output.replace("\\", "/") ==
                package.get("outputRoot", "") + "/phase-terminal.json",
                "V16 CLI terminal does not match execution package")
        result = run(binding)
        print(json.dumps({"status": result["status"], "terminal":
                          bind(args.output.replace("\\", "/"))}, ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
