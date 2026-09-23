"""Full-split epoch connection for the V2 formal single-stage executor.

Internal Trainer component, not a CLI or an admission authority. The enclosing
local lifecycle must authenticate data, model, CPU/GPU qualification and the
execution package before calling it. It owns resources, checkpoints, review,
terminal publication and the current registry. No historical runner fallback.
"""
from __future__ import annotations

from copy import deepcopy
import io
import json
import math
import os
from pathlib import Path
import re

import torch
from torch.utils.data import DataLoader, default_collate
from ai_painter.complete_world.model import build_complete_world_system

from ai_painter.complete_world.split_release import SplitReleaseDataset, canonical_bytes, digest, project_file
from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
from ai_painter_stage4_semantic_transport_v2_trainer_support import (
    FORMAL_OBJECTIVE_CONTRACT_PATH,
    build_stage4_semantic_transport_v2_cpu_inactive_config,
    validate_stage4_semantic_transport_v2_autoencoder_boundary,
    validate_stage4_semantic_transport_v2_trainer_contract,
    state_dict_sha256,
)
from train_ai_assisted_conditional_denoiser import (
    train_epoch, evaluate_velocity_prediction, evaluate_deterministic_rollout_rgb_quality_v7,
    stage4_fixed_preview_determinism_scope,
    serialize_latent_normalization, load_latent_normalization,
)


def require(value, message):
    if not value:
        raise ValueError(message)


def build_formal_stage_component_config(root):
    """Reuse bound V6 rollout weights omitted from the CPU-only config builder.

    This adds no qualification and leaves the inactive support binding intact.
    """
    config = build_stage4_semantic_transport_v2_cpu_inactive_config(Path(root))
    formal = json.loads(project_file(Path(root), FORMAL_OBJECTIVE_CONTRACT_PATH).read_bytes())
    config["training"]["rolloutCheckpointMetricWeights"] = deepcopy(formal["rolloutCheckpointMetricWeights"])
    validate_stage4_semantic_transport_v2_trainer_contract(config, root=Path(root))
    return config


def initialize_formal_stage0_cpu(*, root, initialization, train_dataset, validation_dataset,
                                foundation_state):
    """Full-split Stage0 initialization, never a reuse of a Smoke receipt.

    Internal composition only. The enclosing authenticated loader must establish
    the origin of foundation_state; its state hash alone is not provenance.
    No checkpoint path/loader, optimizer, image decoding or GPU is used here.
    The returned exact initialization binding can be consumed by the formal
    execution adapter, but cannot serve as a data/GPU qualification grant.
    """
    required = {"schemaVersion", "stage", "datasetManifest", "configSha256", "seed", "foundationStateSha256"}
    require(isinstance(initialization, dict) and set(initialization) == required,
            "formal initialization fields invalid; Smoke or parent input forbidden")
    bound = deepcopy(initialization)
    require(bound["schemaVersion"] == "ai-painter-formal-stage0-initialization-input-v1",
            "formal initialization schema invalid")
    require(bound["stage"] == {"stage": 0, "width": 256, "height": 192, "epochCount": 40},
            "formal initialization requires Stage0 full schedule")
    require(all(Path(d.root).resolve() == Path(root).resolve() for d in (train_dataset, validation_dataset)),
            "formal initialization Dataset root mismatch")
    require(bound["datasetManifest"] == train_dataset.binding == validation_dataset.binding,
            "formal initialization dataset binding mismatch")
    config = build_formal_stage_component_config(root)
    require(digest(canonical_bytes(config)) == bound["configSha256"], "formal initialization config mismatch")
    # The objective-only config intentionally omits a run seed. Bind the seed
    # explicitly in this input, as the formal epoch executor does; never inherit
    # it from a Smoke receipt. An explicit config seed must still agree.
    require(type(bound["seed"]) is int and 0 <= bound["seed"] < 2**63 - 100000,
            "formal initialization seed invalid")
    if "seed" in config["training"]:
        require(type(config["training"]["seed"]) is int and bound["seed"] == config["training"]["seed"],
                "formal initialization seed mismatch")
    selections = validate_stage_inputs(bound["stage"], 0, train_dataset, validation_dataset, config, bound["seed"])
    require(isinstance(foundation_state, dict) and bool(foundation_state)
            and all(isinstance(k, str) and isinstance(v, torch.Tensor) and v.device.type == "cpu"
                    and torch.isfinite(v).all().item() for k, v in foundation_state.items()),
            "formal initialization requires a CPU foundation state")
    require(state_hash(foundation_state) == bound["foundationStateSha256"], "formal foundation state mismatch")
    with torch.random.fork_rng(devices=[]), torch.device("cpu"):
        # Seed CPU only; initialization must neither initialize nor reseed CUDA.
        torch.random.default_generator.manual_seed(bound["seed"])
        model = build_complete_world_system(config).cpu()
    initial_denoiser = state_hash(model.denoiser.state_dict())
    model.autoencoder.load_state_dict(foundation_state, strict=True)
    model.train()
    frozen = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    require(state_hash(model.autoencoder.state_dict()) == bound["foundationStateSha256"],
            "formal loaded foundation mismatch")
    require(state_hash(model.denoiser.state_dict()) == initial_denoiser,
            "formal foundation load changed fresh Denoiser")
    require(state_hash(foundation_state) == bound["foundationStateSha256"], "formal source state mutated")
    require(all(p.grad is None for p in model.parameters()), "formal initialization created gradients")
    return config, model, {
        "schemaVersion": "ai-painter-formal-stage0-initialization-component-v1",
        "status": "initialized_not_training_qualified", "input": bound,
        "inputSha256": digest(canonical_bytes(bound)), "selections": selections,
        "initialDenoiserStateSha256": initial_denoiser,
        "foundationStateSha256": bound["foundationStateSha256"], "foundationBoundaryEvidence": frozen,
        "device": "cpu", "optimizerCreated": False, "optimizerSteps": 0,
        "datasetTensorsDecoded": False, "historicalDenoiserLoaded": False,
        "foundationCheckpointAuthenticated": False, "trainingAllowed": False, "gpuStarted": False,
    }


def validate_stage_inputs(stage, epoch_index, train_dataset, validation_dataset, config, seed):
    require(isinstance(stage, dict) and type(stage.get("stage")) is int,
            "formal stage identity missing")
    number = stage["stage"]
    require(number in (0, 1, 2), "unsupported formal stage")
    require(stage == {"stage": number, "width": 256 * 2**number,
                      "height": 192 * 2**number, "epochCount": 40},
            "formal stage differs from the registered batch schedule")
    require(type(epoch_index) is int and 0 <= epoch_index < stage["epochCount"],
            "formal epoch outside schedule")
    require(type(seed) is int and 0 <= seed < 2**63 - 100000, "invalid validation seed")
    require(type(config.get("training", {}).get("batchSize")) is int
            and config["training"]["batchSize"] == 1, "formal split adapter requires batchSize=1")
    selections = {}
    for split, dataset, count in (("train", train_dataset, 48), ("validation", validation_dataset, 8)):
        require(isinstance(dataset, SplitReleaseDataset) and dataset.split == split,
                "formal Dataset must use the bound " + split + " split")
        require(not dataset.manifest.get("reviewOnly"),
                "formal training cannot consume a review-only split candidate")
        require(dataset.image_size == (stage["width"], stage["height"]), "Dataset stage resolution mismatch")
        rows = dataset.rows
        ids = [row["sampleId"] for row in rows]
        require(len(rows) == len(dataset) == count and len(set(ids)) == count,
                "formal " + split + " requires its complete unique membership")
        require(all(row["split"] == split for row in rows), "formal Dataset contains a foreign split")
        require(dataset.selection_sha256 == digest(canonical_bytes(rows)), "Dataset selection hash mismatch")
        selections[split] = {"sampleIds": ids, "rowsSha256": dataset.selection_sha256}
    require(train_dataset.binding == validation_dataset.binding
            and train_dataset.manifest == validation_dataset.manifest
            and Path(train_dataset.root).resolve() == Path(validation_dataset.root).resolve(),
            "formal Datasets cross project or release identities")
    require(not set(selections["train"]["sampleIds"]) & set(selections["validation"]["sampleIds"]),
            "formal train and validation overlap")
    validate_stage4_semantic_transport_v2_trainer_contract(config, root=train_dataset.root)
    validate_formal_rollout_config(config, train_dataset.root)
    return selections


def validate_formal_rollout_config(config, root):
    # The support validator above authenticates this formal contract's SHA.
    formal = json.loads(project_file(Path(root), FORMAL_OBJECTIVE_CONTRACT_PATH).read_bytes())
    training = config["training"]
    require(training.get("rolloutCheckpointMetricWeights") == formal["rolloutCheckpointMetricWeights"],
            "formal rollout metric weights differ from the bound objective")
    for key in ("checkpointRolloutWeight", "checkpointRolloutSeedsPerSample", "checkpointWorstTrajectoryWeight"):
        require(type(training.get(key)) in (int, float) and not isinstance(training[key], bool)
                and training[key] == formal["training"][key], "formal rollout setting mismatch: " + key)


class CheckedFullSplitLoader:
    """Check actual tensors and ordered membership, not only Dataset metadata."""
    def __init__(self, dataset, stage, selection):
        self.dataset = dataset
        self.loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
        self.stage, self.selection = stage, selection
        self.read_ids = []
        self.iterated = False

    def __len__(self):
        return len(self.loader)

    def __iter__(self):
        require(not self.iterated, "formal split loader cannot be replayed")
        self.iterated = True
        expected_ids = self.selection["sampleIds"]
        for index, batch in enumerate(self.loader):
            self.check_batch(index, batch)
            yield batch
        require(self.read_ids == expected_ids, "formal loader did not consume complete split")

    def check_batch(self, index, batch):
        expected_ids = self.selection["sampleIds"]
        require(index < len(expected_ids), "formal loader yielded extra samples")
        require(batch.get("sampleId") == [expected_ids[index]]
                and batch.get("split") == [self.dataset.split]
                and batch.get("datasetReleaseIdentity") == [self.dataset.manifest["datasetReleaseIdentity"]],
                "actual formal batch identity mismatch")
        for key, channels in (("image", 3), ("conditions", 23)):
            value = batch.get(key)
            require(isinstance(value, torch.Tensor) and value.is_floating_point()
                    and tuple(value.shape) == (1, channels, self.stage["height"], self.stage["width"]),
                    "actual formal " + key + " shape mismatch")
            require(torch.isfinite(value).all().item()
                    and ((value >= 0) & (value <= 1)).all().item(),
                    "actual formal " + key + " outside finite unit range")
        self.read_ids.extend(batch["sampleId"])


class CheckedRolloutDataset:
    """Validate actual unbatched validation reads used by the existing sampler."""
    def __init__(self, dataset, stage, selection):
        self.dataset, self.rows = dataset, dataset.rows
        self.checker = CheckedFullSplitLoader(dataset, stage, selection)

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, index):
        require(type(index) is int and index == len(self.checker.read_ids),
                "formal rollout validation read order changed")
        row = self.dataset[index]
        self.checker.check_batch(index, default_collate([row]))
        return row


def run_formal_stage_epoch(*, model, optimizer, train_dataset, validation_dataset,
                           stage, diffusion, latent_normalization, device, config,
                           epoch_index, seed, on_batch_progress=None, step_telemetry_path=None):
    """One complete 48-train/8-validation epoch using the existing V2 Trainer.

    No best-checkpoint selection or eligibility declaration happens here. An
    exception is propagated to the lifecycle; this component never retries.
    """
    stage = deepcopy(stage)
    selections = validate_stage_inputs(stage, epoch_index, train_dataset, validation_dataset, config, seed)
    # This is necessary but not sufficient: the enclosing lifecycle still
    # authenticates the immutable release and its current qualification.
    require(train_dataset.manifest.get("qualification", {}).get("trainingAllowed") is True
            and validation_dataset.manifest.get("qualification", {}).get("trainingAllowed") is True,
            "formal dataset is not training qualified")
    frozen = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="before_training")
    allowed = {id(value) for value in model.denoiser.parameters() if value.requires_grad}
    optimized = [value for group in optimizer.param_groups for value in group["params"]]
    require(allowed and len(optimized) == len(allowed) and {id(value) for value in optimized} == allowed,
            "formal optimizer must contain exactly the trainable Denoiser parameters")
    train_loader = CheckedFullSplitLoader(train_dataset, stage, selections["train"])
    validation_loader = CheckedFullSplitLoader(validation_dataset, stage, selections["validation"])
    rollout_dataset = CheckedRolloutDataset(validation_dataset, stage, selections["validation"])
    with TrainSplitBoundary(model, optimizer, train_dataset) as boundary:
        train_metrics = train_epoch(
            model, boundary.wrap_loader(train_loader), optimizer, diffusion,
            latent_normalization, device, config, epoch_index,
            on_batch_progress=on_batch_progress, step_telemetry_path=step_telemetry_path,
            enable_path_replay=False, enable_epoch_worst_replay=False)
        evidence = boundary.evidence()
        require(train_loader.read_ids == selections["train"]["sampleIds"], "formal train coverage incomplete")
        require(evidence["optimizerSteps"] == 48
                and [step["sampleIds"] for step in evidence["steps"]]
                == [[sample] for sample in selections["train"]["sampleIds"]],
                "formal optimizer ledger differs from complete train split")
        before_model, before_optimizer = state_hash(model.state_dict()), state_hash(optimizer.state_dict())
        with boundary.evaluation():
            validation_metrics = evaluate_velocity_prediction(
                model, validation_loader, diffusion, latent_normalization, device, seed + 1000,
                config["training"]["fixedValidationTimesteps"], config)
            with stage4_fixed_preview_determinism_scope(True):
                rollout_metrics = evaluate_deterministic_rollout_rgb_quality_v7(
                    model, rollout_dataset, diffusion, latent_normalization, device, seed + 3000, config)
        require(validation_loader.read_ids == selections["validation"]["sampleIds"],
                "formal validation coverage incomplete")
        require(boundary.evidence()["rejectedOptimizerStepAttempts"] == 0,
                "formal Trainer suppressed a forbidden optimizer attempt")
        require(rollout_dataset.checker.read_ids == selections["validation"]["sampleIds"],
                "formal rollout validation coverage incomplete")
        seeds = config["training"]["checkpointRolloutSeedsPerSample"]
        require(rollout_metrics.get("rolloutSampleCount") == 8
                and rollout_metrics.get("rolloutSeedCountPerSample") == seeds
                and rollout_metrics.get("rolloutTrajectoryCount") == 8 * seeds,
                "formal rollout trajectory coverage incomplete")
        selection_score = (float(validation_metrics["compositeConditionQualityScore"])
                           + float(rollout_metrics["rolloutRgbQualityScore"])
                           * float(config["training"]["checkpointRolloutWeight"]))
        require(math.isfinite(selection_score), "formal checkpoint selection score is nonfinite")
    validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="after_training", expected_state_sha256=frozen["stateSha256"])
    require(validate_stage_inputs(stage, epoch_index, train_dataset, validation_dataset, config, seed) == selections,
            "formal Dataset changed during epoch")
    return {"schemaVersion": "ai-painter-stage4-formal-full-split-epoch-v1",
            "stage": stage, "epoch": epoch_index + 1, "selections": selections,
            "trainMetrics": train_metrics, "validationMetrics": validation_metrics,
            "rolloutValidationMetrics": rollout_metrics, "checkpointSelectionScore": selection_score,
            "stepEvidence": evidence,
            "validationEvidence": {"sampleIds": validation_loader.read_ids,
                "rolloutSampleIds": rollout_dataset.checker.read_ids,
                "modelStateBefore": before_model, "modelStateAfter": state_hash(model.state_dict()),
                "optimizerStateBefore": before_optimizer, "optimizerStateAfter": state_hash(optimizer.state_dict())},
            "capabilityQualificationGranted": False, "stagePassed": False}


def run_formal_stage_schedule(*, on_epoch_completed, **epoch_arguments):
    """Run the bound forty epochs, stopping at the first failure.

    Called only by the admitted, resource-supervised lifecycle. The required
    callback persists each epoch and applies that lifecycle's bound checkpoint
    selection; this component does not invent a selection rule, retry, advance
    resolution, register activity, or certify a completed stage. No resume from
    caller-supplied epoch counters is supported.
    """
    require(callable(on_epoch_completed), "formal epoch evidence sink required")
    require("epoch_index" not in epoch_arguments, "formal schedule cannot resume from a caller epoch")
    arguments = dict(epoch_arguments)
    arguments["stage"] = deepcopy(arguments["stage"])
    arguments["config"] = deepcopy(arguments["config"])
    validate_stage_inputs(arguments["stage"], 0, arguments["train_dataset"],
                          arguments["validation_dataset"], arguments["config"], arguments["seed"])
    model, optimizer = arguments["model"], arguments["optimizer"]
    completed = []
    for index in range(arguments["stage"]["epochCount"]):
        evidence = run_formal_stage_epoch(**arguments, epoch_index=index)
        require(evidence["epoch"] == index + 1 and evidence["stage"] == arguments["stage"],
                "formal epoch returned a different schedule position")
        require(evidence["stepEvidence"]["optimizerSteps"] == 48
                and evidence["stepEvidence"]["nonTrainOptimizerSteps"] == 0,
                "formal epoch returned incomplete optimizer evidence")
        model_hash, optimizer_hash = state_hash(model.state_dict()), state_hash(optimizer.state_dict())
        on_epoch_completed(deepcopy(evidence))
        require(state_hash(model.state_dict()) == model_hash
                and state_hash(optimizer.state_dict()) == optimizer_hash,
                "formal evidence sink changed model or optimizer")
        completed.append({"epoch": index + 1, "evidenceSha256": digest(canonical_bytes(evidence)),
                          "optimizerSteps": 48, "nonTrainOptimizerSteps": 0})
    return {"schemaVersion": "ai-painter-stage4-formal-stage-schedule-result-v1",
            "status": "schedule_completed_pending_review", "stage": arguments["stage"],
            "completedEpochs": len(completed), "optimizerSteps": sum(row["optimizerSteps"] for row in completed),
            "nonTrainOptimizerSteps": 0, "epochs": completed,
            "stagePassed": False, "capabilityQualificationGranted": False}


def run_formal_stage_checkpoint(*, root, checkpoint_path, identity, on_epoch_completed, **epoch_arguments):
    """Train the bounded stage, select by the unchanged V6 metric, export V7.

    Internal production component, not a permission-granting CLI. Its lifecycle
    caller must admit the exact data/model/programs and own the worker, lease and
    resource budget BEFORE calling. No internal probe snapshot is promoted.
    The returned training artifact still needs independent reload, semantic
    review and the existing batch executor's accepted-chain checks.
    """
    require(callable(on_epoch_completed), "formal epoch evidence sink required")
    identity = deepcopy(identity)
    target = checkpoint_target(root, checkpoint_path, identity)
    require(not target.exists(), "formal V7 checkpoint already exists")
    arguments = dict(epoch_arguments)
    config = arguments["config"] = deepcopy(arguments["config"])
    require(all(Path(arguments[key].root).resolve() == Path(root).resolve()
                for key in ("train_dataset", "validation_dataset")), "formal V7 cross-project Dataset")
    require(arguments["stage"] == identity["stage"], "formal V7 stage identity mismatch")
    require(config.get("denoiserArchitecture") == identity["capabilityVersion"]
            == "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
            and config.get("latentChannels") == 12, "formal V7 architecture mismatch")
    require(config["training"].get("bestCheckpointMetric")
            == "fixed_grid_plus_deterministic_rollout_rgb_score_v6", "formal V7 selection metric mismatch")
    model = arguments["model"]
    normalization = cpu_normalization(arguments["latent_normalization"])
    normalization_hash = state_hash(normalization)
    initial_foundation = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="before_training")
    best, selected, rows = None, None, []

    def collect(evidence):
        nonlocal best, selected
        score = evidence.get("checkpointSelectionScore")
        require(type(score) in (int, float) and math.isfinite(score), "formal V7 selection score invalid")
        require(evidence["validationEvidence"]["modelStateAfter"] == state_hash(model.state_dict()),
                "formal V7 selection does not describe current weights")
        # A strict decrease preserves the first epoch on ties, as in the Trainer.
        improved = selected is None or score < selected["checkpointSelectionScore"]
        if improved:
            best = {key: value.detach().cpu().clone() for key, value in model.denoiser.state_dict().items()}
            selected = deepcopy(evidence)
        on_epoch_completed(deepcopy(evidence))  # persistence failure stops the stage
        rows.append({"epoch": evidence["epoch"], "score": score,
                     "evidenceSha256": digest(canonical_bytes(evidence)), "bestCheckpointUpdated": improved})

    device = torch.device(arguments["device"])
    devices = [] if device.type == "cpu" else [device.index if device.index is not None else torch.cuda.current_device()]
    with torch.random.fork_rng(devices=devices):
        torch.manual_seed(arguments["seed"])
        schedule = run_formal_stage_schedule(on_epoch_completed=collect, **arguments)
    require(schedule["completedEpochs"] == 40 and schedule["optimizerSteps"] == 1920
            and schedule["nonTrainOptimizerSteps"] == 0 and len(rows) == 40 and selected is not None,
            "formal V7 stage schedule incomplete")
    require(state_hash(cpu_normalization(arguments["latent_normalization"])) == normalization_hash,
            "formal V7 normalization changed during training")
    # Recheck the exact package immediately before any artifact is written.
    require(checkpoint_target(root, checkpoint_path, identity) == target, "formal V7 output identity changed")
    model.denoiser.load_state_dict(best, strict=True)
    require(state_hash(model.state_dict()) == selected["validationEvidence"]["modelStateAfter"],
            "formal V7 selected state restore mismatch")
    foundation = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="after_training", expected_state_sha256=initial_foundation["stateSha256"])
    train, validation = arguments["train_dataset"], arguments["validation_dataset"]
    payload = {
        "schemaVersion": "project-owned-ai-assisted-cold-start-checkpoint-v7",
        "ownership": "project_owned_architecture_ai_assisted_cold_start_weights",
        "trainingLane": "ai_assisted_cold_start", "modelConfig": config,
        "upstreamModelIds": [], "thirdPartyWeightsLoaded": False,
        "datasetPackageId": train.manifest["datasetReleaseIdentity"],
        "datasetBindingEvidence": {"manifest": deepcopy(train.binding),
            "trainSelectionSha256": train.selection_sha256, "validationSelectionSha256": validation.selection_sha256},
        "actualLoadedConditionalSampleCount": 56,
        "actualLoadedSplitCounts": {"train": 48, "validation": 8, "challenge": 0, "regression": 0},
        "trainingStage": "conditional_denoiser_training", "denoiserTrained": True,
        "resolutionStage": {key: identity["stage"][key] for key in ("width", "height")},
        "seed": arguments["seed"], "singleSampleOverfitSmoke": {"enabled": False},
        "latentNormalization": serialize_latent_normalization(normalization),
        "bestCheckpointMetric": config["training"]["bestCheckpointMetric"],
        "bestEpoch": selected["epoch"], "bestValidationMetric": selected["checkpointSelectionScore"],
        "autoencoderState": {k: v.detach().cpu().clone() for k, v in model.autoencoder.state_dict().items()},
        "denoiserState": best, "executionIdentity": identity, "epochSelectionEvidence": rows,
        "stage4SemanticTransportV2AutoencoderBoundary": {"beforeTraining": initial_foundation,
            "afterTraining": foundation, "allStateHashesMatch": True, "optimizerContainsAutoencoder": False},
        "machineReviewPending": True, "formalInferenceEligible": False,
        "checkpointPromotionEligible": False, "stage0InitializationEligible": False,
        "stage1InitializationEligible": False,
    }
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    require(buffer.tell() <= MAX_CHECKPOINT_BYTES, "formal V7 checkpoint exceeds byte limit")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as stream:
        stream.write(buffer.getbuffer())
        stream.flush()
        os.fsync(stream.fileno())
    return {"status": "training_completed_review_pending", "checkpoint": {
                "path": checkpoint_path, "sha256": digest(buffer.getvalue())},
            "denoiserStateSha256": state_dict_sha256(best), "schedule": schedule,
            "selectedEpoch": selected["epoch"], "selectedScore": selected["checkpointSelectionScore"],
            "selectedModelStateSha256": selected["validationEvidence"]["modelStateAfter"],
            "executionIdentity": identity, "configSha256": digest(canonical_bytes(config)),
            "stagePassed": False, "capabilityQualificationGranted": False}


def reload_formal_stage_v7_checkpoint(*, root, result, model, config):
    """Same-execution V7 reload; does not fabricate a passed parent terminal."""
    require(result.get("status") == "training_completed_review_pending"
            and result.get("stagePassed") is False, "formal V7 reload result role invalid")
    checkpoint, identity = result["checkpoint"], result["executionIdentity"]
    target = checkpoint_target(root, checkpoint["path"], identity)
    with target.open("rb") as stream:
        data = stream.read(MAX_CHECKPOINT_BYTES + 1)
    require(len(data) <= MAX_CHECKPOINT_BYTES and digest(data) == checkpoint["sha256"],
            "formal V7 checkpoint byte identity mismatch")
    payload = torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
    require(payload.get("schemaVersion") == "project-owned-ai-assisted-cold-start-checkpoint-v7"
            and payload.get("executionIdentity") == identity
            and payload.get("modelConfig") == config
            and digest(canonical_bytes(config)) == result["configSha256"]
            and payload.get("machineReviewPending") is True
            and payload.get("formalInferenceEligible") is False
            and payload.get("checkpointPromotionEligible") is False,
            "formal V7 checkpoint role/config mismatch")
    require(payload.get("bestEpoch") == result["selectedEpoch"]
            and payload.get("bestValidationMetric") == result["selectedScore"], "formal V7 selection mismatch")
    foundation = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    require(state_dict_sha256(payload["autoencoderState"]) == state_dict_sha256(model.autoencoder.state_dict()),
            "formal V7 frozen foundation mismatch")
    state, current = payload["denoiserState"], model.denoiser.state_dict()
    require(set(state) == set(current) and all(isinstance(v, torch.Tensor)
            and v.shape == current[k].shape and v.dtype == current[k].dtype
            and torch.isfinite(v).all().item() for k, v in state.items())
            and state_dict_sha256(state) == result["denoiserStateSha256"], "formal V7 Denoiser mismatch")
    normalization = load_latent_normalization(payload, torch.device("cpu"))
    cpu_normalization(normalization)
    model.denoiser.load_state_dict(state, strict=True)
    require(state_hash(model.state_dict()) == result["selectedModelStateSha256"], "formal V7 reload state mismatch")
    validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded",
        expected_state_sha256=foundation["stateSha256"])
    return {"status": "formal_v7_reloaded_review_pending", "checkpoint": deepcopy(checkpoint),
            "denoiserStateSha256": state_dict_sha256(model.denoiser.state_dict()),
            "latentNormalization": normalization, "stagePassed": False, "capabilityQualificationGranted": False}


# Internal reload evidence only. Not the contract's v7 published/parent format.
CHECKPOINT_SCHEMA = "ai-painter-stage4-formal-component-checkpoint-v1"
MAX_CHECKPOINT_BYTES = 512 * 1024 * 1024


def checkpoint_target(root, logical, identity):
    require(isinstance(identity, dict) and set(identity) == {
        "batchRunId", "runId", "packageId", "capabilityVersion", "executionPackage", "stage"},
        "formal checkpoint execution identity fields invalid")
    for key in ("batchRunId", "runId", "packageId", "capabilityVersion"):
        require(isinstance(identity[key], str) and re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,127}", identity[key]),
                "invalid formal checkpoint " + key)
    binding = identity["executionPackage"]
    require(isinstance(binding, dict) and set(binding) == {"path", "sha256"}
            and isinstance(binding["sha256"], str) and re.fullmatch(r"[a-f0-9]{64}", binding["sha256"]),
            "formal checkpoint package binding missing")
    package_bytes = project_file(Path(root), binding["path"]).read_bytes()
    require(digest(package_bytes) == binding["sha256"], "formal checkpoint package hash mismatch")
    package = json.loads(package_bytes)
    require(isinstance(package, dict)
            and package.get("schemaVersion") == "ai-painter-stage4-v2-formal-stage-execution-package-v1"
            and all(package.get(key) == identity[key] for key in ("runId", "packageId", "capabilityVersion", "stage")),
            "formal checkpoint identity differs from execution package")
    number = identity["stage"].get("stage") if isinstance(identity["stage"], dict) else None
    require(type(number) is int and number in (0, 1, 2)
            and identity["stage"] == {"stage": number, "width": 256 * 2**number,
                                     "height": 192 * 2**number, "epochCount": 40},
            "formal checkpoint stage schedule invalid")
    prefix = (".runtime/ai-painter/stage4-v2-formal-executions/" + identity["batchRunId"]
              + "/stages/" + identity["runId"] + "/")
    require(package.get("outputTerminalPath") == prefix + "phase-terminal.json",
            "formal checkpoint batch differs from execution package")
    require(isinstance(logical, str) and logical.startswith(prefix) and logical.endswith(".pt"),
            "formal checkpoint outside its execution namespace")
    return project_file(Path(root), logical)


def cpu_normalization(normalization):
    require(isinstance(normalization, dict) and set(normalization) == {
        "mean", "standardDeviation", "version", "sampleCount", "valueCountPerChannel"},
            "latent normalization keys invalid")
    require(normalization["version"] == "per_channel_train_split_v1"
            and type(normalization["sampleCount"]) is int and normalization["sampleCount"] == 48
            and type(normalization["valueCountPerChannel"]) is int and normalization["valueCountPerChannel"] > 0,
            "latent normalization provenance invalid")
    result = {key: normalization[key] for key in ("version", "sampleCount", "valueCountPerChannel")}
    for key in ("mean", "standardDeviation"):
        value = normalization[key]
        require(isinstance(value, torch.Tensor) and value.is_floating_point()
                and tuple(value.shape) == (1, 12, 1, 1) and torch.isfinite(value).all().item(),
                "latent normalization tensor invalid")
        require(key != "standardDeviation" or (value > 0).all().item(), "latent scale must be positive")
        result[key] = value.detach().cpu().clone()
    return result


def write_formal_training_checkpoint(*, root, checkpoint_path, identity, epoch_evidence,
                                     model, config, latent_normalization):
    """Persist a pending-review training artifact, never a stage-pass decision.

    Selection belongs to the qualified lifecycle. This writer neither selects a
    best epoch nor licenses this checkpoint as a parent. A partial file remains
    on failure; the exact path cannot be overwritten or silently retried.
    This is an internal component snapshot, NOT the formal contract's v7
    checkpoint. Production-format export and its parent loader are not supplied
    by this component and must not consume this snapshot as a formal parent.
    """
    target = checkpoint_target(root, checkpoint_path, identity)
    require(epoch_evidence.get("schemaVersion") == "ai-painter-stage4-formal-full-split-epoch-v1"
            and epoch_evidence.get("stage") == identity["stage"], "formal checkpoint epoch binding mismatch")
    require(epoch_evidence["validationEvidence"]["modelStateAfter"] == state_hash(model.state_dict()),
            "formal checkpoint differs from evaluated model")
    require(epoch_evidence["stepEvidence"]["optimizerSteps"] == 48
            and epoch_evidence["stepEvidence"]["nonTrainOptimizerSteps"] == 0,
            "formal checkpoint lacks complete train-step evidence")
    frozen = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="after_training")
    denoiser = {key: value.detach().cpu().clone() for key, value in model.denoiser.state_dict().items()}
    require(all(torch.isfinite(value).all().item() for value in denoiser.values()), "nonfinite checkpoint state")
    payload = {"schemaVersion": CHECKPOINT_SCHEMA, "status": "training_checkpoint_pending_review",
        "componentSnapshotOnly": True, "formalCheckpointCompatible": False,
        "identity": deepcopy(identity), "configSha256": digest(canonical_bytes(config)),
        "denoiserState": denoiser, "denoiserStateSha256": state_hash(denoiser),
        "foundationStateSha256": frozen["stateSha256"],
        "latentNormalization": cpu_normalization(latent_normalization),
        "epochEvidence": deepcopy(epoch_evidence), "stagePassed": False, "capabilityReleased": False}
    payload["latentNormalizationSha256"] = state_hash(payload["latentNormalization"])
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    require(buffer.tell() <= MAX_CHECKPOINT_BYTES, "formal checkpoint exceeds byte limit")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as stream:
        stream.write(buffer.getbuffer())
        stream.flush()
        os.fsync(stream.fileno())
    return {"checkpoint": {"path": checkpoint_path, "sha256": digest(buffer.getvalue())},
            "status": payload["status"], "denoiserStateSha256": payload["denoiserStateSha256"],
            "stagePassed": False, "capabilityReleased": False}


def reload_formal_training_checkpoint(*, root, checkpoint, expected_identity, model, config):
    """Same-execution reloading proof, not a cross-stage parent authorization.

    The lifecycle separately verifies the successful predecessor and review
    before any cross-stage use. Smoke/experiment payloads are not accepted.
    """
    require(isinstance(checkpoint, dict) and set(checkpoint) == {"path", "sha256"}, "checkpoint binding invalid")
    target = checkpoint_target(root, checkpoint["path"], expected_identity)
    with target.open("rb") as stream:
        data = stream.read(MAX_CHECKPOINT_BYTES + 1)
    require(len(data) <= MAX_CHECKPOINT_BYTES and digest(data) == checkpoint["sha256"],
            "formal checkpoint byte identity mismatch")
    payload = torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
    require(payload.get("schemaVersion") == CHECKPOINT_SCHEMA
            and payload.get("status") == "training_checkpoint_pending_review"
            and payload.get("componentSnapshotOnly") is True and payload.get("formalCheckpointCompatible") is False
            and payload.get("stagePassed") is False and payload.get("capabilityReleased") is False,
            "formal checkpoint scope invalid")
    require(payload["identity"] == expected_identity, "formal checkpoint execution mismatch")
    require(payload["configSha256"] == digest(canonical_bytes(config)), "formal checkpoint config mismatch")
    frozen = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    require(payload["foundationStateSha256"] == frozen["stateSha256"], "formal checkpoint foundation mismatch")
    state, current = payload["denoiserState"], model.denoiser.state_dict()
    require(isinstance(state, dict) and set(state) == set(current) and all(
        isinstance(value, torch.Tensor) and value.shape == current[key].shape
        and value.dtype == current[key].dtype and torch.isfinite(value).all().item()
        for key, value in state.items()), "formal checkpoint state structure invalid")
    require(state_hash(state) == payload["denoiserStateSha256"], "formal checkpoint state hash mismatch")
    normalization = cpu_normalization(payload["latentNormalization"])
    require(state_hash(normalization) == payload["latentNormalizationSha256"], "formal normalization hash mismatch")
    model.denoiser.load_state_dict(state, strict=True)
    model.eval()
    require(state_hash(model.denoiser.state_dict()) == payload["denoiserStateSha256"], "formal reload state mismatch")
    require(state_hash(model.state_dict()) == payload["epochEvidence"]["validationEvidence"]["modelStateAfter"],
            "formal reload differs from evaluated model")
    validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="loaded", expected_state_sha256=frozen["stateSha256"])
    return {"status": "training_checkpoint_reloaded_pending_review", "checkpoint": deepcopy(checkpoint),
            "latentNormalization": normalization, "denoiserStateSha256": payload["denoiserStateSha256"],
            "stagePassed": False, "capabilityReleased": False}
