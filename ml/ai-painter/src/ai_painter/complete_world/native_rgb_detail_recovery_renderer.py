from __future__ import annotations

"""Deterministic 256x192 detail-recovery renderer for the bounded MVP route."""

from collections.abc import Sequence


RESPONSIBILITY_IDENTITIES = (
    "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)

DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES = (
    "object_instance", "signed_distance_path", "signed_distance_water",
    "signed_distance_shoreline", "signed_distance_object_ground",
)


def build_native_complete_rgb_detail_recovery_renderer(
    *, condition_channel_order: Sequence[str], base_channels: int = 48,
    frequency_bands: Sequence[int] = (1, 2, 4, 8, 16),
):
    import math
    import torch
    from torch import nn
    from torch.nn import functional as functional

    order = tuple(condition_channel_order)
    bands = tuple(int(value) for value in frequency_bands)
    if len(order) != 23 or len(set(order)) != 23:
        raise ValueError("detail recovery renderer requires 23 unique condition channels")
    if any(identity not in order for identity in RESPONSIBILITY_IDENTITIES):
        raise ValueError("detail recovery responsibility channel missing")
    if "coordinate_x" not in order or "coordinate_y" not in order:
        raise ValueError("detail recovery coordinate channels missing")
    if bands != (1, 2, 4, 8, 16):
        raise ValueError("detail recovery frequency bands changed")
    if base_channels < 32 or base_channels % 8:
        raise ValueError("detail recovery base width must be 8-aligned and >= 32")

    responsibility_indices = {
        identity: order.index(identity) for identity in RESPONSIBILITY_IDENTITIES
    }
    coordinate_indices = (order.index("coordinate_x"), order.index("coordinate_y"))
    base_indices = tuple(
        index for index, identity in enumerate(order)
        if identity not in RESPONSIBILITY_IDENTITIES
        and identity not in DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES
    )
    fourier_channels = len(bands) * 4

    class ConvBlock(nn.Module):
        def __init__(self, source: int, target: int) -> None:
            super().__init__()
            self.layers = nn.Sequential(
                nn.Conv2d(source, target, 3, padding=1),
                nn.GroupNorm(min(8, target), target), nn.SiLU(),
                nn.Conv2d(target, target, 3, padding=1),
                nn.GroupNorm(min(8, target), target), nn.SiLU(),
            )

        def forward(self, value):
            return self.layers(value)

    class ResponsibilityHead(nn.Module):
        def __init__(self, feature_channels: int) -> None:
            super().__init__()
            self.local_shape = nn.Sequential(
                nn.Conv2d(1, 8, 5, padding=2), nn.SiLU(),
                nn.Conv2d(8, 8, 3, padding=1), nn.SiLU(),
            )
            self.layers = nn.Sequential(
                nn.Conv2d(feature_channels + 8, feature_channels, 3, padding=1),
                nn.GroupNorm(min(8, feature_channels), feature_channels), nn.SiLU(),
                nn.Conv2d(feature_channels, feature_channels, 3, padding=1),
                nn.GroupNorm(min(8, feature_channels), feature_channels), nn.SiLU(),
                nn.Conv2d(feature_channels, 3, 1),
            )

        def forward(self, features, mask):
            return self.layers(torch.cat((features, self.local_shape(mask)), dim=1)) * mask

    class NativeCompleteRgbDetailRecoveryRenderer(nn.Module):
        architecture_id = "stage4_native_complete_rgb_detail_recovery_renderer_v3"
        responsibility_implementation_mode = "declared_shared_substrate"

        def __init__(self) -> None:
            super().__init__()
            self.condition_channel_order = order
            self.responsibility_indices = responsibility_indices
            self.coordinate_indices = coordinate_indices
            self.base_condition_indices = base_indices
            self.frequency_bands = bands
            self.base_stem = ConvBlock(len(base_indices) + fourier_channels, base_channels)
            self.down_1 = ConvBlock(base_channels, base_channels * 2)
            self.down_2 = ConvBlock(base_channels * 2, base_channels * 4)
            self.bottleneck = ConvBlock(base_channels * 4, base_channels * 4)
            self.decode_3 = ConvBlock(base_channels * 8, base_channels * 2)
            self.decode_2 = ConvBlock(base_channels * 4, base_channels * 2)
            self.decode_1 = ConvBlock(base_channels * 3, base_channels)
            self.full_resolution_detail = ConvBlock(
                base_channels + fourier_channels, base_channels,
            )
            self.base_rgb_logits = nn.Conv2d(base_channels, 3, 1)
            self.responsibility_heads = nn.ModuleDict({
                identity: ResponsibilityHead(base_channels)
                for identity in RESPONSIBILITY_IDENTITIES
            })

        @staticmethod
        def _up(value, target):
            return functional.interpolate(
                value, size=target.shape[-2:], mode="bilinear", align_corners=False,
            )

        def _fourier(self, conditions):
            coordinate_x = conditions[:, self.coordinate_indices[0]:self.coordinate_indices[0] + 1]
            coordinate_y = conditions[:, self.coordinate_indices[1]:self.coordinate_indices[1] + 1]
            values = []
            for frequency in self.frequency_bands:
                scale = math.pi * float(frequency)
                values.extend((
                    torch.sin(coordinate_x * scale), torch.cos(coordinate_x * scale),
                    torch.sin(coordinate_y * scale), torch.cos(coordinate_y * scale),
                ))
            return torch.cat(values, dim=1)

        def forward(self, conditions, *, return_evidence: bool = False):
            if conditions.ndim != 4 or conditions.shape[1] != len(order):
                raise ValueError("detail recovery condition tensor shape invalid")
            fourier = self._fourier(conditions)
            base_input = torch.cat((conditions[:, self.base_condition_indices], fourier), dim=1)
            level_1 = self.base_stem(base_input)
            level_2 = self.down_1(functional.avg_pool2d(level_1, 2))
            level_3 = self.down_2(functional.avg_pool2d(level_2, 2))
            center = self.bottleneck(functional.avg_pool2d(level_3, 2))
            decoded_3 = self.decode_3(torch.cat((self._up(center, level_3), level_3), dim=1))
            decoded_2 = self.decode_2(torch.cat((self._up(decoded_3, level_2), level_2), dim=1))
            decoded_1 = self.decode_1(torch.cat((self._up(decoded_2, level_1), level_1), dim=1))
            features = self.full_resolution_detail(torch.cat((decoded_1, fourier), dim=1))
            base_logits = self.base_rgb_logits(features)
            contributions, masks = {}, {}
            final_logits = base_logits
            for identity in RESPONSIBILITY_IDENTITIES:
                index = self.responsibility_indices[identity]
                mask = conditions[:, index:index + 1]
                contribution = self.responsibility_heads[identity](features, mask)
                masks[identity] = mask
                contributions[identity] = contribution
                final_logits = final_logits + contribution
            rgb = torch.sigmoid(final_logits)
            if not return_evidence:
                return rgb
            return rgb, {
                "baseRgb": torch.sigmoid(base_logits),
                "detailBasis": fourier,
                "responsibilityMasks": masks,
                "responsibilityLogitContributions": contributions,
                "finalLogits": final_logits,
            }

    return NativeCompleteRgbDetailRecoveryRenderer()
