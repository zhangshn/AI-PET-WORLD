"""Explicit component adapter: same model/loss, support-region terrain derivative routing."""
import sys
import painter_stage4_decode1_entry_weight_training_profile_v1 as parent
from ai_painter.complete_world.object_support_terrain_gradient_device_v1 import support_routed_prediction

CAPABILITY = 'stage4_support_terrain_gradient_training_candidate_v1'
EXECUTION_QUALIFIED = False
fresh_networks = parent.fresh_networks
bind_sample_ecology = parent.bind_sample_ecology
validate_sample_ecology = parent.validate_sample_ecology
_bound_device = parent._bound_device
bind_parameters = parent.bind_parameters
_generator_candidate = parent._generator_candidate
observe_generator_gradients = parent.observe_generator_gradients


def sample_forward(model, sample, return_evidence=False):
    prediction, evidence = parent.sample_forward(model, sample, return_evidence=True)
    routed, _ = support_routed_prediction(prediction, evidence)
    return (routed, evidence) if return_evidence else routed


def perform_pair(*args, **kwargs):
    parent.require('components' not in kwargs, 'external component override prohibited')
    return parent.perform_pair(*args, **kwargs, components=sys.modules[__name__])


def zero_update_probe(*args, **kwargs):
    parent.require('components' not in kwargs, 'external component override prohibited')
    return parent.zero_update_probe(*args, **kwargs, components=sys.modules[__name__])
