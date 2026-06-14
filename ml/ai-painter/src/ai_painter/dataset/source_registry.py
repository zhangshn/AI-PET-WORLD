from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from PIL import Image

from .hashing import sha256_file
from .layout import DatasetLayout


@dataclass(frozen=True)
class SourceAsset:
    asset_id: str
    path: Path
    sha256: str
    width: int
    height: int
    image_format: str
    source: str
    license: str


def register_source_originals(dataset_root: Path) -> dict[str, Any]:
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    assets: list[dict[str, Any]] = []
    for image_path in sorted(layout.source_originals.glob("**/*.png")):
        if image_path.name == "registry.json":
            continue
        sidecar = image_path.with_suffix(".source.json")
        data = _read_json(sidecar) if sidecar.is_file() else {}
        source = data.get("source") or data.get("toolName")
        license_basis = data.get("license") or data.get("licenseBasis")
        if not source or not license_basis:
            continue
        with Image.open(image_path) as image:
            image.verify()
        with Image.open(image_path) as image:
            assets.append({
                "id": image_path.stem,
                "path": image_path.relative_to(dataset_root).as_posix(),
                "source": source,
                "license": license_basis,
                "sha256": sha256_file(image_path),
                "width": image.width,
                "height": image.height,
                "format": image.format or "PNG",
                "immutable": True,
            })
    registry = {
        "schemaVersion": "source-asset-registry-v1",
        "generatedAt": _now(),
        "sourceOriginalCount": len(assets),
        "assets": assets,
    }
    layout.registry_path.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return registry


def load_registered_asset(dataset_root: Path, sample_id: str) -> SourceAsset:
    register_source_originals(dataset_root)
    registry = _read_json(DatasetLayout(dataset_root).registry_path)
    for item in registry.get("assets", []):
        if item.get("id") == sample_id:
            return SourceAsset(
                asset_id=sample_id,
                path=dataset_root / item["path"],
                sha256=item["sha256"],
                width=item["width"],
                height=item["height"],
                image_format=item["format"],
                source=item["source"],
                license=item["license"],
            )
    raise ValueError(f"source-original is not registered: {sample_id}")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
