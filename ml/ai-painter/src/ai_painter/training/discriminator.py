from __future__ import annotations

from .torch_runtime import require_torch


def build_patch_discriminator(condition_channels: int = 8, image_channels: int = 3, base: int = 32):
    torch = require_torch()
    nn = torch.nn

    def block(source: int, target: int, normalize: bool = True):
        layers = [nn.Conv2d(source, target, 4, stride=2, padding=1)]
        if normalize:
            layers.append(nn.GroupNorm(min(8, target), target))
        layers.append(nn.LeakyReLU(0.2, inplace=True))
        return layers

    return nn.Sequential(
        *block(condition_channels + image_channels, base, False),
        *block(base, base * 2),
        *block(base * 2, base * 4),
        nn.Conv2d(base * 4, base * 4, 4, stride=1, padding=1),
        nn.LeakyReLU(0.2, inplace=True),
        nn.Conv2d(base * 4, 1, 4, stride=1, padding=1),
    )
