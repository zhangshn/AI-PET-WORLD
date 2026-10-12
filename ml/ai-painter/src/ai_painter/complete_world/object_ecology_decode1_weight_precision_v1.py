"""NS-002 standalone ecology renderer; old factory/validator/defaults stay unchanged."""
from copy import copy, deepcopy
from functools import lru_cache
import hashlib
import torch
from torch import nn
from ai_painter.complete_world import object_ecology_regime_conditioned as old
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_ecology_regime_input_cpu import ECOLOGIES, validate_ecology, validate_regime, require
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS
from ai_painter.complete_world.decode1_weight_reduction_precision_v1 import Decode1WeightReductionConv, NUMERIC_RULE as WEIGHT_RULE

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_v1"
EXECUTION_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_quality_v1"
ARCHITECTURE = "fresh_detail_precision_four_heads_independent_season_ecology_decode1_weight_fp64_v1"
NUMERIC_RULE = old.NUMERIC_RULE + "|" + WEIGHT_RULE
TARGET = "core.core.terrain.decode_1.layers.3"
INITIALIZATION_SEED = 20260929


def identity_bytes(kind):
    require(kind in ("regime", "numeric", "ecology"), "unknown decode1 identity kind")
    text = "|".join((kind, CAPABILITY, ARCHITECTURE, NUMERIC_RULE, *SEASONS, *ECOLOGIES))
    return torch.tensor(list(hashlib.sha256(text.encode()).digest()), dtype=torch.uint8, device="cpu")


def _fork_target(module, path):
    if not path:
        return Decode1WeightReductionConv(module)
    result = copy(module)
    for attribute in ("_modules", "_parameters", "_buffers", "_forward_hooks", "_forward_pre_hooks", "_backward_hooks", "_backward_pre_hooks"):
        setattr(result, attribute, getattr(module, attribute).copy())
    result._non_persistent_buffers_set = module._non_persistent_buffers_set.copy()
    key = path[0]
    result._modules[key] = _fork_target(module._modules[key], path[1:])
    return result


_CONFIG = ("in_channels", "out_channels", "kernel_size", "stride", "padding", "dilation", "groups", "padding_mode",
           "in_features", "out_features", "num_groups", "num_channels", "eps", "inplace", "negative_slope",
           "ceil_mode", "mode", "align_corners", "scale_factor")


def _module_graph(network):
    return tuple((name, type(module), tuple((key, getattr(module, key)) for key in _CONFIG if hasattr(module, key)))
                 for name, module in network.named_modules(remove_duplicate=False))


def _storage_identity(value):
    storage = value.untyped_storage()
    return (storage._cdata, storage.data_ptr(), storage.nbytes(), value.storage_offset(), tuple(value.stride()))


@lru_cache(maxsize=4)
def _fresh_prototype(order):
    require(torch.get_num_threads() <= 2, "decode1 CPU threads exceeded")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(INITIALIZATION_SEED)
        fresh = old.build_fresh_object_ecology_regime_conditioned(condition_channel_order=order)
    return fresh


@lru_cache(maxsize=4)
def _reference(order):
    fresh = _fresh_prototype(order)
    graph = tuple((name, tuple(value.shape), value.dtype) for name, value in fresh.named_parameters(remove_duplicate=False))
    modules = tuple((name, Decode1WeightPrecisionEcologyRenderer if not name else Decode1WeightReductionConv if name == TARGET else cls, config)
                    for name, cls, config in _module_graph(fresh))
    return graph, modules, fresh._parent_forward, fresh.support_ownership_rule, fresh.object_aggregation_rule


class Decode1WeightPrecisionEcologyRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_qualified = False
    parent_checkpoint_loaded = False

    def __init__(self, fresh):
        super().__init__()
        old.validate_model_identity(fresh)
        require(next(fresh.parameters()).device.type == "cpu", "decode1 construction must stay CPU")
        before = tuple(fresh.named_parameters(remove_duplicate=False))
        self.core = _fork_target(fresh.core, ("core", "terrain", "decode_1", "layers", "3"))
        self.object_rgb_heads = fresh.object_rgb_heads
        self.condition_channel_order = fresh.condition_channel_order
        self._parent_forward = fresh._parent_forward
        self.support_ownership_rule = fresh.support_ownership_rule
        self.object_aggregation_rule = fresh.object_aggregation_rule
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self.register_buffer(name, identity_bytes(kind))
        after = tuple(self.named_parameters(remove_duplicate=False))
        require(len(before) == len(after) and all(name == other and value is target
            for (name, value), (other, target) in zip(before, after)), "decode1 replacement changed Parameter identity/order")
        self.training = fresh.training

    def forward(self, conditions, instance_table, *, appearance_regime, ecology_regime, return_evidence=False):
        validate_model_identity(self)
        require(type(conditions) is torch.Tensor and conditions.dtype == torch.float32
            and conditions.device == next(self.parameters()).device, "decode1 conditions FP32/device differs")
        require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "decode1 renderer autocast prohibited")
        season = validate_regime(appearance_regime)
        ecology = validate_ecology(ecology_regime)
        season_token = seasonal._REGIME.set(season)
        ecology_token = old._ECOLOGY.set(ecology)
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            old._ECOLOGY.reset(ecology_token)
            seasonal._REGIME.reset(season_token)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        require(next(self.parameters()).device.type == "cpu", "decode1 strict reload requires CPU")
        expected = self.state_dict()
        require(strict is True and assign is False and tuple(state_dict) == tuple(expected), "decode1 strict full state/order required")
        for key, value in state_dict.items():
            require(type(value) is torch.Tensor and value.device.type == "cpu" and not value.requires_grad
                and value.layout == torch.strided and value.is_contiguous() and value.shape == expected[key].shape
                and value.dtype == expected[key].dtype and bool(torch.isfinite(value).all()), "decode1 state tensor differs: " + key)
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            require(torch.equal(state_dict[name], identity_bytes(kind)), "decode1 old/wrong identity state rejected")
        verified = {key: value.detach().clone() for key, value in state_dict.items()}
        saved = {key: value.detach().clone() for key, value in expected.items()}
        module_slots = [(module, module._modules.copy(), module._parameters.copy(), module._buffers.copy(), module.training)
                        for module in self.modules()]
        parameter_slots = [(value, value.requires_grad, value.grad) for value in self.parameters()]
        parameter_identity = tuple(self.parameters())
        buffer_identity = tuple(self.buffers())
        data_bindings = [(value, value.detach(), _storage_identity(value)) for value in (*parameter_identity, *buffer_identity)]
        try:
            result = nn.Module.load_state_dict(self, verified, strict=True, assign=False)
            validate_model_identity(self)
            require(all(left is right for left, right in zip(self.parameters(), parameter_identity))
                and all(left is right for left, right in zip(self.buffers(), buffer_identity)), "decode1 install replaced original storage")
            require(all(_storage_identity(value) == identity for value, original_data, identity in data_bindings),
                    "decode1 install rebound original data storage")
            installed = self.state_dict()
            require(tuple(installed) == tuple(verified) and all(torch.equal(installed[key].reshape(-1).view(torch.uint8), value.reshape(-1).view(torch.uint8))
                for key, value in verified.items()), "decode1 installed bytes differ")
            return result
        except BaseException:
            for module, children, parameters, buffers, mode in module_slots:
                module._modules, module._parameters, module._buffers, module.training = children, parameters, buffers, mode
            with torch.no_grad():
                for value, original_data, identity in data_bindings:
                    value.data = original_data
                for key, value in expected.items():
                    value.copy_(saved[key])
            for parameter, needed, gradient in parameter_slots:
                parameter.requires_grad_(needed)
                parameter.grad = gradient
            raise


def validate_model_identity(model):
    require(type(model) is Decode1WeightPrecisionEcologyRenderer and model.capability_version == CAPABILITY
        and model.architecture_id == ARCHITECTURE and model.numeric_rule == NUMERIC_RULE, "decode1 exact renderer identity differs")
    require(torch.get_num_threads() <= 2, "decode1 CPU threads exceeded")
    order = tuple(model.condition_channel_order)
    graph, modules, parent, support, aggregation = _reference(order)
    named = tuple(model.named_parameters(remove_duplicate=False))
    parameters = tuple(model.parameters())
    require(tuple((name, tuple(value.shape), value.dtype) for name, value in named) == graph
        and len(named) == len(parameters) == 108 and sum(value.numel() for value in parameters) == 2242687
        and len({id(value) for _, value in named}) == 108 and len({value.untyped_storage().data_ptr() for value in parameters}) == 108
        and all(value.device == parameters[0].device and value.device.type in ("cpu", "cuda")
            and value.layout == torch.strided and value.is_contiguous() and bool(torch.isfinite(value.detach()).all()) for value in parameters),
        "decode1 canonical graph/finite/device/alias differs")
    require(_module_graph(model) == modules and named[52][0] == TARGET + ".weight"
        and sum(type(module) is Decode1WeightReductionConv for module in model.modules()) == 1,
        "decode1 full exact module graph/config/unique target differs")
    require(model._parent_forward is parent and model.support_ownership_rule == support and model.object_aggregation_rule == aggregation,
            "decode1 inherited pure forward/ownership differs")
    require(tuple(name for name, _ in model.named_buffers()) == ("regime_identity", "numeric_identity", "ecology_identity"),
            "decode1 buffer graph differs")
    for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
        value = getattr(model, name)
        require(type(value) is torch.Tensor and value.device == parameters[0].device and value.dtype == torch.uint8
            and value.shape == (32,) and torch.equal(value.detach().cpu(), identity_bytes(kind)), "decode1 identity buffer differs")
    return model


def build_fresh_object_ecology_decode1_weight_precision(*, condition_channel_order):
    require(torch.get_num_threads() <= 2, "decode1 CPU construction threads exceeded")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(INITIALIZATION_SEED)
        # Existing factories define local classes afresh on every call. A pristine,
        # source-created prototype retains exact class identities; deepcopy gives
        # each instance independent initialized Parameter/buffer storage.
        fresh = deepcopy(_fresh_prototype(tuple(condition_channel_order)))
        model = Decode1WeightPrecisionEcologyRenderer(fresh)
    return validate_model_identity(model)


def seasonal_parameter(model):
    validate_model_identity(model)
    return model.get_submodule(old.TARGET).season_branch.weight


def ecological_parameter(model):
    validate_model_identity(model)
    return model.get_submodule(old.TARGET).ecology_branch.weight
