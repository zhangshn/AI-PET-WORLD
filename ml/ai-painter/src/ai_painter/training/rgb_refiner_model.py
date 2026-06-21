from __future__ import annotations

from .torch_runtime import require_torch


def build_rgb_refiner(config: dict[str, object]):
    torch = require_torch()
    nn = torch.nn
    input_channels = int(config.get("inputChannels", 17))
    base = int(config.get("baseChannels", 48))
    block_count = int(config.get("residualBlocks", 6))
    model_version = str(config.get("modelVersion", ""))
    use_detail_pyramid = bool(config.get("detailPyramid", False)) or "v2" in model_version
    use_unet_detail = bool(config.get("unetDetailRefiner", False)) or "unet-v3" in model_version

    class ResidualBlock(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.layers = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(8, base), nn.SiLU(),
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(8, base),
            )

        def forward(self, value):
            return torch.nn.functional.silu(value + self.layers(value))

    class RGBRefiner(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.input = nn.Sequential(nn.Conv2d(input_channels, base, 3, padding=1), nn.SiLU())
            self.blocks = nn.Sequential(*(ResidualBlock() for _ in range(block_count)))
            self.detail = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=1), nn.SiLU(),
                nn.Conv2d(base, 3, 3, padding=1), nn.Tanh(),
            )
            self.residualScale = float(config.get("residualScale", 0.35))

        def forward(self, condition, base_rgb):
            features = self.blocks(self.input(torch.cat((condition, base_rgb), dim=1)))
            residual = self.detail(features) * self.residualScale
            return (base_rgb + residual).clamp(0, 1)

    class DetailPyramidRGBRefiner(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.input = nn.Sequential(nn.Conv2d(input_channels, base, 3, padding=1), nn.SiLU())
            self.blocks = nn.Sequential(*(ResidualBlock() for _ in range(block_count)))
            self.detail1 = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.detail2 = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=2, dilation=2),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.detail4 = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=4, dilation=4),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.fuse = nn.Sequential(
                nn.Conv2d(base * 3, base, 1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.edge = nn.Sequential(
                nn.Conv2d(base, base // 2, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(base // 2, 3, 3, padding=1),
                nn.Tanh(),
            )
            self.color = nn.Sequential(
                nn.Conv2d(base, base, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(base, 3, 3, padding=1),
                nn.Tanh(),
            )
            self.residualScale = float(config.get("residualScale", 0.32))
            self.edgeResidualScale = float(config.get("edgeResidualScale", 0.14))

        def forward(self, condition, base_rgb):
            features = self.blocks(self.input(torch.cat((condition, base_rgb), dim=1)))
            detail = self.fuse(torch.cat((self.detail1(features), self.detail2(features), self.detail4(features)), dim=1))
            color_residual = self.color(detail) * self.residualScale
            edge_residual = self.edge(features - detail).mul(self.edgeResidualScale)
            return (base_rgb + color_residual + edge_residual).clamp(0, 1)

    class UNetDetailRGBRefiner(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.enc0 = nn.Sequential(
                nn.Conv2d(input_channels, base, 3, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.down1 = nn.Sequential(
                nn.Conv2d(base, base * 2, 3, stride=2, padding=1),
                nn.GroupNorm(8, base * 2),
                nn.SiLU(),
            )
            self.mid = nn.Sequential(
                *(MidResidualBlock(base * 2) for _ in range(max(4, block_count // 2)))
            )
            self.up1 = nn.Sequential(
                nn.ConvTranspose2d(base * 2, base, 4, stride=2, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.fuse = nn.Sequential(
                nn.Conv2d(base * 2, base, 3, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
                nn.Conv2d(base, base, 3, padding=1),
                nn.GroupNorm(8, base),
                nn.SiLU(),
            )
            self.head = nn.Sequential(
                nn.Conv2d(base, base // 2, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(base // 2, 3, 3, padding=1),
                nn.Tanh(),
            )
            self.direct_head = nn.Sequential(
                nn.Conv2d(base, base // 2, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(base // 2, 3, 3, padding=1),
            )
            self.residualScale = float(config.get("residualScale", 0.75))
            self.directOutput = bool(config.get("directOutput", False))

        def forward(self, condition, base_rgb):
            value = torch.cat((condition, base_rgb), dim=1)
            enc0 = self.enc0(value)
            mid = self.mid(self.down1(enc0))
            up = self.up1(mid)
            fused = self.fuse(torch.cat((up, enc0), dim=1))
            if self.directOutput:
                return torch.sigmoid(self.direct_head(fused))
            residual = self.head(fused) * self.residualScale
            return (base_rgb + residual).clamp(0, 1)

    class MidResidualBlock(nn.Module):
        def __init__(self, channels: int) -> None:
            super().__init__()
            self.layers = nn.Sequential(
                nn.Conv2d(channels, channels, 3, padding=1),
                nn.GroupNorm(8, channels),
                nn.SiLU(),
                nn.Conv2d(channels, channels, 3, padding=1),
                nn.GroupNorm(8, channels),
            )

        def forward(self, value):
            return torch.nn.functional.silu(value + self.layers(value))

    if use_unet_detail:
        return UNetDetailRGBRefiner()
    if use_detail_pyramid:
        return DetailPyramidRGBRefiner()
    return RGBRefiner()
