from __future__ import annotations


def build_quality_judge_model():
    import torch.nn as nn

    class TinyQualityJudge(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.features = nn.Sequential(
                _block(nn, 3, 24),
                _block(nn, 24, 48),
                _block(nn, 48, 96),
                _block(nn, 96, 128),
                nn.AdaptiveAvgPool2d(1),
            )
            self.classifier = nn.Sequential(nn.Flatten(), nn.Dropout(0.15), nn.Linear(128, 2))

        def forward(self, image):
            return self.classifier(self.features(image))

    return TinyQualityJudge()


def _block(nn, input_channels: int, output_channels: int):
    return nn.Sequential(
        nn.Conv2d(input_channels, output_channels, 3, padding=1, bias=False),
        nn.BatchNorm2d(output_channels),
        nn.SiLU(inplace=True),
        nn.Conv2d(output_channels, output_channels, 3, stride=2, padding=1, bias=False),
        nn.BatchNorm2d(output_channels),
        nn.SiLU(inplace=True),
    )
