"""Explicit, unqualified native memory plan; old families remain unchanged.

Five registered bounded weight VJPs plus segmented non-reentrant activation
recomputation. No optimizer, artifact loader, execution admission or publication.
"""
from collections.abc import Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
from dataclasses import fields, is_dataclass
import hashlib

import torch
from torch import nn
from torch.nn import functional as F
from torch.utils.checkpoint import checkpoint, set_checkpoint_early_stop

from ai_painter.complete_world import terrain_ecology_native_bounded_stage_v1 as parent
from ai_painter.complete_world import native_training_bounded_weight_vjp_v1 as bounded
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as graph_api
from ai_painter.complete_world import object_ecology_regime_conditioned as ecology
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_ecology_regime_input_cpu import require, validate_ecology, validate_regime
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry, validate_geometry
from ai_painter.complete_world.terrain_ecology_projection_v1 import _TERRAIN_PROJECTION
from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import aperiodic_detail_basis
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import TERRAIN_ROLES
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import coordinate_free_views
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import ROLES

CAPABILITY = 'terrain_ecology_native_recomputed_stage_v1'
ARCHITECTURE = parent.ARCHITECTURE + '_registered_segment_recomputation_five_bounded_targets_v1'
EXECUTION_RULE = 'nonreentrant_preserve_rng_default_determinism_no_early_stop_segments_v1'
TARGETS = (
    (4, 'core.core.terrain.base_stem.layers.3', 48),
    (52, 'core.core.terrain.decode_1.layers.3', 48),
    (56, 'core.core.terrain.full_resolution_detail.layers.0', 68),
    (60, 'core.core.terrain.full_resolution_detail.layers.3', 48),
    (88, 'core.core.final_rgb_decoder.base.layers.2', 48),
)
NUMERIC_RULE = ('native_training_memory_v1|parent_numeric=' + parent.NUMERIC_RULE
                + '|replacement_targets=' + repr(TARGETS)
                + '|replacement_numeric=' + bounded.NUMERIC_RULE + '|execution=' + EXECUTION_RULE)
PARAMETER_COUNT = parent.PARAMETER_COUNT
PARAMETER_ELEMENTS = parent.PARAMETER_ELEMENTS
GEOMETRY_CONSUMERS = parent.GEOMETRY_CONSUMERS
IDENTITIES = parent.IDENTITIES
TERRAIN_PATH = 'core.core.terrain'
APPEARANCE_PATH = 'core.core.appearance'
DECODER_PATH = 'core.core.final_rgb_decoder'
TERRAIN_BLOCKS = ('base_stem', 'down_1', 'down_2', 'bottleneck',
                  'decode_3', 'decode_2', 'decode_1', 'full_resolution_detail')
SEGMENTS = (*TERRAIN_BLOCKS, *('responsibility_heads.' + role for role in TERRAIN_ROLES),
            'appearance', 'decoder')
_CONTEXTS = (seasonal._REGIME, ecology._ECOLOGY, _TERRAIN_PROJECTION)
_LEDGER = ContextVar('native_recomputed_execution_ledger_v1', default=None)
_SEGMENT_RUNNING = ContextVar('native_recomputed_segment_running_v1', default=False)
_BOUND_METADATA = (*graph_api._CONFIG, 'bound_target', '_bound_target', 'native_stage_geometry',
                   'order', 'base_indices', 'coordinate_indices', 'scales', 'numeric_rule',
                   'execution_qualified')


def _new_counts():
    return {'executionRule': EXECUTION_RULE, 'logicalGeneratorAttempts': 0,
            'logicalGeneratorCompleted': 0,
            'segments': {name: {phase + suffix: 0 for phase in ('original', 'recompute', 'direct')
                                for suffix in ('Attempts', 'Completed')} for name in SEGMENTS}}


@contextmanager
def execution_call_scope(model):
    """External counters; no model parameter, buffer or instance state is changed."""
    require(type(model) is NativeRecomputedStageTerrainEcologyRenderer,
            'exact recomputed execution counter owner required')
    active = _LEDGER.get()
    if active is not None:
        require(active[0] is model, 'foreign/nested recomputed execution owner')
        yield active[1]
        return
    counts = _new_counts()
    token = _LEDGER.set((model, counts))
    try:
        yield counts
    finally:
        _LEDGER.reset(token)


def _binding(value):
    """Metadata/version guards, without extra tensor copies or value reductions."""
    if isinstance(value, torch.Tensor):
        # Autograd can return a different Python Tensor wrapper for saved input.
        return ('tensor', graph_api._storage_identity(value), value._version,
                value.dtype, value.device, tuple(value.shape), value.requires_grad)
    if is_dataclass(value) and not isinstance(value, type):
        return (type(value), id(value), tuple((f.name, _binding(getattr(value, f.name))) for f in fields(value)))
    if isinstance(value, Mapping):
        return (type(value), tuple((k, _binding(v)) for k, v in value.items()))
    if isinstance(value, (tuple, list)):
        return (type(value), tuple(_binding(v) for v in value))
    require(value is None or type(value) in (str, int, float, bool),
            'unsupported mutable recomputation binding')
    return (type(value), value)


def _module_binding(module):
    return (tuple((name, id(m), type(m), m.training, 'forward' in m.__dict__,
                   tuple((key, _binding(getattr(m, key))) for key in _BOUND_METADATA if hasattr(m, key)))
                  for name, m in module.named_modules()),
            tuple((name, id(p), _binding(p)) for name, p in module.named_parameters(remove_duplicate=False)),
            tuple((name, id(b), _binding(b)) for name, b in module.named_buffers(remove_duplicate=False)))


class _BoundContexts:
    """Re-enterable across all five retain_graph VJPs; never a spent generator."""
    def __init__(self, values):
        self.values = values
        self.stack = []

    def __enter__(self):
        tokens = []
        try:
            for variable, value in zip(_CONTEXTS, self.values):
                tokens.append((variable, variable.set(value)))
            self.stack.append(tokens)
        except BaseException:
            for variable, token in reversed(tokens):
                variable.reset(token)
            raise
        return self

    def __exit__(self, *unused):
        for variable, token in reversed(self.stack.pop()):
            variable.reset(token)


def _segment(name, module, body, *args):
    require(name in SEGMENTS and isinstance(module, nn.Module), 'unknown recomputation segment')
    require(not _SEGMENT_RUNNING.get(), 'recursive recomputation dispatcher prohibited')
    active = _LEDGER.get()
    require(active is not None, 'missing explicit recomputation execution scope')
    counts = active[1]['segments'][name]
    enabled = active[0].training and module.training and torch.is_grad_enabled()
    original_done = False
    if enabled:
        require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
                'recomputation autocast prohibited')
        values = tuple(variable.get() for variable in _CONTEXTS)
        # Keep only these three contexts, never the whole Context or observers.
        context_binding = (_binding(values[0]), _binding(values[1]), _module_binding(values[2]))
        args_binding, modules_binding = _binding(args), _module_binding(module)

    def call(*inputs):
        nonlocal original_done
        phase = ('recompute' if original_done else 'original') if enabled else 'direct'
        counts[phase + 'Attempts'] += 1
        require(not _SEGMENT_RUNNING.get(), 'recursive physical segment call prohibited')
        token = _SEGMENT_RUNNING.set(True)
        try:
            if enabled:
                require(_binding(inputs) == args_binding and _module_binding(module) == modules_binding,
                        'recomputation input/parameter/mode/buffer binding changed')
                require(tuple(variable.get() is value for variable, value in zip(_CONTEXTS, values)) == (True,) * 3
                        and (_binding(values[0]), _binding(values[1]), _module_binding(values[2])) == context_binding,
                        'recomputation season/ecology/projection binding changed')
                require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
                        'recomputation autocast prohibited')
            result = body(*inputs)
            counts[phase + 'Completed'] += 1
            original_done = True
            return result
        finally:
            _SEGMENT_RUNNING.reset(token)

    if not enabled:
        return call(*args)
    # PyTorch's enclosing early-stop context overrides the keyword. Scope the
    # public setting here as well, restoring the caller's setting on every exit.
    with set_checkpoint_early_stop(False):
        return checkpoint(call, *args, use_reentrant=False, preserve_rng_state=True,
                          determinism_check='default', early_stop=False,
                          context_fn=lambda: (_BoundContexts(values), _BoundContexts(values)))


class RecomputedTerrainFeatureBackbone(nn.Module):
    def __init__(self, source, order):
        super().__init__()
        self.base_indices = tuple(source.base_indices)
        self.coordinate_indices = tuple(source.coordinate_indices)
        self.scales = tuple(source.scales)
        self.order = tuple(order)
        for name in (*TERRAIN_BLOCKS, 'responsibility_heads'):
            self.add_module(name, getattr(source, name))
        self.training = source.training

    def _pooled(self, name, value):
        block = self.get_submodule(name)
        return _segment(name, block, lambda x: block(F.avg_pool2d(x, 2)), value)

    def _decoded(self, name, value, skip):
        block = self.get_submodule(name)
        return _segment(name, block, lambda x, s: block(torch.cat((
            F.interpolate(x, size=s.shape[-2:], mode='bilinear', align_corners=False), s), dim=1)), value, skip)

    def forward(self, conditions):
        detail = aperiodic_detail_basis(conditions, self.coordinate_indices, self.scales)
        indices, block = self.base_indices, self.base_stem
        level_1 = _segment('base_stem', block,
                           lambda x, d: block(torch.cat((x[:, indices], d), dim=1)), conditions, detail)
        level_2 = self._pooled('down_1', level_1)
        level_3 = self._pooled('down_2', level_2)
        center = self._pooled('bottleneck', level_3)
        decoded_3 = self._decoded('decode_3', center, level_3)
        decoded_2 = self._decoded('decode_2', decoded_3, level_2)
        decoded_1 = self._decoded('decode_1', decoded_2, level_1)
        detail_block = self.full_resolution_detail
        features = _segment('full_resolution_detail', detail_block,
                            lambda x, d: detail_block(torch.cat((x, d), dim=1)), decoded_1, detail)
        responsibilities = {}
        for role in TERRAIN_ROLES:
            mask = conditions[:, self.order.index(role):self.order.index(role) + 1]
            head = self.responsibility_heads[role]
            responsibilities[role] = _segment('responsibility_heads.' + role, head,
                lambda x, m, head=head: head(torch.cat((x, m), dim=1)) * m, features, mask)
        return features, responsibilities


class RecomputedPositionRegularizedAppearance(nn.Module):
    def __init__(self, source, order):
        super().__init__()
        expected = next(cls for name, cls, _ in parent._reference(tuple(order))[1] if name == APPEARANCE_PATH)
        require(type(source) is expected, 'exact original V18 position-regularized appearance required')
        self.base, self.order = source.base, tuple(order)
        self.training = source.training

    def forward(self, views, terrain_patches):
        # Tuple/dataclass/tensor versions are guarded throughout recomputation.
        frozen_views, order, base = tuple(views), self.order, self.base
        def body(bound_views, patches):
            return base(coordinate_free_views(bound_views, order), patches)
        return _segment('appearance', self, body, frozen_views, terrain_patches)


class RecomputedTerrainOnlyDecoder(nn.Module):
    def __init__(self, source):
        super().__init__()
        self.base = source.base
        self.training = source.training

    def forward(self, terrain_features, terrain_roles, object_roles, responsibility_conditions):
        base = self.base
        def body(features, ground, objects, conditions):
            terrain_only_masks = dict(conditions)
            for role in ROLES:
                terrain_only_masks[role] = torch.zeros_like(terrain_only_masks[role])
            return base(features, ground, tuple(torch.zeros_like(value) for value in objects), terrain_only_masks)
        return _segment('decoder', self, body, terrain_features, terrain_roles,
                        object_roles, responsibility_conditions)


def identity_bytes(kind, geometry):
    validate_geometry(geometry)
    require(kind in ('regime', 'numeric', 'ecology'), 'unknown recomputed identity kind')
    payload = '|'.join((kind, CAPABILITY, ARCHITECTURE, NUMERIC_RULE,
                        repr(geometry.identity()), *parent.SEASONS, *parent.ECOLOGIES))
    return torch.tensor(list(hashlib.sha256(payload.encode()).digest()), dtype=torch.uint8, device='cpu')


def _reference(order):
    graph, modules, forward, support, aggregation = parent._reference(order)
    replacements = {'': NativeRecomputedStageTerrainEcologyRenderer,
                    TERRAIN_PATH: RecomputedTerrainFeatureBackbone,
                    APPEARANCE_PATH: RecomputedPositionRegularizedAppearance,
                    DECODER_PATH: RecomputedTerrainOnlyDecoder,
                    **{path: bounded.NativeTrainingBoundedWeightConv for _, path, _ in TARGETS}}
    return graph, tuple((name, replacements.get(name, cls), config) for name, cls, config in modules), forward, support, aggregation


class NativeRecomputedStageTerrainEcologyRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_rule = EXECUTION_RULE
    execution_qualified = False
    parent_checkpoint_loaded = False

    def __init__(self, fresh, geometry):
        super().__init__()
        parent.validate_model_identity(fresh)
        require(next(fresh.parameters()).device.type == 'cpu', 'recomputed construction requires CPU')
        self.native_stage_geometry = validate_geometry(geometry)
        require(geometry == fresh.native_stage_geometry, 'recomputed source geometry differs')
        self.core = deepcopy(fresh.core)
        self.object_rgb_heads = deepcopy(fresh.object_rgb_heads)
        self.terrain_ecology_projection = deepcopy(fresh.terrain_ecology_projection)
        self.condition_channel_order = tuple(fresh.condition_channel_order)
        self._parent_forward = fresh._parent_forward
        self.support_ownership_rule = fresh.support_ownership_rule
        self.object_aggregation_rule = fresh.object_aggregation_rule
        require(tuple(bounded.REGISTERED_TARGETS) == tuple(path for _, path, _ in TARGETS),
                'bounded component exact five-target interface differs')
        for _, path, _ in TARGETS:
            container, key = path.rsplit('.', 1)
            owner = self.get_submodule(container)
            owner._modules[key] = bounded.build_native_training_bounded_weight_conv(owner._modules[key], target=path)
        core = self.core.core
        core.terrain = RecomputedTerrainFeatureBackbone(core.terrain, self.condition_channel_order)
        core.appearance = RecomputedPositionRegularizedAppearance(core.appearance, self.condition_channel_order)
        core.final_rgb_decoder = RecomputedTerrainOnlyDecoder(core.final_rgb_decoder)
        for name in GEOMETRY_CONSUMERS:
            self.get_submodule(name).native_stage_geometry = geometry
        for name, kind in IDENTITIES:
            self.register_buffer(name, identity_bytes(kind, geometry))
        self.training = fresh.training
        before, after = tuple(fresh.named_parameters()), tuple(self.named_parameters())
        require(len(before) == len(after) == PARAMETER_COUNT and all(
            n == m and p.data_ptr() != q.data_ptr() and p.requires_grad == q.requires_grad
            and torch.equal(p.detach().view(torch.uint8), q.detach().view(torch.uint8))
            for (n, p), (m, q) in zip(before, after)), 'recomputed construction changed parameter graph/bytes/flags')

    def forward(self, conditions, instance_table, *, appearance_regime, ecology_regime, return_evidence=False):
        validate_model_identity(self)
        geometry = self.native_stage_geometry
        require(type(conditions) is torch.Tensor
                and conditions.shape == (1, 23, geometry.height, geometry.width)
                and conditions.dtype == torch.float32 and conditions.device == next(self.parameters()).device,
                'recomputed condition geometry/device/FP32 differs')
        require(not _SEGMENT_RUNNING.get(), 'recursive recomputed model forward prohibited')
        require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
                'recomputed autocast prohibited')
        season, code = validate_regime(appearance_regime), validate_ecology(ecology_regime)
        with execution_call_scope(self) as counts, _BoundContexts((season, code, self.terrain_ecology_projection)):
            counts['logicalGeneratorAttempts'] += 1
            result = self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
            counts['logicalGeneratorCompleted'] += 1
            if return_evidence:
                rgb, evidence = result
                require('nativeExecutionCalls' not in evidence, 'recomputation evidence collision')
                return rgb, {**evidence, 'nativeExecutionCalls': counts}
            return result

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        expected = self.state_dict()
        require(next(self.parameters()).device.type == 'cpu' and strict is True and assign is False
                and isinstance(state_dict, Mapping) and tuple(state_dict) == tuple(expected),
                'recomputed strict complete CPU state required')
        for key, value in state_dict.items():
            require(type(value) is torch.Tensor and value.device.type == 'cpu' and not value.requires_grad
                    and value.layout == torch.strided and value.is_contiguous()
                    and value.shape == expected[key].shape and value.dtype == expected[key].dtype
                    and bool(torch.isfinite(value).all()), 'recomputed state differs: ' + key)
        for name, kind in IDENTITIES:
            require(torch.equal(state_dict[name], identity_bytes(kind, self.native_stage_geometry)),
                    'foreign/legacy recomputed state rejected')
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
                    'recomputed install changed modules/modes')
            require(all(a is b for a, b in zip(self.parameters(), parameters))
                    and all(a is b for a, b in zip(self.buffers(), buffers))
                    and all(p.requires_grad == flag and p.grad is grad for p, flag, grad in parameter_slots),
                    'recomputed install changed identities/flags')
            require(all(graph_api._storage_identity(v) == sid for v, _, sid in data),
                    'recomputed install rebound storage')
            installed = self.state_dict()
            require(tuple(installed) == tuple(verified) and all(torch.equal(
                installed[k].reshape(-1).view(torch.uint8), v.reshape(-1).view(torch.uint8)) for k, v in verified.items()),
                'recomputed installed bytes differ')
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
    require(type(model) is NativeRecomputedStageTerrainEcologyRenderer
            and model.capability_version == CAPABILITY and model.architecture_id == ARCHITECTURE
            and model.numeric_rule == NUMERIC_RULE and model.execution_rule == EXECUTION_RULE
            and model.execution_qualified is False and model.parent_checkpoint_loaded is False,
            'exact unqualified recomputed identity required')
    require(torch.get_num_threads() <= 2, 'recomputed CPU thread budget exceeded')
    geometry = validate_geometry(model.native_stage_geometry)
    graph, modules, forward, support, aggregation = _reference(tuple(model.condition_channel_order))
    named, parameters = tuple(model.named_parameters(remove_duplicate=False)), tuple(model.parameters())
    require(tuple((n, tuple(p.shape), p.dtype) for n, p in named) == graph
            and len(named) == len(parameters) == PARAMETER_COUNT
            and sum(p.numel() for p in parameters) == PARAMETER_ELEMENTS
            and len({id(p) for p in parameters}) == PARAMETER_COUNT
            and len({p.untyped_storage().data_ptr() for p in parameters}) == PARAMETER_COUNT
            and all(p.device == parameters[0].device and p.device.type in ('cpu', 'cuda')
                    and p.layout == torch.strided and p.is_contiguous()
                    and bool(torch.isfinite(p.detach()).all()) for p in parameters),
            'recomputed canonical graph/finite/device/alias differs')
    require(graph_api._module_graph(model) == modules and model._parent_forward is forward
            and model.support_ownership_rule == support and model.object_aggregation_rule == aggregation
            and all('forward' not in m.__dict__ for m in model.modules()),
            'recomputed exact modules/forward/ownership differs')
    for index, path, channels in TARGETS:
        module = model.get_submodule(path)
        require(type(module) is bounded.NativeTrainingBoundedWeightConv
                and module.bound_target == path
                and named[index][0] == path + '.weight' and tuple(module.weight.shape) == (48, channels, 3, 3),
                'recomputed exact bounded target differs: ' + path)
    terrain, appearance = model.core.core.terrain, model.core.core.appearance
    # Canonical immutable metadata comes from the original graph's cached prototype.
    original_terrain = graph_api._fresh_prototype(tuple(model.condition_channel_order)).core.core.terrain
    require(terrain.base_indices == tuple(original_terrain.base_indices)
            and terrain.coordinate_indices == tuple(original_terrain.coordinate_indices)
            and terrain.scales == tuple(original_terrain.scales)
            and terrain.order == appearance.order == tuple(model.condition_channel_order),
            'recomputed fact-channel metadata differs')
    consumers = tuple(name for name, m in model.named_modules() if hasattr(m, 'native_stage_geometry'))
    require(set(consumers) == set(GEOMETRY_CONSUMERS) and all(
        type(model.get_submodule(name).native_stage_geometry) is NativeStageGeometry
        and model.get_submodule(name).native_stage_geometry == geometry for name in GEOMETRY_CONSUMERS),
        'recomputed geometry consumers differ')
    require(tuple(n for n, _ in model.named_buffers()) == tuple(n for n, _ in IDENTITIES),
            'recomputed buffer graph differs')
    for name, kind in IDENTITIES:
        value = getattr(model, name)
        require(type(value) is torch.Tensor and value.device == parameters[0].device
                and value.dtype == torch.uint8 and value.shape == (32,)
                and torch.equal(value.detach().cpu(), identity_bytes(kind, geometry)),
                'recomputed identity buffer differs')
    return model


def build_fresh_terrain_ecology_native_recomputed_stage(*, geometry,
        condition_channel_order=parent.FORMAL_CONDITION_CHANNEL_ORDER):
    validate_geometry(geometry)
    require(torch.get_num_threads() <= 2, 'recomputed CPU construction thread budget exceeded')
    fresh = parent.build_fresh_terrain_ecology_native_bounded_stage(
        geometry=geometry, condition_channel_order=condition_channel_order)
    return validate_model_identity(NativeRecomputedStageTerrainEcologyRenderer(fresh, geometry))
