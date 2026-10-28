"""Explicit train-only auxiliary background hypothesis; unchanged renderer and gates."""
from contextvars import ContextVar
from contextlib import contextmanager
import sys
import torch
import painter_stage4_decode1_entry_weight_training_profile_v1 as parent
from ai_painter.complete_world.isolated_rock_background_proxy_v1 import targets, auxiliary_loss

CAPABILITY = 'stage4_two_rock_background_auxiliary_training_candidate_v1'
EXECUTION_QUALIFIED = False
fresh_networks = parent.fresh_networks
bind_sample_ecology = parent.bind_sample_ecology
validate_sample_ecology = parent.validate_sample_ecology
_bound_device = parent._bound_device
bind_parameters = parent.bind_parameters
observe_generator_gradients = parent.observe_generator_gradients
_FORWARD = ContextVar('rock_background_same_forward', default=None)
_BOUNDARY = ContextVar('rock_background_boundary_rgb', default=None)
BOUNDARY_OBJECTIVE = 'stage4_balanced_boundary_rgb_001_v1'


@contextmanager
def boundary_rgb_scope(sample):
    """Explicit train-only opt-in; both admission and real pairs use this scope."""
    parent.require(_BOUNDARY.get() is None, 'nested boundary scope prohibited')
    _FORWARD.set(None)
    source = sample.get('boundaryRgbSource')
    parent.require(sample.get('split') == 'train' and isinstance(source, dict)
                   and source.get('sampleId') == sample['sampleId'], 'bound boundary source required')
    token = _BOUNDARY.set(source)
    try:
        yield
    finally:
        _BOUNDARY.reset(token)
        _FORWARD.set(None)


def boundary_rgb_loss(prediction, sample):
    source = _BOUNDARY.get()
    parent.require(source is sample.get('boundaryRgbSource') and source is not None
                   and source['sampleId'] == sample['sampleId'], 'same bound boundary source required')
    reference, expected = source.get('reference'), source.get('expectedRoad')
    parent.require(isinstance(reference, torch.Tensor) and reference.shape == (1, 3, 768, 1024)
                   and reference.dtype == torch.float32 and not reference.requires_grad
                   and bool(torch.isfinite(reference).all())
                   and bool(((reference >= 0) & (reference <= 1)).all()), 'original boundary RGB required')
    parent.require(isinstance(expected, torch.Tensor) and expected.dtype == torch.bool
                   and expected.shape == (768, 1024) and not expected.requires_grad,
                   'original boundary road required')
    parent.require(prediction.shape == (1, 3, 192, 256) and prediction.dtype == torch.float32,
                   'native boundary prediction geometry/FP32')
    reference, expected = reference.to(prediction.device), expected.to(prediction.device)
    bands = torch.zeros_like(expected)
    sides = []
    for side, selection in (('north', (slice(0, 6), slice(None))),
                            ('east', (slice(None), slice(-6, None))),
                            ('south', (slice(-6, None), slice(None))),
                            ('west', (slice(None), slice(0, 6)))):
        if bool(expected[selection].any()):
            bands[selection] = True
            sides.append(side)
    mask = expected & bands
    projected = prediction.repeat_interleave(4, -2).repeat_interleave(4, -1)
    raw = ((projected-reference).abs()*mask[None, None]).sum() / (mask.sum()*3).clamp_min(1)
    parent.require(bool(torch.isfinite(raw.detach())), 'finite boundary RGB required')
    return raw, dict(requiredSides=sides, projectedBoundaryPixels=int(mask.sum()),
                     applicable=bool(sides), weight=0.01,
                     notApplicableReason=None if sides else 'structurally_empty_required_road_boundary',
                     sourceBindings={key: source[key] for key in ('image', 'road', 'conditionPack')})


def sample_forward(model, sample, return_evidence=False):
    if parent._geometry_kwargs(model):
        parent.require(_BOUNDARY.get() is None, 'native family prohibits inherited boundary loss scope')
    prediction, evidence = parent.sample_forward(model, sample, return_evidence=True)
    if torch.is_grad_enabled():
        _FORWARD.set((model, prediction, sample['sampleId'], evidence))
    return (prediction, evidence) if return_evidence else prediction


def _generator_candidate(model, critic, sample, order, prediction, *, support_structure_weight=0.1):
    geometry = parent._geometry_kwargs(model)
    if geometry:
        parent.require(_BOUNDARY.get() is None, 'native family prohibits inherited boundary loss scope')
    cached = _FORWARD.get()
    _FORWARD.set(None)
    parent.require(cached is not None and cached[0] is model and cached[1] is prediction
                   and cached[2] == sample['sampleId'], 'same authenticated forward evidence required')
    weight = parent._validate_support_structure_weight(support_structure_weight)
    parent.require(not geometry or weight == 0.1, 'native family requires original support weight0.1')
    evidence = cached[3]
    recomputed = parent._recomputed_identity(model)
    if recomputed is not None:
        parent.require(type(evidence.get('nativeExecutionCalls')) is dict
                       and evidence['nativeExecutionCalls'].get('executionRule') == recomputed.EXECUTION_RULE,
                       'same-forward native execution ledger required')
    with parent.generator_fp32_scope(next(model.parameters()).device):
        original_total, parts = parent.train_object_support_structure_candidate_objective(
            critic, prediction, sample, sample['objectInstanceTable'], order,
            **geometry,
            **({'support_structure_weight': weight} if weight == 1.0 else {}))
        target, mask, records = targets(sample, order, evidence, **geometry)
        background = auxiliary_loss(evidence['terrainRgb'], target, mask, **geometry)
        structured = parts['v21UnchangedTotal'] + background
        boundary = None
        if _BOUNDARY.get() is not None:
            parent.require(weight == 0.1, 'boundary scope requires original support weight')
            boundary, boundary_facts = boundary_rgb_loss(prediction, sample)
            boundary = 0.01 * boundary
            structured = structured + boundary
        total = ((structured + parts['wholeFrameFidelity']) + parts['objectCoreRgbWeighted']) + parts['objectSupportStructureWeighted']
        candidate, facts = parent.compute_generator_candidate_gradients(
            model=model, critic=critic, sample=sample, actual_total=total,
            structured_objective=structured, whole_frame_fidelity=parts['wholeFrameFidelity'],
            object_core_rgb=parts['objectCoreRgbWeighted'], object_support_structure=parts['objectSupportStructureWeighted'])
    facts.update(trainingObjective=CAPABILITY, backgroundAuxiliaryWeight=1.0,
                 backgroundHypotheses=records, backgroundTargetPixelCount=int(mask.sum()))
    if recomputed is not None:
        from copy import deepcopy
        facts['nativeExecutionCalls'] = deepcopy(evidence['nativeExecutionCalls'])
    if weight == 1.0:
        facts.update(trainingObjective='stage4_two_rock_background_support_weight1_training_candidate_v1',
                     objectSupportStructureWeight=1.0)
    facts['scalarValues'].update(structuredOriginal=float(parts['v21UnchangedTotal'].detach()),
                                backgroundAuxiliary=float(background.detach()))
    if boundary is not None:
        facts.update(trainingObjective=BOUNDARY_OBJECTIVE, boundaryRgb=boundary_facts)
        # Seven existing values + one new value: the unchanged recorder limit is8.
        facts['scalarValues']['boundaryPathRgbWeighted'] = float(boundary.detach())
        parent.require(len(facts['scalarValues']) <= 8, 'boundary scalar recording ceiling')
    return total, candidate, facts


def perform_pair(*args, **kwargs):
    parent.require('components' not in kwargs, 'external component override prohibited')
    try:
        return parent.perform_pair(*args, **kwargs, components=sys.modules[__name__])
    finally:
        _FORWARD.set(None)


def zero_update_probe(*args, **kwargs):
    parent.require('components' not in kwargs, 'external component override prohibited')
    try:
        return parent.zero_update_probe(*args, **kwargs, components=sys.modules[__name__])
    finally:
        _FORWARD.set(None)
