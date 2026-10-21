"""Inactive additive support-structure objective; synthetic CPU definition only.

No model, optimizer, execution entry, qualification or production routing is
provided. Original objectives and their existing failure boundaries are retained.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
import torch

from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import (
    train_object_core_fidelity_candidate_objective,
)
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    complete_typed_support_partition, OWNERSHIP_RULE, TYPED_ROLES,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import LUMA_WEIGHTS
from ai_painter.complete_world.object_instance_supervision_cpu import PATCH_SIZE
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER

CANDIDATE_ID = "stage4_mvp256_dry_object_support_structure_loss_cpu_v1"
EXECUTION_QUALIFIED = False
OBJECT_SUPPORT_STRUCTURE_WEIGHT = 0.1
EPSILON = 1e-8
MINIMUM_PIXELS = 2
MINIMUM_REFERENCE_CENTERED_ENERGY = 1e-8


def _require(condition, message):
    if not condition: raise ValueError(message)


def _support_structure_weight(value):
    _require(type(value) is float and value in (OBJECT_SUPPORT_STRUCTURE_WEIGHT, 1.0),
        "support structure weight must be float 0.1 or 1.0")
    return value


def _bound_inputs(predicted, sample, channel_order):
    _require(isinstance(sample, Mapping) and sample.get("split") == "train", "support structure requires train split")
    _require(torch.get_num_threads() <= 2, "support structure CPU threads exceeded")
    _require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "support structure requires FP32 without autocast")
    _require(isinstance(channel_order, Sequence) and not isinstance(channel_order, (str, bytes))
        and tuple(channel_order) == FORMAL_CONDITION_CHANNEL_ORDER, "support structure formal channel order differs")
    target, conditions = sample.get("image"), sample.get("conditions")
    for value, shape in ((predicted, (1, 3, 192, 256)), (target, (3, 192, 256)), (conditions, (23, 192, 256))):
        _require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape
            and value.device.type == "cpu" and value.dtype == torch.float32 and value.layout == torch.strided,
            "support structure requires complete CPU FP32 tensors")
        plain = value.detach()
        _require(bool(torch.isfinite(plain).all()) and bool(((plain >= 0) & (plain <= 1)).all()),
            "support structure requires finite tensors in [0,1]")
    return {**sample, "image": target.detach(), "conditions": conditions.detach()}, tuple(channel_order)


def _visible_support(conditions, instance_table, channel_order):
    """Reproduce original clipped support union and exact typed ownership."""
    _require(isinstance(instance_table, Sequence) and not isinstance(instance_table, (str, bytes))
        and all(isinstance(item, Mapping) for item in instance_table), "bound instance table required")
    with torch.no_grad():
        views = validate_bound_object_views(conditions.detach(), instance_table, channel_order)
        coverage = {role: torch.zeros((1, 1, 192, 256), dtype=torch.float32) for role in TYPED_ROLES}
        for view in views:
            y0, y1 = max(0, view.top), min(192, view.top + PATCH_SIZE)
            x0, x1 = max(0, view.left), min(256, view.left + PATCH_SIZE)
            dy, dx = y0 - view.top, x0 - view.left
            clipped = view.support_mask[:, dy:dy + y1-y0, dx:dx + x1-x0].detach()
            region = coverage[view.role][0, :, y0:y1, x0:x1]
            region.copy_(torch.maximum(region, clipped))
        cores = {role: conditions[channel_order.index(role)][None, None].detach() for role in TYPED_ROLES}
        owned, _distances = complete_typed_support_partition(cores, coverage)
        return {role: mask.detach() for role, mask in owned.items()}


def train_original_object_support_structure(predicted, sample, instance_table, channel_order,
        *, support_structure_weight=OBJECT_SUPPORT_STRUCTURE_WEIGHT):
    """Return the weighted new term and explicit applicability diagnostics.

    Masks are rebuilt from authoritative facts, never caller overrides or RGB.
    A differentiable zero for all-NA is not a successful structure observation.
    """
    support_structure_weight = _support_structure_weight(support_structure_weight)
    bound, order = _bound_inputs(predicted, sample, channel_order)
    masks = _visible_support(bound["conditions"], instance_table, order)
    weights = predicted.new_tensor(LUMA_WEIGHTS)[:, None, None]
    candidate_luma = (predicted[0] * weights).sum(0)
    reference_luma = (bound["image"] * weights).sum(0)
    terms, diagnostics = [], {}
    for role in TYPED_ROLES:
        mask = masks[role][0, 0]
        pixels = int(mask.sum())
        diagnostic = {"pixels": pixels, "status": "not_applicable", "reason": None, "correlation": None}
        if pixels < MINIMUM_PIXELS:
            diagnostic["reason"] = "fewer_than_two_support_pixels"
        else:
            candidate, reference = candidate_luma[mask], reference_luma[mask]
            candidate_centered, reference_centered = candidate - candidate.mean(), reference - reference.mean()
            reference_energy = reference_centered.square().sum()
            if float(reference_energy) < MINIMUM_REFERENCE_CENTERED_ENERGY:
                diagnostic["reason"] = "constant_reference_support"
            else:
                numerator = (candidate_centered * reference_centered).sum()
                denominator = torch.sqrt(candidate_centered.square().sum() * reference_energy + EPSILON)
                correlation = (numerator / denominator).clamp(-1, 1)
                terms.append(1 - correlation)
                diagnostic.update(status="applicable", correlation=correlation)
        diagnostics[role] = diagnostic
    loss = torch.stack(terms).mean() if terms else predicted.sum() * 0
    weighted = support_structure_weight * loss
    _require(bool(torch.isfinite(weighted.detach())), "nonfinite support structure objective")
    return weighted, {"objectSupportStructureLoss": loss, "objectSupportStructureWeighted": weighted,
        "objectSupportStructureStatus": "applicable" if terms else "not_applicable",
        "objectSupportStructureApplicableRoleCount": len(terms), "objectSupportStructureRoles": diagnostics,
        "objectSupportOwnershipRule": OWNERSHIP_RULE}


def train_object_support_structure_candidate_objective(discriminator, predicted, sample, instance_table, channel_order,
        *, support_structure_weight=OBJECT_SUPPORT_STRUCTURE_WEIGHT):
    """Call the unchanged complete old objective once, then add the new term."""
    support_structure_weight = _support_structure_weight(support_structure_weight)
    bound, order = _bound_inputs(predicted, sample, channel_order)
    _require(isinstance(discriminator, torch.nn.Module) and all(value.device.type == "cpu"
        and (not value.is_floating_point() or value.dtype == torch.float32)
        for value in (*discriminator.parameters(), *discriminator.buffers())), "CPU FP32 critic required")
    weighted, parts = train_original_object_support_structure(predicted, bound, instance_table, order,
        support_structure_weight=support_structure_weight)
    inherited_total, inherited_parts = train_object_core_fidelity_candidate_objective(
        discriminator, predicted, bound, instance_table, order)
    total = inherited_total.float() + weighted
    _require(bool(torch.isfinite(total.detach())), "nonfinite support structure candidate total")
    return total, {**inherited_parts, **parts, "objectCoreFidelityUnchangedTotal": inherited_total,
        "objectCoreFidelityUnchangedParts": inherited_parts, "total": total}
