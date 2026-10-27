"""Inactive CPU comparison: route support-region RGB gradients away from terrain.

No model replacement, optimizer, GPU admission or training entry is provided.
Forward pixels and scalar objectives are unchanged. This does not remove an
object already encoded in a loaded terrain branch or establish semantic masks.
"""
import torch

CANDIDATE_ID = 'object_support_terrain_gradient_probe_cpu_v1'
EXECUTION_QUALIFIED = False
ROLES = ('object_footprints', 'object_tree', 'object_rock', 'object_vegetation')


def support_routed_prediction(prediction, evidence):
    """Return the same RGB with terrain's local derivative blocked in the union."""
    terrain = evidence.get('terrainRgb')
    residual = evidence.get('objectResidualSum')
    masks = evidence.get('visibleObjectSupportMasks')
    if not isinstance(masks, dict) or set(masks) != set(ROLES):
        raise ValueError('complete existing support masks required')
    for value in (prediction, terrain, residual):
        if (not isinstance(value, torch.Tensor) or value.shape != (1, 3, 192, 256)
                or value.device.type != 'cpu' or value.dtype != torch.float32
                or not bool(torch.isfinite(value.detach()).all())):
            raise ValueError('finite CPU FP32 complete RGB evidence required')
    if not all(bool(((v.detach() >= 0) & (v.detach() <= 1)).all()) for v in (prediction, terrain)):
        raise ValueError('prediction and terrain RGB range differs')
    union = torch.zeros((1, 1, 192, 256), dtype=torch.bool)
    for role in ROLES:
        mask = masks[role]
        if (not isinstance(mask, torch.Tensor) or mask.shape != union.shape
                or mask.device.type != 'cpu' or mask.requires_grad
                or not bool(((mask == 0) | (mask == 1)).all())):
            raise ValueError('detached binary CPU support required')
        union |= mask.bool()
    if not bool(union.any()) or bool(union.all()):
        raise ValueError('nonempty partial object support required')
    reproduced = torch.sigmoid(torch.logit(terrain.float().clamp(1e-5, 1-1e-5)) + residual)
    if not torch.equal(reproduced.detach(), prediction.detach()):
        raise ValueError('renderer composition not byte-exact; candidate refused')
    routed_terrain = torch.where(union, terrain.detach(), terrain)
    routed = torch.sigmoid(torch.logit(routed_terrain.float().clamp(1e-5, 1-1e-5)) + residual)
    if not torch.equal(routed.detach(), prediction.detach()):
        raise ValueError('candidate changed forward RGB')
    return routed, union
