"""Inactive CPU candidate for train-only regularization of V23 object RGB heads.

This module has no optimizer, checkpoint, GPU, review, or publication entry.
It leaves the V23 renderer and its state dictionary untouched on disk.
"""
from __future__ import annotations

from collections.abc import Sequence
from torch import nn
from torch.nn import functional

from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    ROLES,
    build_fresh_native_rgb_complete_support_partition_v23_cpu,
)


CAPABILITY = "stage4_mvp256_dry_object_head_train_dropout_v25_cpu_candidate"
ARCHITECTURE = "stage4_native_rgb_complete_support_train_dropout_v25"
DROPOUT_PROBABILITY = 0.10


class TrainDropoutHead(nn.Sequential):
    """Preserve V23 state keys while regularizing only hidden activations."""

    def forward(self, feature):
        hidden = self[1](self[0](feature))
        hidden = functional.dropout2d(
            hidden, p=DROPOUT_PROBABILITY, training=self.training)
        return self[2](hidden)


def build_fresh_object_head_train_dropout_v25_cpu(*,
                                                  condition_channel_order: Sequence[str]):
    """Build fresh V23 weights and add dropout only between each head's layers.

    Sequential indices, parameter names, and inference calculations are kept
    identical to V23.  The dropout mask exists only while the model is in
    training mode; no historical checkpoint or data is read here.
    """
    model = build_fresh_native_rgb_complete_support_partition_v23_cpu(
        condition_channel_order=condition_channel_order)

    for role in ROLES:
        original = model.object_rgb_heads[role]
        if (not isinstance(original, nn.Sequential)
                or len(original) != 3
                or not isinstance(original[0], nn.Conv2d)
                or not isinstance(original[1], nn.SiLU)
                or not isinstance(original[2], nn.Conv2d)):
            raise ValueError("V23 object head structure differs: " + role)
        model.object_rgb_heads[role] = TrainDropoutHead(*tuple(original.children()))
    model.architecture_id = ARCHITECTURE
    model.capability_version = CAPABILITY
    model.execution_qualified = False
    return model
