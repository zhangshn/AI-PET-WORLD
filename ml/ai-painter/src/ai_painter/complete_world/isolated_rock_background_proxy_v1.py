"""Train-only diagnostic background hypothesis; not an object-free ground truth."""
import torch
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views

SAMPLE_ID = 'mvp64-slot164-objects-v5-20261020'
OBJECT_IDS = (36, 38)


def targets(sample, order, evidence):
    if sample.get('split') != 'train':
        raise ValueError('background hypothesis is train-only')
    image = sample['image']
    if image.shape != (3, 192, 256) or image.dtype != torch.float32 or image.requires_grad:
        raise ValueError('detached native train RGB required')
    target = torch.zeros_like(image)[None]
    selected = torch.zeros((1, 1, 192, 256), dtype=torch.bool, device=image.device)
    if sample['sampleId'] != SAMPLE_ID:
        return target, selected, []
    masks = evidence['visibleObjectSupportMasks']
    union = torch.zeros_like(selected)
    for mask in masks.values():
        if mask.shape != selected.shape or mask.device != image.device or mask.requires_grad:
            raise ValueError('detached device support required')
        union |= mask.bool()
    views = validate_bound_object_views(sample['conditions'], sample['objectInstanceTable'], order)
    records = []
    for oid in OBJECT_IDS:
        view = next(v for v in views if v.instance_value == oid)
        if view.role != 'object_rock':
            raise ValueError('fixed object role changed')
        support = torch.zeros_like(selected)
        y0, y1 = max(0, view.top), min(192, view.top + 32)
        x0, x1 = max(0, view.left), min(256, view.left + 32)
        support[0, 0, y0:y1, x0:x1] = view.support_mask[0, y0-view.top:y1-view.top, x0-view.left:x1-view.left].bool()
        if bool((support & selected).any()) or bool((support & ~masks['object_rock'].bool()).any()):
            raise ValueError('fixed disjoint rock support ownership changed')
        ring = torch.nn.functional.max_pool2d(support.float(), 5, stride=1, padding=2).bool() & ~union
        if int(ring.sum()) < 8:
            raise ValueError('insufficient object-free ring pixels')
        median = image[:, ring[0, 0]].median(1).values.detach()
        target[0, :, support[0, 0]] = median[:, None]
        selected |= support
        records.append({'objectId': oid, 'supportPixels': int(support.sum()), 'ringPixels': int(ring.sum()),
                        'backgroundRgb': median.detach().cpu().tolist()})
    if not bool(torch.isfinite(target).all()) or target.requires_grad:
        raise ValueError('background target invalid')
    return target, selected, records


def auxiliary_loss(terrain, target, mask):
    if terrain.shape != target.shape or terrain.shape != (1, 3, 192, 256):
        raise ValueError('native background target shape differs')
    if target.requires_grad or mask.requires_grad or target.device != terrain.device or mask.device != terrain.device:
        raise ValueError('background target/device differs')
    if bool(mask.any()):
        return (terrain - target).abs()[mask.expand_as(terrain)].mean()
    return terrain.sum() * 0.0
