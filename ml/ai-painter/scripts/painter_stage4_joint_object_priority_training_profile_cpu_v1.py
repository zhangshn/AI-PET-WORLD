"""Inactive one-forward/five-VJP joint-priority CPU probe; no training entry."""
import hashlib
import random

import numpy as np
import torch

import painter_stage4_object_support_structure_training_profile_cpu_v1 as support_cpu
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as identity
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as joint
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
from ai_painter.complete_world.native_rgb_object_support_structure_candidate_cpu_v1 import (
    train_object_support_structure_candidate_objective,
)

CANDIDATE_ID = CAPABILITY = "stage4_mvp256_dry_joint_object_priority_real_cpu_v1"
UPDATE_RULE_ID = joint.CANDIDATE_ID
MODEL_CAPABILITY = identity.CAPABILITY
EXECUTION_QUALIFIED = False
COMPONENTS_IN_ORDER = joint.COMPONENTS_IN_ORDER
require = joint.require
bind_parameters = joint.bind_parameters
compute_generator_candidate_gradients = joint.compute_generator_candidate_gradients
observe_generator_gradients = joint.observe_generator_gradients
parent = support_cpu.parent
prepare_metadata = parent.prepare_metadata
bind_sample_ecology = parent.bind_sample_ecology
validate_sample_ecology = parent.validate_sample_ecology
_preserve_probe_state = support_cpu._preserve_probe_state
_network_snapshot = support_cpu._network_snapshot
_plain = support_cpu._plain


def fresh_networks(order):
    require(torch.get_num_threads() <= 2 and parent.core.TRAINING["initializationSeed"] == 20260929,
            "fixed CPU/seed required")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(20260929)
        model = identity.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
    bind_parameters(model)
    return model, critic


def _source(model, sample, order):
    require(sample.get("split") == "train", "CPU generator requires train")
    bind_parameters(model)
    require(tuple(order) == tuple(model.condition_channel_order), "CPU generator condition order differs")
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.device.type == "cpu"
            and value.dtype == torch.float32 and not value.requires_grad and bool(torch.isfinite(value).all()),
            "detached CPU source tensors required")
    validate_sample_ecology(sample)
    return sample


def sample_forward(model, sample, return_evidence=False):
    _source(model, sample, model.condition_channel_order)
    return parent.sample_forward(model, sample, return_evidence=return_evidence)


def rng_fingerprint():
    state = np.random.get_state()
    return {"python": hashlib.sha256(repr(random.getstate()).encode()).hexdigest(),
        "numpy": hashlib.sha256(state[1].tobytes() + repr((state[0], *state[2:])).encode()).hexdigest(),
        "torchCpu": hashlib.sha256(torch.get_rng_state().numpy().tobytes()).hexdigest()}


def gradient_summary(label, rows):
    nonfinite = [i for i, value in enumerate(rows) if value is not None and not bool(torch.isfinite(value).all())]
    return {"label": label, "parameterTensorCount": len(rows), "unusedTensorCount": sum(v is None for v in rows),
        "allFinite": not nonfinite, "nonfiniteTensorIndexes": nonfinite[:16]}


def generator_objective_and_gradients(model, critic, sample, order, prediction):
    _source(model, sample, order)
    require(all(not m.training for m in critic.modules()) and all(not p.requires_grad for p in critic.parameters()),
            "critic must be frozen eval")
    with _preserve_probe_state(model, critic), parent.generator_fp32_scope(torch.device("cpu")):
        total, parts = train_object_support_structure_candidate_objective(
            critic, prediction, sample, sample["objectInstanceTable"], order)
        candidate, facts = compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
            actual_total=total, structured_objective=parts["v21UnchangedTotal"],
            whole_frame_fidelity=parts["wholeFrameFidelity"], object_core_rgb=parts["objectCoreRgbWeighted"],
            object_support_structure=parts["objectSupportStructureWeighted"])
    return total, parts, candidate, facts


def zero_update_probe(model, critic, sample, order, resource, *, event=None, failure_evidence=None):
    """One actual G invocation and five independent gradients, never an update.

Exceptions retain the original error and only finite JSON summaries.  Raw
gradients attached by the frozen rule remain in memory, never in the report.
"""
    calls = {"generatorForwards": 0, "generatorForwardCompleted": 0,
        "generatorAutogradAttempts": 0, "generatorAutograd": 0, "discriminatorAutograd": 0,
        "optimizerConstruction": 0, "optimizerUpdates": 0}
    completed, summaries = [], []
    before_rng = rng_fingerprint()

    def observed(stage, label, rows):
        if stage == "attempt":
            require(calls["generatorAutogradAttempts"] < 5, "five G VJP ceiling")
            calls["generatorAutogradAttempts"] += 1
        elif stage == "complete":
            completed.append(label)
            calls["generatorAutograd"] += 1
            summaries.append(gradient_summary(label, rows))
        resource()
        if event is not None:
            event(stage, label, None)

    def forward_seen(*args):
        require(calls["generatorForwards"] == 0, "single shared forward ceiling")
        calls["generatorForwards"] += 1

    try:
        _source(model, sample, order)
        require(not torch.cuda.is_initialized(), "CPU probe cannot inherit initialized CUDA")
        with _preserve_probe_state(model, critic):
            parent._phase(critic, False)
            model.eval()
            handle = model.register_forward_pre_hook(forward_seen)
            primary = None
            try:
                resource()
                if event is not None:
                    event("attempt", "forward", None)
                prediction, evidence = sample_forward(model, sample, return_evidence=True)
                calls["generatorForwardCompleted"] += 1
                if event is not None:
                    event("complete", "forward", None)
                resource()
                with observe_generator_gradients(observed):
                    total, parts, candidate, facts = generator_objective_and_gradients(
                        model, critic, sample, order, prediction)
                require(calls["generatorForwards"] == calls["generatorForwardCompleted"] == 1
                    and calls["generatorAutogradAttempts"] == calls["generatorAutograd"] == 5
                    and tuple(completed) == COMPONENTS_IN_ORDER, "one-forward/five-independent-VJP protocol differs")
                require(facts["candidateId"] == UPDATE_RULE_ID and facts["actualTotalProvenanceVerified"] is True,
                        "frozen joint update identity/provenance differs")
                result = {"candidateId": CANDIDATE_ID, "updateRuleId": UPDATE_RULE_ID,
                    "modelCapabilityVersion": MODEL_CAPABILITY, "passed": True,
                    "status": "real_cpu_zero_update_observation_not_qualified", "loss": float(total.detach()),
                    "lossParts": _plain(parts), "fiveGradientFacts": facts, "callCounts": dict(calls),
                    "completedGradientLabels": list(completed), "gradientSummaries": list(summaries),
                    "objectCount": evidence["objectCount"], "optimizerCreated": False, "optimizerUpdates": 0,
                    "gpuInitialized": False, "trainingGranted": False, "gpuQualificationGranted": False,
                    "formalStage4QualificationGranted": False}
                resource()
            except BaseException as error:
                primary = error
                raise
            finally:
                try:
                    handle.remove()
                except BaseException as secondary:
                    if primary is None:
                        raise
                    primary.secondary_hook_cleanup_error = str(secondary)[:2048]
        after_rng = rng_fingerprint()
        require(before_rng == after_rng, "probe RNG fingerprint differs")
        result.update(modelCriticStateGradUnchanged=True, rngUnchanged=True,
            rngBefore=before_rng, rngAfter=after_rng)
        return result
    except BaseException as error:
        failure = {"originalError": {"type": type(error).__name__, "message": str(error)[:4096]},
            "callCounts": dict(calls), "completedGradientLabels": list(completed),
            "gradientSummaries": list(summaries), "gradientSetsAvailable": len(summaries),
            "rngBefore": before_rng, "rngAfter": rng_fingerprint(),
            "secondaryProbeErrors": getattr(error, "secondary_probe_errors", []),
            "secondaryHookCleanupError": getattr(error, "secondary_hook_cleanup_error", None),
            "gpuQualificationGranted": False, "trainingGranted": False}
        try:
            error.joint_probe_evidence = failure
            if failure_evidence is not None:
                failure_evidence.update(failure)
        except BaseException as secondary:
            try:
                error.secondary_failure_evidence_error = str(secondary)[:2048]
            except BaseException:
                pass
        raise
