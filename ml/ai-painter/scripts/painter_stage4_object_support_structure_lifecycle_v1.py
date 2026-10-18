"""Inactive 24x48 support-Loss lifecycle; no admission, background or routing.

All execution sinks and resource supervision belong to the existing authenticated
backend. This module cannot grant execution or model qualification on its own.
"""
from copy import deepcopy
import hashlib
import random
import torch

import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
import ecology_quality_ranking_v1 as ranking
from painter_stage4_ecology_terrain_detail_weight_quality_lifecycle_v1 import observation_scope
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as checkpoint
from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import validate_model_identity

CAPABILITY = checkpoint.CAPABILITY
TERMINAL_SCHEMA = "object-support-structure-quality-lifecycle-terminal-v1"
EXECUTION_QUALIFIED = False
require = checkpoint.require


def profile_components(capability_version=CAPABILITY):
    import object_support_structure_quality_auth_v1 as auth
    return auth.profile_components(capability_version)


def _codec(capability_version=CAPABILITY):
    import object_support_structure_quality_auth_v1 as auth
    return auth.checkpoint_components(capability_version)


def _model_validator(capability_version=CAPABILITY):
    if capability_version == CAPABILITY:
        return validate_model_identity
    return _codec(capability_version).components()[2]


def validation_epoch(model, samples, order, *, epoch, capability_version=CAPABILITY):
    """Unchanged fixed-eight ranking; validation never enters the new Loss."""
    _model_validator(capability_version)(model)
    require(len(samples) == 8 and len({s["sampleId"] for s in samples}) == 8,
        "support lifecycle requires all eight validation samples")
    profile = profile_components(capability_version)
    rows = []
    before = shared.v24.core.cpu.state_hash(model)
    with shared._preserve_rng_and_mode(model), torch.no_grad():
        model.eval()
        for sample in samples:
            require(sample["split"] == "validation", "validation split required")
            predicted = profile.sample_forward(model, sample)
            _, metrics = shared.original_object_class_spatial_loss(predicted, sample, order, split="validation")
            target = sample["image"].detach().to(device=predicted.device)
            rows.append({"sampleId": sample["sampleId"], "split": "validation", "epoch": epoch,
                "fullRgbMae": float((predicted[0] - target).abs().mean()),
                "objectCorrelations": {role: None if metrics.get(role) is None else float(metrics[role])
                    for role in shared.OBJECT_CHANNELS}})
    require(before == shared.v24.core.cpu.state_hash(model), "support validation changed model")
    return ranking.rank_validation_epoch(rows, [s["sampleId"] for s in samples], epoch=epoch,
        eligible_epochs=(12, 24)), rows


def training_loop(*, model, critic, train, validation, order, configuration, package_binding,
        plan, plan_binding, resource, checkpoint_sink, progress_sink, capture_sink=None,
        context_for_sample=None, pair_runner=None, validation_runner=None, checkpoint_encoder=None,
        checkpoint_reloader=None, network_factory=None, optimizer_factory=None, observation_sink=None):
    """Single fixed schedule, actual ledgers and new strict checkpoint identity.

    Injected dependencies support synthetic CPU tests, not qualification. No old
    candidate/configuration, continuation weights or default old pair is accepted.
    """
    capability_version=plan.get("capabilityVersion")
    profile=profile_components(capability_version)
    codec=_codec(capability_version)
    validate=_model_validator(capability_version)
    codec.validate_configuration(configuration)
    validate(model)
    require(plan.get("capabilityVersion") == capability_version and codec._same_json(plan.get("configuration"), configuration)
        and type(plan.get("runId")) is str and bool(plan["runId"])
        and type(plan.get("packageId")) is str and bool(plan["packageId"])
        and plan["packageId"] != plan["runId"], "support lifecycle plan identity differs")
    for binding in (package_binding, plan_binding, plan["modelBinding"], plan["datasetManifest"]):
        codec.exact_binding(binding)
    require(tuple(order) == tuple(model.condition_channel_order), "support lifecycle channel order differs")
    shared._validate_samples(train, validation)
    pair_runner = pair_runner or profile.perform_pair
    validation_runner = validation_runner or (lambda model,samples,order,*,epoch: validation_epoch(model,samples,order,epoch=epoch,capability_version=capability_version))
    checkpoint_encoder = checkpoint_encoder or codec.encode
    checkpoint_reloader = checkpoint_reloader or codec.reload
    network_factory = network_factory or profile.fresh_networks
    optimizer_factory = optimizer_factory or torch.optim.AdamW
    counts = {"generator": 0, "discriminator": 0}
    records, observations, selected = [], [], None
    completed_epochs = 0
    current = position = None
    try:
        # Keep every old optimizer setting, including explicit foreach/fused flags.
        args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
        go, do = optimizer_factory(model.parameters(), **args), optimizer_factory(critic.parameters(), **args)
        for epoch in range(1, 25):
            indices = list(range(48))
            random.Random(configuration["seed"] + epoch).shuffle(indices)
            for ordinal, index in enumerate(indices):
                current = train[index]
                position = {"epoch": epoch, "zeroBasedEpochPosition": ordinal,
                    "trainIndex": index, "sampleId": current["sampleId"]}
                resource()
                ledger = {"sampleId": current["sampleId"], "generator": 0, "discriminator": 0}
                pair_runner(model, critic, current, order, go, do, counts, ledger, resource, None, update_limit=1152)
                require(ledger == {"sampleId": current["sampleId"], "generator": 1, "discriminator": 1},
                    "support pair actual ledger differs")
                progress_sink(epoch, dict(counts), deepcopy(selected), completed_epochs=completed_epochs)
            require(counts == {"generator": epoch*48, "discriminator": epoch*48}, "support epoch actual counts differ")
            completed_epochs = epoch
            if epoch == 12:
                resource()
                with observation_scope(model, critic):
                    metrics, rows = validation_runner(model, validation, order, epoch=epoch)
                expected = ranking.rank_validation_epoch(rows, [s["sampleId"] for s in validation], epoch=12, eligible_epochs=(12,))
                require(codec._same_json(metrics, expected), "support midpoint rows/metrics differ")
                observation = {"epoch": 12, "validation": deepcopy(rows), "metrics": deepcopy(metrics),
                    "checkpointSelectionEligible": False, "weightUpdates": 0, "capabilityVersion": capability_version,
                    "modelCapabilityVersion": codec.MODEL_CAPABILITY, "runId": plan["runId"], "packageId": plan["packageId"],
                    "executionPackage": deepcopy(package_binding), "planBinding": deepcopy(plan_binding),
                    "modelBinding": deepcopy(plan["modelBinding"]), "datasetManifest": deepcopy(plan["datasetManifest"]),
                    "configurationSha256": codec.configuration_digest(configuration), "optimizerSteps": dict(counts)}
                observations.append(observation)
                if observation_sink is not None:
                    with observation_scope(model, critic):
                        observation_binding = observation_sink(12, deepcopy(observation))
                    codec.exact_binding(observation_binding)
                    observation["artifact"] = observation_binding
                resource()
            if epoch == 24:
                resource()
                with observation_scope(model, critic):
                    selection, rows = validation_runner(model, validation, order, epoch=epoch)
                expected = ranking.rank_validation_epoch(rows, [s["sampleId"] for s in validation], epoch=24, eligible_epochs=(24,))
                require(codec._same_json(selection, expected), "support final rows/metrics differ")
                codec.validate_selection(configuration, plan["runId"], epoch, selection, counts)
                raw = checkpoint_encoder(model, critic, configuration=configuration, run_id=plan["runId"],
                    package_binding=package_binding, dataset_binding=plan["datasetManifest"], epoch=epoch,
                    selection=selection, counts=dict(counts), program_bindings=plan["programBindings"], plan_binding=plan_binding)
                binding = checkpoint_sink(epoch, raw)
                codec.exact_binding(binding)
                require(type(raw) is bytes and binding["sha256"] == hashlib.sha256(raw).hexdigest(), "support checkpoint sink SHA differs")
                record = {"epoch": epoch, "selection": deepcopy(selection), "validation": deepcopy(rows),
                    "checkpoint": binding, "counts": dict(counts)}
                records.append(record)
                if ranking.prefer_checkpoint(selection, None if selected is None else selected["selection"], eligible_epochs=(24,)):
                    selected = record
            progress_sink(epoch, dict(counts), deepcopy(selected), completed_epochs=completed_epochs)
        require(selected is not None and len(records) == 1, "support final checkpoint selection missing")
        resource()
        cpu_model, cpu_critic = network_factory(order)
        validate(cpu_model)
        raw = checkpoint_sink(None, selected["checkpoint"])
        require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == selected["checkpoint"]["sha256"],
            "support selected checkpoint changed before reload")
        checkpoint_reloader(raw, model=cpu_model, critic=cpu_critic, configuration=configuration,
            run_id=plan["runId"], package_binding=package_binding, dataset_binding=plan["datasetManifest"],
            epoch=24, selection=selected["selection"], counts=selected["counts"],
            program_bindings=plan["programBindings"], plan_binding=plan_binding)
        resource()
        return {"schema": TERMINAL_SCHEMA, "status": "training_completed_review_pending",
            "capabilityVersion": capability_version, "modelCapabilityVersion": codec.MODEL_CAPABILITY,
            "executionPackage": package_binding, "runId": plan["runId"], "packageId": plan["packageId"],
            "executionState": "completed", "completedEpochs": completed_epochs, "optimizerSteps": dict(counts),
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "checkpoints": records, "selectedCheckpointRecord": selected, "epochObservations": observations,
            "checkpointReloadVerified": True, "captureStatus": "capture_not_triggered", "captureReceipt": None,
            "lossDefinition": configuration["lossDefinition"], "gradientDefinition": configuration["gradientDefinition"],
            "challengeContentRead": False, "regressionContentRead": False, "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
            "productionExecutionAuthenticated": False}
    except BaseException as error:
        error.actual_optimizer_counts = dict(counts)
        error.partial_checkpoint_records = records
        error.epoch_observations = deepcopy(observations)
        error.completed_epochs = completed_epochs
        error.failure_position = position
        from ai_painter.complete_world.ecology_regime_gradient_failure_capture import primary_error
        try:
            require(capture_sink is not None and context_for_sample is not None, "support capture sink/context unavailable")
            context = context_for_sample(current, position)
            require(type(context) is dict, "support capture context must be a dictionary")
            error.object_support_failure_capture_receipt = capture_sink(error, model=model, critic=critic,
                context={**context, "failurePosition": position, "optimizerSteps": dict(counts)})
        except BaseException as secondary:
            error.object_support_failure_capture_receipt = {"status": "capture_incomplete",
                "primaryError": primary_error(error), "secondaryCaptureFailure": primary_error(secondary)}
        raise
