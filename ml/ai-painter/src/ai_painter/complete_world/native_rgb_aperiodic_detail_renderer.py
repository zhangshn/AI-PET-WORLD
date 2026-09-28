from __future__ import annotations

"""Deterministic 256x192 aperiodic-detail renderer for the bounded MVP route."""

from collections.abc import Sequence


RESPONSIBILITY_IDENTITIES = (
    "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)

DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES = (
    "object_instance", "signed_distance_path", "signed_distance_water",
    "signed_distance_shoreline", "signed_distance_object_ground",
)


def build_native_complete_rgb_aperiodic_detail_renderer(
    *, condition_channel_order: Sequence[str], base_channels: int = 48,
    scales: Sequence[int] = (2, 4, 8, 16, 32),
):
    import torch
    from torch import nn
    from torch.nn import functional as functional

    order = tuple(condition_channel_order)
    bands = tuple(int(value) for value in scales)
    if len(order) != 23 or len(set(order)) != 23:
        raise ValueError("detail recovery renderer requires 23 unique condition channels")
    if any(identity not in order for identity in RESPONSIBILITY_IDENTITIES):
        raise ValueError("detail recovery responsibility channel missing")
    if "coordinate_x" not in order or "coordinate_y" not in order:
        raise ValueError("detail recovery coordinate channels missing")
    if bands != (2, 4, 8, 16, 32):
        raise ValueError("detail recovery detail scales changed")
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
    detail_channels = len(bands) * 4

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

    class NativeCompleteRgbAperiodicDetailRenderer(nn.Module):
        architecture_id = "stage4_native_complete_rgb_aperiodic_detail_renderer_v4"
        responsibility_implementation_mode = "declared_shared_substrate"

        def __init__(self) -> None:
            super().__init__()
            self.condition_channel_order = order
            self.responsibility_indices = responsibility_indices
            self.coordinate_indices = coordinate_indices
            self.base_condition_indices = base_indices
            self.detail_scales = bands
            self.base_stem = ConvBlock(len(base_indices) + detail_channels, base_channels)
            self.down_1 = ConvBlock(base_channels, base_channels * 2)
            self.down_2 = ConvBlock(base_channels * 2, base_channels * 4)
            self.bottleneck = ConvBlock(base_channels * 4, base_channels * 4)
            self.decode_3 = ConvBlock(base_channels * 8, base_channels * 2)
            self.decode_2 = ConvBlock(base_channels * 4, base_channels * 2)
            self.decode_1 = ConvBlock(base_channels * 3, base_channels)
            self.full_resolution_detail = ConvBlock(
                base_channels + detail_channels, base_channels,
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

        def detail_basis(self, conditions):
            return aperiodic_detail_basis(conditions, self.coordinate_indices, self.detail_scales)

        def forward(self, conditions, *, return_evidence: bool = False):
            if conditions.ndim != 4 or conditions.shape[1] != len(order):
                raise ValueError("detail recovery condition tensor shape invalid")
            detail = self.detail_basis(conditions)
            base_input = torch.cat((conditions[:, self.base_condition_indices], detail), dim=1)
            level_1 = self.base_stem(base_input)
            level_2 = self.down_1(functional.avg_pool2d(level_1, 2))
            level_3 = self.down_2(functional.avg_pool2d(level_2, 2))
            center = self.bottleneck(functional.avg_pool2d(level_3, 2))
            decoded_3 = self.decode_3(torch.cat((self._up(center, level_3), level_3), dim=1))
            decoded_2 = self.decode_2(torch.cat((self._up(decoded_3, level_2), level_2), dim=1))
            decoded_1 = self.decode_1(torch.cat((self._up(decoded_2, level_1), level_1), dim=1))
            features = self.full_resolution_detail(torch.cat((decoded_1, detail), dim=1))
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
                "detailBasis": detail,
                "responsibilityMasks": masks,
                "responsibilityLogitContributions": contributions,
                "finalLogits": final_logits,
            }

    return NativeCompleteRgbAperiodicDetailRenderer()


def aperiodic_detail_basis(conditions, coordinate_indices, scales=(2, 4, 8, 16, 32)):
    """Fixed single-world coordinate features, never an RGB map or world-seed claim.

    Twenty oblique 2-D value fields are recomputed from authoritative global
    coordinates. No random state, texture asset, learned pixel table or target
    image is accessed. Cropping retains exactly the same feature at each point.
    """
    import torch
    if conditions.ndim != 4 or conditions.shape[1] != 23:
        raise ValueError('aperiodic detail requires BCHW 23 conditions')
    if tuple(scales) != (2, 4, 8, 16, 32):
        raise ValueError('aperiodic detail scales changed')
    # Explicit float32 island preserves the same coordinates under mixed precision.
    with torch.autocast(device_type=conditions.device.type, enabled=False):
        x = conditions[:, coordinate_indices[0]:coordinate_indices[0]+1].float() * 256.0
        y = conditions[:, coordinate_indices[1]:coordinate_indices[1]+1].float() * 192.0
        if not bool(torch.isfinite(x).all() & torch.isfinite(y).all()):
            raise ValueError('nonfinite authoritative coordinate')
        if bool((x.abs() > 512).any() | (y.abs() > 384).any()):
            raise ValueError('coordinate exceeds fixed single-world domain')
        # Integer arithmetic is identical on CPU/CUDA; 31-bit mixing avoids
        # platform-dependent float sine hashing and never draws random numbers.
        def lattice(ix, iy, salt):
            n = (ix * 374761393 + iy * 668265263 + salt * 1442695041) & 0x7fffffff
            n = ((n ^ (n >> 13)) * 1274126177) & 0x7fffffff
            n = n ^ (n >> 16)
            return n.float() * (2.0 / 2147483647.0) - 1.0
        fields = []
        for band, scale in enumerate(scales):
            for channel, (a, b) in enumerate(((0.8, 0.6), (0.6, -0.8), (0.9238795, 0.3826834), (0.3826834, -0.9238795))):
                u, v = (a*x+b*y)/scale, (-b*x+a*y)/scale
                ix, iy = torch.floor(u).to(torch.int64), torch.floor(v).to(torch.int64)
                fx, fy = u-ix.float(), v-iy.float()
                salt = 20260928+1+4*band+channel
                upper = lattice(ix,iy,salt)*(1-fx)+lattice(ix+1,iy,salt)*fx
                lower = lattice(ix,iy+1,salt)*(1-fx)+lattice(ix+1,iy+1,salt)*fx
                fields.append(upper*(1-fy)+lower*fy)
        return torch.cat(fields, dim=1)
