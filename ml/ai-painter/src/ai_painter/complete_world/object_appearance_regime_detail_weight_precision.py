"""Explicit numerical successor; no registry, training or old-type bypass."""
from __future__ import annotations
import hashlib
from copy import copy
import torch
from torch import nn
from ai_painter.complete_world import object_appearance_regime_bias_precision as old
from ai_painter.complete_world.object_appearance_regime_input_cpu import require, validate_regime
from ai_painter.complete_world.detail_weight_reduction_precision import (
    detail_weight_reduction_precision, NUMERIC_RULE as WEIGHT_RULE)

CAPABILITY = "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1"
ARCHITECTURE = "fresh_v23_four_heads_zero_season_rgb_bias_fp64_detail_weight_fp64_v1"
NUMERIC_RULE = old.NUMERIC_RULE + "|" + WEIGHT_RULE
TARGET = "core.core.terrain.full_resolution_detail.layers.0"
TARGET_PARAMETER = TARGET + ".weight"


def _fork_target_ancestors(module, path):
    """Copy containers along the target path; keep every Parameter object.

    The caller's old model retains its original convolution and old identity.
    Other immutable leaf modules can be shared without installing the new op there.
    """
    if not path:
        return PrecisionDetailWeightConv(module)
    result = copy(module)
    for attribute in ("_modules", "_parameters", "_buffers", "_forward_hooks",
                      "_forward_pre_hooks", "_backward_hooks", "_backward_pre_hooks"):
        setattr(result, attribute, getattr(module, attribute).copy())
    result._non_persistent_buffers_set = module._non_persistent_buffers_set.copy()
    key = path[0]
    result._modules[key] = _fork_target_ancestors(module._modules[key], path[1:])
    return result


def identity_bytes(kind):
    if kind == "regime":
        return old.identity_bytes("regime")
    require(kind == "numeric", "unknown identity kind")
    text = "|".join((CAPABILITY, ARCHITECTURE, NUMERIC_RULE))
    return torch.tensor(list(hashlib.sha256(text.encode()).digest()), dtype=torch.uint8, device="cpu")


class PrecisionDetailWeightConv(nn.Conv2d):
    def __init__(self, original):
        require(type(original) is nn.Conv2d and tuple(original.weight.shape) == (48, 68, 3, 3)
            and original.bias is not None and tuple(original.bias.shape) == (48,)
            and original.stride == (1, 1) and original.padding == (1, 1)
            and original.dilation == (1, 1) and original.groups == 1
            and original.padding_mode == "zeros", "detail convolution differs")
        with torch.random.fork_rng(devices=[]):
            super().__init__(68, 48, 3, padding=1, device="cpu", dtype=torch.float32)
        self.weight, self.bias = original.weight, original.bias
        self.train(original.training)

    def forward(self, features):
        return detail_weight_reduction_precision(features, self.weight, self.bias)


class DetailWeightPrecisionRegimeRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_qualified = False
    parent_checkpoint_loaded = False
    support_ownership_rule = old.OWNERSHIP_RULE
    object_aggregation_rule = old.AGGREGATION_RULE

    def __init__(self, predecessor):
        super().__init__()
        old.validate_model_identity(predecessor)
        require(next(predecessor.parameters()).device.type == "cpu", "construction must stay CPU")
        before = tuple(predecessor.named_parameters(remove_duplicate=False))
        self.core = _fork_target_ancestors(predecessor.core,
            ("core", "terrain", "full_resolution_detail", "layers", "0"))
        self.object_rgb_heads = predecessor.object_rgb_heads
        self.condition_channel_order = predecessor.condition_channel_order
        self._parent_forward = predecessor._parent_forward
        self._canonical = tuple((name, tuple(p.shape)) for name, p in before)
        self.register_buffer("regime_identity", identity_bytes("regime"))
        self.register_buffer("numeric_identity", identity_bytes("numeric"))
        after = tuple(self.named_parameters(remove_duplicate=False))
        require(len(after) == len(before) and all(n == m and p is q
            for (n, p), (m, q) in zip(before, after)), "replacement changed Parameter identity/order")
        self.training = predecessor.training

    def forward(self, conditions, instance_table, *, appearance_regime, return_evidence=False):
        validate_model_identity(self)
        require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"),
            "generator autocast prohibited")
        device = next(self.parameters()).device
        require(isinstance(conditions, torch.Tensor) and conditions.device == device
            and conditions.dtype == torch.float32, "conditions FP32/device differs")
        if device.type == "cuda":
            require(torch.backends.cuda.matmul.fp32_precision == "ieee"
                and torch.backends.cudnn.conv.fp32_precision == "ieee", "generator CUDA IEEE FP32 required")
        token = old._REGIME.set(validate_regime(appearance_regime))
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            old._REGIME.reset(token)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        require(next(self.parameters()).device.type == "cpu", "load state must precede device migration")
        expected = self.state_dict()
        require(strict is True and assign is False and set(state_dict) == set(expected),
            "old/incomplete/non-strict state rejected")
        for key, value in state_dict.items():
            require(isinstance(value, torch.Tensor) and value.device.type == "cpu"
                and value.shape == expected[key].shape and value.dtype == expected[key].dtype
                and value.layout == torch.strided and value.is_contiguous()
                and bool(torch.isfinite(value).all()), "state tensor differs: " + key)
        for key, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric")):
            require(torch.equal(state_dict[key], identity_bytes(kind)), "old/wrong state identity rejected")
        return nn.Module.load_state_dict(self, state_dict, strict=True, assign=False)


def validate_model_identity(model):
    require(type(model) is DetailWeightPrecisionRegimeRenderer
        and model.capability_version == CAPABILITY and model.architecture_id == ARCHITECTURE
        and model.numeric_rule == NUMERIC_RULE, "detail successor identity differs")
    named = tuple(model.named_parameters(remove_duplicate=False))
    parameters = tuple(model.parameters())
    require(tuple((name, tuple(p.shape)) for name, p in named) == model._canonical
        and len(named) == len(parameters) == 107
        and sum(p.numel() for p in parameters) == 2240671
        and len({id(p) for _, p in named}) == 107
        and len({p.untyped_storage().data_ptr() for p in parameters}) == 107
        and len({p.device for p in parameters}) == 1
        and all(p.dtype == torch.float32 and p.layout == torch.strided and p.is_contiguous()
            and bool(torch.isfinite(p.detach()).all()) for p in parameters),
        "detail successor graph/finite/alias differs")
    require(named[56][0] == TARGET_PARAMETER, "target canonical index differs")
    device = parameters[0].device
    require(device.type in ("cpu", "cuda"), "unsupported model device")
    for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric")):
        value = getattr(model, name, None)
        require(isinstance(value, torch.Tensor) and value.device == device and value.dtype == torch.uint8
            and value.shape == (32,) and torch.equal(value.detach().cpu(), identity_bytes(kind)),
            "successor identity buffer differs")
    require(type(model.get_submodule(TARGET)) is PrecisionDetailWeightConv
        and type(model.get_submodule(old.TARGET)) is old.PrecisionFinalRGBConv
        and type(model.core.core.appearance.base.layers[0]) is old.SeasonalFirstConv,
        "successor implementation differs")
    require(sum(type(m) is PrecisionDetailWeightConv for m in model.modules()) == 1,
        "detail operator must occur exactly once")
    if device.type == "cpu":
        require(torch.get_num_threads() <= 2, "CPU thread budget exceeded")
    return model


def build_fresh_object_appearance_regime_detail_weight_precision(*, condition_channel_order):
    predecessor = old.build_fresh_object_appearance_regime_bias_precision(
        condition_channel_order=condition_channel_order)
    return validate_model_identity(DetailWeightPrecisionRegimeRenderer(predecessor))


def seasonal_parameter(model):
    validate_model_identity(model)
    value = model.core.core.appearance.base.layers[0].season_branch.weight
    require(value.shape == (32, 4, 3, 3) and value.numel() == 1152, "seasonal graph differs")
    return value



_DIAGNOSTIC_SPEC_SHA = "33958c6d55c809b5a52288f0dfe8a5e615ce76913e54bc6e7870ba806830ccc6"
_DIAGNOSTIC_FROZEN = {
    "ml/ai-painter/scripts/diagnose_stage4_appearance_regime_failure_state_g_cpu.py": "1603ee77766626f502445f739f1c8a8975516f82f37e8cf49aab6795435418dc",
    "ml/ai-painter/scripts/diagnose_stage4_appearance_regime_failure_state_g_gpu.py": "b5d62ca754dccc0a395d9cd3f3b87536a0bae26eea8690ac447385396b097d5c",
    "ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py": "61260d64d0b518e747c6924edccc79c575d90f2bca5b30f10a75fc6c20a8de3d",
    "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_bias_precision.py": "b39c29fb918a304f798a8fa1bd3457b6cae43829295c1d4514f67e83c692366c",
    "ml/ai-painter/src/ai_painter/complete_world/appearance_regime_gradient_failure_capture.py": "20dfbcd0fe87b26c7b56043dd792624d82d6ab2840cad90b13525acc9b933eef",
}


def authenticate_diagnostic_capture(*, root, terminal_binding, history_binding, deadline):
    """Authenticate original closed evidence, then one weights_only CPU load.

    This function requires the live private owned Job before any capture load.
    No caller-provided verification booleans or arbitrary terminal identities.
    """
    from pathlib import Path
    import sys
    project = Path(__file__).resolve().parents[5]
    require(Path(root).resolve() == project, "diagnostic project root differs")
    sys.path.insert(0, str(project / "ml/ai-painter/scripts"))
    import diagnose_stage4_appearance_regime_failure_state_g_gpu as legacy
    core, safe = legacy.core, legacy.safe
    require(terminal_binding == core.SOURCE_FAILURE and history_binding == legacy.HISTORY,
        "diagnostic fixed failure/history binding differs")
    safe.verify_owned_worker()
    safe.deadline_check(deadline)
    for path, expected in _DIAGNOSTIC_FROZEN.items():
        require(safe.file_hash(safe.logical_path(root, path), deadline) == expected,
            "diagnostic frozen source changed: " + path)
    require(safe.file_hash(safe.logical_path(root, core.SPEC), deadline) == _DIAGNOSTIC_SPEC_SHA,
        "diagnostic current specification differs")
    reader = core.HistoryReader(root, deadline, terminal_binding, history_binding)
    context = safe.preflight(reader, terminal_binding)
    data = core.input_preflight(reader, context)
    require(context["synthetic"] is False, "real importer cannot accept synthetic provenance")
    artifact = context["receipt"]["artifacts"]["tensors"]
    capture = safe.load_capture(root)
    with safe.locked_capture_archive(Path(artifact["path"])):
        archive = safe.inspect_tensor_archive(Path(artifact["path"]),
            context["manifest"]["tensorDescriptors"], expected_sha=artifact["sha256"])
        raw = Path(artifact["path"]).read_bytes()
        require(len(raw) == artifact["bytes"] <= safe.LIMITS["captureBytes"]
            and safe.digest(raw) == artifact["sha256"], "diagnostic capture changed")
        # Frozen capture verifier uses torch.load(..., map_location='cpu', weights_only=True)
        # and matches every descriptor/key/dtype/shape/byte hash.
        tensors = capture._verify_tensors(raw, context["manifest"]["tensorDescriptors"])
    reader.unchanged()
    safe.deadline_check(deadline)
    return {"reader": reader, "context": context, "data": data, "tensors": tensors,
        "archivePreflight": archive, "sourceChecks": dict(_DIAGNOSTIC_FROZEN),
        "terminalBinding": terminal_binding, "historyBinding": history_binding}


def _prepared_network_state(network, metadata, tensors, *, family):
    """Complete pure validation; never writes a Parameter, mode or buffer."""
    actual_p = dict(network.named_parameters())
    actual_b = dict(network.named_buffers())
    require(len(actual_p) == (107 if family == "model" else 14), "diagnostic role/count differs")
    require(list(actual_p) == [p["name"] for p in metadata["parameters"]]
        and list(actual_b) == [p["name"] for p in metadata["buffers"]],
        "diagnostic exact state names/order differ")
    modes = dict(network.named_modules())
    require(set(modes) == set(metadata["modes"])
        and all(type(flag) is bool for flag in metadata["modes"].values()),
        "diagnostic complete mode graph differs")
    state = {}
    for kind, actual in (("parameters", actual_p), ("buffers", actual_b)):
        for i, item in enumerate(metadata[kind]):
            require(item["key"] == f"{family}.{kind[:-1]}.{i}", "diagnostic canonical tensor key differs")
            value = tensors[item["key"]]
            require(type(value) is torch.Tensor and value.device.type == "cpu"
                and value.layout == torch.strided and value.is_contiguous() and not value.requires_grad
                and list(value.shape) == item["shape"] == list(actual[item["name"]].shape)
                and str(value.dtype) == item["dtype"] == str(actual[item["name"]].dtype)
                and bool(torch.isfinite(value).all()), "diagnostic state tensor differs/nonfinite")
            if kind == "parameters":
                require(type(item["requiresGrad"]) is bool and item["gradientKey"] is None,
                    "diagnostic requiresGrad/dirty gradient differs")
                if family == "model": require(item["requiresGrad"], "all generator parameters must require gradients")
            state[item["name"]] = value.clone()
    require(set(state) == set(network.state_dict()), "diagnostic partial state prohibited")
    return state


def _install_diagnostic_capture(*, model, critic, authenticated):
    """Internal installation after full byte authentication; synthetic tests mock only the loader."""
    import diagnose_stage4_appearance_regime_failure_state_g_cpu as core
    validate_model_identity(model)
    require(all(p.device.type == "cpu" and p.grad is None for network in (model, critic)
        for p in network.parameters()), "diagnostic install must be clean CPU")
    metadata = authenticated["context"]["manifest"]["networks"]
    tensors = authenticated["tensors"]
    core.validate_network_metadata(authenticated["context"]["manifest"])
    model_state = _prepared_network_state(model, metadata["model"], tensors, family="model")
    critic_state = _prepared_network_state(critic, metadata["critic"], tensors, family="critic")
    require(torch.equal(model_state["regime_identity"], old.identity_bytes("regime"))
        and torch.equal(model_state["numeric_identity"], old.identity_bytes("numeric")),
        "diagnostic predecessor identity differs")
    old_numeric = model_state["numeric_identity"].clone()
    model_state["numeric_identity"] = identity_bytes("numeric")
    # Verify the predecessor factory identity/parameter graph against the authenticated source.
    predecessor = old.build_fresh_object_appearance_regime_bias_precision(
        condition_channel_order=model.condition_channel_order)
    old.validate_model_identity(predecessor)
    require(tuple((n, tuple(p.shape), p.dtype) for n, p in predecessor.named_parameters())
        == tuple((n, tuple(p.shape), p.dtype) for n, p in model.named_parameters()),
        "diagnostic predecessor graph differs")
    allowed = {str(core.safe.logical_path(authenticated["reader"].root, path).resolve())
        for path in authenticated["data"]["sources"] if path.endswith(".py")}
    core.module_guard(critic, allowed)
    authenticated["reader"].unchanged()
    # All keys, tensors, identities, modes and frozen source checks precede writes.
    previous = []
    for network in (model, critic):
        previous.append(({k: v.detach().clone() for k, v in network.state_dict().items()},
            {n: m.training for n, m in network.named_modules()},
            {n: p.requires_grad for n, p in network.named_parameters()}))
    try:
        model.load_state_dict(model_state, strict=True)
        critic.load_state_dict(critic_state, strict=True)
        for network, family in ((model, "model"), (critic, "critic")):
            modules, parameters = dict(network.named_modules()), dict(network.named_parameters())
            for name, flag in metadata[family]["modes"].items(): modules[name].training = flag
            for item in metadata[family]["parameters"]:
                parameters[item["name"]].requires_grad_(item["requiresGrad"])
            expected = model_state if family == "model" else critic_state
            require(all(core.tensor_sha(network.state_dict()[name]) == core.tensor_sha(value)
                for name, value in expected.items()), "diagnostic installed bytes differ")
        authenticated["reader"].unchanged()
    except BaseException as error:
        rollback_errors = []
        for network, (state, modes, flags) in zip((model, critic), previous):
            try:
                nn.Module.load_state_dict(network, state, strict=True)
                for name, module in network.named_modules(): module.training = modes[name]
                for name, parameter in network.named_parameters(): parameter.requires_grad_(flags[name])
            except BaseException as secondary: rollback_errors.append(str(secondary)[:512])
        if rollback_errors: error.diagnostic_import_rollback_errors = rollback_errors
        raise
    receipt = {"diagnosticOnly": True, "trainingInitialization": False, "checkpointRestore": False,
        "terminalBinding": authenticated["terminalBinding"], "historyBinding": authenticated["historyBinding"],
        "oldCapability": old.CAPABILITY, "newCapability": CAPABILITY,
        "oldNumericIdentitySha256": core.tensor_sha(old_numeric),
        "newNumericIdentitySha256": core.tensor_sha(model.numeric_identity),
        "excludedCrossBaselineBuffers": ["numeric_identity"],
        "allOtherStateBytesMatched": True, "generatorParameterCount": 107, "criticParameterCount": 14,
        "snapshotDeserializations": 1, "weightsOnly": True,
        "archivePreflight": authenticated["archivePreflight"],
        "inputBindings": dict(authenticated["reader"].observed)}
    return {**authenticated, "receipt": receipt}


def import_diagnostic_failure_state(*, model, critic, root,
        terminal_binding, history_binding, deadline):
    validate_model_identity(model)
    require(isinstance(critic, nn.Module) and len(tuple(critic.parameters())) == 14,
        "diagnostic critic role differs")
    authenticated = authenticate_diagnostic_capture(root=root, terminal_binding=terminal_binding,
        history_binding=history_binding, deadline=deadline)
    return _install_diagnostic_capture(model=model, critic=critic, authenticated=authenticated)
