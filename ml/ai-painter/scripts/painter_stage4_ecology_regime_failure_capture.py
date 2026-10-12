"""Standalone bounded diagnostic loop component; no CLI or production dispatch.

The future authenticated supervisor supplies train data, fresh model binding,
resources and an immutable capture sink. This file never modifies the 48-epoch
lifecycle or provides registry/consumption/GPU admission. Test seams are labelled.
"""
from __future__ import annotations
from dataclasses import dataclass
import random
import time

from ai_painter.complete_world.ecology_regime_gradient_failure_capture import primary_error, require

SCHEMA = "ecology-regime-bounded-failure-capture-loop-v1"
CAPABILITY = "stage4_mvp256_dry_factorized_ecology_v1"
PROFILE = "factorized_ecology_failure_capture_component_v1"
SEED, LIMIT, WALL_SECONDS = 20260929, 600, 2700


def _attach(error, name, value):
    try:
        setattr(error, name, value)
    except BaseException:
        pass


@dataclass(frozen=True)
class SimulationSeam:
    """Only tests may replace numerical calls; outputs explicitly say simulated."""
    fresh_networks: object
    optimizers: object
    perform_pair: object


def run_capture_loop(*, train, order, resource, capture_sink, context_for_sample,
                     clock=time.monotonic, simulation=None, device=None,
                     initial_observer=lambda model, critic: None, progress_observer=lambda value: None):
    require(type(train) is list and len(train) == 48 and
            all(type(row) is dict and row.get("split") == "train" and type(row.get("sampleId")) is str for row in train) and
            len({row["sampleId"] for row in train}) == 48, "exact48 unique train records required")
    require(simulation is None or type(simulation) is SimulationSeam, "unknown simulation seam")
    counts = {"generator": 0, "discriminator": 0}
    completed_epochs, position, current = 0, None, None
    start = clock()
    model = critic = None
    mode = "simulated_cpu_component_test" if simulation is not None else "numerical_component_not_authenticated_dispatch"

    def bounded_resource():
        require(clock() - start < WALL_SECONDS, "diagnostic wall deadline reached")
        require(all(type(n) is int and 0 <= n <= LIMIT for n in counts.values()), "diagnostic actual count boundary exceeded")
        resource()

    try:
        bounded_resource()
        if simulation is None:
            import torch
            require(device == "cuda:0" and torch.cuda.is_initialized(),
                    "future qualified CUDA dispatch required; component cannot initialize CUDA")
            import painter_stage4_ecology_regime_training_profile as profile
            model, critic = profile.fresh_networks(order)
            initial_observer(model, critic)
            model, critic = model.to(device), critic.to(device)
            args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
            go, do = torch.optim.AdamW(model.parameters(), **args), torch.optim.AdamW(critic.parameters(), **args)
            pair = profile.perform_pair
        else:
            model, critic = simulation.fresh_networks(order)
            initial_observer(model, critic)
            go, do = simulation.optimizers(model, critic)
            pair = simulation.perform_pair
        epoch = 0
        while counts["generator"] < LIMIT and counts["discriminator"] < LIMIT:
            epoch += 1
            indices = list(range(48))
            random.Random(SEED + epoch).shuffle(indices)
            for sample_position, index in enumerate(indices):
                if counts["generator"] >= LIMIT or counts["discriminator"] >= LIMIT:
                    break
                bounded_resource()
                current = train[index]
                position = {"epoch": epoch, "zeroBasedEpochPosition": sample_position,
                            "trainIndex": index, "sampleId": current["sampleId"]}
                before = dict(counts)
                ledger = {"sampleId": current["sampleId"], "generator": 0, "discriminator": 0}
                pair(model, critic, current, order, go, do, counts, ledger, bounded_resource, None)
                require(ledger == {"sampleId": current["sampleId"], "generator": 1, "discriminator": 1} and
                        counts == {key: value + 1 for key, value in before.items()}, "diagnostic pair/count ledger differs")
                bounded_resource()
                progress_observer({"epoch": epoch, "position": dict(position),
                    "optimizerSteps": dict(counts),
                    "completedEpochs": epoch if sample_position == 47 else completed_epochs})
            if sample_position == 47 and counts["generator"] == epoch * 48 and counts["discriminator"] == epoch * 48:
                completed_epochs = epoch
        return {"schema": SCHEMA, "executionProfile": PROFILE, "mode": mode,
                "status": "bounded_diagnostic_completed", "captureStatus": "capture_not_triggered",
                "optimizerSteps": dict(counts), "completedEpochs": completed_epochs,
                "lastPosition": position, "elapsedSeconds": clock() - start,
                "automaticRetries": 0, "checkpointSelectionExecuted": False,
                "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
                "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
                "productionExecutionAuthenticated": False}
    except BaseException as error:
        # Preserve exact partial counts and re-raise the SAME primary exception.
        _attach(error, "actual_optimizer_counts", dict(counts))
        _attach(error, "completed_epochs", completed_epochs)
        _attach(error, "failure_position", position)
        _attach(error, "capture_loop_mode", mode)
        try:
            context = context_for_sample(current, position)
            require(type(context) is dict, "capture context must be a dictionary")
            context = {**context, "failurePosition": position, "optimizerSteps": dict(counts)}
            receipt = capture_sink(error, model=model, critic=critic, context=context)
            _attach(error, "ecology_failure_capture_receipt", receipt)
        except BaseException as secondary:
            _attach(error, "ecology_failure_capture_receipt", {"status": "capture_incomplete",
                "primaryError": primary_error(error), "secondaryCaptureFailure": primary_error(secondary)})
        raise
