from __future__ import annotations

"""Inactive CPU prototype: object supervision from bound train RGB and conditions.

This does not train a model, change the authoritative 23-channel pack, or grant
execution qualification. Patches exist only in memory. A successor capability
must explicitly version the subject-relative instance channel before using it.
"""

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from copy import deepcopy

import torch
from torch.nn import functional as functional


PATCH_SIZE = 32
ROLE_BY_KIND = {
    "tree": "object_tree",
    "rock": "object_rock",
    "shrub": "object_vegetation",
    "grass_detail": "object_vegetation",
}
SUPPORT_RADIUS = {"object_tree": 8, "object_rock": 4, "object_vegetation": 6}


@dataclass(frozen=True)
class ObjectView:
    instance_value: int
    kind: str
    role: str
    top: int
    left: int
    subject_conditions: torch.Tensor
    subject_mask: torch.Tensor
    support_mask: torch.Tensor
    valid_mask: torch.Tensor


@dataclass(frozen=True)
class ObjectSupervision:
    sample_id: str
    instance_value: int
    kind: str
    role: str
    top: int
    left: int
    target_rgb: torch.Tensor
    subject_conditions: torch.Tensor
    subject_mask: torch.Tensor
    support_mask: torch.Tensor
    valid_mask: torch.Tensor


def _crop(value: torch.Tensor, top: int, left: int, size: int) -> tuple[torch.Tensor, torch.Tensor]:
    channels, height, width = value.shape
    result = value.new_zeros((channels, size, size))
    valid = value.new_zeros((1, size, size))
    y0, y1 = max(0, top), min(height, top + size)
    x0, x1 = max(0, left), min(width, left + size)
    if y1 > y0 and x1 > x0:
        dy, dx = y0 - top, x0 - left
        result[:, dy:dy + y1 - y0, dx:dx + x1 - x0] = value[:, y0:y1, x0:x1]
        valid[:, dy:dy + y1 - y0, dx:dx + x1 - x0] = 1
    return result, valid


def iter_object_views(
    conditions: torch.Tensor,
    instance_table: Sequence[Mapping],
    channel_order: Sequence[str],
) -> Iterator[ObjectView]:
    """Build target-free views for a proposed internal object branch."""
    if (not isinstance(conditions, torch.Tensor)
            or conditions.shape != (23, 192, 256)
            or len(channel_order) != 23 or len(set(channel_order)) != 23):
        raise ValueError("complete conditions must match the 23-channel contract")
    if not bool(torch.isfinite(conditions).all()
                and ((conditions >= 0) & (conditions <= 1)).all()):
        raise ValueError("object conditions must be finite and in [0,1]")
    if not isinstance(instance_table, Sequence):
        raise ValueError("bound instance table is missing")
    instance_index = channel_order.index("object_instance")
    labels = (conditions[instance_index] * 255).round().to(torch.int32)
    if not bool(((conditions[instance_index] * 255 - labels).abs() < 1e-3).all()):
        raise ValueError("object instance channel is not discrete")
    table_values = [item.get("value") for item in instance_table]
    if (any(type(value) is not int or not 1 <= value <= 254 for value in table_values)
            or len(set(table_values)) != len(table_values)):
        raise ValueError("instance table labels are invalid or duplicated")
    seen_values = set(int(value) for value in torch.unique(labels).tolist()) - {0}
    if seen_values != set(table_values):
        raise ValueError("instance table and condition labels differ")

    for item in instance_table:
        kind = item.get("kind")
        if kind not in ROLE_BY_KIND:
            raise ValueError("unknown object kind in instance table")
        role = ROLE_BY_KIND[kind]
        subject = labels == item["value"]
        role_mask = conditions[channel_order.index(role)] > 0.5
        if not bool(subject.any()) or not bool(role_mask[subject].all()):
            raise ValueError("object instance is absent from its authoritative role mask")
        bounds = item.get("footprint")
        if (not isinstance(bounds, Mapping)
                or any(type(bounds.get(key)) is not int for key in ("x", "y", "width", "height"))
                or bounds["width"] < 1 or bounds["height"] < 1
                or bounds["x"] < 0 or bounds["y"] < 0
                or bounds["x"] + bounds["width"] > 1024
                or bounds["y"] + bounds["height"] > 768):
            raise ValueError("object footprint is outside the source canvas")
        ys, xs = torch.where(subject)
        if (bool((xs * 4 + 2 < bounds["x"] - 2).any())
                or bool((xs * 4 + 2 > bounds["x"] + bounds["width"] + 2).any())
                or bool((ys * 4 + 2 < bounds["y"] - 2).any())
                or bool((ys * 4 + 2 > bounds["y"] + bounds["height"] + 2).any())):
            raise ValueError("downsampled instance escaped its native footprint")
        center_y = (int(ys.min()) + int(ys.max())) // 2
        center_x = (int(xs.min()) + int(xs.max())) // 2
        top, left = center_y - PATCH_SIZE // 2, center_x - PATCH_SIZE // 2
        _, valid = _crop(conditions[:1], top, left, PATCH_SIZE)
        local_conditions, _ = _crop(conditions, top, left, PATCH_SIZE)
        local_subject, _ = _crop(subject[None].to(conditions.dtype), top, left, PATCH_SIZE)
        support = functional.max_pool2d(
            local_subject[None], 2 * SUPPORT_RADIUS[role] + 1,
            stride=1, padding=SUPPORT_RADIUS[role],
        )[0] * valid
        # This is a proposed INTERNAL subject-relative view, not a mutation
        # of the authoritative object_instance condition channel.
        local_conditions[instance_index] = local_subject[0]
        yield ObjectView(
            instance_value=item["value"], kind=kind, role=role,
            top=top, left=left,
            subject_conditions=local_conditions, subject_mask=local_subject,
            support_mask=support, valid_mask=valid,
        )


def iter_train_object_supervision(
    sample: Mapping,
    instance_table: Sequence[Mapping],
    channel_order: Sequence[str],
) -> Iterator[ObjectSupervision]:
    """Yield in-memory direct-original targets only from the bound train split."""
    if sample.get("split") != "train":
        raise ValueError("object supervision may only consume the train split")
    rgb = sample.get("image")
    if not isinstance(rgb, torch.Tensor) or rgb.shape != (3, 192, 256):
        raise ValueError("train RGB must be a complete 256x192 tensor")
    if not bool(torch.isfinite(rgb).all() and ((rgb >= 0) & (rgb <= 1)).all()):
        raise ValueError("object supervision requires RGB in [0,1]")
    for view in iter_object_views(sample.get("conditions"), instance_table, channel_order):
        target, _ = _crop(rgb, view.top, view.left, PATCH_SIZE)
        yield ObjectSupervision(
            sample_id=str(sample["sampleId"]), instance_value=view.instance_value,
            kind=view.kind, role=view.role, top=view.top, left=view.left,
            target_rgb=target,
            subject_conditions=view.subject_conditions,
            subject_mask=view.subject_mask,
            support_mask=view.support_mask, valid_mask=view.valid_mask,
        )


def load_bound_object_sample(dataset, index: int) -> dict:
    """Read an existing split row and its SHA-bound object table, without writes.

    The table is source metadata in the already-bound condition pack, not a
    label inferred from RGB or a second independently editable annotation.
    This adapter leaves SplitReleaseDataset and all historical runs unchanged.
    """
    from ai_painter.complete_world.split_release import SplitReleaseDataset, bound_json

    if not isinstance(dataset, SplitReleaseDataset):
        raise TypeError("object sample requires a bound split-release Dataset")
    if type(index) is not int or not 0 <= index < len(dataset):
        raise IndexError("object sample index outside bound split")
    row = dataset.rows[index]
    sample = dataset[index]
    if (sample["sampleId"] != row["sampleId"] or sample["split"] != row["split"]
            or sample["conditionPackPath"] != row["conditionPack"]["path"]):
        raise ValueError("object sample and bound source row differ")
    pack = bound_json(dataset.root, row["conditionPack"])
    table = pack.get("objectInstanceTable")
    if not isinstance(table, list):
        raise ValueError("bound condition pack lacks an object instance table")
    order = dataset.manifest["identityPayload"]["channelOrder"]
    # Exhaust the iterator now: a malformed table must fail before the sample
    # reaches a trainer or inference caller.
    list(iter_object_views(sample["conditions"], table, order))
    return {**sample, "objectInstanceTable": deepcopy(table)}
