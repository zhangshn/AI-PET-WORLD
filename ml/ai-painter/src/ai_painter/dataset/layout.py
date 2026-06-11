from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DatasetLayout:
    root: Path

    @property
    def incoming(self) -> Path:
        return self.root / "incoming"

    @property
    def accepted(self) -> Path:
        return self.root / "accepted" / "dataset_v0"

    @property
    def rejected(self) -> Path:
        return self.root / "rejected"

    @property
    def indexes(self) -> Path:
        return self.root / "indexes"

    @property
    def manifests(self) -> Path:
        return self.root / "manifests"

    def ensure(self) -> None:
        for path in (
            self.incoming,
            self.accepted / "images",
            self.accepted / "blueprints",
            self.accepted / "masks",
            self.accepted / "metadata",
            self.rejected,
            self.indexes,
            self.manifests,
        ):
            path.mkdir(parents=True, exist_ok=True)
