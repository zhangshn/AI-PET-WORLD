from __future__ import annotations

from .torch_runtime import require_torch


def build_tiny_unet(config: dict[str, object]):
    torch = require_torch()
    nn = torch.nn
    input_channels = int(config.get("inputChannels", 8))
    output_channels = int(config.get("outputChannels", 3))
    base = int(config.get("baseChannels", 32))
    upsample_mode = str(config.get("upsampleMode", "transpose"))
    mid_blocks = int(config.get("midBlocks", 0))
    detail_blocks = int(config.get("decoderDetailBlocks", 0))

    class ConvBlock(nn.Module):
        def __init__(self, source: int, target: int) -> None:
            super().__init__()
            groups = min(8, target)
            self.layers = nn.Sequential(
                nn.Conv2d(source, target, 3, padding=1),
                nn.GroupNorm(groups, target), nn.SiLU(),
                nn.Conv2d(target, target, 3, padding=1),
                nn.GroupNorm(groups, target), nn.SiLU(),
            )

        def forward(self, value):
            return self.layers(value)

    class ResidualBlock(nn.Module):
        def __init__(self, channels: int) -> None:
            super().__init__()
            groups = min(8, channels)
            self.layers = nn.Sequential(
                nn.Conv2d(channels, channels, 3, padding=1),
                nn.GroupNorm(groups, channels),
                nn.SiLU(),
                nn.Conv2d(channels, channels, 3, padding=1),
                nn.GroupNorm(groups, channels),
            )

        def forward(self, value):
            return torch.nn.functional.silu(value + self.layers(value))

    class UpsampleBlock(nn.Module):
        def __init__(self, source: int, target: int) -> None:
            super().__init__()
            if upsample_mode == "bilinear":
                self.layers = nn.Sequential(
                    nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
                    nn.Conv2d(source, target, 3, padding=1),
                    nn.GroupNorm(min(8, target), target),
                    nn.SiLU(),
                )
            else:
                self.layers = nn.ConvTranspose2d(source, target, 2, stride=2)

        def forward(self, value):
            return self.layers(value)

    class TinyUNet(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.condition_encoder = ConvBlock(input_channels, base)
            self.encoder_2 = ConvBlock(base, base * 2)
            self.encoder_3 = ConvBlock(base * 2, base * 4)
            self.bottleneck = nn.Sequential(
                ConvBlock(base * 4, base * 4),
                *(ResidualBlock(base * 4) for _ in range(mid_blocks)),
            )
            self.pool = nn.MaxPool2d(2)
            self.up_3 = UpsampleBlock(base * 4, base * 4)
            self.decoder_3 = ConvBlock(base * 8, base * 2)
            self.up_2 = UpsampleBlock(base * 2, base * 2)
            self.decoder_2 = ConvBlock(base * 4, base)
            self.up_1 = UpsampleBlock(base, base)
            self.decoder_1 = nn.Sequential(
                ConvBlock(base * 2, base),
                *(ResidualBlock(base) for _ in range(detail_blocks)),
            )
            self.output = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(min(8, base), base),
                nn.SiLU(),
                nn.Conv2d(base, output_channels, 1),
                nn.Sigmoid(),
            )

        def forward(self, condition):
            level_1 = self.condition_encoder(condition)
            level_2 = self.encoder_2(self.pool(level_1))
            level_3 = self.encoder_3(self.pool(level_2))
            center = self.bottleneck(self.pool(level_3))
            decoded_3 = self.decoder_3(torch.cat((self.up_3(center), level_3), dim=1))
            decoded_2 = self.decoder_2(torch.cat((self.up_2(decoded_3), level_2), dim=1))
            decoded_1 = self.decoder_1(torch.cat((self.up_1(decoded_2), level_1), dim=1))
            return self.output(decoded_1)

    return TinyUNet()
