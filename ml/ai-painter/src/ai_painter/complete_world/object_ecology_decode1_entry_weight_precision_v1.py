"""Isolated source-created target-48 renderer; no execution or release admission."""
from copy import copy, deepcopy
from functools import lru_cache
import hashlib
import torch
from torch import nn
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as parent
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as base
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as detail
from ai_painter.complete_world import object_ecology_regime_conditioned as ecology
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_ecology_regime_input_cpu import ECOLOGIES, validate_ecology, validate_regime, require
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS
from ai_painter.complete_world.decode1_weight_reduction_precision_v1 import Decode1WeightReductionConv
from ai_painter.complete_world.terrain_detail_weight_reduction_precision_v1 import TerrainDetailWeightReductionConv
from ai_painter.complete_world.final_rgb_base_weight_reduction_precision_v1 import (
    FinalRgbBaseWeightReductionConv, FinalRgbOutputWeightReductionConv, OUTPUT_NUMERIC_RULE)
from ai_painter.complete_world.decode1_entry_weight_reduction_precision_v1 import (
    Decode1EntryWeightReductionConv, Decode2EntryWeightReductionConv,
    NUMERIC_RULE as WEIGHT_RULE, DECODE2_NUMERIC_RULE)
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1"
ARCHITECTURE = "fresh_detail_precision_four_heads_independent_season_ecology_decode1_terrain_detail_final_rgb_base_decode1_entry_weight_fp64_v1"
NUMERIC_RULE = parent.NUMERIC_RULE + "|" + WEIGHT_RULE
TARGET = "core.core.terrain.decode_1.layers.0"
TARGET_INDEX = 48
INITIALIZATION_SEED = 20260929
DECODE2_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode2_entry_weight_precision_v1"
DECODE2_ARCHITECTURE = ARCHITECTURE + "_decode2_entry_weight_fp64_v1"
DECODE2_RULE = NUMERIC_RULE + "|" + DECODE2_NUMERIC_RULE
DECODE2_TARGET = "core.core.terrain.decode_2.layers.0"
RGB_OUTPUT_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1"
RGB_OUTPUT_ARCHITECTURE = DECODE2_ARCHITECTURE + "_final_rgb_output_weight_fp64_v1"
RGB_OUTPUT_RULE = DECODE2_RULE + "|" + OUTPUT_NUMERIC_RULE
RGB_OUTPUT_TARGET = "core.core.final_rgb_decoder.base.layers.4"


def identity_bytes(kind, decode2=False, rgb_output=False):
    require(kind in ("regime", "numeric", "ecology"), "unknown decode1 entry identity kind")
    require(not rgb_output or decode2, "RGB output successor requires decode2 parent")
    text = "|".join((kind, RGB_OUTPUT_CAPABILITY if rgb_output else DECODE2_CAPABILITY if decode2 else CAPABILITY,
        RGB_OUTPUT_ARCHITECTURE if rgb_output else DECODE2_ARCHITECTURE if decode2 else ARCHITECTURE,
        RGB_OUTPUT_RULE if rgb_output else DECODE2_RULE if decode2 else NUMERIC_RULE, *SEASONS, *ECOLOGIES))
    return torch.tensor(list(hashlib.sha256(text.encode()).digest()), dtype=torch.uint8, device="cpu")


def _fork_target(module, path, wrapper=Decode1EntryWeightReductionConv):
    if not path:
        return wrapper(module)
    result = copy(module)
    for attribute in ("_modules", "_parameters", "_buffers", "_forward_hooks", "_forward_pre_hooks", "_backward_hooks", "_backward_pre_hooks"):
        setattr(result, attribute, getattr(module, attribute).copy())
    result._non_persistent_buffers_set = module._non_persistent_buffers_set.copy()
    key = path[0]
    result._modules[key] = _fork_target(module._modules[key], path[1:], wrapper)
    return result


@lru_cache(maxsize=4)
def _fresh_prototype(order):
    require(torch.get_num_threads() <= 2, "decode1 entry CPU threads exceeded")
    require(order == FORMAL_CONDITION_CHANNEL_ORDER, "decode1 entry formal condition channel order differs")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(INITIALIZATION_SEED)
        return parent.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=order)


@lru_cache(maxsize=6)
def _reference(order, decode2=False, rgb_output=False):
    fresh = _fresh_prototype(order)
    graph = tuple((name, tuple(value.shape), value.dtype) for name, value in fresh.named_parameters(remove_duplicate=False))
    modules = tuple((name, (Decode2OutputWeightPrecisionEcologyRenderer if rgb_output else Decode2EntryWeightPrecisionEcologyRenderer if decode2 else Decode1EntryWeightPrecisionEcologyRenderer)
                    if not name else Decode1EntryWeightReductionConv if name == TARGET
                    else Decode2EntryWeightReductionConv if decode2 and name == DECODE2_TARGET
                    else FinalRgbOutputWeightReductionConv if rgb_output and name == RGB_OUTPUT_TARGET else cls, config)
                    for name, cls, config in base._module_graph(fresh))
    return graph, modules, fresh._parent_forward, fresh.support_ownership_rule, fresh.object_aggregation_rule


class Decode1EntryWeightPrecisionEcologyRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_qualified = False
    parent_checkpoint_loaded = False

    def __init__(self, fresh):
        super().__init__()
        parent.validate_model_identity(fresh)
        require(next(fresh.parameters()).device.type == "cpu", "decode1 entry construction CPU required")
        before = tuple(fresh.named_parameters(remove_duplicate=False))
        pristine = tuple(_fresh_prototype(tuple(fresh.condition_channel_order)).named_parameters(remove_duplicate=False))
        require(len(before) == len(pristine) and all(name == other and torch.equal(value.detach().view(torch.uint8), expected.detach().view(torch.uint8))
            for (name, value), (other, expected) in zip(before, pristine)),
            "decode1 entry construction requires pristine source-created parent weights")
        self.core = _fork_target(fresh.core, ("core", "terrain", "decode_1", "layers", "0"))
        self.object_rgb_heads = fresh.object_rgb_heads
        self.condition_channel_order = fresh.condition_channel_order
        self._parent_forward = fresh._parent_forward
        self.support_ownership_rule = fresh.support_ownership_rule
        self.object_aggregation_rule = fresh.object_aggregation_rule
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self.register_buffer(name, identity_bytes(kind))
        after = tuple(self.named_parameters(remove_duplicate=False))
        require(len(before) == len(after) and all(name == other and value is target
            for (name, value), (other, target) in zip(before, after)), "decode1 entry Parameter identity/order changed")
        self.training = fresh.training

    def forward(self, conditions, instance_table, *, appearance_regime, ecology_regime, return_evidence=False):
        validate_model_identity(self)
        require(type(conditions) is torch.Tensor and conditions.dtype == torch.float32
            and conditions.device == next(self.parameters()).device, "decode1 entry conditions FP32/device differs")
        require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "decode1 entry autocast prohibited")
        season, code = validate_regime(appearance_regime), validate_ecology(ecology_regime)
        season_token, ecology_token = seasonal._REGIME.set(season), ecology._ECOLOGY.set(code)
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            ecology._ECOLOGY.reset(ecology_token)
            seasonal._REGIME.reset(season_token)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        require(next(self.parameters()).device.type == "cpu", "decode1 entry strict reload requires CPU")
        expected = self.state_dict()
        require(strict is True and assign is False and tuple(state_dict) == tuple(expected), "decode1 entry strict full state/order required")
        for key, value in state_dict.items():
            require(type(value) is torch.Tensor and value.device.type == "cpu" and not value.requires_grad
                and value.layout == torch.strided and value.is_contiguous() and value.shape == expected[key].shape
                and value.dtype == expected[key].dtype and bool(torch.isfinite(value).all()), "decode1 entry state tensor differs: " + key)
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            require(torch.equal(state_dict[name], identity_bytes(kind,
                    type(self) in (Decode2EntryWeightPrecisionEcologyRenderer, Decode2OutputWeightPrecisionEcologyRenderer),
                    type(self) is Decode2OutputWeightPrecisionEcologyRenderer)),
                    "entry old/wrong identity state rejected")
        verified = {key: value.detach().clone() for key, value in state_dict.items()}
        saved = {key: value.detach().clone() for key, value in expected.items()}
        module_slots = [(module, {key: value.copy() if isinstance(value, (dict, set)) else value
                                 for key, value in module.__dict__.items()}) for module in self.modules()]
        parameter_slots = [(value, value.requires_grad, value.grad) for value in self.parameters()]
        parameter_identity, buffer_identity = tuple(self.parameters()), tuple(self.buffers())
        data_bindings = [(value, value.detach(), base._storage_identity(value)) for value in (*parameter_identity, *buffer_identity)]
        try:
            result = nn.Module.load_state_dict(self, verified, strict=True, assign=False)
            validate_model_identity(self)
            require(tuple(self.modules()) == tuple(module for module, _ in module_slots)
                and all(module.training == attrs["training"] for module, attrs in module_slots),
                "decode1 entry install replaced modules/modes")
            require(all(left is right for left, right in zip(self.parameters(), parameter_identity))
                and all(left is right for left, right in zip(self.buffers(), buffer_identity))
                and all(value.requires_grad == needed and value.grad is gradient for value, needed, gradient in parameter_slots),
                "decode1 entry install replaced original parameters/buffers/flags")
            require(all(base._storage_identity(value) == identity for value, original_data, identity in data_bindings),
                    "decode1 entry install rebound original data storage")
            installed = self.state_dict()
            require(tuple(installed) == tuple(verified) and all(torch.equal(installed[key].reshape(-1).view(torch.uint8), value.reshape(-1).view(torch.uint8))
                for key, value in verified.items()), "decode1 entry installed bytes differ")
            return result
        except BaseException:
            # Restore without invoking a failing hook again, including rebound
            # storage, replaced module registrations, configuration and modes.
            for module, attrs in module_slots:
                module.__dict__.clear()
                module.__dict__.update(attrs)
            with torch.no_grad():
                for value, original_data, identity in data_bindings:
                    value.data = original_data
                for key, value in expected.items():
                    value.copy_(saved[key])
            for parameter, needed, gradient in parameter_slots:
                parameter.requires_grad_(needed)
                parameter.grad = gradient
            raise


class Decode2EntryWeightPrecisionEcologyRenderer(Decode1EntryWeightPrecisionEcologyRenderer):
    """Parameter40 numeric successor; no forward/parameter-graph changes."""
    capability_version = DECODE2_CAPABILITY
    architecture_id = DECODE2_ARCHITECTURE
    numeric_rule = DECODE2_RULE

    def __init__(self, fresh):
        super().__init__(fresh)
        self.core = _fork_target(self.core, ("core", "terrain", "decode_2", "layers", "0"), Decode2EntryWeightReductionConv)
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self._buffers[name] = identity_bytes(kind, True)


class Decode2OutputWeightPrecisionEcologyRenderer(Decode2EntryWeightPrecisionEcologyRenderer):
    """Parameter90 numeric successor; forward/graph/initial weights unchanged."""
    capability_version = RGB_OUTPUT_CAPABILITY
    architecture_id = RGB_OUTPUT_ARCHITECTURE
    numeric_rule = RGB_OUTPUT_RULE

    def __init__(self, fresh):
        super().__init__(fresh)
        self.core = _fork_target(self.core, ("core", "final_rgb_decoder", "base", "layers", "4"), FinalRgbOutputWeightReductionConv)
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self._buffers[name] = identity_bytes(kind, True, True)


def validate_model_identity(model):
    rgb_output = type(model) is Decode2OutputWeightPrecisionEcologyRenderer
    decode2 = rgb_output or type(model) is Decode2EntryWeightPrecisionEcologyRenderer
    require(type(model) in (Decode1EntryWeightPrecisionEcologyRenderer, Decode2EntryWeightPrecisionEcologyRenderer,
                            Decode2OutputWeightPrecisionEcologyRenderer)
        and model.capability_version == (RGB_OUTPUT_CAPABILITY if rgb_output else DECODE2_CAPABILITY if decode2 else CAPABILITY)
        and model.architecture_id == (RGB_OUTPUT_ARCHITECTURE if rgb_output else DECODE2_ARCHITECTURE if decode2 else ARCHITECTURE)
        and model.numeric_rule == (RGB_OUTPUT_RULE if rgb_output else DECODE2_RULE if decode2 else NUMERIC_RULE)
        and model.execution_qualified is False and model.parent_checkpoint_loaded is False,
        "decode1 entry exact inactive renderer identity differs")
    require(torch.get_num_threads() <= 2, "decode1 entry CPU threads exceeded")
    graph, modules, forward, support, aggregation = _reference(tuple(model.condition_channel_order), decode2, rgb_output)
    named, parameters = tuple(model.named_parameters(remove_duplicate=False)), tuple(model.parameters())
    require(tuple((name, tuple(value.shape), value.dtype) for name, value in named) == graph
        and len(named) == len(parameters) == 108 and sum(value.numel() for value in parameters) == 2242687
        and len({id(value) for _, value in named}) == 108 and len({value.untyped_storage().data_ptr() for value in parameters}) == 108
        and all(value.device == parameters[0].device and value.device.type in ("cpu", "cuda")
            and value.layout == torch.strided and value.is_contiguous()
            and bool(torch.isfinite(value.detach()).all()) for value in parameters), "decode1 entry canonical graph/finite/device/alias differs")
    require(base._module_graph(model) == modules and named[TARGET_INDEX][0] == TARGET + ".weight"
        and tuple(named[TARGET_INDEX][1].shape) == (48, 144, 3, 3)
        and named[52][0] == base.TARGET + ".weight" and named[60][0] == detail.TARGET + ".weight"
        and named[88][0] == parent.TARGET + ".weight"
        and sum(type(module) is Decode1EntryWeightReductionConv for module in model.modules()) == 1
        and sum(type(module) is Decode1WeightReductionConv for module in model.modules()) == 1
        and sum(type(module) is TerrainDetailWeightReductionConv for module in model.modules()) == 1
        and sum(type(module) is FinalRgbBaseWeightReductionConv for module in model.modules()) == 1,
        "decode1 entry full exact module graph/config/unique targets differ")
    require(named[40][0] == DECODE2_TARGET + ".weight" and tuple(named[40][1].shape) == (96, 192, 3, 3)
        and sum(type(module) is Decode2EntryWeightReductionConv for module in model.modules()) == int(decode2),
        "decode2 entry exact target/config differs")
    require(named[90][0] == RGB_OUTPUT_TARGET + ".weight" and tuple(named[90][1].shape) == (3,48,1,1)
        and sum(type(module) is FinalRgbOutputWeightReductionConv for module in model.modules()) == int(rgb_output),
        "RGB output exact target/config differs")
    require(model._parent_forward is forward and model.support_ownership_rule == support and model.object_aggregation_rule == aggregation,
            "decode1 entry inherited pure forward/ownership differs")
    require(tuple(name for name, _ in model.named_buffers()) == ("regime_identity", "numeric_identity", "ecology_identity"),
            "decode1 entry buffer graph differs")
    for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
        value = getattr(model, name)
        require(type(value) is torch.Tensor and value.device == parameters[0].device and value.dtype == torch.uint8
            and value.shape == (32,) and torch.equal(value.detach().cpu(), identity_bytes(kind, decode2, rgb_output)), "decode1 entry identity buffer differs")
    return model


def build_fresh_object_ecology_decode1_entry_weight_precision(*, condition_channel_order=FORMAL_CONDITION_CHANNEL_ORDER):
    require(torch.get_num_threads() <= 2, "decode1 entry CPU construction threads exceeded")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(INITIALIZATION_SEED)
        fresh = deepcopy(_fresh_prototype(tuple(condition_channel_order)))
        model = Decode1EntryWeightPrecisionEcologyRenderer(fresh)
    return validate_model_identity(model)


def build_fresh_object_ecology_decode2_entry_weight_precision(*, condition_channel_order=FORMAL_CONDITION_CHANNEL_ORDER):
    require(torch.get_num_threads() <= 2, "decode2 entry CPU construction threads exceeded")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(INITIALIZATION_SEED)
        fresh = deepcopy(_fresh_prototype(tuple(condition_channel_order)))
        model = Decode2EntryWeightPrecisionEcologyRenderer(fresh)
    return validate_model_identity(model)


def build_fresh_object_ecology_decode2_output_weight_precision(*, condition_channel_order=FORMAL_CONDITION_CHANNEL_ORDER):
    require(torch.get_num_threads() <= 2, "RGB output CPU construction threads exceeded")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(INITIALIZATION_SEED)
        fresh = deepcopy(_fresh_prototype(tuple(condition_channel_order)))
        model = Decode2OutputWeightPrecisionEcologyRenderer(fresh)
    return validate_model_identity(model)


def seasonal_parameter(model):
    validate_model_identity(model)
    return model.get_submodule(ecology.TARGET).season_branch.weight


def ecological_parameter(model):
    validate_model_identity(model)
    return model.get_submodule(ecology.TARGET).ecology_branch.weight
