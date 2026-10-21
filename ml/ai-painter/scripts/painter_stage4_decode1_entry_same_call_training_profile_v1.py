"""Versioned G-boundary wiring; no production entry or new numerical policy.

The copied pair body is identical to its bound predecessor except one context
around the existing G forward/VJPs, strictly before the existing G commit.
"""
from contextlib import contextmanager
import torch
import painter_stage4_decode1_entry_weight_training_profile_v1 as original
from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as gradient_bridge

ADAPTER_ID = "parameter90-training-same-call-profile-v1"
PRODUCTION_ACTIVATED = False
UPDATE_LIMIT = original.UPDATE_LIMIT
require = original.require
inherited = original.inherited
generator_fp32_scope = original.generator_fp32_scope
_phase = original._phase
_critic_state = original._critic_state
_d_objective = original._d_objective
_update_discriminator = original._update_discriminator
commit_generator_step = original.commit_generator_step


@contextmanager
def _same_call_scope(factory, model, sample, counts, resource):
    if factory is None:
        yield
        return
    observer = factory(model, sample, dict(counts), resource)
    previous = gradient_bridge._OBSERVER.get()
    def observe(stage, label, rows):
        if previous is not None:
            previous(stage, label, rows)
        observer(stage, label, rows)
    try:
        with observer, gradient_bridge.observe_generator_gradients(observe):
            yield
    except BaseException as error:
        try:
            error.parameter90_same_call_packet = observer.packet
            error.parameter90_same_call_outcome = observer.outcome
        except Exception:
            pass
        raise


def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
        counts, ledger_row, resource, forward, after_update=lambda name, loss: None, *, update_limit=UPDATE_LIMIT,
        prediction_observer=None, components=None, same_call_context=None):
    api = original._component_profile(components)
    require(type(update_limit) is int and update_limit == UPDATE_LIMIT, "fixed 1152 update limit required")
    require(sample.get("split") == "train" and sample.get("sampleId") == ledger_row["sampleId"], "update source differs")
    require(tuple(order) == tuple(model.condition_channel_order), "update channel order differs")
    require(all(type(counts.get(k)) is int and 0 <= counts[k] < update_limit for k in ("generator", "discriminator")), "optimizer step budget exhausted")
    bound = api._bound_device(model, sample); device = next(model.parameters()).device
    entry = inherited.v24._critic_mode_snapshot(critic)
    primary = None
    preview_error = None
    try:
        generator_optimizer.zero_grad(set_to_none=True); resource()
        _phase(critic, True)
        with torch.no_grad(), generator_fp32_scope(device):
            detached = api.sample_forward(model, bound)
        d_loss, _ = _d_objective(critic, detached, bound, device)
        before = counts["discriminator"]
        try:
            _update_discriminator(critic_optimizer, d_loss, critic, bound, "discriminator", counts, update_limit, resource)
        finally:
            ledger_row["discriminator"] += counts["discriminator"] - before
        after_update("discriminator", float(d_loss.detach()))
        require(all(p.grad is None for p in model.parameters()), "D leaked generator gradient")
        critic_optimizer.zero_grad(set_to_none=True)
        _phase(critic, False); frozen = _critic_state(critic)
        with _same_call_scope(same_call_context, model, bound, counts, resource):
            with generator_fp32_scope(device):
                prediction = api.sample_forward(model, bound)
                if prediction_observer is not None:
                    try:
                        prediction_observer(prediction, bound, dict(counts))
                    except Exception as secondary:
                        # Optional diagnostics cannot prevent the original G objective.
                        # Safety/control BaseExceptions and resource() remain unchanged.
                        preview_error = {"errorType": type(secondary).__name__, "availabilityCode": "capture_failed"}
                total, candidate, facts = api._generator_candidate(model, critic, bound, order, prediction)
        before = counts["generator"]
        try:
            commit_generator_step(optimizer=generator_optimizer, model=model, candidate_gradients=candidate,
                sample=bound, counts=counts, limit=update_limit, check_resource=resource,
                gradient_validator=inherited.core.gpu.gradient_facts)
        finally:
            ledger_row["generator"] += counts["generator"] - before
        inherited.v24._require_critic_phase(critic, training=False, trainable=False)
        require(_critic_state(critic) == frozen, "G changed frozen critic")
        after_update("generator", float(total.detach()))
        result = {"generatorLoss": float(total.detach()), "discriminatorLoss": float(d_loss.detach()),
            "fiveGradientFacts": facts, "criticGeneratorPhaseUnchanged": True}
        if preview_error is not None:
            result["trainingPreviewSecondaryError"] = preview_error
        return result
    except BaseException as error:
        if preview_error is not None:
            try: error.training_preview_secondary_error = preview_error
            except Exception: pass
        primary = error; raise
    finally:
        try: inherited.v24._restore_critic_mode_snapshot(entry)
        except BaseException as secondary:
            if primary is None: raise
            try: primary.secondary_restore_error = str(secondary)
            except BaseException: pass


