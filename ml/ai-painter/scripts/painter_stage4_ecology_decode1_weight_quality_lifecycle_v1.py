# NS-003 independent identity adapter; inherited pure algorithms, no old qualification.
"""Independent quality lifecycle: 12 epochs, one selection, strict reload and real failure capture.

This is not a production entry point. The supervisor must independently bind and
authenticate the final program, execution package and own CPU/GPU evidence.
"""
from copy import deepcopy
import hashlib
import random
import torch
import painter_stage4_ecology_decode1_weight_training_profile_v1 as profile
import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
import ecology_quality_ranking_v1 as ranking
from ai_painter.complete_world.object_ecology_decode1_weight_precision_v1 import validate_model_identity
from ai_painter.complete_world.ecology_decode1_weight_checkpoint_v1 import CAPABILITY
from ai_painter.complete_world.object_ecology_regime_input_cpu import require

TERMINAL_SCHEMA = "ecology-decode1-weight-quality-lifecycle-terminal-v1"


def checkpoint_components():
    from ai_painter.complete_world import ecology_decode1_weight_checkpoint_v1 as checkpoint
    return checkpoint


def validation_epoch(model, samples, order, *, epoch):
    """Existing ranking and metrics; only the two-code forward is new."""
    validate_model_identity(model)
    require(len(samples) == 8 and len({s["sampleId"] for s in samples}) == 8,
            "complete eight validation samples required")
    rows = []
    before = shared.v24.core.cpu.state_hash(model)
    with shared._preserve_rng_and_mode(model), torch.no_grad():
        model.eval()
        for sample in samples:
            require(sample["split"] == "validation", "selection requires validation")
            device = next(model.parameters()).device
            bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
            predicted = profile.sample_forward(model, bound)
            _, values = shared.original_object_class_spatial_loss(predicted, bound, order, split="validation")
            rows.append({"sampleId": sample["sampleId"], "split": "validation", "epoch": epoch,
                "fullRgbMae": float((predicted[0] - bound["image"]).abs().mean()),
                "objectCorrelations": {role: None if values.get(role) is None else float(values[role])
                                       for role in shared.OBJECT_CHANNELS}})
    require(before == shared.v24.core.cpu.state_hash(model), "validation mutated model")
    return ranking.rank_validation_epoch(rows, [s["sampleId"] for s in samples], epoch=epoch, eligible_epochs=(12,)), rows


def training_loop(*, model, critic, train, validation, order, configuration, package_binding,
                  plan, plan_binding, resource, checkpoint_sink, progress_sink,
                  capture_sink=None, context_for_sample=None,
                  pair_runner=None, validation_runner=None, checkpoint_encoder=None,
                  checkpoint_reloader=None, network_factory=None, optimizer_factory=None):
    """Frozen 12��48 schedule through explicit, testable dependencies.

    Hooks support isolated simulated tests, not permissions or source eligibility.
    The final factory is explicitly the ecology factory, never the old default.
    """
    checkpoint = checkpoint_components()
    checkpoint.validate_configuration(configuration)
    validate_model_identity(model)
    require(plan.get("capabilityVersion") == CAPABILITY
            and plan.get("configuration") == configuration
            and type(plan.get("runId")) is str and bool(plan["runId"])
            and type(plan.get("packageId")) is str and plan["packageId"] != plan["runId"],
            "lifecycle plan/configuration identity differs")
    checkpoint.exact_binding(package_binding)
    checkpoint.exact_binding(plan["datasetManifest"])
    require(tuple(order) == tuple(model.condition_channel_order), "lifecycle condition order differs")
    shared._validate_samples(train, validation)
    pair_runner = pair_runner or profile.perform_pair
    validation_runner = validation_runner or validation_epoch
    checkpoint_encoder = checkpoint_encoder or checkpoint.encode
    checkpoint_reloader = checkpoint_reloader or checkpoint.reload
    network_factory = network_factory or profile.fresh_networks
    counts = {"generator": 0, "discriminator": 0}
    records = []; selected = None; completed_epochs = 0
    optimizer = configuration["optimizer"]
    require(optimizer == shared.v24.core.TRAINING["optimizer"], "optimizer formula differs")
    args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
    optimizer_factory = optimizer_factory or torch.optim.AdamW
    current = position = None
    try:
        go = optimizer_factory(model.parameters(), **args)
        do = optimizer_factory(critic.parameters(), **args)
        for epoch in range(1, 13):
            indices = list(range(48))
            random.Random(configuration["seed"] + epoch).shuffle(indices)
            for ordinal, index in enumerate(indices):
                current = train[index]
                position = {"epoch": epoch, "zeroBasedEpochPosition": ordinal,
                    "trainIndex": index, "sampleId": current["sampleId"]}
                resource()
                ledger = {"sampleId": train[index]["sampleId"], "generator": 0, "discriminator": 0}
                pair_runner(model, critic, train[index], order, go, do, counts, ledger, resource, None)
                require(ledger == {"sampleId": train[index]["sampleId"], "generator": 1, "discriminator": 1},
                        "actual pair ledger differs")
                progress_sink(epoch, dict(counts), deepcopy(selected), completed_epochs=completed_epochs)
            require(counts == {"generator": epoch * 48, "discriminator": epoch * 48}, "actual epoch counts differ")
            completed_epochs = epoch
            if epoch == 12:
                resource()
                selection, observations = validation_runner(model, validation, order, epoch=epoch)
                checkpoint.validate_selection(configuration, plan["runId"], epoch, selection, counts)
                raw = checkpoint_encoder(model, critic, configuration=configuration, run_id=plan["runId"],
                    package_binding=package_binding, dataset_binding=plan["datasetManifest"],
                    epoch=epoch, selection=selection, counts=dict(counts),
                    program_bindings=plan["programBindings"], plan_binding=plan_binding)
                binding = checkpoint_sink(epoch, raw)
                checkpoint.exact_binding(binding)
                require(binding["sha256"] == hashlib.sha256(raw).hexdigest(), "checkpoint sink SHA differs")
                record = {"epoch": epoch, "selection": deepcopy(selection), "validation": observations,
                          "checkpoint": binding, "counts": dict(counts)}
                records.append(record)
                if ranking.prefer_checkpoint(selection, None if selected is None else selected["selection"], eligible_epochs=(12,)):
                    selected = record
            progress_sink(epoch, dict(counts), deepcopy(selected), completed_epochs=completed_epochs)
        require(selected is not None and len(records) == 1, "fixed selected checkpoint missing")
        resource()
        cpu_model, cpu_critic = network_factory(order)
        validate_model_identity(cpu_model)
        raw = checkpoint_sink(None, selected["checkpoint"])
        require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == selected["checkpoint"]["sha256"],
                "selected checkpoint changed before reload")
        checkpoint_reloader(raw, model=cpu_model, critic=cpu_critic, configuration=configuration,
            run_id=plan["runId"], package_binding=package_binding, dataset_binding=plan["datasetManifest"],
            epoch=selected["epoch"], selection=selected["selection"], counts=selected["counts"],
            program_bindings=plan["programBindings"], plan_binding=plan_binding)
        resource()
        return {"schema": TERMINAL_SCHEMA, "status": "training_completed_review_pending",
            "capabilityVersion": CAPABILITY, "executionPackage": package_binding,
            "runId": plan["runId"], "packageId": plan["packageId"], "completedEpochs": completed_epochs,
            "executionState": "completed", "optimizerSteps": dict(counts),
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "checkpoints": records, "selectedCheckpointRecord": selected,
            "checkpointReloadVerified": True, "captureStatus": "capture_not_triggered", "captureReceipt": None, "challengeContentRead": False, "regressionContentRead": False,
            "checkpointPromotable": False, "formalStage4QualificationAllowed": False,
            "runtimePublicationAllowed": False, "productionExecutionAuthenticated": False}
    except BaseException as error:
        error.actual_optimizer_counts = dict(counts)
        error.partial_checkpoint_records = records
        error.completed_epochs = completed_epochs
        error.failure_position = position
        from ai_painter.complete_world.ecology_regime_gradient_failure_capture import primary_error
        try:
            require(capture_sink is not None and context_for_sample is not None, "capture sink/context unavailable")
            context = context_for_sample(current, position)
            require(type(context) is dict, "capture context must be a dictionary")
            receipt = capture_sink(error, model=model, critic=critic,
                context={**context, "failurePosition": position, "optimizerSteps": dict(counts)})
            error.ecology_failure_capture_receipt = receipt
        except BaseException as secondary:
            error.ecology_failure_capture_receipt = {"status": "capture_incomplete",
                "primaryError": primary_error(error), "secondaryCaptureFailure": primary_error(secondary)}
        raise
