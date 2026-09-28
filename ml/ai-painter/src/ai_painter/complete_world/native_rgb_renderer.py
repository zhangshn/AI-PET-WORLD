from __future__ import annotations

"""Native complete-frame RGB renderer for the bounded Stage4 MVP candidate.

The renderer intentionally has no diffusion state and no Autoencoder boundary.
It maps the authoritative 23-channel condition tensor directly to one complete
RGB frame.  Seven visually reviewed responsibilities have isolated parameter
namespaces and are gated by their exact authoritative masks.
"""

from collections.abc import Sequence


RESPONSIBILITY_IDENTITIES = (
    "terrain_water",
    "terrain_path_ground",
    "terrain_shoreline",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)

DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES = (
    "object_instance",
    "signed_distance_path",
    "signed_distance_water",
    "signed_distance_shoreline",
    "signed_distance_object_ground",
)


def build_native_complete_rgb_renderer(
    *, condition_channel_order: Sequence[str], base_channels: int = 32
):
    import torch
    from torch import nn
    from torch.nn import functional as functional

    order = tuple(condition_channel_order)
    if len(order) != 23 or len(set(order)) != 23:
        raise ValueError("native RGB renderer requires 23 unique condition channels")
    if any(identity not in order for identity in RESPONSIBILITY_IDENTITIES):
        raise ValueError("native RGB renderer responsibility channel is missing")
    if base_channels < 16 or base_channels % 8:
        raise ValueError("native RGB renderer base width must be an 8-aligned value >= 16")

    responsibility_indices = {
        identity: order.index(identity) for identity in RESPONSIBILITY_IDENTITIES
    }
    base_indices = tuple(
        index for index, identity in enumerate(order)
        if identity not in RESPONSIBILITY_IDENTITIES
        and identity not in DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES
    )

    class ConvBlock(nn.Module):
        def __init__(self, source: int, target: int) -> None:
            super().__init__()
            self.layers = nn.Sequential(
                nn.Conv2d(source, target, 3, padding=1),
                nn.GroupNorm(min(8, target), target),
                nn.SiLU(),
                nn.Conv2d(target, target, 3, padding=1),
                nn.GroupNorm(min(8, target), target),
                nn.SiLU(),
            )

        def forward(self, value):
            return self.layers(value)

    class ResponsibilityHead(nn.Module):
        def __init__(self, feature_channels: int) -> None:
            super().__init__()
            hidden = max(16, feature_channels // 2)
            self.layers = nn.Sequential(
                nn.Conv2d(feature_channels + 1, feature_channels, 3, padding=1),
                nn.GroupNorm(min(8, feature_channels), feature_channels),
                nn.SiLU(),
                nn.Conv2d(feature_channels, hidden, 3, padding=1),
                nn.GroupNorm(min(8, hidden), hidden),
                nn.SiLU(),
                nn.Conv2d(hidden, 3, 1),
            )

        def forward(self, features, mask):
            return self.layers(torch.cat((features, mask), dim=1)) * mask

    class NativeCompleteRgbRenderer(nn.Module):
        architecture_id = "stage4_native_complete_rgb_responsibility_renderer_v1"
        responsibility_implementation_mode = "declared_shared_substrate"

        def __init__(self) -> None:
            super().__init__()
            self.condition_channel_order = order
            self.responsibility_indices = responsibility_indices
            self.base_condition_indices = base_indices
            base_input_channels = len(base_indices)
            self.base_stem = ConvBlock(base_input_channels, base_channels)
            self.down_1 = ConvBlock(base_channels, base_channels * 2)
            self.down_2 = ConvBlock(base_channels * 2, base_channels * 4)
            self.bottleneck = ConvBlock(base_channels * 4, base_channels * 4)
            self.up_2 = ConvBlock(base_channels * 8, base_channels * 2)
            self.up_1 = ConvBlock(base_channels * 3, base_channels)
            self.base_rgb_logits = nn.Conv2d(base_channels, 3, 1)
            self.responsibility_heads = nn.ModuleDict({
                identity: ResponsibilityHead(base_channels)
                for identity in RESPONSIBILITY_IDENTITIES
            })

        @staticmethod
        def _up(value, target):
            return functional.interpolate(
                value, size=target.shape[-2:], mode="bilinear", align_corners=False
            )

        def forward(self, conditions, *, return_evidence: bool = False):
            if conditions.ndim != 4 or conditions.shape[1] != len(order):
                raise ValueError("native RGB renderer condition tensor shape is invalid")
            base_input = conditions[:, self.base_condition_indices]
            level_1 = self.base_stem(base_input)
            level_2 = self.down_1(functional.avg_pool2d(level_1, 2))
            level_3 = self.down_2(functional.avg_pool2d(level_2, 2))
            center = self.bottleneck(functional.avg_pool2d(level_3, 2))
            decoded_2 = self.up_2(torch.cat((self._up(center, level_3), level_3), dim=1))
            decoded_1 = self.up_1(torch.cat((self._up(decoded_2, level_1), level_1), dim=1))
            base_logits = self.base_rgb_logits(decoded_1)
            contributions = {}
            masks = {}
            final_logits = base_logits
            for identity in RESPONSIBILITY_IDENTITIES:
                index = self.responsibility_indices[identity]
                mask = conditions[:, index:index + 1]
                contribution = self.responsibility_heads[identity](decoded_1, mask)
                masks[identity] = mask
                contributions[identity] = contribution
                final_logits = final_logits + contribution
            rgb = torch.sigmoid(final_logits)
            if not return_evidence:
                return rgb
            return rgb, {
                "baseRgb": torch.sigmoid(base_logits),
                "baseLogits": base_logits,
                "responsibilityMasks": masks,
                "responsibilityLogitContributions": contributions,
                "finalLogits": final_logits,
            }

    return NativeCompleteRgbRenderer()
