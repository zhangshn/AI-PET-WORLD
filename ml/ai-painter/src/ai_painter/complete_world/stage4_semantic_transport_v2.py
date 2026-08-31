from __future__ import annotations

"""Versioned Stage 4 successor with responsibility-isolated semantic transport.

This module intentionally lives outside ``complete_world.model``.  The predecessor
architecture remains reproducible under its original identity; material changes are
available only through ``ARCHITECTURE_ID`` below.
"""

from ai_painter.training.torch_runtime import require_torch


ARCHITECTURE_ID = (
    "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
)
PREDECESSOR_ARCHITECTURE_ID = (
    "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
)
FORMAL_CONDITION_CHANNEL_ORDER = (
    "terrain_grass",
    "terrain_water",
    "terrain_path_ground",
    "terrain_shoreline",
    "terrain_natural_boundary",
    "terrain_mud_patch",
    "terrain_tall_grass",
    "walkable",
    "collision",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
    "focal_area",
    "object_instance",
    "coordinate_x",
    "coordinate_y",
    "signed_distance_path",
    "signed_distance_water",
    "signed_distance_shoreline",
    "signed_distance_object_ground",
    "signed_distance_boundary",
    "moisture_proximity",
)
FORMAL_DISCRETE_CONDITION_ORDER = FORMAL_CONDITION_CHANNEL_ORDER[:15]
FORMAL_CONTINUOUS_CONDITION_ORDER = FORMAL_CONDITION_CHANNEL_ORDER[15:]
AUTOENCODER_BASE_CHANNELS = 48
DENOISER_BASE_CHANNELS = 64
LATENT_CHANNELS = 12
CONDITION_CHANNELS = 23
LATENT_DOWNSAMPLE_FACTOR = 4
RESPONSIBILITY_CHANNELS = (
    "terrain_path_ground",
    "terrain_water",
    "terrain_shoreline",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
RESPONSIBILITY_GROUPS = {
    "terrain_route_hydrology_spatial_realization": (
        "terrain_path_ground",
        "terrain_water",
        "terrain_shoreline",
    ),
    "per_class_object_semantic_realization": (
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    ),
    "global_visual_harmonization_and_native_complete_rgb_decode": (
        "base_decoded_rgb",
        *RESPONSIBILITY_CHANNELS,
    ),
}


def _group_count(channels: int) -> int:
    for groups in (32, 16, 8, 4, 2):
        if channels % groups == 0:
            return groups
    return 1


def validate_successor_config(config: dict[str, object]) -> None:
    """Reject any implicit or free parameterization of the successor."""

    if str(config.get("denoiserArchitecture", "")) != ARCHITECTURE_ID:
        raise ValueError("Stage 4 semantic transport V2 requires its versioned architecture identity")
    if int(config.get("conditionChannels", 0)) != CONDITION_CHANNELS:
        raise ValueError("Stage 4 semantic transport V2 requires exactly 23 condition channels")
    if int(config.get("latentChannels", 0)) != LATENT_CHANNELS:
        raise ValueError("Stage 4 semantic transport V2 requires exactly 12 latent channels")
    if int(config.get("denoiserBaseChannels", 0)) != DENOISER_BASE_CHANNELS:
        raise ValueError("Stage 4 semantic transport V2 requires the derived base width 64")
    if int(config.get("baseChannels", 0)) != AUTOENCODER_BASE_CHANNELS:
        raise ValueError("Stage 4 semantic transport V2 requires Autoencoder base width 48")
    if str(config.get("autoencoderArchitecture", "")) != "residual_4x_latent_pixel_detail_v2":
        raise ValueError("Stage 4 semantic transport V2 requires the frozen 4x Autoencoder")
    if int(config.get("latentDownsampleFactor", 0)) != LATENT_DOWNSAMPLE_FACTOR:
        raise ValueError("Stage 4 semantic transport V2 requires the frozen four-times spatial relation")

    order = tuple(config.get("conditionChannelOrder", ()))
    if order != FORMAL_CONDITION_CHANNEL_ORDER:
        raise ValueError("Stage 4 semantic transport V2 condition channel order must match the authoritative 23-channel contract")
    types = config.get("conditionChannelTypes", {})
    discrete = tuple(types.get("discrete", ()))
    continuous = tuple(types.get("continuous", ()))
    if discrete != FORMAL_DISCRETE_CONDITION_ORDER:
        raise ValueError("Stage 4 semantic transport V2 discrete condition order must match the authoritative contract")
    if continuous != FORMAL_CONTINUOUS_CONDITION_ORDER:
        raise ValueError("Stage 4 semantic transport V2 continuous condition order must match the authoritative contract")
    missing = tuple(name for name in RESPONSIBILITY_CHANNELS if name not in discrete)
    if missing:
        raise ValueError(
            "Stage 4 semantic responsibility identities must remain discrete: "
            + ", ".join(missing)
        )


def build_stage4_semantic_transport_denoiser(config: dict[str, object]):
    """Build the isolated V2 denoiser from contract-derived dimensions only."""

    validate_successor_config(config)
    torch = require_torch()
    nn = torch.nn
    functional = torch.nn.functional
    condition_order = tuple(config["conditionChannelOrder"])
    discrete_ids = tuple(config["conditionChannelTypes"]["discrete"])
    continuous_ids = tuple(config["conditionChannelTypes"]["continuous"])
    discrete_indices = tuple(condition_order.index(name) for name in discrete_ids)
    continuous_indices = tuple(condition_order.index(name) for name in continuous_ids)
    responsibility_indices = {
        name: condition_order.index(name) for name in RESPONSIBILITY_CHANNELS
    }
    base_channels = DENOISER_BASE_CHANNELS
    latent_channels = LATENT_CHANNELS
    time_channels = 256

    def typed_resize(conditions, size):
        grouped = []
        grouped_indices: list[int] = []
        if discrete_indices:
            grouped.append(functional.interpolate(
                conditions[:, discrete_indices], size=size, mode="nearest"
            ))
            grouped_indices.extend(discrete_indices)
        if continuous_indices:
            grouped.append(functional.interpolate(
                conditions[:, continuous_indices],
                size=size,
                mode="bilinear",
                align_corners=False,
            ))
            grouped_indices.extend(continuous_indices)
        combined = torch.cat(grouped, dim=1)
        restore = [grouped_indices.index(index) for index in range(23)]
        return combined[:, restore]

    class SinusoidalTimeEmbedding(nn.Module):
        def __init__(self):
            super().__init__()

        def forward(self, timestep):
            half = base_channels // 2
            scale = torch.exp(
                torch.arange(half, device=timestep.device, dtype=torch.float32)
                * -(torch.log(torch.tensor(10000.0, device=timestep.device)) / max(half - 1, 1))
            )
            angles = timestep.float().view(-1, 1) * scale.view(1, -1)
            return torch.cat((angles.sin(), angles.cos()), dim=1)

    class TimeResidualBlock(nn.Module):
        def __init__(self, channels: int):
            super().__init__()
            self.norm1 = nn.GroupNorm(_group_count(channels), channels)
            self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
            self.time_projection = nn.Linear(time_channels, channels)
            self.norm2 = nn.GroupNorm(_group_count(channels), channels)
            self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)

        def forward(self, value, time_embedding):
            hidden = self.conv1(functional.silu(self.norm1(value)))
            hidden = hidden + self.time_projection(time_embedding).view(
                -1, hidden.shape[1], 1, 1
            )
            hidden = self.conv2(functional.silu(self.norm2(hidden)))
            return value + hidden

    class OutputBoundResidualBlock(nn.Module):
        """Exact V5+ output-bound probe block with no responsibility ownership."""

        def __init__(self):
            super().__init__()
            self.block = nn.Sequential(
                nn.GroupNorm(_group_count(base_channels), base_channels),
                nn.SiLU(),
                nn.Conv2d(base_channels, base_channels, 3, padding=1),
                nn.GroupNorm(_group_count(base_channels), base_channels),
                nn.SiLU(),
                nn.Conv2d(base_channels, base_channels, 3, padding=1),
            )

        def forward(self, value):
            return value + self.block(value)

    class ResponsibilityPath(nn.Module):
        """One semantic identity, one encoder, one transport kernel and one output."""

        def __init__(self):
            super().__init__()
            # The responsibility encoder is not allowed to invent an additional
            # hidden width.  Reuse the audited denoiser base width so every
            # trainable dimension is derived from the versioned model contract.
            semantic_channels = base_channels
            self.native_condition_encoder = nn.Sequential(
                nn.Conv2d(1, semantic_channels, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(semantic_channels, semantic_channels, 3, padding=1),
                nn.SiLU(),
            )
            self.transport_logits = nn.Conv2d(semantic_channels, 9, 3, padding=1)
            self.feature_projection = nn.Conv2d(base_channels, base_channels, 1)
            self.latent_residual = nn.Sequential(
                nn.Conv2d(base_channels + semantic_channels, base_channels, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(base_channels, latent_channels, 3, padding=1),
            )

        @staticmethod
        def _valid_neighbors(reference):
            height, width = reference.shape[-2:]
            return functional.unfold(
                torch.ones(
                    (1, 1, height, width),
                    dtype=reference.dtype,
                    device=reference.device,
                ),
                kernel_size=3,
                padding=1,
            ).reshape(1, 9, height, width) > 0

        def forward(self, features, native_mask):
            # Encode the source identity at native condition resolution first.  The
            # discrete occupancy mask is then reduced with max pooling, so a valid
            # one-pixel object cannot disappear before the first semantic encoding.
            native_semantic = self.native_condition_encoder(native_mask)
            semantic = functional.adaptive_max_pool2d(
                native_semantic, features.shape[-2:]
            )
            preserved_mask = functional.adaptive_max_pool2d(
                native_mask, features.shape[-2:]
            )
            logits = self.transport_logits(semantic)
            logits = logits.masked_fill(
                ~self._valid_neighbors(logits), torch.finfo(logits.dtype).min
            )
            weights = torch.softmax(logits, dim=1)
            projected = self.feature_projection(features)
            batch, channels, height, width = projected.shape
            neighbors = functional.unfold(
                projected, kernel_size=3, padding=1
            ).reshape(batch, channels, 9, height, width)
            transported = (neighbors * weights.unsqueeze(1)).sum(dim=2)
            contribution = self.latent_residual(torch.cat((transported, semantic), dim=1))
            return contribution * preserved_mask, {
                "preservedMask": preserved_mask,
                "transportWeights": weights,
                "ungatedContribution": contribution,
            }

    class Stage4SemanticTransportDenoiserV2(nn.Module):
        architecture_id = ARCHITECTURE_ID
        predecessor_architecture_id = PREDECESSOR_ARCHITECTURE_ID

        def __init__(self):
            super().__init__()
            self.time_embedding = nn.Sequential(
                SinusoidalTimeEmbedding(),
                nn.Linear(base_channels, time_channels),
                nn.SiLU(),
                nn.Linear(time_channels, time_channels),
            )
            self.latent_stem = nn.Conv2d(latent_channels, base_channels, 3, padding=1)
            # The full 23-channel tensor is encoded before any spatial reduction.
            self.native_condition_encoder = nn.Sequential(
                nn.Conv2d(23, base_channels, 3, padding=1),
                nn.SiLU(),
                TimeResidualBlock(base_channels),
            )
            self.level0_fusion = nn.Conv2d(base_channels * 2, base_channels, 1)
            self.level0 = TimeResidualBlock(base_channels)
            self.down1 = nn.Conv2d(base_channels, 128, 4, stride=2, padding=1)
            self.level1 = TimeResidualBlock(128)
            self.down2 = nn.Conv2d(128, 256, 4, stride=2, padding=1)
            self.middle = TimeResidualBlock(256)
            self.up1 = nn.ConvTranspose2d(256, 128, 4, stride=2, padding=1)
            self.up1_fusion = nn.Conv2d(256, 128, 1)
            self.up1_block = TimeResidualBlock(128)
            self.up0 = nn.ConvTranspose2d(128, base_channels, 4, stride=2, padding=1)
            self.up0_fusion = nn.Conv2d(base_channels * 2, base_channels, 1)
            self.up0_block = TimeResidualBlock(base_channels)
            self.base_output = nn.Sequential(
                nn.GroupNorm(_group_count(base_channels), base_channels),
                nn.SiLU(),
                nn.Conv2d(base_channels, latent_channels, 3, padding=1),
            )
            # Preserve the existing V5+ condition-output Loss formula without
            # assigning semantic responsibility to this auxiliary probe.  Its
            # dimensions and operations are the exact audited 12 -> 64 ->
            # ResidualBlock -> 23 -> Sigmoid path already used by the formal
            # Trainer.  The seven responsibility paths and RGB heads remain the
            # only responsibility-owned parameter namespaces.
            self.output_bound_condition_probe = nn.Sequential(
                nn.Conv2d(latent_channels, base_channels, 3, padding=1),
                nn.SiLU(),
                OutputBoundResidualBlock(),
                nn.Conv2d(base_channels, CONDITION_CHANNELS, 1),
                nn.Sigmoid(),
            )
            self.responsibility_paths = nn.ModuleDict({
                name: ResponsibilityPath() for name in RESPONSIBILITY_CHANNELS
            })
            # These heads are applied after the frozen Autoencoder decode.  Each
            # identity has a distinct parameter namespace and immutable source mask.
            self.rgb_responsibility_heads = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(3 + 23 + 1, base_channels, 3, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(base_channels, 3, 3, padding=1),
                    nn.Sigmoid(),
                )
                for name in RESPONSIBILITY_CHANNELS
            })

        def _native_condition_context(self, conditions, target_size, time_embedding):
            hidden = self.native_condition_encoder[0](conditions)
            hidden = self.native_condition_encoder[1](hidden)
            hidden = self.native_condition_encoder[2](hidden, time_embedding)
            return functional.interpolate(
                hidden, size=target_size, mode="bilinear", align_corners=False
            )

        def forward(
            self,
            noisy_latent,
            timestep,
            conditions,
            return_stage4_semantic_responsibility=False,
        ):
            if conditions.ndim != 4 or int(conditions.shape[1]) != 23:
                raise ValueError("Stage 4 semantic transport V2 requires a 23-channel condition tensor")
            expected_native_size = (
                int(noisy_latent.shape[-2]) * 4,
                int(noisy_latent.shape[-1]) * 4,
            )
            if tuple(conditions.shape[-2:]) != expected_native_size:
                raise ValueError(
                    "Stage 4 semantic transport V2 requires native conditions at exactly four times the latent size"
                )
            time_embedding = self.time_embedding(timestep)
            native_context = self._native_condition_context(
                conditions, noisy_latent.shape[-2:], time_embedding
            )
            level0 = self.level0(
                self.level0_fusion(torch.cat((self.latent_stem(noisy_latent), native_context), dim=1)),
                time_embedding,
            )
            level1 = self.level1(self.down1(level0), time_embedding)
            middle = self.middle(self.down2(level1), time_embedding)
            up1 = self.up1_block(
                self.up1_fusion(torch.cat((self.up1(middle), level1), dim=1)),
                time_embedding,
            )
            up0 = self.up0_block(
                self.up0_fusion(torch.cat((self.up0(up1), level0), dim=1)),
                time_embedding,
            )
            base_output = self.base_output(up0)
            contributions = []
            evidence = {}
            for name in RESPONSIBILITY_CHANNELS:
                source_index = responsibility_indices[name]
                contribution, path_evidence = self.responsibility_paths[name](
                    up0, conditions[:, source_index:source_index + 1]
                )
                contributions.append(contribution)
                evidence[name] = path_evidence
            predicted = base_output + torch.stack(contributions, dim=0).sum(dim=0)
            if return_stage4_semantic_responsibility:
                return predicted, {
                    "architectureIdentity": ARCHITECTURE_ID,
                    "predecessorArchitectureIdentity": PREDECESSOR_ARCHITECTURE_ID,
                    "baseOutput": base_output,
                    "responsibilityContributions": tuple(contributions),
                    "responsibilityEvidence": evidence,
                    "responsibilityIdentityOrder": RESPONSIBILITY_CHANNELS,
                    "responsibilityGroups": RESPONSIBILITY_GROUPS,
                    "typedIdentityCollapsedBeforeOutput": False,
                    "nativeConditionEncodingBeforeReduction": True,
                }
            return predicted

        def prepare_typed_conditions(self, conditions, size):
            return typed_resize(conditions, size)

        def reconstruct_conditions_from_clean_latent(self, predicted_clean):
            if (
                predicted_clean.ndim != 4
                or int(predicted_clean.shape[1]) != LATENT_CHANNELS
            ):
                raise ValueError(
                    "Stage 4 semantic transport V2 output-bound probe requires a 12-channel clean latent"
                )
            return self.output_bound_condition_probe(predicted_clean)

        def stage4_semantic_responsibility_identity_order(self):
            return RESPONSIBILITY_CHANNELS

    return Stage4SemanticTransportDenoiserV2()
