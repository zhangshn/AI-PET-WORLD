"""Device adapter for the frozen support objective; no execution qualification."""
from collections.abc import Mapping
import torch
from ai_painter.complete_world import native_rgb_object_support_structure_candidate_cpu_v1 as frozen
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER

CAPABILITY = "stage4_mvp256_dry_object_support_structure_quality24_v1"
CANDIDATE_ID = CAPABILITY
EXECUTION_QUALIFIED = False


def require(ok, message):
    if not ok: raise ValueError(message)


def _bound(predicted, sample, channel_order):
    require(isinstance(predicted, torch.Tensor) and predicted.device.type in ("cpu", "cuda"), "CPU/CUDA prediction required")
    require(isinstance(sample, Mapping) and sample.get("split") == "train", "support structure requires train split")
    require(torch.get_num_threads() <= 2 and not torch.is_autocast_enabled("cpu")
        and not torch.is_autocast_enabled("cuda"), "CPU<=2/no autocast required")
    require(not isinstance(channel_order, (str, bytes)) and tuple(channel_order) == FORMAL_CONDITION_CHANNEL_ORDER,
        "support structure formal channel order differs")
    for value, shape in ((predicted, (1, 3, 192, 256)), (sample.get("image"), (3, 192, 256)),
            (sample.get("conditions"), (23, 192, 256))):
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.dtype == torch.float32
            and value.layout == torch.strided and (value.device.type == "cpu" or value.device == predicted.device),
            "complete FP32 tensors on CPU or prediction device required")
        plain = value.detach()
        require(bool(torch.isfinite(plain).all()) and bool(((plain >= 0) & (plain <= 1)).all()), "finite tensors in [0,1] required")
    return {**sample, "image": sample["image"].detach().to(predicted.device),
        "conditions": sample["conditions"].detach().to(predicted.device)}, tuple(channel_order)


def train_original_object_support_structure(predicted, sample, instance_table, channel_order):
    require(isinstance(predicted, torch.Tensor) and predicted.device.type in ("cpu", "cuda"), "CPU/CUDA prediction required")
    if predicted.device.type == "cpu":
        return frozen.train_original_object_support_structure(predicted, sample, instance_table, channel_order)
    bound, order = _bound(predicted, sample, channel_order)
    # Only detached authoritative CPU facts define masks, exactly as in the frozen CPU definition.
    masks = frozen._visible_support(sample["conditions"].detach().cpu(), instance_table, order)
    weights = predicted.new_tensor(frozen.LUMA_WEIGHTS)[:, None, None]
    candidate_luma = (predicted[0] * weights).sum(0)
    reference_luma = (bound["image"] * weights).sum(0)
    terms, diagnostics = [], {}
    for role in frozen.TYPED_ROLES:
        cpu_mask = masks[role][0, 0]
        require(cpu_mask.dtype == torch.bool and not cpu_mask.requires_grad, "frozen binary owned mask required")
        mask = cpu_mask.to(device=predicted.device)
        pixels = int(cpu_mask.sum())
        diagnostic = {"pixels": pixels, "status": "not_applicable", "reason": None, "correlation": None}
        if pixels < frozen.MINIMUM_PIXELS:
            diagnostic["reason"] = "fewer_than_two_support_pixels"
        else:
            candidate, reference = candidate_luma[mask], reference_luma[mask]
            candidate_centered, reference_centered = candidate - candidate.mean(), reference - reference.mean()
            reference_energy = reference_centered.square().sum()
            if float(reference_energy) < frozen.MINIMUM_REFERENCE_CENTERED_ENERGY:
                diagnostic["reason"] = "constant_reference_support"
            else:
                numerator = (candidate_centered * reference_centered).sum()
                denominator = torch.sqrt(candidate_centered.square().sum() * reference_energy + frozen.EPSILON)
                correlation = (numerator / denominator).clamp(-1, 1)
                terms.append(1 - correlation)
                diagnostic.update(status="applicable", correlation=correlation)
        diagnostics[role] = diagnostic
    loss = torch.stack(terms).mean() if terms else predicted.sum() * 0
    weighted = frozen.OBJECT_SUPPORT_STRUCTURE_WEIGHT * loss
    require(bool(torch.isfinite(weighted.detach())), "nonfinite support structure objective")
    return weighted, {"objectSupportStructureLoss": loss, "objectSupportStructureWeighted": weighted,
        "objectSupportStructureStatus": "applicable" if terms else "not_applicable",
        "objectSupportStructureApplicableRoleCount": len(terms), "objectSupportStructureRoles": diagnostics,
        "objectSupportOwnershipRule": frozen.OWNERSHIP_RULE}


def train_object_support_structure_candidate_objective(critic, predicted, sample, instance_table, channel_order):
    require(isinstance(predicted, torch.Tensor) and predicted.device.type in ("cpu", "cuda"), "CPU/CUDA prediction required")
    if predicted.device.type == "cpu":
        return frozen.train_object_support_structure_candidate_objective(critic, predicted, sample, instance_table, channel_order)
    bound, order = _bound(predicted, sample, channel_order)
    require(isinstance(critic, torch.nn.Module) and all(v.device == predicted.device
        and (not v.is_floating_point() or v.dtype == torch.float32) for v in (*critic.parameters(), *critic.buffers())),
        "critic must share prediction device/FP32")
    weighted, parts = train_original_object_support_structure(predicted, bound, instance_table, order)
    inherited_total, inherited_parts = train_object_core_fidelity_candidate_objective(critic, predicted, bound, instance_table, order)
    total = inherited_total.float() + weighted
    require(bool(torch.isfinite(total.detach())), "nonfinite support structure candidate total")
    return total, {**inherited_parts, **parts, "objectCoreFidelityUnchangedTotal": inherited_total,
        "objectCoreFidelityUnchangedParts": inherited_parts, "total": total}
