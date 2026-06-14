from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DatasetLayout:
    root: Path

    @property
    def source_originals(self) -> Path:
        return self.root / "source-originals"

    @property
    def incoming(self) -> Path:
        return self.root / "incoming"

    @property
    def accepted(self) -> Path:
        return self.root / "accepted" / "dataset_v1"

    @property
    def legacy_accepted(self) -> Path:
        return self.root / "accepted" / "dataset_v0"

    @property
    def quarantine(self) -> Path:
        return self.root / "annotation-quarantine"

    @property
    def rejected(self) -> Path:
        return self.root / "rejected"

    @property
    def indexes(self) -> Path:
        return self.root / "indexes"

    @property
    def manifests(self) -> Path:
        return self.root / "manifests"

    @property
    def registry_path(self) -> Path:
        return self.source_originals / "registry.json"

    def ensure(self) -> None:
        for path in (
            self.source_originals,
            self.incoming,
            self.quarantine,
            self.rejected,
            self.indexes,
            self.manifests,
        ):
            path.mkdir(parents=True, exist_ok=True)
        (self.accepted / "scene" / "world").mkdir(parents=True, exist_ok=True)
