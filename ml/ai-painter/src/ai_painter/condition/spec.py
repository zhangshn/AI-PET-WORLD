from dataclasses import dataclass

CONDITION_CHANNELS = (
    "grass",
    "water",
    "road",
    "tree",
    "rock",
    "shelter",
    "walkable",
    "depth",
)


@dataclass(frozen=True)
class ConditionTensorSpec:
    version: str = "condition-tensor-v0"
    width: int = 256
    height: int = 192
    channels: tuple[str, ...] = CONDITION_CHANNELS
    value_min: float = 0.0
    value_max: float = 1.0

    @property
    def channel_count(self) -> int:
        return len(self.channels)
