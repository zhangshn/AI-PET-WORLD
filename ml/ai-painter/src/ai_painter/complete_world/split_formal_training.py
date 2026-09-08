"""Full-split epoch adapter for a separately qualified Stage4 successor.

Reuses the frozen model/Loss/Trainer and the existing optimizer boundary. This
component creates no execution permission and publishes no stage success.
Its lifecycle caller owns qualification, accepted-chain selection,
resource supervision, fixed previews, selection, review and durable terminals.
"""
from __future__ import annotations

from copy import deepcopy
import io
import json
import math
from pathlib import Path
import re

from .split_release import COUNTS, SplitReleaseDataset, canonical_bytes, digest, project_file
from .split_training import TrainSplitBoundary, state_hash


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def _integer(value, minimum, maximum, label):
    _require(type(value) is int and minimum <= value <= maximum, label + " invalid")
    return value


def _rows(dataset, split):
    _require(isinstance(dataset, SplitReleaseDataset) and dataset.split == split,
             "formal epoch requires the bound " + split + " Dataset")
    rows = dataset.rows
    _require(len(rows) == COUNTS[split], "formal epoch split capacity mismatch")
    ids = [row.get("sampleId") for row in rows]
    _require(all(isinstance(key, str) and key for key in ids)
             and len(set(ids)) == len(ids) and all(row.get("split") == split for row in rows),
             "formal epoch split membership invalid")
    _require(dataset.selection_sha256 == digest(canonical_bytes(rows)),
             "formal epoch Dataset selection changed")
    return rows, ids


def _finite_metrics(value):
    if isinstance(value, dict):
        for child in value.values():
            _finite_metrics(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            _finite_metrics(child)
    else:
        _require(type(value) in (int, float) and math.isfinite(value),
                 "formal epoch contains invalid or nonfinite metrics")


def apply_formal_parent_state(*, model, parent_state, expected_state_sha256,
                              stage_index, parent_stage_index):
    """Strictly copy an already-decoded predecessor Denoiser state.

    This is a tensor-consumption component, NOT a checkpoint-file loader. The
    lifecycle caller must establish qualification, same-chain success and raw
    file identity before deserializing anything, then call this before creating
    an optimizer. Caller-provided stage numbers/digests do not grant authority.
    No file, checkpoint selection, fallback or runtime registration is involved.
    """
    import torch
    from ai_painter_stage4_semantic_transport_v2_trainer_support import (
        state_dict_sha256, validate_stage4_semantic_transport_v2_autoencoder_boundary,
    )

    _integer(stage_index, 1, 2, "parent-state destination stage")
    _integer(parent_stage_index, 0, 1, "parent-state source stage")
    _require(parent_stage_index == stage_index - 1, "parent state must be the immediately preceding stage")
    _require(isinstance(expected_state_sha256, str) and len(expected_state_sha256) == 64
             and all(c in "0123456789abcdef" for c in expected_state_sha256),
             "parent tensor state digest missing")
    destination = model.denoiser.state_dict()
    _require(isinstance(parent_state, dict) and parent_state and set(parent_state) == set(destination),
             "parent Denoiser state keys must match exactly")
    # Validate the whole mapping before load_state_dict, which can otherwise
    # partially copy valid entries before rejecting a later shape mismatch.
    for key, value in parent_state.items():
        target = destination[key]
        _require(isinstance(value, torch.Tensor) and value.layout == torch.strided
                 and value.device.type != "meta" and value.shape == target.shape
                 and value.dtype == target.dtype and torch.isfinite(value).all().item(),
                 "parent Denoiser tensor shape/dtype/value mismatch: " + key)
    source_sha = state_dict_sha256(parent_state)
    _require(source_sha == expected_state_sha256, "parent tensor state digest mismatch")
    ae_before = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    before_sha = state_dict_sha256(destination)
    # Default copy semantics retain destination Parameter identities; never
    # alias the incoming state with assign=True or permit strict=False fallback.
    model.denoiser.load_state_dict(parent_state, strict=True)
    loaded_sha = state_dict_sha256(model.denoiser.state_dict())
    _require(loaded_sha == source_sha == state_dict_sha256(parent_state),
             "parent parameters were not faithfully loaded")
    ae_after = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="loaded", expected_state_sha256=ae_before["stateSha256"])
    return {"schemaVersion": "ai-painter-stage4-parent-tensor-consumption-v1",
            "status": "tensor_copy_verified_not_file_lineage_or_execution_qualification",
            "stageIndex": stage_index, "parentStageIndex": parent_stage_index,
            "destinationStateBeforeSha256": before_sha, "sourceStateSha256": source_sha,
            "loadedDenoiserStateSha256": loaded_sha,
            "autoencoderStateBeforeSha256": ae_before["stateSha256"],
            "autoencoderStateAfterSha256": ae_after["stateSha256"],
            "checkpointFileRead": False, "fileLineageVerified": False,
            "capabilityQualificationGranted": False}


def load_formal_parent_checkpoint(*, model, root, parent_terminal_binding,
                                 batch_run_id, package_id, source_run_id,
                                 stage_index, max_checkpoint_bytes):
    """Consume the batch executor's accepted predecessor, never select one.

    Rechecks the existing terminal/Manifest/review protocol and loads the exact
    hashed bytes with weights_only=True on CPU. The outer lifecycle must first
    verify the ENTIRE accepted chain, current package, ticket, data/GPU gates
    and resource budget. This component cannot grant those qualifications or
    start training. Invoke before optimizer creation; on failure discard the
    destination, including when a final stability check fails after copying.
    The file-byte limit is not a peak-RAM guarantee: the outer isolated worker
    must enforce process memory/time limits, including during deserialization.
    No current/latest lookup, directory search, unsafe fallback or AE loading.
    """
    import torch
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256

    parent_terminal_binding = deepcopy(parent_terminal_binding)
    _integer(stage_index, 1, 2, "parent checkpoint destination stage")
    _integer(max_checkpoint_bytes, 1, 512 * 1024 * 1024, "parent checkpoint byte limit")
    for value in (batch_run_id, package_id, source_run_id):
        _require(isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,199}", value),
                 "formal parent execution identity invalid")
    root = Path(root).resolve(strict=True)
    capability = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
    directory = f".runtime/ai-painter/stage4-v2-formal-executions/{batch_run_id}/stages/{source_run_id}"
    source_stage = {"stage": stage_index - 1, "width": 256 * 2 ** (stage_index - 1),
                    "height": 192 * 2 ** (stage_index - 1), "epochCount": 40}
    receipts = {}

    def read(binding, limit, expected_path=None):
        _require(isinstance(binding, dict) and set(binding) == {"path", "sha256"}
                 and isinstance(binding["sha256"], str)
                 and re.fullmatch(r"[a-f0-9]{64}", binding["sha256"]), "formal parent binding invalid")
        _require(expected_path is None or binding["path"] == expected_path, "formal parent namespace conflict")
        file = project_file(root, binding["path"])
        with file.open("rb") as stream:
            data = stream.read(limit + 1)
        _require(len(data) <= limit, "formal parent file exceeds byte limit")
        _require(digest(data) == binding["sha256"], "formal parent file SHA mismatch")
        previous = receipts.get(binding["path"])
        _require(previous is None or previous[0] == binding, "formal parent binding changed during read")
        receipts[binding["path"]] = (deepcopy(binding), limit)
        return data

    def document(binding, expected_path=None):
        value = json.loads(read(binding, 4 * 1024 * 1024, expected_path))
        _require(isinstance(value, dict), "formal parent JSON object required")
        return value

    def verify_stable():
        for binding, limit in list(receipts.values()):
            read(binding, limit)

    terminal = document(parent_terminal_binding, directory + "/phase-terminal.json")
    _require(terminal.get("schemaVersion") == "ai-painter-stage4-v2-formal-stage-terminal-v1"
             and terminal.get("status") == "stage4_v2_formal_stage_passed"
             and terminal.get("executionState") == "completed"
             and terminal.get("gpuStarted") is True and terminal.get("trainingStarted") is True,
             "formal parent terminal is not a completed successful stage")
    manifest = document(terminal.get("trainingManifest"))
    review = document(terminal.get("machineReview"))
    for doc, architecture_key in ((terminal, "capabilityVersion"), (manifest, "architectureId"),
                                  (review, "capabilityVersion")):
        _require(doc.get(architecture_key) == capability and doc.get("packageId") == package_id
                 and doc.get("runId") == source_run_id, "formal parent document identity conflict")
    _require(terminal.get("stage") == manifest.get("stage") == source_stage
             and all(isinstance(doc.get("stage"), dict)
                     and all(type(doc["stage"].get(key)) is int for key in source_stage)
                     for doc in (terminal, manifest)),
             "formal parent stage/resolution conflict")
    predecessor = terminal.get("parent")
    _require("parent" in terminal and "loadedParentCheckpoint" in manifest,
             "formal parent predecessor evidence missing")
    if source_stage["stage"] == 0:
        _require(predecessor is None and manifest["loadedParentCheckpoint"] is None,
                 "formal Stage0 cannot inherit a Denoiser checkpoint")
    else:
        # Consistency only: the outer batch executor separately rehashes and
        # qualifies this predecessor against its already-accepted chain.
        _require(isinstance(predecessor, dict) and set(predecessor) == {"terminal", "checkpoint"},
                 "formal Stage1 predecessor binding missing")
        for binding in predecessor.values():
            _require(isinstance(binding, dict) and set(binding) == {"path", "sha256"}
                     and isinstance(binding["path"], str) and isinstance(binding["sha256"], str)
                     and re.fullmatch(r"[a-f0-9]{64}", binding["sha256"]),
                     "formal Stage1 predecessor binding invalid")
        _require(manifest["loadedParentCheckpoint"] == predecessor["checkpoint"],
                 "formal parent actual predecessor conflict")
    checkpoint = terminal.get("checkpoint")
    _require(isinstance(checkpoint, dict) and isinstance(checkpoint.get("path"), str)
             and checkpoint["path"].startswith(directory + "/") and checkpoint["path"].endswith(".pt"),
             "formal parent checkpoint namespace conflict")
    _require(manifest.get("status") == "training_completed"
             and type(manifest.get("nonTrainOptimizerSteps")) is int and manifest["nonTrainOptimizerSteps"] == 0
             and manifest.get("checkpoint") == review.get("checkpoint") == checkpoint,
             "formal parent Manifest/checkpoint conflict")
    _require(review.get("status") == "stage4_v2_machine_review_passed"
             and type(review.get("failCount")) is int and review["failCount"] == 0
             and type(review.get("passCount")) is int and review["passCount"] > 0,
             "formal parent review did not pass")
    expected_state_sha = manifest.get("denoiserStateSha256")
    _require(isinstance(expected_state_sha, str) and re.fullmatch(r"[a-f0-9]{64}", expected_state_sha),
             "formal parent Manifest tensor-state hash missing")
    checkpoint_bytes = read(checkpoint, max_checkpoint_bytes)
    # Hash and deserialize ONE snapshot. Never re-open a mutable pathname for
    # torch.load, and never retry with weights_only=False or custom safe globals.
    payload = torch.load(io.BytesIO(checkpoint_bytes), map_location="cpu", weights_only=True)
    _require(isinstance(payload, dict)
             and payload.get("schemaVersion") == "project-owned-ai-assisted-cold-start-checkpoint-v7"
             and isinstance(payload.get("modelConfig"), dict)
             and payload["modelConfig"].get("denoiserArchitecture") == capability
             and type(payload["modelConfig"].get("latentChannels")) is int
             and payload["modelConfig"]["latentChannels"] == 12
             and payload.get("trainingStage") == "conditional_denoiser_training"
             and payload.get("denoiserTrained") is True
             and isinstance(payload.get("singleSampleOverfitSmoke"), dict)
             and payload["singleSampleOverfitSmoke"].get("enabled") is False,
             "formal parent checkpoint role/architecture conflict")
    resolution = payload.get("resolutionStage")
    _require(isinstance(resolution, dict)
             and all(type(resolution.get(key)) is int and resolution[key] == source_stage[key]
                     for key in ("width", "height")), "formal parent checkpoint resolution conflict")
    ae_state = payload.get("autoencoderState")
    _require(isinstance(ae_state, dict) and set(ae_state) == set(model.autoencoder.state_dict())
             and all(isinstance(v, torch.Tensor) and v.device.type == "cpu" and v.layout == torch.strided
                     and torch.isfinite(v).all().item() for v in ae_state.values())
             and state_dict_sha256(ae_state) == state_dict_sha256(model.autoencoder.state_dict()),
             "formal parent frozen Autoencoder identity conflict")
    normalization = payload.get("latentNormalization")
    _require(isinstance(normalization, dict) and normalization.get("version") == "per_channel_train_split_v1",
             "formal parent latent normalization missing")
    for key in ("mean", "standardDeviation"):
        values = normalization.get(key)
        _require(isinstance(values, list) and len(values) == 12
                 and all(type(v) in (int, float) and math.isfinite(v)
                         and (key != "standardDeviation" or v > 0) for v in values),
                 "formal parent latent normalization invalid")
        tensor = torch.tensor(values, dtype=torch.float32)
        _require(torch.isfinite(tensor).all().item()
                 and (key != "standardDeviation" or (tensor > 0).all().item()),
                 "formal parent latent normalization invalid at float32 precision")
    verify_stable()  # Reject evidence replacement before mutating parameters.
    result = apply_formal_parent_state(model=model, parent_state=payload.get("denoiserState"),
                                      expected_state_sha256=expected_state_sha,
                                      stage_index=stage_index, parent_stage_index=stage_index - 1)
    verify_stable()
    return {"schemaVersion": "ai-painter-stage4-parent-checkpoint-consumption-v1",
            "status": "bound_parent_bytes_and_tensor_copy_verified_not_execution_qualification",
            "parentTerminal": deepcopy(parent_terminal_binding), "checkpoint": deepcopy(checkpoint),
            "stageIndex": stage_index, "parentStageIndex": stage_index - 1,
            "checkpointFileRead": True, "weightsOnly": True, "mapLocation": "cpu",
            "tensorConsumption": result, "latentNormalization": deepcopy(normalization),
            "inputReceipts": [binding for binding, _ in receipts.values()],
            "acceptedChainQualifiedByThisComponent": False, "capabilityQualificationGranted": False,
            "formalStagePassed": False, "optimizerCreated": False, "gpuStarted": False}


def run_formal_split_epoch(*, model, optimizer, train_dataset, validation_dataset,
                           diffusion, latent_normalization, device, config,
                           stage_index, epoch_index, on_batch_progress=None):
    """Consume every train row once and every validation row once, batch size 1.

    Resolutions/Epochs/seed come from the caller's versioned config; the outer
    formal-stage package, not this component, certifies the 0 -> 1 -> 2 schedule.
    Replay and checkpoint selection are not implemented by this epoch adapter.
    """
    import torch
    from torch.utils.data import DataLoader
    from train_ai_assisted_conditional_denoiser import train_epoch, evaluate_velocity_prediction
    from ai_painter_stage4_semantic_transport_v2_trainer_support import (
        validate_stage4_semantic_transport_v2_autoencoder_boundary,
        validate_stage4_semantic_transport_v2_trainer_contract,
    )

    train_rows, train_ids = _rows(train_dataset, "train")
    validation_rows, validation_ids = _rows(validation_dataset, "validation")
    manifest = train_dataset.manifest
    _require(manifest == validation_dataset.manifest
             and train_dataset.root == validation_dataset.root
             and manifest.get("splitCounts") == COUNTS
             and isinstance(manifest.get("datasetReleaseIdentity"), str)
             and bool(manifest["datasetReleaseIdentity"])
             and not set(train_ids) & set(validation_ids), "formal epoch release/split conflict")
    training = config["training"]
    _require(type(training.get("batchSize")) is int and training["batchSize"] == 1,
             "formal epoch component supports only registered batchSize=1")
    epochs = _integer(training.get("denoiserEpochs"), 1, 10000, "epoch count")
    _integer(epoch_index, 0, epochs - 1, "epoch index")
    _integer(stage_index, 0, 2, "stage index")
    seed = _integer(training.get("seed"), 0, 2**63 - 1 - epochs, "seed")
    stages = training.get("resolutionStages")
    _require(isinstance(stages, list) and len(stages) == 3, "formal resolution schedule missing")
    resolution = tuple(_integer(stages[stage_index].get(key), 1, 4096, key)
                       for key in ("width", "height"))
    _require(train_dataset.image_size == validation_dataset.image_size == resolution,
             "formal Dataset resolution differs from configured stage")
    timesteps = training.get("fixedValidationTimesteps")
    _require(isinstance(timesteps, list) and timesteps and len(set(timesteps)) == len(timesteps)
             and all(type(t) is int and 0 <= t < config["diffusionSteps"] for t in timesteps),
             "formal fixed validation timesteps invalid")
    validate_stage4_semantic_transport_v2_trainer_contract(config, root=train_dataset.root)
    ae_before = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="before_training")
    allowed = {id(value) for value in model.denoiser.parameters() if value.requires_grad}
    actual = [value for group in optimizer.param_groups for value in group["params"]]
    _require(bool(allowed) and len(actual) == len(allowed) and {id(v) for v in actual} == allowed,
             "formal optimizer must contain exactly the trainable Denoiser parameters")

    config_before = deepcopy(config)
    manifest_before = deepcopy(manifest)
    selection_before = (train_dataset.selection_sha256, validation_dataset.selection_sha256)
    order = torch.randperm(len(train_rows), generator=torch.Generator().manual_seed(seed + epoch_index)).tolist()
    expected_train = [train_ids[i] for i in order]
    consumed = {"train": [], "validation": []}
    release_id = manifest["datasetReleaseIdentity"]

    def checked_loader(dataset, indices, expected_ids):
        loader = DataLoader(dataset, batch_sampler=[[i] for i in indices], num_workers=0)

        class CheckedLoader:
            def __init__(self):
                self.dataset = dataset
                self.iterated = False

            def __len__(self):
                return len(loader)

            def __iter__(self):
                _require(not self.iterated, "formal split loader cannot be replayed")
                self.iterated = True
                for index, batch in enumerate(loader):
                    _require(batch.get("sampleId") == [expected_ids[index]]
                             and batch.get("split") == [dataset.split]
                             and batch.get("datasetReleaseIdentity") == [release_id],
                             "formal actual batch identity/order mismatch before forward")
                    for key, channels in (("image", 3), ("conditions", 23)):
                        tensor = batch[key]
                        _require(tuple(tensor.shape) == (1, channels, resolution[1], resolution[0])
                                 and torch.isfinite(tensor).all().item()
                                 and tensor.min().item() >= 0 and tensor.max().item() <= 1,
                                 "formal actual batch shape/range invalid before forward")
                    consumed[dataset.split].extend(batch["sampleId"])
                    yield batch
        return CheckedLoader()

    initial_state = state_hash(model.state_dict())
    with TrainSplitBoundary(model, optimizer, train_dataset) as boundary:
        metrics = train_epoch(
            model, boundary.wrap_loader(checked_loader(train_dataset, order, expected_train)),
            optimizer, diffusion, latent_normalization, device, config, epoch_index,
            max_batches=None, on_batch_progress=on_batch_progress,
            enable_path_replay=False, enable_epoch_worst_replay=False,
        )
        steps = boundary.evidence()
        _require(consumed["train"] == expected_train and steps["optimizerSteps"] == len(train_ids)
                 and [s["sampleIds"] for s in steps["steps"]] == [[key] for key in expected_train]
                 and steps["rejectedOptimizerStepAttempts"] == 0,
                 "formal epoch did not optimize every train row exactly once")
        before_validation = state_hash(model.state_dict())
        optimizer_before = state_hash(optimizer.state_dict())
        with boundary.evaluation():
            validation = evaluate_velocity_prediction(
                model, checked_loader(validation_dataset, list(range(len(validation_rows))), validation_ids),
                diffusion, latent_normalization, device, seed + 2000, timesteps, config)
        _require(consumed["validation"] == validation_ids,
                 "formal validation did not consume every validation row exactly once")
        _require(boundary.evidence()["rejectedOptimizerStepAttempts"] == 0,
                 "formal epoch suppressed a forbidden optimizer attempt")
        after_validation = state_hash(model.state_dict())
        optimizer_after = state_hash(optimizer.state_dict())
    ae_after = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="after_training", expected_state_sha256=ae_before["stateSha256"])
    _require(config == config_before and train_dataset.rows == train_rows
             and validation_dataset.rows == validation_rows
             and train_dataset.manifest == validation_dataset.manifest == manifest_before
             and (train_dataset.selection_sha256, validation_dataset.selection_sha256) == selection_before,
             "formal epoch inputs changed during execution")
    _require(all(torch.isfinite(value).all().item() for value in model.state_dict().values()),
             "formal epoch produced nonfinite model state")
    _finite_metrics(metrics)
    _finite_metrics(validation)
    return {
        "schemaVersion": "ai-painter-stage4-full-split-epoch-evidence-v1",
        "status": "epoch_component_completed_not_stage_or_release_qualification",
        "stageIndex": stage_index, "epoch": epoch_index + 1, "resolution": list(resolution),
        "datasetReleaseIdentity": release_id, "trainMetrics": metrics, "validationMetrics": validation,
        "stepEvidence": steps, "initialModelStateSha256": initial_state,
        "finalModelStateSha256": state_hash(model.state_dict()),
        "autoencoderEvidence": {"before": ae_before, "after": ae_after},
        "validationEvidence": {
            "sampleIds": consumed["validation"], "split": "validation",
            "datasetSelectionSha256": validation_dataset.selection_sha256,
            "modelStateBefore": before_validation, "modelStateAfter": after_validation,
            "optimizerStateBefore": optimizer_before, "optimizerStateAfter": optimizer_after,
            "gradientsEnabled": False,
        },
        "challengeConsumed": False, "regressionConsumed": False, "checkpointSelected": False,
        "capabilityQualificationGranted": False, "formalStagePassed": False,
    }
