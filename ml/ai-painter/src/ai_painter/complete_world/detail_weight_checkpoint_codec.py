"""CPU-only complete state codec. This module never grants checkpoint qualification.

The lifecycle must authenticate immutable package bytes and machine selection
evidence independently. Synthetic round trips are not training initialization.
"""
from __future__ import annotations
from copy import deepcopy
import io
import json
import torch
from ai_painter.complete_world.object_appearance_regime_input_cpu import require
from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import (
    CAPABILITY, ARCHITECTURE, NUMERIC_RULE, validate_model_identity)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

SCHEMA = "detail-weight-complete-cpu-state-v1"
MAX_BYTES = 64 * 1024 * 1024
_KEYS = {"schema", "capability", "architecture", "numericRule", "bindings", "graph", "counts", "generator", "discriminator"}


def frozen_training_config():
    # Use the actual immutable execution plan rather than a second configuration.
    from painter_stage4_appearance_regime_probe import core
    return deepcopy(core.TRAINING)


def _counts(counts):
    require(type(counts) is dict and set(counts) == {"generator", "discriminator"}, "counts keys differ")
    require(all(type(v) is int and 0 <= v <= 2304 for v in counts.values()), "actual counts invalid")
    require(counts["generator"] <= counts["discriminator"], "G count exceeds completed D count")
    return dict(counts)


def _bindings(*, run_id, dataset_identity, synthetic, training_config):
    require(type(run_id) is str and bool(run_id.strip()), "Run binding missing")
    require(type(dataset_identity) is dict and bool(dataset_identity), "dataset binding missing")
    require(type(synthetic) is bool, "synthetic marker must be explicit")
    require(training_config == frozen_training_config(), "frozen training config differs")
    value = {"runId": run_id, "datasetIdentity": dataset_identity, "synthetic": synthetic,
             "trainingConfig": training_config}
    # JSON identity disallows NaN and custom object/pickle metadata.
    return json.loads(json.dumps(value, sort_keys=True, allow_nan=False))


def _graph(network):
    return [{"name": n, "shape": list(p.shape), "dtype": str(p.dtype)} for n, p in network.named_parameters()]


def _state(state, reference, label):
    require(type(state) is dict and list(state) == list(reference), label + " complete keys/order differ")
    result = {}
    for name, expected in reference.items():
        value = state[name]
        require(type(value) is torch.Tensor and value.device.type == "cpu" and not value.requires_grad
                and value.layout == torch.strided and value.shape == expected.shape and value.dtype == expected.dtype,
                label + " shape/dtype/CPU differs: " + name)
        require(bool(torch.isfinite(value).all()), label + " nonfinite: " + name)
        if name.endswith("identity"):
            require(torch.equal(value, expected), label + " numeric/regime identity differs: " + name)
        # Detach caller storage before either destination is mutated.
        result[name] = value.detach().clone()
    return result


def _critic(critic):
    require(all(p.device.type == "cpu" for p in critic.parameters()), "critic must be CPU")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        reference = build_conditional_texture_discriminator()
    require(type(critic) is type(reference) and _graph(critic) == _graph(reference), "critic graph differs")
    return reference.state_dict()


def _require_installed_state(network, verified, label):
    """Loader success is not evidence: inspect every installed tensor byte."""
    installed = network.state_dict()
    require(list(installed) == list(verified), label + " installed complete keys/order differ")
    for name, expected in verified.items():
        actual = installed[name]
        require(type(actual) is torch.Tensor and actual.device.type == "cpu"
                and actual.layout == torch.strided and actual.shape == expected.shape and actual.dtype == expected.dtype,
                label + " installed shape/dtype/CPU differs: " + name)
        require(torch.equal(actual.detach().contiguous().reshape(-1).view(torch.uint8),
                            expected.contiguous().reshape(-1).view(torch.uint8)),
                label + " installed tensor differs: " + name)


def encode_checkpoint(*, model, critic, counts, run_id, dataset_identity, synthetic, training_config):
    validate_model_identity(model)
    require(all(p.device.type == "cpu" for p in model.parameters()), "generator must be CPU")
    bindings = _bindings(run_id=run_id, dataset_identity=dataset_identity, synthetic=synthetic, training_config=training_config)
    return {"schema": SCHEMA, "capability": CAPABILITY, "architecture": ARCHITECTURE, "numericRule": NUMERIC_RULE,
            "bindings": bindings, "counts": _counts(counts),
            "graph": {"generator": _graph(model), "discriminator": _graph(critic)},
            "generator": _state(dict(model.state_dict()), model.state_dict(), "generator"),
            "discriminator": _state(dict(critic.state_dict()), _critic(critic), "discriminator")}


def decode_checkpoint(payload, *, model, critic, expected_counts, run_id, dataset_identity, synthetic, training_config):
    """Validate all metadata and both states before any writes; rollback late failure.

    Optimizer/RNG/lifecycle restoration is deliberately outside this model-state
    codec. A caller cannot turn a diagnostic payload into a valid envelope by
    supplying a verified flag; the exact schema accepts no such flags.
    """
    validate_model_identity(model)
    require(all(p.device.type == "cpu" for p in model.parameters()), "generator must be CPU")
    require(type(payload) is dict and set(payload) == _KEYS, "checkpoint schema/complete fields differ")
    require((payload["schema"], payload["capability"], payload["architecture"], payload["numericRule"]) ==
            (SCHEMA, CAPABILITY, ARCHITECTURE, NUMERIC_RULE), "checkpoint numeric identity differs")
    expected = _bindings(run_id=run_id, dataset_identity=dataset_identity, synthetic=synthetic, training_config=training_config)
    require(payload["bindings"] == expected, "Run/dataset/config binding differs")
    require(_counts(payload["counts"]) == _counts(expected_counts), "actual counts binding differs")
    require(payload["graph"] == {"generator": _graph(model), "discriminator": _graph(critic)}, "parameter graph differs")
    generator = _state(payload["generator"], model.state_dict(), "generator")
    discriminator = _state(payload["discriminator"], _critic(critic), "discriminator")
    before_g = {k: v.detach().clone() for k, v in model.state_dict().items()}
    before_d = {k: v.detach().clone() for k, v in critic.state_dict().items()}
    try:
        model.load_state_dict(generator, strict=True)
        critic.load_state_dict(discriminator, strict=True)
        validate_model_identity(model)
        _require_installed_state(model, generator, "generator")
        _require_installed_state(critic, discriminator, "discriminator")
    except BaseException as primary:
        for network, state in ((model, before_g), (critic, before_d)):
            try:
                # Direct tensor restoration also handles a deliberately failing loader.
                with torch.no_grad():
                    for name, target in network.state_dict().items():
                        target.copy_(state[name])
            except BaseException as secondary:
                primary.add_note("secondary checkpoint rollback failure: " + str(secondary)) if hasattr(primary, "add_note") else None
        raise
    return {"modelStateLoaded": True, "checkpointQualified": False, "synthetic": synthetic, "counts": dict(expected_counts)}


def serialize_checkpoint(payload):
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    data = buffer.getvalue()
    require(len(data) <= MAX_BYTES, "checkpoint byte limit exceeded")
    return data


def deserialize_checkpoint(data):
    require(type(data) is bytes and 0 < len(data) <= MAX_BYTES, "checkpoint byte bound invalid")
    return torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
