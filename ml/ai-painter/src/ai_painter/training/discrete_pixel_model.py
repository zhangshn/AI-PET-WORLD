from __future__ import annotations

from .torch_runtime import require_torch


def build_discrete_pixel_unet(config: dict[str, object]):
    torch = require_torch(); nn = torch.nn
    input_channels = int(config.get("inputChannels", 14))
    palette_size = int(config.get("paletteSize", 48))
    base = int(config.get("baseChannels", 32))

    class Block(nn.Module):
        def __init__(self, source: int, target: int) -> None:
            super().__init__()
            self.layers = nn.Sequential(nn.Conv2d(source, target, 3, padding=1), nn.GroupNorm(min(8, target), target), nn.SiLU(), nn.Conv2d(target, target, 3, padding=1), nn.GroupNorm(min(8, target), target), nn.SiLU())
        def forward(self, value): return self.layers(value)

    class Model(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.e1, self.e2, self.e3 = Block(input_channels, base), Block(base, base * 2), Block(base * 2, base * 4)
            self.center = Block(base * 4, base * 4); self.pool = nn.MaxPool2d(2)
            self.u3, self.d3 = nn.ConvTranspose2d(base * 4, base * 4, 2, 2), Block(base * 8, base * 2)
            self.u2, self.d2 = nn.ConvTranspose2d(base * 2, base * 2, 2, 2), Block(base * 4, base)
            self.u1, self.d1 = nn.ConvTranspose2d(base, base, 2, 2), Block(base * 2, base)
            self.output = nn.Conv2d(base, palette_size, 1)
        def forward(self, condition):
            l1 = self.e1(condition); l2 = self.e2(self.pool(l1)); l3 = self.e3(self.pool(l2)); center = self.center(self.pool(l3))
            d3 = self.d3(torch.cat((self.u3(center), l3), dim=1)); d2 = self.d2(torch.cat((self.u2(d3), l2), dim=1)); d1 = self.d1(torch.cat((self.u1(d2), l1), dim=1))
            return self.output(d1)
    return Model()
