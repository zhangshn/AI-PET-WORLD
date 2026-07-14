from __future__ import annotations

from ai_painter.training.torch_runtime import require_torch


def build_complete_world_system(config: dict[str, object]):
    """Build the project-owned complete-world model with newly initialized weights."""
    torch = require_torch()
    nn = torch.nn
    functional = torch.nn.functional
    base = int(config.get("baseChannels", 64))
    latent_channels = int(config.get("latentChannels", 4))
    condition_channels = int(config.get("conditionChannels", 23))

    class ResidualBlock(nn.Module):
        def __init__(self, channels: int):
            super().__init__()
            groups = max(1, min(8, channels // 8))
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
            self.layers = nn.Sequential(
                nn.Conv2d(condition_channels, base, 5, padding=2),
                nn.SiLU(),
                ResidualBlock(base),
                nn.Conv2d(base, base * 2, 4, stride=2, padding=1),
                ResidualBlock(base * 2),
                nn.Conv2d(base * 2, base * 4, 4, stride=2, padding=1),
                ResidualBlock(base * 4),
                nn.Conv2d(base * 4, base * 4, 4, stride=2, padding=1),
                ResidualBlock(base * 4),
            )

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

    class ProjectOwnedCompleteWorldSystem(nn.Module):
        def __init__(self):
            super().__init__()
            self.autoencoder = ProjectOwnedAutoencoder()
            self.denoiser = ProjectOwnedDenoiser()

        def predict_noise(self, noisy_latent, timestep, conditions):
            return self.denoiser(noisy_latent, timestep, conditions)

    return ProjectOwnedCompleteWorldSystem()
