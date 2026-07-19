from __future__ import annotations

import math

from ai_painter.training.torch_runtime import require_torch


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

    def group_count(channels: int) -> int:
        for groups in (32, 16, 8, 4, 2):
            if channels % groups == 0:
                return groups
        return 1

    def typed_condition_indices():
        if denoiser_architecture != "multiscale_condition_unet_v4":
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
        def __init__(self, channels: int, time_channels: int):
            super().__init__()
            self.norm1 = nn.GroupNorm(group_count(channels), channels)
            self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
            self.time_projection = nn.Linear(time_channels, channels)
            self.norm2 = nn.GroupNorm(group_count(channels), channels)
            self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)

        def forward(self, value, time_embedding):
            hidden = self.conv1(functional.silu(self.norm1(value)))
            hidden = hidden + self.time_projection(time_embedding).view(-1, hidden.shape[1], 1, 1)
            hidden = self.conv2(functional.silu(self.norm2(hidden)))
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
            self.block0 = TimeResidualBlock(channels, time_channels)

            self.latent_down1 = nn.Conv2d(channels, channels * 2, 4, stride=2, padding=1)
            self.condition_down1 = nn.Conv2d(channels, channels * 2, 4, stride=2, padding=1)
            self.fuse1 = nn.Conv2d(channels * 4, channels * 2, 1)
            self.block1 = TimeResidualBlock(channels * 2, time_channels)

            self.latent_down2 = nn.Conv2d(channels * 2, channels * 4, 4, stride=2, padding=1)
            self.condition_down2 = nn.Conv2d(channels * 2, channels * 4, 4, stride=2, padding=1)
            self.fuse2 = nn.Conv2d(channels * 8, channels * 4, 1)
            self.middle1 = TimeResidualBlock(channels * 4, time_channels)
            self.middle2 = TimeResidualBlock(channels * 4, time_channels)

            self.up1 = nn.ConvTranspose2d(channels * 4, channels * 2, 4, stride=2, padding=1)
            self.up_fuse1 = nn.Conv2d(channels * 4, channels * 2, 1)
            self.up_block1 = TimeResidualBlock(channels * 2, time_channels)
            self.up0 = nn.ConvTranspose2d(channels * 2, channels, 4, stride=2, padding=1)
            self.up_fuse0 = nn.Conv2d(channels * 2, channels, 1)
            self.up_block0 = TimeResidualBlock(channels, time_channels)
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

        def forward(self, noisy_latent, timestep, conditions, return_condition_reconstruction=False):
            if conditions.shape[1] != condition_channels:
                raise ValueError(f"expected {condition_channels} condition channels, got {conditions.shape[1]}")
            time_embedding = self.time_embedding(timestep)
            resized_conditions = resize_typed_conditions(conditions, noisy_latent.shape[-2:])
            condition0 = self.condition_stem(resized_conditions)
            level0 = self.block0(
                self.fuse0(torch.cat((self.latent_stem(noisy_latent), condition0), dim=1)),
                time_embedding,
            )
            condition1 = self.condition_down1(condition0)
            level1 = self.block1(
                self.fuse1(torch.cat((self.latent_down1(level0), condition1), dim=1)),
                time_embedding,
            )
            condition2 = self.condition_down2(condition1)
            middle = self.fuse2(torch.cat((self.latent_down2(level1), condition2), dim=1))
            middle = self.middle2(self.middle1(middle, time_embedding), time_embedding)

            up1 = self.up_block1(
                self.up_fuse1(torch.cat((self.up1(middle), level1), dim=1)),
                time_embedding,
            )
            up0 = self.up_block0(
                self.up_fuse0(torch.cat((self.up0(up1), level0), dim=1)),
                time_embedding,
            )
            predicted_velocity = self.output(up0)
            if return_condition_reconstruction:
                if self.condition_reconstruction is None:
                    raise ValueError("condition reconstruction is only available in the V4 denoiser")
                return predicted_velocity, self.condition_reconstruction(up0), resized_conditions
            return predicted_velocity

    class ProjectOwnedCompleteWorldSystem(nn.Module):
        def __init__(self):
            super().__init__()
            self.autoencoder = ProjectOwnedAutoencoder()
            if denoiser_architecture in {"multiscale_condition_unet_v3", "multiscale_condition_unet_v4"}:
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

    return ProjectOwnedCompleteWorldSystem()
