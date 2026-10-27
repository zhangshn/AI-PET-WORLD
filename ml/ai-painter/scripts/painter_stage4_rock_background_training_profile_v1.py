"""Explicit train-only auxiliary background hypothesis; unchanged renderer and gates."""
from contextvars import ContextVar
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


def sample_forward(model, sample, return_evidence=False):
    prediction, evidence = parent.sample_forward(model, sample, return_evidence=True)
    if torch.is_grad_enabled():
        _FORWARD.set((model, prediction, sample['sampleId'], evidence))
    return (prediction, evidence) if return_evidence else prediction


def _generator_candidate(model, critic, sample, order, prediction, *, support_structure_weight=0.1):
    cached = _FORWARD.get()
    _FORWARD.set(None)
    parent.require(cached is not None and cached[0] is model and cached[1] is prediction
                   and cached[2] == sample['sampleId'], 'same authenticated forward evidence required')
    weight = parent._validate_support_structure_weight(support_structure_weight)
    evidence = cached[3]
    with parent.generator_fp32_scope(next(model.parameters()).device):
        original_total, parts = parent.train_object_support_structure_candidate_objective(
            critic, prediction, sample, sample['objectInstanceTable'], order,
            **({'support_structure_weight': weight} if weight == 1.0 else {}))
        target, mask, records = targets(sample, order, evidence)
        background = auxiliary_loss(evidence['terrainRgb'], target, mask)
        structured = parts['v21UnchangedTotal'] + background
        total = ((structured + parts['wholeFrameFidelity']) + parts['objectCoreRgbWeighted']) + parts['objectSupportStructureWeighted']
        candidate, facts = parent.compute_generator_candidate_gradients(
            model=model, critic=critic, sample=sample, actual_total=total,
            structured_objective=structured, whole_frame_fidelity=parts['wholeFrameFidelity'],
            object_core_rgb=parts['objectCoreRgbWeighted'], object_support_structure=parts['objectSupportStructureWeighted'])
    facts.update(trainingObjective=CAPABILITY, backgroundAuxiliaryWeight=1.0,
                 backgroundHypotheses=records, backgroundTargetPixelCount=int(mask.sum()))
    if weight == 1.0:
        facts.update(trainingObjective='stage4_two_rock_background_support_weight1_training_candidate_v1',
                     objectSupportStructureWeight=1.0)
    facts['scalarValues'].update(structuredOriginal=float(parts['v21UnchangedTotal'].detach()),
                                backgroundAuxiliary=float(background.detach()))
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
