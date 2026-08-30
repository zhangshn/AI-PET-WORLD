from __future__ import annotations

import math

from ai_painter.training.torch_runtime import require_torch


STAGE4_STRUCTURE_FACT_CHANNEL_ORDER = (
    "terrain_path_ground",
    "route_required_boundary",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS = ("route_required_boundary",)


def resize_stage4_structure_fact_layout(structure_layout, size, channel_order=STAGE4_STRUCTURE_FACT_CHANNEL_ORDER):
    """Resize Stage A facts without erasing one-pixel discrete boundary topology."""
    torch = require_torch()
    order = tuple(channel_order)
    if order != STAGE4_STRUCTURE_FACT_CHANNEL_ORDER:
        raise ValueError(
            "Stage 4 structure-fact channel order must match the immutable six-channel contract"
        )
    if structure_layout.ndim != 4:
        raise ValueError("Stage 4 structure-fact layout must be a four-dimensional tensor")
    if int(structure_layout.shape[1]) != len(STAGE4_STRUCTURE_FACT_CHANNEL_ORDER):
        raise ValueError("Stage 4 structure-fact layout must contain exactly six channels")

    continuous = torch.nn.functional.interpolate(
        structure_layout,
        size=size,
        mode="bilinear",
        align_corners=False,
    )
    resized_channels = []
    for index, channel_id in enumerate(STAGE4_STRUCTURE_FACT_CHANNEL_ORDER):
        if channel_id in STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS:
            resized_channels.append(torch.nn.functional.interpolate(
                structure_layout[:, index:index + 1],
                size=size,
                mode="nearest",
            ))
        else:
            resized_channels.append(continuous[:, index:index + 1])
    return torch.cat(resized_channels, dim=1)


def build_complete_world_system(config: dict[str, object]):
    """Build the project-owned complete-world model with newly initialized weights."""
    torch = require_torch()
    nn = torch.nn
    functional = torch.nn.functional
    base = int(config.get("baseChannels", 64))
    latent_channels = int(config.get("latentChannels", 4))
    condition_channels = int(config.get("conditionChannels", 23))
    autoencoder_architecture = str(config.get("autoencoderArchitecture", "legacy_8x_latent_v1"))
    denoiser_architecture = str(config.get("denoiserArchitecture", "shallow_condition_fusion_v2"))
    latent_downsample_factor = int(config.get("latentDownsampleFactor", 8))
    condition_channel_order = list(config.get("conditionChannelOrder", []))
    condition_channel_types = config.get("conditionChannelTypes", {})
    discrete_condition_ids = list(condition_channel_types.get("discrete", []))
    continuous_condition_ids = list(condition_channel_types.get("continuous", []))
    stage4_alignment_readout_channels = STAGE4_STRUCTURE_FACT_CHANNEL_ORDER
    stage4_object_alignment_channels = (
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    )
    stage4_route_alignment_channels = (
        "terrain_path_ground",
        "route_required_boundary",
    )
    stage4_structure_fact_channels = stage4_alignment_readout_channels
    structure_fact_first_architecture = "stage4_structure_fact_first_dual_stage_generator_v1"
    semantic_renderer_architecture = "stage4_condition_preserving_semantic_renderer_v1"
    semantic_mixture_architecture = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
    spatial_affine_conditioned_decoder_architecture = (
        "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
    )
    full_backbone_spatial_affine_architecture = (
        "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
    )
    joint_condition_local_transport_architecture = (
        "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
    )
    authoritative_semantic_carrier_architecture = (
        "stage4_authoritative_visual_semantic_carrier_decoder_v1"
    )
    post_decode_object_rgb_compositor_architecture = (
        "stage4_post_decode_authoritative_object_rgb_compositor_v1"
    )
    post_decode_full_condition_responsibility_architecture = (
        "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1"
    )
    direct_clean_latent_architecture = (
        "stage4_direct_condition_clean_latent_generator_v1"
    )
    direct_responsibility_residual_architecture = (
        "stage4_direct_condition_clean_latent_responsibility_residual_v1"
    )
    native_condition_encoder_architecture = (
        "stage4_native_condition_encoder_clean_latent_generator_v1"
    )
    native_responsibility_residual_architecture = (
        "stage4_native_condition_encoder_masked_responsibility_residual_v1"
    )
    route_counterfactual_compositor_architecture = (
        "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
    )
    direct_responsibility_residual_channels = (
        "terrain_path_ground",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    )
    authoritative_visual_semantic_carrier_channels = (
        "terrain_grass",
        "terrain_water",
        "terrain_path_ground",
        "terrain_shoreline",
        "terrain_natural_boundary",
        "terrain_mud_patch",
        "terrain_tall_grass",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    )
    post_decode_object_rgb_channels = (
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    )
    post_decode_full_condition_responsibility_channels = (
        "terrain_path_ground",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    )
    authoritative_carrier_architectures = {
        authoritative_semantic_carrier_architecture,
        post_decode_object_rgb_compositor_architecture,
        post_decode_full_condition_responsibility_architecture,
    }
    controlled_structure_baseline_arm = "baseline_current_formal_structure"
    controlled_structure_fusion_arm = (
        "condition_fusion_only_final_direct_residual_23_64_12"
    )
    controlled_structure_capacity_arm = (
        "capacity_only_base_width_64_to_existing_level1_128"
    )
    controlled_structure_arms = {
        controlled_structure_baseline_arm,
        controlled_structure_fusion_arm,
        controlled_structure_capacity_arm,
    }
    controlled_structure_arm_explicit = "stage4ControlledStructureArm" in config
    controlled_structure_arm = str(config.get(
        "stage4ControlledStructureArm",
        controlled_structure_baseline_arm,
    ))
    stage4_responsibility_component_roles = (
        "terrain_route_hydrology_spatial_realization",
        "per_class_object_semantic_realization",
        "global_visual_harmonization_and_native_complete_rgb_decode",
    )
    stage4_responsibility_component_role_explicit = (
        "stage4ResponsibilityComponentRole" in config
    )
    stage4_responsibility_component_role = str(config.get(
        "stage4ResponsibilityComponentRole",
        "",
    ))
    if denoiser_architecture in {
        spatial_affine_conditioned_decoder_architecture,
        full_backbone_spatial_affine_architecture,
        joint_condition_local_transport_architecture,
    }:
        if controlled_structure_arm_explicit or stage4_responsibility_component_role_explicit:
            raise ValueError(
                "Stage 4 full-backbone conditioning cannot reuse exited controlled arms or responsibility components"
            )
        if int(config.get("denoiserBaseChannels", 64)) != 64:
            raise ValueError("Stage 4 full-backbone conditioning requires base width 64")
        if condition_channels != 23 or latent_channels != 12:
            raise ValueError(
                "Stage 4 full-backbone conditioning requires exactly 23 condition and 12 latent channels"
            )
        if autoencoder_architecture != "residual_4x_latent_pixel_detail_v2" or latent_downsample_factor != 4:
            raise ValueError(
                "Stage 4 full-backbone conditioning requires the frozen 4x 12-channel Autoencoder boundary"
            )
    if denoiser_architecture in {
        direct_clean_latent_architecture,
        direct_responsibility_residual_architecture,
        native_condition_encoder_architecture,
        native_responsibility_residual_architecture,
        route_counterfactual_compositor_architecture,
    }:
        if controlled_structure_arm_explicit or stage4_responsibility_component_role_explicit:
            raise ValueError(
                "direct clean-latent generator cannot reuse exited controlled arms or responsibility components"
            )
        if int(config.get("denoiserBaseChannels", 64)) != 64:
            raise ValueError("direct clean-latent generator requires the derived base width 64")
        if condition_channels != 23 or latent_channels != 12:
            raise ValueError(
                "direct clean-latent generator requires exactly 23 condition and 12 latent channels"
            )
        if autoencoder_architecture != "residual_4x_latent_pixel_detail_v2" or latent_downsample_factor != 4:
            raise ValueError(
                "direct clean-latent generator requires the frozen 4x 12-channel Autoencoder boundary"
            )
        if "diffusionSteps" in config:
            raise ValueError("direct clean-latent generator forbids a diffusion-step contract")
    if stage4_responsibility_component_role_explicit:
        if denoiser_architecture != semantic_mixture_architecture:
            raise ValueError(
                "Stage 4 isolated responsibility components require the existing fact-conditioned semantic mixture architecture"
            )
        if stage4_responsibility_component_role not in stage4_responsibility_component_roles:
            raise ValueError(
                f"unknown Stage 4 responsibility component role: {stage4_responsibility_component_role}"
            )
        if controlled_structure_arm_explicit:
            raise ValueError(
                "Stage 4 responsibility component role cannot be combined with a controlled structure arm"
            )
        if int(config.get("denoiserBaseChannels", 64)) != 64:
            raise ValueError("Stage 4 responsibility components require base width 64")
        if condition_channels != 23 or latent_channels != 12:
            raise ValueError(
                "Stage 4 responsibility components require exactly 23 condition and 12 latent channels"
            )
        if autoencoder_architecture != "residual_4x_latent_pixel_detail_v2" or latent_downsample_factor != 4:
            raise ValueError(
                "Stage 4 responsibility components require the frozen 4x 12-channel Autoencoder boundary"
            )
    if controlled_structure_arm_explicit:
        if denoiser_architecture != semantic_mixture_architecture:
            raise ValueError(
                "stage4ControlledStructureArm is only available for the fact-conditioned semantic mixture architecture"
            )
        if controlled_structure_arm not in controlled_structure_arms:
            raise ValueError(f"unknown Stage 4 controlled structure arm: {controlled_structure_arm}")
        expected_base_channels = (
            128 if controlled_structure_arm == controlled_structure_capacity_arm else 64
        )
        if int(config.get("denoiserBaseChannels", 64)) != expected_base_channels:
            raise ValueError(
                "Stage 4 controlled structure arm and denoiserBaseChannels are inconsistent"
            )
        if condition_channels != 23 or latent_channels != 12:
            raise ValueError(
                "Stage 4 controlled structure arms require exactly 23 condition and 12 latent channels"
            )
    if denoiser_architecture in authoritative_carrier_architectures:
        if controlled_structure_arm_explicit or stage4_responsibility_component_role_explicit:
            raise ValueError(
                "authoritative semantic carriers cannot be combined with exited controlled arms or responsibility components"
            )
        if int(config.get("denoiserBaseChannels", 64)) != 64:
            raise ValueError("authoritative semantic carriers require the existing base width 64")
        if condition_channels != 23 or latent_channels != 12:
            raise ValueError(
                "authoritative semantic carriers require exactly 23 condition and 12 latent channels"
            )
        if autoencoder_architecture != "residual_4x_latent_pixel_detail_v2" or latent_downsample_factor != 4:
            raise ValueError(
                "authoritative semantic carriers require the frozen 4x 12-channel Autoencoder boundary"
            )
        if any(
            channel_id not in discrete_condition_ids
            for channel_id in authoritative_visual_semantic_carrier_channels
        ):
            raise ValueError(
                "authoritative semantic carrier identities must remain discrete condition channels"
            )
        if (
            denoiser_architecture == post_decode_object_rgb_compositor_architecture
            and any(
                channel_id not in discrete_condition_ids
                for channel_id in post_decode_object_rgb_channels
            )
        ):
            raise ValueError(
                "post-decode object RGB compositor identities must remain discrete condition channels"
            )
        if (
            denoiser_architecture
            == post_decode_full_condition_responsibility_architecture
            and any(
                channel_id not in discrete_condition_ids
                for channel_id in post_decode_full_condition_responsibility_channels
            )
        ):
            raise ValueError(
                "post-decode full-condition responsibility identities must remain discrete condition channels"
            )
    semantic_renderer_channels = (
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
        "route_required_boundary",
    )
    semantic_renderer_source_channels = {
        "object_footprints": "object_footprints",
        "object_tree": "object_tree",
        "object_rock": "object_rock",
        "object_vegetation": "object_vegetation",
        "route_required_boundary": "terrain_path_ground",
    }
    semantic_mixture_types = (
        "route",
        "footprints",
        "tree",
        "rock",
        "vegetation",
    )
    if stage4_responsibility_component_role_explicit:
        if stage4_responsibility_component_role == stage4_responsibility_component_roles[0]:
            semantic_mixture_types = ("route",)
        elif stage4_responsibility_component_role == stage4_responsibility_component_roles[1]:
            semantic_mixture_types = ("footprints", "tree", "rock", "vegetation")
        else:
            semantic_mixture_types = ()
    semantic_mixture_source_channels = {
        "route": "terrain_path_ground",
        "footprints": "object_footprints",
        "tree": "object_tree",
        "rock": "object_rock",
        "vegetation": "object_vegetation",
    }

    def group_count(channels: int) -> int:
        for groups in (32, 16, 8, 4, 2):
            if channels % groups == 0:
                return groups
        return 1

    def typed_condition_indices():
        if denoiser_architecture not in {
            "multiscale_condition_unet_v4",
            "multiscale_condition_unet_v5",
            "multiscale_condition_unet_v6",
            "multiscale_condition_unet_v7",
            "multiscale_condition_unet_v8_stage4_decoded_alignment",
            "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
            structure_fact_first_architecture,
            semantic_renderer_architecture,
            semantic_mixture_architecture,
            spatial_affine_conditioned_decoder_architecture,
            full_backbone_spatial_affine_architecture,
            authoritative_semantic_carrier_architecture,
            post_decode_object_rgb_compositor_architecture,
            post_decode_full_condition_responsibility_architecture,
            direct_clean_latent_architecture,
            direct_responsibility_residual_architecture,
            native_condition_encoder_architecture,
            native_responsibility_residual_architecture,
            route_counterfactual_compositor_architecture,
        }:
            return None
        if len(condition_channel_order) != condition_channels:
            raise ValueError("V4 condition channel order does not match conditionChannels")
        typed_ids = discrete_condition_ids + continuous_condition_ids
        if len(typed_ids) != condition_channels or set(typed_ids) != set(condition_channel_order):
            raise ValueError("V4 condition channel types must cover every condition channel exactly once")
        return {
            "discrete": [condition_channel_order.index(value) for value in discrete_condition_ids],
            "continuous": [condition_channel_order.index(value) for value in continuous_condition_ids],
        }

    condition_indices = typed_condition_indices()

    def resize_typed_conditions(conditions, size):
        if condition_indices is None:
            return functional.interpolate(conditions, size=size, mode="bilinear", align_corners=False)
        grouped = []
        grouped_indices = []
        if condition_indices["discrete"]:
            grouped.append(functional.interpolate(
                conditions[:, condition_indices["discrete"]],
                size=size,
                mode="nearest",
            ))
            grouped_indices.extend(condition_indices["discrete"])
        if condition_indices["continuous"]:
            grouped.append(functional.interpolate(
                conditions[:, condition_indices["continuous"]],
                size=size,
                mode="bilinear",
                align_corners=False,
            ))
            grouped_indices.extend(condition_indices["continuous"])
        combined = torch.cat(grouped, dim=1)
        restore_order = [grouped_indices.index(index) for index in range(condition_channels)]
        return combined[:, restore_order]

    class ResidualBlock(nn.Module):
        def __init__(self, channels: int):
            super().__init__()
            groups = group_count(channels)
            self.block = nn.Sequential(
                nn.GroupNorm(groups, channels),
                nn.SiLU(),
                nn.Conv2d(channels, channels, 3, padding=1),
                nn.GroupNorm(groups, channels),
                nn.SiLU(),
                nn.Conv2d(channels, channels, 3, padding=1),
            )

        def forward(self, value):
            return value + self.block(value)

    class ProjectOwnedAutoencoder(nn.Module):
        def __init__(self):
            super().__init__()
            if autoencoder_architecture == "residual_4x_latent_pixel_detail_v2":
                if latent_downsample_factor != 4:
                    raise ValueError("pixel-detail v2 autoencoder requires latentDownsampleFactor=4")
                self.encoder = nn.Sequential(
                    nn.Conv2d(3, base, 3, padding=1),
                    ResidualBlock(base),
                    nn.Conv2d(base, base * 2, 4, stride=2, padding=1),
                    ResidualBlock(base * 2),
                    nn.Conv2d(base * 2, base * 4, 4, stride=2, padding=1),
                    ResidualBlock(base * 4),
                    nn.Conv2d(base * 4, latent_channels, 3, padding=1),
                )
                self.decoder = nn.Sequential(
                    nn.Conv2d(latent_channels, base * 4, 3, padding=1),
                    ResidualBlock(base * 4),
                    nn.ConvTranspose2d(base * 4, base * 2, 4, stride=2, padding=1),
                    ResidualBlock(base * 2),
                    nn.ConvTranspose2d(base * 2, base, 4, stride=2, padding=1),
                    ResidualBlock(base),
                    nn.Conv2d(base, 3, 3, padding=1),
                    nn.Sigmoid(),
                )
            else:
                if latent_downsample_factor != 8:
                    raise ValueError("legacy autoencoder requires latentDownsampleFactor=8")
                self.encoder = nn.Sequential(
                    nn.Conv2d(3, base, 3, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(base, base * 2, 4, stride=2, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(base * 2, base * 4, 4, stride=2, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(base * 4, latent_channels, 4, stride=2, padding=1),
                )
                self.decoder = nn.Sequential(
                    nn.ConvTranspose2d(latent_channels, base * 4, 4, stride=2, padding=1),
                    nn.SiLU(),
                    nn.ConvTranspose2d(base * 4, base * 2, 4, stride=2, padding=1),
                    nn.SiLU(),
                    nn.ConvTranspose2d(base * 2, base, 4, stride=2, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(base, 3, 3, padding=1),
                    nn.Sigmoid(),
                )

        def encode(self, image):
            return self.encoder(image)

        def decode(self, latent):
            return self.decoder(latent)

    class ProjectOwnedConditionEncoder(nn.Module):
        def __init__(self):
            super().__init__()
            layers = [
                nn.Conv2d(condition_channels, base, 5, padding=2),
                nn.SiLU(),
                ResidualBlock(base),
                nn.Conv2d(base, base * 2, 4, stride=2, padding=1),
                ResidualBlock(base * 2),
                nn.Conv2d(base * 2, base * 4, 4, stride=2, padding=1),
                ResidualBlock(base * 4),
            ]
            if latent_downsample_factor == 8:
                layers.extend((
                    nn.Conv2d(base * 4, base * 4, 4, stride=2, padding=1),
                    ResidualBlock(base * 4),
                ))
            elif latent_downsample_factor != 4:
                raise ValueError("condition encoder only supports latent downsample factors 4 or 8")
            self.layers = nn.Sequential(*layers)

        def forward(self, conditions, latent_size):
            encoded = self.layers(conditions)
            return functional.interpolate(encoded, size=latent_size, mode="bilinear", align_corners=False)

    class ProjectOwnedDenoiser(nn.Module):
        def __init__(self):
            super().__init__()
            self.condition_encoder = ProjectOwnedConditionEncoder()
            self.latent_stem = nn.Conv2d(latent_channels, base * 4, 3, padding=1)
            self.time_mlp = nn.Sequential(nn.Linear(1, base * 4), nn.SiLU(), nn.Linear(base * 4, base * 4))
            self.fusion = nn.Sequential(
                nn.Conv2d(base * 8, base * 4, 1),
                ResidualBlock(base * 4),
                ResidualBlock(base * 4),
                nn.Conv2d(base * 4, latent_channels, 3, padding=1),
            )

        def forward(self, noisy_latent, timestep, conditions):
            if conditions.shape[1] != condition_channels:
                raise ValueError(f"expected {condition_channels} condition channels, got {conditions.shape[1]}")
            latent_features = self.latent_stem(noisy_latent)
            condition_features = self.condition_encoder(conditions, noisy_latent.shape[-2:])
            time_value = timestep.float().reshape(-1, 1) / max(1, int(config.get("diffusionSteps", 1000)) - 1)
            time_features = self.time_mlp(time_value).view(-1, base * 4, 1, 1)
            return self.fusion(torch.cat((latent_features + time_features, condition_features), dim=1))

    class SinusoidalTimeEmbedding(nn.Module):
        def __init__(self, channels: int):
            super().__init__()
            self.channels = channels

        def forward(self, timestep):
            half = self.channels // 2
            scale = math.log(10000.0) / max(1, half - 1)
            frequencies = torch.exp(
                torch.arange(half, device=timestep.device, dtype=torch.float32) * -scale
            )
            angles = timestep.float().reshape(-1, 1) * frequencies.reshape(1, -1)
            embedding = torch.cat((angles.sin(), angles.cos()), dim=1)
            if embedding.shape[1] < self.channels:
                embedding = functional.pad(embedding, (0, self.channels - embedding.shape[1]))
            return embedding

    class TimeResidualBlock(nn.Module):
        def __init__(
            self,
            channels: int,
            time_channels: int,
            spatial_condition_channels: int | None = None,
            local_transport_condition_channels: int | None = None,
        ):
            super().__init__()
            if (
                spatial_condition_channels is not None
                and local_transport_condition_channels is not None
            ):
                raise ValueError(
                    "spatial affine and joint-condition local transport are mutually exclusive"
                )
            self.norm1 = nn.GroupNorm(group_count(channels), channels)
            self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
            self.time_projection = nn.Linear(time_channels, channels)
            self.norm2 = nn.GroupNorm(group_count(channels), channels)
            self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
            self.spatial_affine_norm1 = (
                nn.Conv2d(
                    spatial_condition_channels,
                    channels * 2,
                    3,
                    padding=1,
                    bias=True,
                )
                if spatial_condition_channels is not None
                else None
            )
            self.spatial_affine_norm2 = (
                nn.Conv2d(
                    spatial_condition_channels,
                    channels * 2,
                    3,
                    padding=1,
                    bias=True,
                )
                if spatial_condition_channels is not None
                else None
            )
            self.local_transport_norm1 = (
                nn.Conv2d(
                    local_transport_condition_channels,
                    9,
                    3,
                    padding=1,
                    bias=True,
                )
                if local_transport_condition_channels is not None
                else None
            )
            self.local_transport_norm2 = (
                nn.Conv2d(
                    local_transport_condition_channels,
                    9,
                    3,
                    padding=1,
                    bias=True,
                )
                if local_transport_condition_channels is not None
                else None
            )

        @staticmethod
        def apply_spatial_affine(normalized, spatial_conditions, affine_projection):
            if affine_projection is None:
                return normalized
            if spatial_conditions is None:
                raise ValueError("spatial-affine decoder block requires resized typed conditions")
            if spatial_conditions.shape[-2:] != normalized.shape[-2:]:
                raise ValueError(
                    "spatial-affine decoder conditions must match the normalized feature spatial size"
                )
            gamma, beta = affine_projection(spatial_conditions).chunk(2, dim=1)
            return normalized * (1 + gamma) + beta

        @staticmethod
        def joint_condition_local_transport_weights(
            normalized,
            spatial_conditions,
            transport_projection,
        ):
            if transport_projection is None:
                return None
            if spatial_conditions is None:
                raise ValueError(
                    "joint-condition local transport requires resized typed conditions"
                )
            if spatial_conditions.shape[-2:] != normalized.shape[-2:]:
                raise ValueError(
                    "joint-condition local transport conditions must match the normalized feature spatial size"
                )
            logits = transport_projection(spatial_conditions)
            if logits.shape[1] != 9:
                raise ValueError(
                    "joint-condition local transport requires exactly nine row-major neighbor logits"
                )
            height, width = normalized.shape[-2:]
            valid_neighbors = functional.unfold(
                torch.ones(
                    (1, 1, height, width),
                    dtype=logits.dtype,
                    device=logits.device,
                ),
                kernel_size=3,
                padding=1,
            ).reshape(1, 9, height, width) > 0
            masked_logits = logits.masked_fill(
                ~valid_neighbors,
                torch.finfo(logits.dtype).min,
            )
            return torch.softmax(masked_logits, dim=1)

        @classmethod
        def apply_joint_condition_local_transport(
            cls,
            normalized,
            spatial_conditions,
            transport_projection,
        ):
            if transport_projection is None:
                return normalized
            weights = cls.joint_condition_local_transport_weights(
                normalized,
                spatial_conditions,
                transport_projection,
            )
            batch, channels, height, width = normalized.shape
            neighbor_values = functional.unfold(
                normalized,
                kernel_size=3,
                padding=1,
            ).reshape(batch, channels, 9, height, width)
            return (neighbor_values * weights.unsqueeze(1)).sum(dim=2)

        def requires_spatial_conditions(self):
            return (
                self.spatial_affine_norm1 is not None
                or self.local_transport_norm1 is not None
            )

        def forward(self, value, time_embedding, spatial_conditions=None):
            normalized1 = self.apply_spatial_affine(
                self.norm1(value),
                spatial_conditions,
                self.spatial_affine_norm1,
            )
            normalized1 = self.apply_joint_condition_local_transport(
                normalized1,
                spatial_conditions,
                self.local_transport_norm1,
            )
            hidden = self.conv1(functional.silu(normalized1))
            hidden = hidden + self.time_projection(time_embedding).view(-1, hidden.shape[1], 1, 1)
            normalized2 = self.apply_spatial_affine(
                self.norm2(hidden),
                spatial_conditions,
                self.spatial_affine_norm2,
            )
            normalized2 = self.apply_joint_condition_local_transport(
                normalized2,
                spatial_conditions,
                self.local_transport_norm2,
            )
            hidden = self.conv2(functional.silu(normalized2))
            return value + hidden

    class ProjectOwnedMultiscaleConditionUNet(nn.Module):
        def __init__(self):
            super().__init__()
            channels = int(config.get("denoiserBaseChannels", 64))
            time_channels = channels * 4
            self.time_embedding = nn.Sequential(
                SinusoidalTimeEmbedding(channels),
                nn.Linear(channels, time_channels),
                nn.SiLU(),
                nn.Linear(time_channels, time_channels),
            )

            self.latent_stem = nn.Conv2d(latent_channels, channels, 3, padding=1)
            self.condition_stem = nn.Sequential(
                nn.Conv2d(condition_channels, channels, 3, padding=1),
                nn.SiLU(),
                ResidualBlock(channels),
            )
            self.fuse0 = nn.Conv2d(channels * 2, channels, 1)
            full_backbone_spatial_affine_condition_channels = (
                condition_channels
                if denoiser_architecture == full_backbone_spatial_affine_architecture
                else None
            )
            joint_condition_local_transport_channels = (
                condition_channels
                if denoiser_architecture == joint_condition_local_transport_architecture
                else None
            )
            self.block0 = TimeResidualBlock(
                channels,
                time_channels,
                full_backbone_spatial_affine_condition_channels,
                joint_condition_local_transport_channels,
            )

            self.latent_down1 = nn.Conv2d(channels, channels * 2, 4, stride=2, padding=1)
            self.condition_down1 = nn.Conv2d(channels, channels * 2, 4, stride=2, padding=1)
            self.fuse1 = nn.Conv2d(channels * 4, channels * 2, 1)
            self.block1 = TimeResidualBlock(
                channels * 2,
                time_channels,
                full_backbone_spatial_affine_condition_channels,
                joint_condition_local_transport_channels,
            )

            self.latent_down2 = nn.Conv2d(channels * 2, channels * 4, 4, stride=2, padding=1)
            self.condition_down2 = nn.Conv2d(channels * 2, channels * 4, 4, stride=2, padding=1)
            self.fuse2 = nn.Conv2d(channels * 8, channels * 4, 1)
            self.middle1 = TimeResidualBlock(
                channels * 4,
                time_channels,
                full_backbone_spatial_affine_condition_channels,
                joint_condition_local_transport_channels,
            )
            self.middle2 = TimeResidualBlock(
                channels * 4,
                time_channels,
                full_backbone_spatial_affine_condition_channels,
                joint_condition_local_transport_channels,
            )

            self.up1 = nn.ConvTranspose2d(channels * 4, channels * 2, 4, stride=2, padding=1)
            self.up_fuse1 = nn.Conv2d(channels * 4, channels * 2, 1)
            spatial_affine_condition_channels = (
                condition_channels
                if denoiser_architecture in {
                    spatial_affine_conditioned_decoder_architecture,
                    full_backbone_spatial_affine_architecture,
                }
                else None
            )
            self.up_block1 = TimeResidualBlock(
                channels * 2,
                time_channels,
                spatial_affine_condition_channels,
                joint_condition_local_transport_channels,
            )
            self.up0 = nn.ConvTranspose2d(channels * 2, channels, 4, stride=2, padding=1)
            self.up_fuse0 = nn.Conv2d(channels * 2, channels, 1)
            self.up_block0 = TimeResidualBlock(
                channels,
                time_channels,
                spatial_affine_condition_channels,
                joint_condition_local_transport_channels,
            )
            self.output = nn.Sequential(
                nn.GroupNorm(group_count(channels), channels),
                nn.SiLU(),
                nn.Conv2d(channels, latent_channels, 3, padding=1),
            )
            self.condition_reconstruction = nn.Sequential(
                nn.GroupNorm(group_count(channels), channels),
                nn.SiLU(),
                nn.Conv2d(channels, condition_channels, 1),
                nn.Sigmoid(),
            ) if denoiser_architecture == "multiscale_condition_unet_v4" else None
            self.output_bound_condition_probe = nn.Sequential(
                nn.Conv2d(latent_channels, channels, 3, padding=1),
                nn.SiLU(),
                ResidualBlock(channels),
                nn.Conv2d(channels, condition_channels, 1),
                nn.Sigmoid(),
            ) if denoiser_architecture in {
                "multiscale_condition_unet_v5",
                "multiscale_condition_unet_v6",
                "multiscale_condition_unet_v7",
                "multiscale_condition_unet_v8_stage4_decoded_alignment",
                "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
                structure_fact_first_architecture,
                semantic_renderer_architecture,
                semantic_mixture_architecture,
                spatial_affine_conditioned_decoder_architecture,
                full_backbone_spatial_affine_architecture,
                joint_condition_local_transport_architecture,
                authoritative_semantic_carrier_architecture,
                post_decode_object_rgb_compositor_architecture,
                post_decode_full_condition_responsibility_architecture,
            } else None
            self.typed_condition_adapter_up1 = nn.Sequential(
                nn.Conv2d(condition_channels, channels * 2, 1),
                nn.SiLU(),
                nn.Conv2d(channels * 2, channels * 2, 1),
            ) if denoiser_architecture in {
                "multiscale_condition_unet_v8_stage4_decoded_alignment",
                "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
                structure_fact_first_architecture,
                semantic_renderer_architecture,
                semantic_mixture_architecture,
                authoritative_semantic_carrier_architecture,
                post_decode_object_rgb_compositor_architecture,
                post_decode_full_condition_responsibility_architecture,
            } else None
            self.typed_condition_adapter_up0 = nn.Sequential(
                nn.Conv2d(condition_channels, channels, 1),
                nn.SiLU(),
                nn.Conv2d(channels, channels, 1),
            ) if denoiser_architecture in {
                "multiscale_condition_unet_v8_stage4_decoded_alignment",
                "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
                structure_fact_first_architecture,
                semantic_renderer_architecture,
                semantic_mixture_architecture,
                authoritative_semantic_carrier_architecture,
                post_decode_object_rgb_compositor_architecture,
                post_decode_full_condition_responsibility_architecture,
            } else None
            self.shared_semantic_topology_readout = nn.Sequential(
                nn.GroupNorm(group_count(channels), channels),
                nn.SiLU(),
                nn.Conv2d(channels, len(stage4_alignment_readout_channels), 1),
                nn.Sigmoid(),
            ) if denoiser_architecture == "multiscale_condition_unet_v8_stage4_decoded_alignment" else None
            self.v9_object_projection_up1 = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(1, channels * 2, 1),
                    nn.SiLU(),
                    nn.Conv2d(channels * 2, channels * 2, 1),
                )
                for name in stage4_object_alignment_channels
            }) if denoiser_architecture == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" else None
            self.v9_object_projection_up0 = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(1, channels, 1),
                    nn.SiLU(),
                    nn.Conv2d(channels, channels, 1),
                )
                for name in stage4_object_alignment_channels
            }) if denoiser_architecture == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" else None
            self.v9_object_readout_up1 = nn.ModuleDict({
                name: nn.Sequential(
                    nn.GroupNorm(group_count(channels * 2), channels * 2),
                    nn.SiLU(),
                    nn.Conv2d(channels * 2, 1, 1),
                    nn.Sigmoid(),
                )
                for name in stage4_object_alignment_channels
            }) if denoiser_architecture == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" else None
            self.v9_object_readout_up0 = nn.ModuleDict({
                name: nn.Sequential(
                    nn.GroupNorm(group_count(channels), channels),
                    nn.SiLU(),
                    nn.Conv2d(channels, 1, 1),
                    nn.Sigmoid(),
                )
                for name in stage4_object_alignment_channels
            }) if denoiser_architecture == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" else None
            self.v9_route_topology_readout = nn.Sequential(
                nn.GroupNorm(group_count(channels), channels),
                nn.SiLU(),
                nn.Conv2d(channels, len(stage4_route_alignment_channels), 1),
                nn.Sigmoid(),
            ) if denoiser_architecture == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" else None
            self.structure_fact_shared_trunk = nn.Sequential(
                nn.Conv2d(condition_channels, channels, 3, padding=1),
                nn.SiLU(),
                ResidualBlock(channels),
            ) if denoiser_architecture == structure_fact_first_architecture else None
            self.structure_fact_heads = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(channels, channels, 3, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(channels, 1, 1),
                    nn.Sigmoid(),
                )
                for name in stage4_structure_fact_channels
            }) if denoiser_architecture == structure_fact_first_architecture else None
            self.structure_fact_stage_b_adapters = nn.ModuleDict({
                "level0": nn.Conv2d(len(stage4_structure_fact_channels), channels, 1),
                "level1": nn.Conv2d(len(stage4_structure_fact_channels), channels * 2, 1),
                "middle": nn.Conv2d(len(stage4_structure_fact_channels), channels * 4, 1),
                "up1": nn.Conv2d(len(stage4_structure_fact_channels), channels * 2, 1),
                "up0": nn.Conv2d(len(stage4_structure_fact_channels), channels, 1),
            }) if denoiser_architecture == structure_fact_first_architecture else None
            self.semantic_renderer_paths_up1 = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(1, channels * 2, 3, padding=1),
                    nn.SiLU(),
                    ResidualBlock(channels * 2),
                )
                for name in semantic_renderer_channels
            }) if denoiser_architecture == semantic_renderer_architecture else None
            self.semantic_renderer_paths_up0 = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(1, channels, 3, padding=1),
                    nn.SiLU(),
                    ResidualBlock(channels),
                )
                for name in semantic_renderer_channels
            }) if denoiser_architecture == semantic_renderer_architecture else None
            self.semantic_renderer_readouts = nn.ModuleDict({
                name: nn.Sequential(
                    nn.GroupNorm(group_count(channels), channels),
                    nn.SiLU(),
                    nn.Conv2d(channels, 1, 1),
                    nn.Sigmoid(),
                )
                for name in semantic_renderer_channels
            }) if denoiser_architecture == semantic_renderer_architecture else None
            self.semantic_renderer_fusion_up1 = nn.Sequential(
                nn.Conv2d(channels * 4, channels * 2, 1),
                nn.SiLU(),
                ResidualBlock(channels * 2),
            ) if denoiser_architecture == semantic_renderer_architecture else None
            self.semantic_renderer_fusion_gate_up1 = nn.Sequential(
                nn.Conv2d(channels * 4, channels * 2, 1),
                nn.Sigmoid(),
            ) if denoiser_architecture == semantic_renderer_architecture else None
            self.semantic_renderer_fusion_up0 = nn.Sequential(
                nn.Conv2d(channels * 2, channels, 1),
                nn.SiLU(),
                ResidualBlock(channels),
            ) if denoiser_architecture == semantic_renderer_architecture else None
            self.semantic_renderer_fusion_gate_up0 = nn.Sequential(
                nn.Conv2d(channels * 2, channels, 1),
                nn.Sigmoid(),
            ) if denoiser_architecture == semantic_renderer_architecture else None
            semantic_mixture_input_channels = channels + condition_channels + 1
            self.semantic_mixture_experts = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(semantic_mixture_input_channels, channels, 3, padding=1),
                    nn.SiLU(),
                    ResidualBlock(channels),
                    nn.GroupNorm(group_count(channels), channels),
                    nn.SiLU(),
                    nn.Conv2d(channels, latent_channels, 3, padding=1),
                )
                for name in semantic_mixture_types
            }) if denoiser_architecture == semantic_mixture_architecture and semantic_mixture_types else None
            self.semantic_mixture_participation = nn.ModuleDict({
                name: nn.Sequential(
                    nn.Conv2d(semantic_mixture_input_channels, channels, 3, padding=1),
                    nn.SiLU(),
                    nn.Conv2d(channels, 1, 1),
                    nn.Sigmoid(),
                )
                for name in semantic_mixture_types
            }) if denoiser_architecture == semantic_mixture_architecture and semantic_mixture_types else None
            self.final_condition_residual = nn.Sequential(
                nn.Conv2d(23, 64, 3, padding=1, bias=True),
                nn.SiLU(),
                nn.Conv2d(64, 12, 3, padding=1, bias=True),
            ) if (
                denoiser_architecture == semantic_mixture_architecture
                and controlled_structure_arm_explicit
                and controlled_structure_arm == controlled_structure_fusion_arm
            ) else None
            authoritative_carrier_input_channels = channels + condition_channels + 1
            self.authoritative_semantic_carriers = nn.ModuleDict({
                channel_id: nn.Sequential(
                    nn.Conv2d(authoritative_carrier_input_channels, channels, 3, padding=1),
                    nn.SiLU(),
                    ResidualBlock(channels),
                    nn.GroupNorm(group_count(channels), channels),
                    nn.SiLU(),
                    nn.Conv2d(channels, latent_channels, 3, padding=1),
                )
                for channel_id in authoritative_visual_semantic_carrier_channels
            }) if denoiser_architecture in authoritative_carrier_architectures else None
            self.stage4_post_decode_object_rgb_heads = nn.ModuleDict({
                channel_id: nn.Sequential(
                    nn.Conv2d(4, 64, 3, padding=1),
                    nn.SiLU(),
                    ResidualBlock(64),
                    nn.GroupNorm(group_count(64), 64),
                    nn.SiLU(),
                    nn.Conv2d(64, 3, 3, padding=1),
                    nn.Sigmoid(),
                )
                for channel_id in post_decode_object_rgb_channels
            }) if (
                denoiser_architecture == post_decode_object_rgb_compositor_architecture
            ) else None
            self.stage4_post_decode_full_condition_responsibility_heads = nn.ModuleDict({
                channel_id: nn.Sequential(
                    nn.Conv2d(3 + condition_channels, 64, 3, padding=1),
                    nn.SiLU(),
                    ResidualBlock(64),
                    nn.GroupNorm(group_count(64), 64),
                    nn.SiLU(),
                    nn.Conv2d(64, 3, 3, padding=1),
                    nn.Sigmoid(),
                )
                for channel_id in post_decode_full_condition_responsibility_channels
            }) if (
                denoiser_architecture
                == post_decode_full_condition_responsibility_architecture
            ) else None

        def forward(
            self,
            noisy_latent,
            timestep,
            conditions,
            return_condition_reconstruction=False,
            return_stage4_alignment_readout=False,
            return_stage4_object_alignment=False,
            return_stage4_structure_fact=False,
            return_stage4_semantic_renderer=False,
            return_stage4_semantic_mixture=False,
            return_stage4_authoritative_semantic_carriers=False,
        ):
            if conditions.shape[1] != condition_channels:
                raise ValueError(f"expected {condition_channels} condition channels, got {conditions.shape[1]}")
            time_embedding = self.time_embedding(timestep)
            resized_conditions = resize_typed_conditions(conditions, noisy_latent.shape[-2:])
            structure_fact_head_outputs = ()
            structure_fact_layout = None
            if self.structure_fact_shared_trunk is not None:
                shared_structure = self.structure_fact_shared_trunk(resized_conditions)
                structure_fact_head_outputs = tuple(
                    self.structure_fact_heads[name](shared_structure)
                    for name in stage4_structure_fact_channels
                )
                structure_fact_layout = torch.cat(structure_fact_head_outputs, dim=1)
            condition0 = self.condition_stem(resized_conditions)
            if structure_fact_layout is not None:
                condition0 = condition0 + self.structure_fact_stage_b_adapters["level0"](
                    structure_fact_layout
                )
            level0 = self.block0(
                self.fuse0(torch.cat((self.latent_stem(noisy_latent), condition0), dim=1)),
                time_embedding,
                (
                    resized_conditions
                    if self.block0.requires_spatial_conditions()
                    else None
                ),
            )
            condition1 = self.condition_down1(condition0)
            if structure_fact_layout is not None:
                condition1 = condition1 + self.structure_fact_stage_b_adapters["level1"](
                    resize_stage4_structure_fact_layout(
                        structure_fact_layout,
                        size=condition1.shape[-2:],
                    )
                )
            level1 = self.block1(
                self.fuse1(torch.cat((self.latent_down1(level0), condition1), dim=1)),
                time_embedding,
                (
                    resize_typed_conditions(conditions, condition1.shape[-2:])
                    if self.block1.requires_spatial_conditions()
                    else None
                ),
            )
            condition2 = self.condition_down2(condition1)
            if structure_fact_layout is not None:
                condition2 = condition2 + self.structure_fact_stage_b_adapters["middle"](
                    resize_stage4_structure_fact_layout(
                        structure_fact_layout,
                        size=condition2.shape[-2:],
                    )
                )
            middle = self.fuse2(torch.cat((self.latent_down2(level1), condition2), dim=1))
            spatial_affine_middle_conditions = (
                resize_typed_conditions(conditions, middle.shape[-2:])
                if self.middle1.requires_spatial_conditions()
                else None
            )
            middle = self.middle2(
                self.middle1(
                    middle,
                    time_embedding,
                    spatial_affine_middle_conditions,
                ),
                time_embedding,
                spatial_affine_middle_conditions,
            )

            decoded_up1 = self.up1(middle)
            v9_object_features_up1 = []
            v9_object_readouts_up1 = []
            semantic_renderer_features_up1 = []
            semantic_renderer_features_up0 = []
            semantic_renderer_readouts = []
            primary_up1 = None
            primary_decoded_up0 = None
            if self.typed_condition_adapter_up1 is not None:
                typed_up1 = resize_typed_conditions(conditions, decoded_up1.shape[-2:])
                decoded_up1 = decoded_up1 + self.typed_condition_adapter_up1(typed_up1)
            if structure_fact_layout is not None:
                decoded_up1 = decoded_up1 + self.structure_fact_stage_b_adapters["up1"](
                    resize_stage4_structure_fact_layout(
                        structure_fact_layout,
                        size=decoded_up1.shape[-2:],
                    )
                )
            if self.v9_object_projection_up1 is not None:
                typed_up1 = resize_typed_conditions(conditions, decoded_up1.shape[-2:])
                for name in stage4_object_alignment_channels:
                    index = condition_channel_order.index(name)
                    projected = self.v9_object_projection_up1[name](typed_up1[:, index:index + 1])
                    v9_object_features_up1.append(projected)
                    v9_object_readouts_up1.append(self.v9_object_readout_up1[name](projected))
                decoded_up1 = decoded_up1 + torch.stack(v9_object_features_up1, dim=0).sum(dim=0)
            if self.semantic_renderer_paths_up1 is not None:
                primary_up1 = self.up_block1(
                    self.up_fuse1(torch.cat((decoded_up1, level1), dim=1)),
                    time_embedding,
                )
                typed_up1 = resize_typed_conditions(conditions, decoded_up1.shape[-2:])
                for name in semantic_renderer_channels:
                    index = condition_channel_order.index(semantic_renderer_source_channels[name])
                    semantic_renderer_features_up1.append(
                        self.semantic_renderer_paths_up1[name](typed_up1[:, index:index + 1])
                    )
                semantic_up1 = torch.stack(semantic_renderer_features_up1, dim=0).mean(dim=0)
                fusion_input_up1 = torch.cat((decoded_up1, semantic_up1), dim=1)
                decoded_up1 = decoded_up1 + (
                    self.semantic_renderer_fusion_gate_up1(fusion_input_up1)
                    * self.semantic_renderer_fusion_up1(fusion_input_up1)
                )
            spatial_affine_up1_conditions = (
                resize_typed_conditions(conditions, decoded_up1.shape[-2:])
                if self.up_block1.requires_spatial_conditions()
                else None
            )
            up1 = self.up_block1(
                self.up_fuse1(torch.cat((decoded_up1, level1), dim=1)),
                time_embedding,
                spatial_affine_up1_conditions,
            )
            decoded_up0 = self.up0(up1)
            if primary_up1 is not None:
                primary_decoded_up0 = self.up0(primary_up1)
            v9_object_features_up0 = []
            v9_object_readouts_up0 = []
            if self.typed_condition_adapter_up0 is not None:
                typed_up0 = resize_typed_conditions(conditions, decoded_up0.shape[-2:])
                decoded_up0 = decoded_up0 + self.typed_condition_adapter_up0(typed_up0)
                if primary_decoded_up0 is not None:
                    primary_decoded_up0 = primary_decoded_up0 + self.typed_condition_adapter_up0(typed_up0)
            if structure_fact_layout is not None:
                decoded_up0 = decoded_up0 + self.structure_fact_stage_b_adapters["up0"](
                    resize_stage4_structure_fact_layout(
                        structure_fact_layout,
                        size=decoded_up0.shape[-2:],
                    )
                )
            if self.v9_object_projection_up0 is not None:
                typed_up0 = resize_typed_conditions(conditions, decoded_up0.shape[-2:])
                for name in stage4_object_alignment_channels:
                    index = condition_channel_order.index(name)
                    projected = self.v9_object_projection_up0[name](typed_up0[:, index:index + 1])
                    v9_object_features_up0.append(projected)
                    v9_object_readouts_up0.append(self.v9_object_readout_up0[name](projected))
                decoded_up0 = decoded_up0 + torch.stack(v9_object_features_up0, dim=0).sum(dim=0)
            if self.semantic_renderer_paths_up0 is not None:
                typed_up0 = resize_typed_conditions(conditions, decoded_up0.shape[-2:])
                for name in semantic_renderer_channels:
                    index = condition_channel_order.index(semantic_renderer_source_channels[name])
                    feature = self.semantic_renderer_paths_up0[name](typed_up0[:, index:index + 1])
                    semantic_renderer_features_up0.append(feature)
                    semantic_renderer_readouts.append(self.semantic_renderer_readouts[name](feature))
                semantic_up0 = torch.stack(semantic_renderer_features_up0, dim=0).mean(dim=0)
                fusion_input_up0 = torch.cat((decoded_up0, semantic_up0), dim=1)
                decoded_up0 = decoded_up0 + (
                    self.semantic_renderer_fusion_gate_up0(fusion_input_up0)
                    * self.semantic_renderer_fusion_up0(fusion_input_up0)
                )
            spatial_affine_up0_conditions = (
                resize_typed_conditions(conditions, decoded_up0.shape[-2:])
                if self.up_block0.requires_spatial_conditions()
                else None
            )
            up0 = self.up_block0(
                self.up_fuse0(torch.cat((decoded_up0, level0), dim=1)),
                time_embedding,
                spatial_affine_up0_conditions,
            )
            base_velocity = self.output(up0)
            predicted_velocity = base_velocity
            primary_velocity = predicted_velocity
            if primary_decoded_up0 is not None:
                primary_up0 = self.up_block0(
                    self.up_fuse0(torch.cat((primary_decoded_up0, level0), dim=1)),
                    time_embedding,
                )
                primary_velocity = self.output(primary_up0)
            semantic_mixture_contributions = []
            semantic_mixture_participation = []
            semantic_mixture_gated_contributions = []
            authoritative_semantic_carrier_contributions = []
            authoritative_semantic_carrier_gated_contributions = []
            if self.semantic_mixture_experts is not None:
                typed_mixture_conditions = resize_typed_conditions(
                    conditions,
                    up0.shape[-2:],
                )
                for name in semantic_mixture_types:
                    source_index = condition_channel_order.index(
                        semantic_mixture_source_channels[name]
                    )
                    expert_input = torch.cat((
                        up0,
                        typed_mixture_conditions,
                        typed_mixture_conditions[:, source_index:source_index + 1],
                    ), dim=1)
                    contribution = self.semantic_mixture_experts[name](expert_input)
                    participation = self.semantic_mixture_participation[name](expert_input)
                    semantic_mixture_contributions.append(contribution)
                    semantic_mixture_participation.append(participation)
                    semantic_mixture_gated_contributions.append(
                        contribution * participation
                    )
                predicted_velocity = base_velocity + torch.stack(
                    semantic_mixture_gated_contributions,
                    dim=0,
                ).sum(dim=0)
            if self.final_condition_residual is not None:
                final_typed_conditions = resize_typed_conditions(
                    conditions,
                    predicted_velocity.shape[-2:],
                )
                predicted_velocity = predicted_velocity + self.final_condition_residual(
                    final_typed_conditions
                )
            if self.authoritative_semantic_carriers is not None:
                typed_carrier_conditions = resize_typed_conditions(
                    conditions,
                    up0.shape[-2:],
                )
                for channel_id in authoritative_visual_semantic_carrier_channels:
                    source_index = condition_channel_order.index(channel_id)
                    authoritative_gate = typed_carrier_conditions[
                        :, source_index:source_index + 1
                    ]
                    carrier_input = torch.cat((
                        up0,
                        typed_carrier_conditions,
                        authoritative_gate,
                    ), dim=1)
                    contribution = self.authoritative_semantic_carriers[channel_id](
                        carrier_input
                    )
                    authoritative_semantic_carrier_contributions.append(contribution)
                    authoritative_semantic_carrier_gated_contributions.append(
                        contribution * authoritative_gate
                    )
                predicted_velocity = base_velocity + torch.stack(
                    authoritative_semantic_carrier_gated_contributions,
                    dim=0,
                ).sum(dim=0)
            if return_condition_reconstruction:
                if self.condition_reconstruction is None:
                    raise ValueError("condition reconstruction is only available in the V4 denoiser")
                return predicted_velocity, self.condition_reconstruction(up0), resized_conditions
            if return_stage4_alignment_readout:
                if self.shared_semantic_topology_readout is None:
                    raise ValueError("Stage 4 decoded alignment readout is only available in the V8 denoiser")
                return predicted_velocity, self.shared_semantic_topology_readout(up0)
            if return_stage4_object_alignment:
                if self.v9_route_topology_readout is None or not v9_object_readouts_up1 or not v9_object_readouts_up0:
                    raise ValueError("Stage 4 object semantic alignment is only available in the V9 denoiser")
                return predicted_velocity, {
                    "objectReadoutUp1": torch.cat(v9_object_readouts_up1, dim=1),
                    "objectReadoutUp0": torch.cat(v9_object_readouts_up0, dim=1),
                    "objectProjectionFeaturesUp1": tuple(v9_object_features_up1),
                    "objectProjectionFeaturesUp0": tuple(v9_object_features_up0),
                    "routeReadout": self.v9_route_topology_readout(up0),
                }
            if return_stage4_structure_fact:
                if structure_fact_layout is None or len(structure_fact_head_outputs) != len(stage4_structure_fact_channels):
                    raise ValueError("Stage 4 structure-fact outputs are only available in the dual-stage generator")
                return predicted_velocity, {
                    "structureLayout": structure_fact_layout,
                    "structureHeadOutputs": structure_fact_head_outputs,
                    "structureChannelOrder": stage4_structure_fact_channels,
                    "stageBInjectionScales": ("level0", "level1", "middle", "up1", "up0"),
                }
            if return_stage4_semantic_renderer:
                if (
                    len(semantic_renderer_features_up1) != len(semantic_renderer_channels)
                    or len(semantic_renderer_features_up0) != len(semantic_renderer_channels)
                    or len(semantic_renderer_readouts) != len(semantic_renderer_channels)
                ):
                    raise ValueError("Stage 4 learned semantic renderer outputs are unavailable")
                return predicted_velocity, {
                    "semanticReadout": torch.cat(semantic_renderer_readouts, dim=1),
                    "semanticFeaturesUp1": tuple(semantic_renderer_features_up1),
                    "semanticFeaturesUp0": tuple(semantic_renderer_features_up0),
                    "semanticChannelOrder": semantic_renderer_channels,
                    "semanticSourceChannels": tuple(
                        semantic_renderer_source_channels[name]
                        for name in semantic_renderer_channels
                    ),
                    "fusionScales": ("up1", "up0"),
                    "primaryVelocity": primary_velocity,
                    "fusionKind": "learned_condition_preserving_residual_gate_v1",
                }
            if return_stage4_semantic_mixture:
                if self.authoritative_semantic_carriers is not None:
                    compatibility_identities = (
                        "route", "footprints", "tree", "rock", "vegetation",
                    )
                    compatibility_sources = tuple(
                        semantic_mixture_source_channels[name]
                        for name in compatibility_identities
                    )
                    carrier_by_source = {
                        channel_id: (contribution, gated)
                        for channel_id, contribution, gated in zip(
                            authoritative_visual_semantic_carrier_channels,
                            authoritative_semantic_carrier_contributions,
                            authoritative_semantic_carrier_gated_contributions,
                        )
                    }
                    participation = torch.cat(tuple(
                        typed_carrier_conditions[
                            :, condition_channel_order.index(source):condition_channel_order.index(source) + 1
                        ]
                        for source in compatibility_sources
                    ), dim=1)
                    return predicted_velocity, {
                        "baseVelocity": base_velocity,
                        "expertContributions": tuple(
                            carrier_by_source[source][0] for source in compatibility_sources
                        ),
                        "participation": participation,
                        "gatedContributions": tuple(
                            carrier_by_source[source][1] for source in compatibility_sources
                        ),
                        "expertIdentityOrder": compatibility_identities,
                        "sourceConditionChannels": compatibility_sources,
                        "compositorKind": "authoritative_semantic_carrier_compatibility_v1",
                        "authoritativeGateKind": "immutable_source_condition_mask_multiplication_v1",
                        "learnedParticipationGatePresent": False,
                        "typedIdentityCollapsedBeforeOutput": False,
                    }
                if (
                    len(semantic_mixture_contributions) != len(semantic_mixture_types)
                    or len(semantic_mixture_participation) != len(semantic_mixture_types)
                    or len(semantic_mixture_gated_contributions) != len(semantic_mixture_types)
                ):
                    raise ValueError("Stage 4 fact-conditioned semantic mixture outputs are unavailable")
                return predicted_velocity, {
                    "baseVelocity": base_velocity,
                    "expertContributions": tuple(semantic_mixture_contributions),
                    "participation": torch.cat(semantic_mixture_participation, dim=1),
                    "gatedContributions": tuple(semantic_mixture_gated_contributions),
                    "expertIdentityOrder": semantic_mixture_types,
                    "sourceConditionChannels": tuple(
                        semantic_mixture_source_channels[name]
                        for name in semantic_mixture_types
                    ),
                    "compositorKind": "typed_fact_conditioned_gated_additive_mixture_v1",
                    "typedIdentityCollapsedBeforeOutput": False,
                }
            if return_stage4_authoritative_semantic_carriers:
                if (
                    len(authoritative_semantic_carrier_contributions)
                    != len(authoritative_visual_semantic_carrier_channels)
                    or len(authoritative_semantic_carrier_gated_contributions)
                    != len(authoritative_visual_semantic_carrier_channels)
                ):
                    raise ValueError("Stage 4 authoritative semantic carriers are unavailable")
                return predicted_velocity, {
                    "baseVelocity": base_velocity,
                    "carrierContributions": tuple(
                        authoritative_semantic_carrier_contributions
                    ),
                    "authoritativelyGatedContributions": tuple(
                        authoritative_semantic_carrier_gated_contributions
                    ),
                    "carrierIdentityOrder": authoritative_visual_semantic_carrier_channels,
                    "sourceConditionChannels": authoritative_visual_semantic_carrier_channels,
                    "gateKind": "immutable_source_condition_mask_multiplication_v1",
                    "learnedParticipationGatePresent": False,
                    "typedIdentityCollapsedBeforeOutput": False,
                }
            return predicted_velocity

        def reconstruct_conditions_from_clean_latent(self, predicted_clean):
            if self.output_bound_condition_probe is None:
                raise ValueError("output-bound condition probe is only available in the V5 denoiser")
            return self.output_bound_condition_probe(predicted_clean)

        def prepare_typed_conditions(self, conditions, latent_size):
            return resize_typed_conditions(conditions, latent_size)

        def stage4_alignment_readout_channel_order(self):
            if self.shared_semantic_topology_readout is None:
                raise ValueError("Stage 4 decoded alignment readout is only available in the V8 denoiser")
            return stage4_alignment_readout_channels

        def stage4_object_alignment_channel_order(self):
            if self.v9_route_topology_readout is None:
                raise ValueError("Stage 4 object semantic alignment is only available in the V9 denoiser")
            return stage4_object_alignment_channels

        def stage4_route_alignment_channel_order(self):
            if self.v9_route_topology_readout is None:
                raise ValueError("Stage 4 route topology alignment is only available in the V9 denoiser")
            return stage4_route_alignment_channels

        def stage4_structure_fact_channel_order(self):
            if self.structure_fact_shared_trunk is None:
                raise ValueError("Stage 4 structure-fact channels are only available in the dual-stage generator")
            return stage4_structure_fact_channels

        def stage4_semantic_renderer_channel_order(self):
            if self.semantic_renderer_paths_up0 is None:
                raise ValueError("Stage 4 semantic renderer channels are only available in the learned renderer")
            return semantic_renderer_channels

        def stage4_semantic_mixture_identity_order(self):
            if self.semantic_mixture_experts is None:
                raise ValueError("Stage 4 semantic mixture identities are unavailable")
            return semantic_mixture_types

        def stage4_authoritative_semantic_carrier_identity_order(self):
            if self.authoritative_semantic_carriers is None:
                raise ValueError("Stage 4 authoritative semantic carriers are unavailable")
            return authoritative_visual_semantic_carrier_channels

    class ProjectOwnedCompleteWorldSystem(nn.Module):
        def __init__(self):
            super().__init__()
            self.autoencoder = ProjectOwnedAutoencoder()
            if denoiser_architecture in {
                "multiscale_condition_unet_v3",
                "multiscale_condition_unet_v4",
                "multiscale_condition_unet_v5",
                "multiscale_condition_unet_v6",
                "multiscale_condition_unet_v7",
                "multiscale_condition_unet_v8_stage4_decoded_alignment",
                "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
                structure_fact_first_architecture,
                semantic_renderer_architecture,
                semantic_mixture_architecture,
                spatial_affine_conditioned_decoder_architecture,
                full_backbone_spatial_affine_architecture,
                joint_condition_local_transport_architecture,
                authoritative_semantic_carrier_architecture,
                post_decode_object_rgb_compositor_architecture,
                post_decode_full_condition_responsibility_architecture,
            }:
                self.denoiser = ProjectOwnedMultiscaleConditionUNet()
            elif denoiser_architecture == "shallow_condition_fusion_v2":
                self.denoiser = ProjectOwnedDenoiser()
            else:
                raise ValueError(f"unsupported denoiser architecture: {denoiser_architecture}")

        def predict_noise(self, noisy_latent, timestep, conditions):
            return self.denoiser(noisy_latent, timestep, conditions)

        def predict_velocity(self, noisy_latent, timestep, conditions):
            return self.denoiser(noisy_latent, timestep, conditions)

        def predict_velocity_with_condition_reconstruction(self, noisy_latent, timestep, conditions):
            return self.denoiser(noisy_latent, timestep, conditions, return_condition_reconstruction=True)

        def predict_velocity_with_stage4_alignment(self, noisy_latent, timestep, conditions):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_alignment_readout=True,
            )

        def predict_velocity_with_stage4_object_alignment(self, noisy_latent, timestep, conditions):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_object_alignment=True,
            )

        def predict_velocity_with_stage4_structure_fact(self, noisy_latent, timestep, conditions):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_structure_fact=True,
            )

        def predict_velocity_with_stage4_semantic_renderer(self, noisy_latent, timestep, conditions):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_semantic_renderer=True,
            )

        def predict_velocity_with_stage4_semantic_mixture(self, noisy_latent, timestep, conditions):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_semantic_mixture=True,
            )

        def predict_velocity_with_stage4_authoritative_semantic_carriers(
            self,
            noisy_latent,
            timestep,
            conditions,
        ):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_authoritative_semantic_carriers=True,
            )

        def decode_stage4_post_decode_object_rgb(
            self,
            latent,
            conditions,
            return_evidence=False,
        ):
            decoded_rgb = self.autoencoder.decode(latent)
            if self.denoiser.stage4_post_decode_object_rgb_heads is None:
                if return_evidence:
                    raise ValueError(
                        "post-decode object RGB evidence is only available in the authoritative object RGB compositor"
                    )
                return decoded_rgb
            typed_conditions = self.denoiser.prepare_typed_conditions(
                conditions,
                decoded_rgb.shape[-2:],
            )
            masks = []
            proposals = []
            gated_proposals = []
            for channel_id in post_decode_object_rgb_channels:
                source_index = condition_channel_order.index(channel_id)
                mask = typed_conditions[:, source_index:source_index + 1]
                proposal = self.denoiser.stage4_post_decode_object_rgb_heads[channel_id](
                    torch.cat((decoded_rgb, mask), dim=1)
                )
                masks.append(mask)
                proposals.append(proposal)
                gated_proposals.append(proposal * mask)
            mask_sum = torch.stack(masks, dim=0).sum(dim=0)
            foreground_sum = torch.stack(gated_proposals, dim=0).sum(dim=0)
            denominator = mask_sum.clamp_min(torch.finfo(decoded_rgb.dtype).eps)
            foreground_rgb = foreground_sum / denominator
            object_coverage = mask_sum.clamp(0.0, 1.0)
            complete_rgb = (
                decoded_rgb * (1.0 - object_coverage)
                + foreground_rgb * object_coverage
            )
            if return_evidence:
                return complete_rgb, {
                    "baseDecodedRgb": decoded_rgb,
                    "objectMasks": tuple(masks),
                    "objectRgbProposals": tuple(proposals),
                    "authoritativelyGatedObjectRgb": tuple(gated_proposals),
                    "objectIdentityOrder": post_decode_object_rgb_channels,
                    "sourceConditionChannels": post_decode_object_rgb_channels,
                    "compositorKind": "authoritative_mask_normalized_rgb_compositor_v1",
                    "maskOutsideMutationAllowed": False,
                    "freeBlendWeightsPresent": False,
                }
            return complete_rgb

        def stage4_post_decode_object_rgb_identity_order(self):
            if self.denoiser.stage4_post_decode_object_rgb_heads is None:
                raise ValueError(
                    "post-decode object RGB identities are only available in the authoritative object RGB compositor"
                )
            return post_decode_object_rgb_channels

        def decode_stage4_post_decode_full_condition_responsibility_rgb(
            self,
            latent,
            conditions,
            return_evidence=False,
        ):
            decoded_rgb = self.autoencoder.decode(latent)
            heads = self.denoiser.stage4_post_decode_full_condition_responsibility_heads
            if heads is None:
                if return_evidence:
                    raise ValueError(
                        "post-decode full-condition responsibility evidence is only available in its formal architecture"
                    )
                return decoded_rgb
            typed_conditions = self.denoiser.prepare_typed_conditions(
                conditions,
                decoded_rgb.shape[-2:],
            )
            branch_input = torch.cat((decoded_rgb, typed_conditions), dim=1)
            masks = []
            proposals = []
            gated_proposals = []
            for channel_id in post_decode_full_condition_responsibility_channels:
                source_index = condition_channel_order.index(channel_id)
                mask = typed_conditions[:, source_index:source_index + 1]
                proposal = heads[channel_id](branch_input)
                masks.append(mask)
                proposals.append(proposal)
                gated_proposals.append(proposal * mask)
            mask_sum = torch.stack(masks, dim=0).sum(dim=0)
            foreground_sum = torch.stack(gated_proposals, dim=0).sum(dim=0)
            denominator = mask_sum.clamp_min(torch.finfo(decoded_rgb.dtype).eps)
            foreground_rgb = foreground_sum / denominator
            responsibility_coverage = mask_sum.clamp(0.0, 1.0)
            complete_rgb = (
                decoded_rgb * (1.0 - responsibility_coverage)
                + foreground_rgb * responsibility_coverage
            )
            if return_evidence:
                return complete_rgb, {
                    "baseDecodedRgb": decoded_rgb,
                    "responsibilityMasks": tuple(masks),
                    "responsibilityRgbProposals": tuple(proposals),
                    "authoritativelyGatedResponsibilityRgb": tuple(gated_proposals),
                    "responsibilityIdentityOrder": post_decode_full_condition_responsibility_channels,
                    "sourceConditionChannels": tuple(condition_channel_order),
                    "branchInputChannels": 3 + condition_channels,
                    "compositorKind": "authoritative_mask_normalized_full_condition_responsibility_rgb_v1",
                    "maskOutsideMutationAllowed": False,
                    "freeBlendWeightsPresent": False,
                }
            return complete_rgb

        def stage4_post_decode_full_condition_responsibility_identity_order(self):
            if self.denoiser.stage4_post_decode_full_condition_responsibility_heads is None:
                raise ValueError(
                    "post-decode full-condition responsibility identities are unavailable"
                )
            return post_decode_full_condition_responsibility_channels

        def reconstruct_conditions_from_clean_latent(self, predicted_clean):
            return self.denoiser.reconstruct_conditions_from_clean_latent(predicted_clean)

        def prepare_typed_conditions(self, conditions, latent_size):
            return self.denoiser.prepare_typed_conditions(conditions, latent_size)

        def stage4_alignment_readout_channel_order(self):
            return self.denoiser.stage4_alignment_readout_channel_order()

        def stage4_object_alignment_channel_order(self):
            return self.denoiser.stage4_object_alignment_channel_order()

        def stage4_route_alignment_channel_order(self):
            return self.denoiser.stage4_route_alignment_channel_order()

        def stage4_structure_fact_channel_order(self):
            return self.denoiser.stage4_structure_fact_channel_order()

        def stage4_semantic_renderer_channel_order(self):
            return self.denoiser.stage4_semantic_renderer_channel_order()

        def stage4_semantic_mixture_identity_order(self):
            return self.denoiser.stage4_semantic_mixture_identity_order()

        def stage4_authoritative_semantic_carrier_identity_order(self):
            return self.denoiser.stage4_authoritative_semantic_carrier_identity_order()

    class ProjectOwnedDirectConditionCleanLatentGenerator(nn.Module):
        """Generate the clean Autoencoder latent directly from the formal conditions."""

        def __init__(self, responsibility_residuals=False):
            super().__init__()
            channels = 64
            self.responsibility_residuals_enabled = bool(responsibility_residuals)
            self.condition_stem = nn.Sequential(
                nn.Conv2d(condition_channels, channels, 3, padding=1),
                nn.SiLU(),
                ResidualBlock(channels),
            )
            self.condition_down1 = nn.Sequential(
                nn.Conv2d(channels, channels * 2, 4, stride=2, padding=1),
                ResidualBlock(channels * 2),
            )
            self.condition_down2 = nn.Sequential(
                nn.Conv2d(channels * 2, channels * 4, 4, stride=2, padding=1),
                ResidualBlock(channels * 4),
            )
            self.middle = nn.Sequential(
                ResidualBlock(channels * 4),
                ResidualBlock(channels * 4),
            )
            self.up1 = nn.ConvTranspose2d(
                channels * 4,
                channels * 2,
                4,
                stride=2,
                padding=1,
            )
            self.fuse1 = nn.Sequential(
                nn.Conv2d(channels * 4, channels * 2, 1),
                ResidualBlock(channels * 2),
            )
            self.up0 = nn.ConvTranspose2d(
                channels * 2,
                channels,
                4,
                stride=2,
                padding=1,
            )
            self.fuse0 = nn.Sequential(
                nn.Conv2d(channels * 2, channels, 1),
                ResidualBlock(channels),
            )
            self.output = nn.Sequential(
                nn.GroupNorm(group_count(channels), channels),
                nn.SiLU(),
                nn.Conv2d(channels, latent_channels, 3, padding=1),
            )
            self.responsibility_residual_heads = (
                nn.ModuleDict({
                    channel_id: nn.Conv2d(
                        channels,
                        latent_channels,
                        3,
                        padding=1,
                        bias=True,
                    )
                    for channel_id in direct_responsibility_residual_channels
                })
                if self.responsibility_residuals_enabled
                else None
            )

        def prepare_typed_conditions(self, conditions, latent_size):
            return resize_typed_conditions(conditions, latent_size)

        def forward(self, conditions, return_responsibility_evidence=False):
            if conditions.ndim != 4:
                raise ValueError("direct clean-latent conditions must be a four-dimensional tensor")
            if int(conditions.shape[1]) != condition_channels:
                raise ValueError(
                    f"expected {condition_channels} condition channels, got {conditions.shape[1]}"
                )
            height, width = int(conditions.shape[-2]), int(conditions.shape[-1])
            if height % latent_downsample_factor or width % latent_downsample_factor:
                raise ValueError(
                    "direct clean-latent condition size must be divisible by the Autoencoder factor"
                )
            latent_size = (
                height // latent_downsample_factor,
                width // latent_downsample_factor,
            )
            typed_conditions = self.prepare_typed_conditions(conditions, latent_size)
            level0 = self.condition_stem(typed_conditions)
            level1 = self.condition_down1(level0)
            level2 = self.middle(self.condition_down2(level1))
            up1 = self.up1(level2)
            if up1.shape[-2:] != level1.shape[-2:]:
                up1 = functional.interpolate(
                    up1,
                    size=level1.shape[-2:],
                    mode="bilinear",
                    align_corners=False,
                )
            decoded1 = self.fuse1(torch.cat((up1, level1), dim=1))
            up0 = self.up0(decoded1)
            if up0.shape[-2:] != level0.shape[-2:]:
                up0 = functional.interpolate(
                    up0,
                    size=level0.shape[-2:],
                    mode="bilinear",
                    align_corners=False,
                )
            final_features = self.fuse0(torch.cat((up0, level0), dim=1))
            base_clean_latent = self.output(final_features)
            if self.responsibility_residual_heads is None:
                if return_responsibility_evidence:
                    raise ValueError(
                        "responsibility residual evidence is unavailable for the baseline direct generator"
                    )
                return base_clean_latent
            residuals = []
            masks = []
            for channel_id in direct_responsibility_residual_channels:
                channel_index = condition_channel_order.index(channel_id)
                mask = typed_conditions[:, channel_index:channel_index + 1]
                residual = self.responsibility_residual_heads[channel_id](
                    final_features
                ) * mask
                masks.append(mask)
                residuals.append(residual)
            clean_latent = base_clean_latent + torch.stack(residuals, dim=0).sum(dim=0)
            if return_responsibility_evidence:
                return clean_latent, {
                    "baseCleanLatent": base_clean_latent,
                    "responsibilityIdentityOrder": direct_responsibility_residual_channels,
                    "responsibilityMasks": tuple(masks),
                    "maskedResponsibilityResiduals": tuple(residuals),
                    "responsibilityParameterNamespace": (
                        "clean_latent_generator.responsibility_residual_heads"
                    ),
                    "outsideMaskMutationAllowed": False,
                    "freeBlendWeightsPresent": False,
                }
            return clean_latent

    class ProjectOwnedDirectConditionCleanLatentSystem(nn.Module):
        def __init__(
            self,
            responsibility_residuals=False,
            native_condition_encoder=False,
            native_responsibility_residuals=False,
            route_counterfactual_compositor=False,
        ):
            super().__init__()
            self.autoencoder = ProjectOwnedAutoencoder()
            self.autoencoder.eval()
            for parameter in self.autoencoder.parameters():
                parameter.requires_grad_(False)
            self.clean_latent_generator = (
                ProjectOwnedNativeConditionCleanLatentGenerator(
                    responsibility_residuals=native_responsibility_residuals,
                    route_counterfactual_compositor=route_counterfactual_compositor,
                )
                if native_condition_encoder
                else ProjectOwnedDirectConditionCleanLatentGenerator(
                    responsibility_residuals=responsibility_residuals
                )
            )

        @property
        def denoiser(self):
            return self.clean_latent_generator

        def predict_clean_latent(self, conditions):
            return self.clean_latent_generator(conditions)

        def predict_clean_latent_with_responsibility_evidence(self, conditions):
            return self.clean_latent_generator(
                conditions,
                return_responsibility_evidence=True,
            )

        def predict_clean_latent_with_route_counterfactual_evidence(self, conditions):
            return self.clean_latent_generator(
                conditions,
                return_route_counterfactual_evidence=True,
            )

        def decode_clean_latent(self, clean_latent):
            return self.autoencoder.decode(clean_latent)

        def prepare_typed_conditions(self, conditions, latent_size):
            return self.clean_latent_generator.prepare_typed_conditions(
                conditions,
                latent_size,
            )

    class ProjectOwnedNativeConditionCleanLatentGenerator(nn.Module):
        """Encode native-resolution conditions before the frozen 4x latent boundary."""

        def __init__(
            self,
            responsibility_residuals=False,
            route_counterfactual_compositor=False,
        ):
            super().__init__()
            channels = 64
            self.responsibility_residuals_enabled = bool(responsibility_residuals)
            self.route_counterfactual_compositor_enabled = bool(
                route_counterfactual_compositor
            )
            if (
                self.responsibility_residuals_enabled
                and self.route_counterfactual_compositor_enabled
            ):
                raise ValueError(
                    "route counterfactual compositor cannot retain responsibility residual heads"
                )
            self.native_condition_stem = nn.Sequential(
                nn.Conv2d(condition_channels, channels, 3, padding=1),
                nn.SiLU(),
                ResidualBlock(channels),
            )
            self.native_condition_down1 = nn.Sequential(
                nn.Conv2d(channels, channels * 2, 4, stride=2, padding=1),
                ResidualBlock(channels * 2),
            )
            self.native_condition_down2 = nn.Sequential(
                nn.Conv2d(channels * 2, channels * 4, 4, stride=2, padding=1),
                ResidualBlock(channels * 4),
            )
            self.middle = nn.Sequential(
                ResidualBlock(channels * 4),
                ResidualBlock(channels * 4),
            )
            self.output = nn.Sequential(
                nn.GroupNorm(group_count(channels * 4), channels * 4),
                nn.SiLU(),
                nn.Conv2d(channels * 4, latent_channels, 3, padding=1),
            )
            self.responsibility_residual_heads = (
                nn.ModuleDict({
                    channel_id: nn.Conv2d(
                        channels * 4,
                        latent_channels,
                        3,
                        padding=1,
                        bias=True,
                    )
                    for channel_id in direct_responsibility_residual_channels
                })
                if self.responsibility_residuals_enabled
                else None
            )

        def prepare_typed_conditions(self, conditions, latent_size):
            return resize_typed_conditions(conditions, latent_size)

        def _encode_native_conditions(self, conditions):
            native_features = self.native_condition_stem(conditions)
            half_features = self.native_condition_down1(native_features)
            latent_features = self.native_condition_down2(half_features)
            terminal_features = self.middle(latent_features)
            return self.output(terminal_features)

        def _derive_no_route_conditions(self, conditions):
            grass_index = condition_channel_order.index("terrain_grass")
            path_index = condition_channel_order.index("terrain_path_ground")
            signed_path_index = condition_channel_order.index("signed_distance_path")
            no_route_conditions = conditions.clone()
            no_route_conditions[:, grass_index:grass_index + 1] = torch.maximum(
                conditions[:, grass_index:grass_index + 1],
                conditions[:, path_index:path_index + 1],
            )
            no_route_conditions[:, path_index:path_index + 1] = 0.0
            no_route_conditions[:, signed_path_index:signed_path_index + 1] = (
                1.0 / 255.0
            )
            return no_route_conditions

        def forward(
            self,
            conditions,
            return_responsibility_evidence=False,
            return_route_counterfactual_evidence=False,
        ):
            if conditions.ndim != 4:
                raise ValueError(
                    "native condition encoder conditions must be a four-dimensional tensor"
                )
            if int(conditions.shape[1]) != condition_channels:
                raise ValueError(
                    f"expected {condition_channels} condition channels, got {conditions.shape[1]}"
                )
            if return_responsibility_evidence and return_route_counterfactual_evidence:
                raise ValueError(
                    "native encoder can return only one bounded evidence identity"
                )
            height, width = int(conditions.shape[-2]), int(conditions.shape[-1])
            if height % latent_downsample_factor or width % latent_downsample_factor:
                raise ValueError(
                    "native condition encoder size must be divisible by the Autoencoder factor"
                )
            if self.route_counterfactual_compositor_enabled:
                if return_responsibility_evidence:
                    raise ValueError(
                        "route counterfactual compositor has no responsibility residual evidence"
                    )
                full_route_latent = self._encode_native_conditions(conditions)
                no_route_conditions = self._derive_no_route_conditions(conditions)
                no_route_latent = self._encode_native_conditions(no_route_conditions)
                typed_latent_conditions = resize_typed_conditions(
                    conditions,
                    full_route_latent.shape[-2:],
                )
                route_index = condition_channel_order.index("terrain_path_ground")
                route_mask = typed_latent_conditions[
                    :, route_index:route_index + 1
                ].detach()
                clean_latent = no_route_latent + route_mask * (
                    full_route_latent - no_route_latent
                )
                expected_size = (
                    height // latent_downsample_factor,
                    width // latent_downsample_factor,
                )
                if clean_latent.shape[-2:] != expected_size:
                    raise ValueError(
                        "route counterfactual compositor output does not match the frozen latent boundary"
                    )
                if return_route_counterfactual_evidence:
                    return clean_latent, {
                        "fullRouteLatent": full_route_latent,
                        "noRouteLatent": no_route_latent,
                        "routeMask": route_mask,
                        "noRouteConditions": no_route_conditions,
                        "sharedParameterCopies": 1,
                    }
                return clean_latent
            if return_route_counterfactual_evidence:
                raise ValueError(
                    "route counterfactual evidence is unavailable for this native encoder"
                )
            native_features = self.native_condition_stem(conditions)
            half_features = self.native_condition_down1(native_features)
            latent_features = self.native_condition_down2(half_features)
            terminal_features = self.middle(latent_features)
            base_clean_latent = self.output(terminal_features)
            clean_latent = base_clean_latent
            masks = []
            residuals = []
            if self.responsibility_residual_heads is not None:
                typed_latent_conditions = resize_typed_conditions(
                    conditions,
                    base_clean_latent.shape[-2:],
                )
                for channel_id in direct_responsibility_residual_channels:
                    channel_index = condition_channel_order.index(channel_id)
                    mask = typed_latent_conditions[:, channel_index:channel_index + 1]
                    residual = self.responsibility_residual_heads[channel_id](
                        terminal_features
                    ) * mask
                    masks.append(mask)
                    residuals.append(residual)
                clean_latent = base_clean_latent + torch.stack(
                    residuals,
                    dim=0,
                ).sum(dim=0)
            elif return_responsibility_evidence:
                raise ValueError(
                    "native responsibility residual evidence is unavailable for the baseline native encoder"
                )
            expected_size = (
                height // latent_downsample_factor,
                width // latent_downsample_factor,
            )
            if clean_latent.shape[-2:] != expected_size:
                raise ValueError(
                    "native condition encoder output does not match the frozen latent boundary"
                )
            if return_responsibility_evidence:
                return clean_latent, {
                    "baseCleanLatent": base_clean_latent,
                    "responsibilityIdentityOrder": direct_responsibility_residual_channels,
                    "responsibilityMasks": tuple(masks),
                    "maskedResponsibilityResiduals": tuple(residuals),
                    "responsibilityParameterNamespace": (
                        "clean_latent_generator.responsibility_residual_heads"
                    ),
                    "outsideMaskMutationAllowed": False,
                    "freeBlendWeightsPresent": False,
                    "nativeConditionEncodingBeforeResiduals": True,
                }
            return clean_latent

    class ProjectOwnedStage4ResponsibilityComponentSystem(nn.Module):
        """One CPU-inactive responsibility component with a role-bound parameter namespace."""

        def __init__(self):
            super().__init__()
            self.autoencoder = ProjectOwnedAutoencoder()
            self.autoencoder.eval()
            for parameter in self.autoencoder.parameters():
                parameter.requires_grad_(False)
            self.stage4_responsibility_components = nn.ModuleDict({
                stage4_responsibility_component_role: ProjectOwnedMultiscaleConditionUNet(),
            })

        @property
        def denoiser(self):
            return self.stage4_responsibility_components[
                stage4_responsibility_component_role
            ]

        def predict_noise(self, noisy_latent, timestep, conditions):
            return self.denoiser(noisy_latent, timestep, conditions)

        def predict_velocity(self, noisy_latent, timestep, conditions):
            return self.denoiser(noisy_latent, timestep, conditions)

        def predict_velocity_with_stage4_semantic_mixture(self, noisy_latent, timestep, conditions):
            return self.denoiser(
                noisy_latent,
                timestep,
                conditions,
                return_stage4_semantic_mixture=True,
            )

        def reconstruct_conditions_from_clean_latent(self, predicted_clean):
            return self.denoiser.reconstruct_conditions_from_clean_latent(predicted_clean)

        def prepare_typed_conditions(self, conditions, latent_size):
            return self.denoiser.prepare_typed_conditions(conditions, latent_size)

        def stage4_semantic_mixture_identity_order(self):
            return self.denoiser.stage4_semantic_mixture_identity_order()

        def stage4_responsibility_component_role(self):
            return stage4_responsibility_component_role

        def stage4_responsibility_parameter_namespace(self):
            return (
                "stage4_responsibility_components."
                f"{stage4_responsibility_component_role}"
            )

        def decode_stage4_native_complete_rgb(self, latent):
            if stage4_responsibility_component_role != (
                "global_visual_harmonization_and_native_complete_rgb_decode"
            ):
                raise ValueError(
                    "native complete RGB decode belongs only to the final Stage 4 responsibility component"
                )
            return self.autoencoder.decode(latent)

    if denoiser_architecture in {
        direct_clean_latent_architecture,
        direct_responsibility_residual_architecture,
        native_condition_encoder_architecture,
        native_responsibility_residual_architecture,
        route_counterfactual_compositor_architecture,
    }:
        return ProjectOwnedDirectConditionCleanLatentSystem(
            responsibility_residuals=(
                denoiser_architecture == direct_responsibility_residual_architecture
            ),
            native_condition_encoder=(
                denoiser_architecture in {
                    native_condition_encoder_architecture,
                    native_responsibility_residual_architecture,
                    route_counterfactual_compositor_architecture,
                }
            ),
            native_responsibility_residuals=(
                denoiser_architecture == native_responsibility_residual_architecture
            ),
            route_counterfactual_compositor=(
                denoiser_architecture == route_counterfactual_compositor_architecture
            ),
        )
    if stage4_responsibility_component_role_explicit:
        return ProjectOwnedStage4ResponsibilityComponentSystem()
    return ProjectOwnedCompleteWorldSystem()
