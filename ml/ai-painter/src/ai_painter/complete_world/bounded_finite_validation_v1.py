"""Standalone bounded finite predicate; not integrated into model execution."""
from collections.abc import Iterator

import torch
from torch import nn

MAX_BLOCK_ELEMENTS = 4194304


def _iter_bounded_views(value: torch.Tensor) -> Iterator[torch.Tensor]:
    """Partition logical elements using detached narrow views, including strided views."""
    pending = [value.detach()]
    while pending:
        block = pending.pop()
        elements = block.numel()
        if elements <= MAX_BLOCK_ELEMENTS:
            yield block
            continue
        axis = max(range(block.ndim), key=lambda dimension: block.shape[dimension])
        length = block.shape[axis]
        other_elements = elements // length
        width = MAX_BLOCK_ELEMENTS // other_elements
        cut = min(length - 1, width) if width else length // 2
        pending.append(block.narrow(axis, cut, length - cut))
        pending.append(block.narrow(axis, 0, cut))


def bounded_all_finite(value: torch.Tensor) -> bool:
    """Match bool(torch.isfinite(value).all()) for supported CPU/CUDA FP32/FP64.

    Each isfinite input contains at most MAX_BLOCK_ELEMENTS logical elements.
    This bounds tensor work per block, not whole-device memory consumption.
    """
    if type(value) not in (torch.Tensor, nn.Parameter):
        raise TypeError("bounded_all_finite requires a Tensor or nn.Parameter")
    if value.layout != torch.strided:
        raise TypeError("bounded_all_finite requires dense strided layout")
    if value.device.type not in ("cpu", "cuda"):
        raise ValueError("bounded_all_finite requires CPU or CUDA device")
    if value.dtype not in (torch.float32, torch.float64):
        raise TypeError("bounded_all_finite requires float32 or float64 dtype")
    return all(bool(torch.isfinite(block).all()) for block in _iter_bounded_views(value))
