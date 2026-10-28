"""Unqualified native bounded-VJP family retaining the 109 parameter graph.

This module provides geometry and parameter migration only. It has no training,
stage advancement, checkpoint publication or Runtime entry point.
"""
from copy import deepcopy
import hashlib
from collections.abc import Mapping

import torch
from torch import nn

from ai_painter.complete_world import terrain_ecology_native_stage_v1 as parent
from ai_painter.complete_world import decode1_entry_weight_reduction_precision_v1 as original_entry
from ai_painter.complete_world import decode1_entry_bounded_weight_vjp_v1 as bounded
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as graph_api
from ai_painter.complete_world import object_ecology_regime_conditioned as ecology
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_ecology_regime_input_cpu import require, validate_ecology, validate_regime, ECOLOGIES
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry, validate_geometry
from ai_painter.complete_world.terrain_ecology_projection_v1 import (
    NativeStageTerrainEcologyProjection,
    _TERRAIN_PROJECTION,
)

CAPABILITY = 'terrain_ecology_native_bounded_stage_v1'
ARCHITECTURE = parent.ARCHITECTURE + '_bounded_columns16_entry_weight_vjp_v1'
require(parent.NUMERIC_RULE.count(original_entry.NUMERIC_RULE) == 1, 'exact original entry numeric rule required')
NUMERIC_RULE = parent.NUMERIC_RULE.replace(original_entry.NUMERIC_RULE, bounded.NUMERIC_RULE)
PARAMETER_COUNT = parent.PARAMETER_COUNT
PARAMETER_ELEMENTS = parent.PARAMETER_ELEMENTS
STEM_TARGET = parent.STEM_TARGET
BOUNDED_TARGET = 'core.core.terrain.decode_1.layers.0'
GEOMETRY_CONSUMERS = ('', 'core.core', 'core.core.appearance.base',
                      'core.core.final_rgb_decoder.base', STEM_TARGET,
                      'terrain_ecology_projection')
IDENTITIES = (('regime_identity', 'regime'), ('numeric_identity', 'numeric'),
              ('ecology_identity', 'ecology'))


def identity_bytes(kind, geometry):
    validate_geometry(geometry)
    require(kind in ('regime', 'numeric', 'ecology'), 'unknown native stage identity kind')
    payload = '|'.join((kind, CAPABILITY, ARCHITECTURE, NUMERIC_RULE,
                        repr(geometry.identity()), *SEASONS, *ECOLOGIES))
    return torch.tensor(list(hashlib.sha256(payload.encode()).digest()),
                        dtype=torch.uint8, device='cpu')


def _reference(order):
    graph, modules, forward, support, aggregation = parent._reference(order)
    modules = tuple((name, NativeBoundedStageTerrainEcologyRenderer if not name else
                     bounded.Decode1EntryBoundedWeightVjpConv if name == BOUNDED_TARGET else cls, config) for name, cls, config in modules)
    return graph, modules, forward, support, aggregation


class NativeBoundedStageTerrainEcologyRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_qualified = False
    parent_checkpoint_loaded = False

    def __init__(self, fresh, geometry):
        super().__init__()
        parent.validate_model_identity(fresh)
        require(next(fresh.parameters()).device.type == 'cpu', 'native stage construction requires CPU')
        self.native_stage_geometry = validate_geometry(geometry)
        require(geometry == fresh.native_stage_geometry, 'source construction geometry differs')
        self.core = deepcopy(fresh.core)
        self.object_rgb_heads = deepcopy(fresh.object_rgb_heads)
        self.terrain_ecology_projection = deepcopy(fresh.terrain_ecology_projection)
        self.condition_channel_order = tuple(fresh.condition_channel_order)
        self._parent_forward = fresh._parent_forward
        self.support_ownership_rule = fresh.support_ownership_rule
        self.object_aggregation_rule = fresh.object_aggregation_rule
        entry_container = self.get_submodule(BOUNDED_TARGET.rsplit('.', 1)[0])
        entry_key = BOUNDED_TARGET.rsplit('.', 1)[1]
        entry_container._modules[entry_key] = bounded.Decode1EntryBoundedWeightVjpConv(
            entry_container._modules[entry_key])
        for name in GEOMETRY_CONSUMERS:
            self.get_submodule(name).native_stage_geometry = geometry
        for name, kind in IDENTITIES:
            self.register_buffer(name, identity_bytes(kind, geometry))
        self.training = fresh.training
        before, after = tuple(fresh.named_parameters()), tuple(self.named_parameters())
        require(len(before) == len(after) == PARAMETER_COUNT
                and all(n == m and p.data_ptr() != q.data_ptr()
                        and torch.equal(p.detach().view(torch.uint8), q.detach().view(torch.uint8))
                        for (n, p), (m, q) in zip(before, after)),
                'native bounded construction changed parameter order/bytes or shared parent storage')

    def forward(self, conditions, instance_table, *, appearance_regime,
                ecology_regime, return_evidence=False):
        validate_model_identity(self)
        geometry = self.native_stage_geometry
        require(type(conditions) is torch.Tensor
                and conditions.shape == (1, 23, geometry.height, geometry.width)
                and conditions.dtype == torch.float32
                and conditions.device == next(self.parameters()).device,
                'native stage condition geometry/device differs')
        require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
                'native stage autocast prohibited')
        season, code = validate_regime(appearance_regime), validate_ecology(ecology_regime)
        st, et, pt = (seasonal._REGIME.set(season), ecology._ECOLOGY.set(code),
                      _TERRAIN_PROJECTION.set(self.terrain_ecology_projection))
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            _TERRAIN_PROJECTION.reset(pt)
            ecology._ECOLOGY.reset(et)
            seasonal._REGIME.reset(st)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        expected = self.state_dict()
        require(next(self.parameters()).device.type == 'cpu' and strict is True and assign is False
                and isinstance(state_dict, Mapping) and tuple(state_dict) == tuple(expected),
                'native stage strict complete CPU state required')
        for key, value in state_dict.items():
            require(type(value) is torch.Tensor and value.device.type == 'cpu' and not value.requires_grad
                    and value.layout == torch.strided and value.is_contiguous()
                    and value.shape == expected[key].shape and value.dtype == expected[key].dtype
                    and bool(torch.isfinite(value).all()), 'native stage state differs: ' + key)
        for name, kind in IDENTITIES:
            require(torch.equal(state_dict[name], identity_bytes(kind, self.native_stage_geometry)),
                    'old/foreign native stage identity rejected')
        verified = {k: v.detach().clone() for k, v in state_dict.items()}
        saved = {k: v.detach().clone() for k, v in expected.items()}
        slots = [(m, dict(m.__dict__), {k: v.copy() for k, v in m.__dict__.items()
                                      if isinstance(v, (dict, set))}) for m in self.modules()]
        parameter_slots = [(p, p.requires_grad, p.grad) for p in self.parameters()]
        parameters, buffers = tuple(self.parameters()), tuple(self.buffers())
        data = [(v, v.detach(), graph_api._storage_identity(v)) for v in (*parameters, *buffers)]
        try:
            result = nn.Module.load_state_dict(self, verified, strict=True, assign=False)
            validate_model_identity(self)
            require(tuple(self.modules()) == tuple(m for m, _, _ in slots)
                    and all(m.training == attrs['training'] for m, attrs, _ in slots),
                    'native stage install changed modules/modes')
            require(all(a is b for a, b in zip(self.parameters(), parameters))
                    and all(a is b for a, b in zip(self.buffers(), buffers))
                    and all(p.requires_grad == flag and p.grad is grad for p, flag, grad in parameter_slots),
                    'native stage install changed identities/flags')
            require(all(graph_api._storage_identity(v) == sid for v, _, sid in data),
                    'native stage rebound storage')
            installed = self.state_dict()
            require(tuple(installed) == tuple(verified)
                    and all(torch.equal(installed[k].reshape(-1).view(torch.uint8),
                                        v.reshape(-1).view(torch.uint8)) for k, v in verified.items()),
                    'native stage installed bytes differ')
            return result
        except BaseException:
            for module, attrs, containers in slots:
                module.__dict__.clear()
                module.__dict__.update(attrs)
                for key, values in containers.items():
                    attrs[key].clear()
                    attrs[key].update(values)
            with torch.no_grad():
                for value, original, _ in data:
                    value.data = original
                for key, value in expected.items():
                    value.copy_(saved[key])
            for p, flag, grad in parameter_slots:
                p.requires_grad_(flag)
                p.grad = grad
            raise


def validate_model_identity(model):
    require(type(model) is NativeBoundedStageTerrainEcologyRenderer and model.capability_version == CAPABILITY
            and model.architecture_id == ARCHITECTURE and model.numeric_rule == NUMERIC_RULE
            and model.execution_qualified is False and model.parent_checkpoint_loaded is False,
            'exact unqualified native stage identity required')
    require(torch.get_num_threads() <= 2, 'native stage CPU thread budget exceeded')
    geometry = validate_geometry(model.native_stage_geometry)
    graph, modules, forward, support, aggregation = _reference(tuple(model.condition_channel_order))
    named = tuple(model.named_parameters(remove_duplicate=False))
    parameters = tuple(model.parameters())
    require(tuple((n, tuple(p.shape), p.dtype) for n, p in named) == graph
            and len(named) == len(parameters) == PARAMETER_COUNT
            and named[48][0] == BOUNDED_TARGET + '.weight'
            and sum(p.numel() for p in parameters) == PARAMETER_ELEMENTS
            and len({id(p) for p in parameters}) == PARAMETER_COUNT
            and len({p.untyped_storage().data_ptr() for p in parameters}) == PARAMETER_COUNT
            and all(p.device == parameters[0].device and p.device.type in ('cpu', 'cuda')
                    and p.layout == torch.strided and p.is_contiguous()
                    and bool(torch.isfinite(p.detach()).all()) for p in parameters),
            'native stage canonical graph/finite/device/alias differs')
    require(graph_api._module_graph(model) == modules and model._parent_forward is forward
            and model.support_ownership_rule == support and model.object_aggregation_rule == aggregation,
            'native stage exact modules/forward/ownership differ')
    consumers = tuple(name for name, m in model.named_modules()
                      if hasattr(m, 'native_stage_geometry'))
    require(set(consumers) == set(GEOMETRY_CONSUMERS)
            and all(type(model.get_submodule(name).native_stage_geometry) is NativeStageGeometry
                    and model.get_submodule(name).native_stage_geometry == geometry
                    for name in GEOMETRY_CONSUMERS), 'native stage geometry consumers differ')
    require(tuple(n for n, _ in model.named_buffers()) == tuple(n for n, _ in IDENTITIES),
            'native stage buffer graph differs')
    for name, kind in IDENTITIES:
        value = getattr(model, name)
        require(type(value) is torch.Tensor and value.device == parameters[0].device
                and value.dtype == torch.uint8 and value.shape == (32,)
                and torch.equal(value.detach().cpu(), identity_bytes(kind, geometry)),
                'native stage identity buffer differs')
    return model


def build_fresh_terrain_ecology_native_bounded_stage(*, geometry,
        condition_channel_order=FORMAL_CONDITION_CHANNEL_ORDER):
    validate_geometry(geometry)
    require(torch.get_num_threads() <= 2, 'native stage CPU construction threads exceeded')
    fresh = parent.build_fresh_terrain_ecology_native_stage(
        geometry=geometry, condition_channel_order=condition_channel_order)
    return validate_model_identity(NativeBoundedStageTerrainEcologyRenderer(fresh, geometry))


def migrate_parent_parameters_for_diagnostic(parent_model, *, geometry):
    """Copy an authenticated099-family parent; does not advance any stage.

    Artifact authentication belongs to the bounded caller. Stage1/2 copies here
    are forward diagnostics, never eligible training parents or publication.
    """
    parent.validate_model_identity(parent_model)
    require(next(parent_model.parameters()).device.type == 'cpu', 'native stage parent must be CPU')
    candidate = build_fresh_terrain_ecology_native_bounded_stage(
        geometry=geometry, condition_channel_order=parent_model.condition_channel_order)
    state = {k: v.detach().clone() for k, v in candidate.state_dict().items()}
    originals = tuple(parent_model.named_parameters())
    for name, value in originals:
        require(state[name].shape == value.shape and state[name].dtype == value.dtype,
                'native stage parent parameter differs: ' + name)
        state[name] = value.detach().clone()
    candidate.load_state_dict(state, strict=True)
    migrated = tuple(candidate.named_parameters())
    require(len(originals) == len(migrated) == PARAMETER_COUNT
            and all(n == m and p.untyped_storage().data_ptr() != q.untyped_storage().data_ptr()
                    and torch.equal(p.detach().view(torch.uint8), q.detach().view(torch.uint8))
                    for (n, p), (m, q) in zip(originals, migrated)),
            'native stage migration changed parameter bytes/order or shared storage')
    parent.validate_model_identity(parent_model)
    return candidate
