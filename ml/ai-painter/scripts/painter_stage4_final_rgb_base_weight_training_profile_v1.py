"""Registered final RGB profile; explicit components for the existing pair/probe engine."""
import sys
import torch
import painter_stage4_object_support_structure_training_profile_v1 as shared
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as model_identity
from ai_painter.complete_world.object_support_final_rgb_weight_priority_update_device_v1 import (
    CAPABILITY, MODEL_CAPABILITY, COMPONENTS_IN_ORDER, bind_parameters, compute_generator_candidate_gradients,
    observe_generator_gradients, require)
from ai_painter.complete_world.native_rgb_object_support_structure_device_v1 import train_object_support_structure_candidate_objective
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

EXECUTION_QUALIFIED = False
UPDATE_LIMIT = 1152
inherited = shared.inherited
prepare_metadata = inherited.prepare_metadata
bind_sample_ecology = inherited.bind_sample_ecology
validate_sample_ecology = inherited.validate_sample_ecology
generator_fp32_scope = inherited.generator_fp32_scope


def fresh_networks(order):
    require(torch.get_num_threads() <= 2 and inherited.core.TRAINING["initializationSeed"] == 20260929, "fixed CPU/seed required")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(20260929)
        model = model_identity.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
    bind_parameters(model)
    return model, critic


def _bound_device(model, sample):
    require(sample.get("split") in ("train", "validation"), "train/validation source required")
    validate_sample_ecology(sample)
    device = next(model.parameters()).device
    with generator_fp32_scope(device):
        bind_parameters(model)
    for key, shape in (("image", (3,192,256)), ("conditions", (23,192,256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.dtype == torch.float32
            and value.device.type in ("cpu", device.type) and not value.requires_grad and bool(torch.isfinite(value).all())
            and bool(((value >= 0) & (value <= 1)).all()), "detached source FP32 tensor required")
    return {**sample,"image":sample["image"].detach().to(device),"conditions":sample["conditions"].detach().to(device)}


def sample_forward(model, sample, return_evidence=False):
    require(sample.get("split") == "train" or not torch.is_grad_enabled(), "validation is readonly")
    return inherited.sample_forward(model, _bound_device(model,sample), return_evidence=return_evidence)


def _generator_candidate(model, critic, sample, order, prediction):
    require(sample.get("split") == "train" and tuple(order) == tuple(model.condition_channel_order), "train/order differs")
    with generator_fp32_scope(next(model.parameters()).device):
        total, parts = train_object_support_structure_candidate_objective(critic,prediction,sample,sample["objectInstanceTable"],order)
        candidate, facts = compute_generator_candidate_gradients(model=model,critic=critic,sample=sample,actual_total=total,
            structured_objective=parts["v21UnchangedTotal"],whole_frame_fidelity=parts["wholeFrameFidelity"],
            object_core_rgb=parts["objectCoreRgbWeighted"],object_support_structure=parts["objectSupportStructureWeighted"])
    return total,candidate,facts


def perform_pair(*args, **kwargs):
    require("components" not in kwargs, "caller component override prohibited")
    return shared.perform_pair(*args, **kwargs, components=sys.modules[__name__])


def zero_update_probe(*args, **kwargs):
    require("components" not in kwargs, "caller component override prohibited")
    return shared.zero_update_probe(*args, **kwargs, components=sys.modules[__name__])
