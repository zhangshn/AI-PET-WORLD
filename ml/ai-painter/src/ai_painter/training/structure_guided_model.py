from __future__ import annotations

from .torch_runtime import require_torch


def build_structure_guided_unet(config: dict[str, object]):
    torch = require_torch()
    nn = torch.nn
    input_channels = int(config.get("inputChannels", 14))
    structure_channels = int(config.get("structureChannels", 14))
    base = int(config.get("baseChannels", 32))

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

    class StructureGuidedUNet(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.encoder_1 = ConvBlock(input_channels, base)
            self.encoder_2 = ConvBlock(base, base * 2)
            self.encoder_3 = ConvBlock(base * 2, base * 4)
            self.bottleneck = ConvBlock(base * 4, base * 4)
            self.pool = nn.MaxPool2d(2)
            self.up_3 = nn.ConvTranspose2d(base * 4, base * 4, 2, stride=2)
            self.decoder_3 = ConvBlock(base * 8, base * 2)
            self.up_2 = nn.ConvTranspose2d(base * 2, base * 2, 2, stride=2)
            self.decoder_2 = ConvBlock(base * 4, base)
            self.up_1 = nn.ConvTranspose2d(base, base, 2, stride=2)
            self.decoder_1 = ConvBlock(base * 2, base)
            self.structure_head = nn.Conv2d(base, structure_channels, 1)
            self.rgb_fusion = ConvBlock(base + structure_channels, base)
            self.rgb_head = nn.Sequential(nn.Conv2d(base, 3, 1), nn.Sigmoid())

        def forward(self, condition):
            level_1 = self.encoder_1(condition)
            level_2 = self.encoder_2(self.pool(level_1))
            level_3 = self.encoder_3(self.pool(level_2))
            center = self.bottleneck(self.pool(level_3))
            decoded_3 = self.decoder_3(torch.cat((self.up_3(center), level_3), dim=1))
            decoded_2 = self.decoder_2(torch.cat((self.up_2(decoded_3), level_2), dim=1))
            decoded_1 = self.decoder_1(torch.cat((self.up_1(decoded_2), level_1), dim=1))
            structure_logits = self.structure_head(decoded_1)
            structure = torch.sigmoid(structure_logits)
            rgb = self.rgb_head(self.rgb_fusion(torch.cat((decoded_1, structure), dim=1)))
            return rgb, structure_logits

    return StructureGuidedUNet()
