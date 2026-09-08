"""Content-addressed, inactive split packages for the Stage4 V2 successor.

The frozen 64-row release is provenance, never a training permission. This
module has no GPU, optimizer, current-registry or capability-publication API.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import io
import json
import math
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

PARENT = {
    "path": "data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json",
    "sha256": "cd6b7e3fe70549788159237a86f1ab7144ee39db6cc011abaac43b6e5e15affc",
}
COUNTS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
PACKAGE_ROOT = "data/world-samples/ai-assisted-cold-start-dataset-packages"
SCHEMA = "ai-painter-stage4-v2-independent-split-package-v1"
REQUIREMENTS = ["AP-TRAIN-001", "AP-TRAIN-002", "AP-CHANGE-004"]


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def project_file(root: Path, logical: str) -> Path:
    """Permit only the project's declared .runtime hot-storage mount."""
    root = root.resolve()
    if (not isinstance(logical, str) or not logical or "\\" in logical
            or PureWindowsPath(logical).drive or PurePosixPath(logical).is_absolute()
            or any(part in {"", ".", "..", "latest", "latest.json"} for part in logical.split("/"))):
        raise ValueError("invalid explicit project path")
    target = root.joinpath(*logical.split("/"))
    allowed = (root / ".runtime").resolve() if logical.startswith(".runtime/") else root
    if not target.resolve().is_relative_to(allowed):
        raise ValueError("project path escapes its declared storage root")
    return target


def read_bound(root: Path, binding: dict) -> bytes:
    expected = binding.get("sha256", "")
    if len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        raise ValueError("SHA-256 binding missing")
    data = project_file(root, binding["path"]).read_bytes()
    if digest(data) != expected:
        raise ValueError("SHA-256 mismatch: " + binding["path"])
    return data


def bound_json(root: Path, binding: dict) -> dict:
    value = json.loads(read_bound(root, binding))
    if not isinstance(value, dict):
        raise ValueError("expected JSON object")
    return value


def _binding(path: str, data: bytes) -> dict:
    return {"path": path, "sha256": digest(data)}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _parent_binding(value: dict | None) -> dict:
    # The default preserves the original candidate byte-for-byte. An explicitly
    # supplied version never falls back to it, even when that version is invalid.
    binding = deepcopy(PARENT if value is None else value)
    _require(isinstance(binding, dict) and set(binding) == {"path", "sha256"},
             "parent release requires an explicit path and SHA-256")
    _require(isinstance(binding["path"], str) and bool(binding["path"])
             and isinstance(binding["sha256"], str) and len(binding["sha256"]) == 64
             and all(c in "0123456789abcdef" for c in binding["sha256"]),
             "parent release binding is invalid")
    return binding


def collect_parent_rows(root: Path, *, parent_binding: dict | None = None) -> tuple[dict, list[dict], dict]:
    """Recompute every selected image, pack, channel and provenance binding."""
    parent = bound_json(root, _parent_binding(parent_binding))
    _require(parent.get("schemaVersion") == "ai-painter-stage4-v2-dataset-release-contract-v1",
             "parent release schema mismatch")
    _require(parent.get("immutable") is True and parent.get("status") == "verified_dataset_release",
             "parent release is not immutable")
    manifest = bound_json(root, parent["sourcePackage"]["manifest"])
    source = bound_json(root, parent["sourcePackage"]["sourceIndex"])
    condition = bound_json(root, parent["conditionContractBinding"])
    _require(manifest.get("schemaVersion") == "ai-assisted-cold-start-dataset-package-v1"
             and source.get("schemaVersion") == "ai-assisted-cold-start-dataset-source-index-v1",
             "parent source schema mismatch")
    _require(manifest["packageId"] == parent["sourcePackage"]["packageId"], "parent package mismatch")
    _require(source.get("packageId") == manifest["packageId"], "source index package identity mismatch")
    _require(manifest["sourceIndexPath"] == parent["sourcePackage"]["sourceIndex"]["path"],
             "source index path mismatch")
    source_count = manifest["sampleCount"]
    _require(type(source_count) is int and source_count >= 64
             and isinstance(source.get("samples"), list)
             and len(source["samples"]) == source.get("sampleCount")
             == parent["sourcePackage"].get("packageSampleCount") == source_count,
             "source capacity mismatch")
    _require(len({sample["sampleId"] for sample in source["samples"]}) == source_count,
             "duplicate source sample identity")
    _require(len(parent["samples"]) == len(source["v7CapacityContributions"]) == 64,
             "released capacity mismatch")
    _require(parent["releaseScope"]["splitCounts"] == COUNTS, "parent split counts mismatch")
    channel_order = condition["tensorContract"]["channelOrder"]
    definitions = {item["id"]: item for item in condition["channelDefinitions"]}
    _require(len(channel_order) == len(set(channel_order)) == len(definitions) == 23
             and set(channel_order) == set(definitions), "condition definition count mismatch")
    rows = []
    for offset, item in enumerate(parent["samples"]):
        _require(type(item["sourceSampleIndex"]) is int and 0 <= item["sourceSampleIndex"] < source_count,
                 "source sample index outside bound source collection")
        sample = source["samples"][item["sourceSampleIndex"]]
        contribution = source["v7CapacityContributions"][offset]
        _require(item["ordinal"] == offset + 1 and item["sourceContributionIndex"] == offset,
                 "release ordinal mismatch")
        _require(item["sampleId"] == sample["sampleId"] == contribution["sampleId"], "sample identity mismatch")
        _require(item["split"] == sample["split"] == contribution["split"], "source split mismatch")
        _require(item["image"] == {"path": sample["imagePath"], "sha256": sample["imageSha256"]},
                 "source image mismatch")
        _require(item["conditionPack"]["path"] == sample["conditionPackPath"], "source condition mismatch")
        _require(item["contribution"] == {"path": sample["v7CapacityContributionPath"],
                                          "sha256": sample["v7CapacityContributionSha256"]},
                 "source contribution mismatch")
        read_bound(root, item["image"])
        evidence = bound_json(root, item["contribution"])
        pack = bound_json(root, item["conditionPack"])
        _require(evidence["conditionPackFileSha256"] == item["conditionPack"]["sha256"],
                 "contribution condition mismatch")
        _require([c["id"] for c in pack["channels"]] == channel_order, "condition channel order mismatch")
        for channel in pack["channels"]:
            _require(channel["shape"] == [1, 768, 1024] and channel["dtype"] == "uint8"
                     and channel["valueRange"] == [0, 255], "condition storage mismatch")
            read_bound(root, channel)
        # The legacy producer binds the sorted JSON payload WITHOUT packageSha256,
        # not file bytes. Verify that meaning first, then add a separate byte hash
        # in this successor. Never overwrite the old source-index field.
        region_path = sample["realEarthRegionSourcePackagePath"]
        region_bytes = project_file(root, region_path).read_bytes()
        region = json.loads(region_bytes)
        content = {k: v for k, v in region.items() if k != "packageSha256"}
        content_sha = digest(canonical_bytes(content))
        _require(content_sha == region.get("packageSha256") == sample["realEarthRegionSourcePackageSha256"],
                 "region source canonical payload mismatch: " + region_path)
        region_binding = {"path": region_path, "sha256": digest(region_bytes),
                          "contentSha256": content_sha,
                          "contentHashAlgorithm": "sorted_json_without_packageSha256_v1"}
        record_binding = {"path": sample["sourceRecordPath"], "sha256": sample["sourceRecordSha256"]}
        record = bound_json(root, record_binding)
        _require(record["conditionBinding"]["structuralIdentities"] == sample["structuralIdentities"],
                 "source structural identity mismatch")
        row = {**deepcopy(item), "conditionLabel": sample["conditionLabel"],
               "monsoonSeason": sample.get("classification", {}).get("monsoonSeason"),
               "sourceRecord": record_binding, "regionSource": region_binding,
               "grouping": {
                   "worldId": sample["conditionWorldId"],
                   "theme": sample["structuralIdentities"]["themeArchitectureIdentity"],
                   "instance": sample["structuralIdentities"]["instanceDetailIdentity"],
                   "conditionTensorContent": digest(canonical_bytes([
                       {"id": c["id"], "sha256": c["sha256"]} for c in pack["channels"]])),
                   "coordinateReference": region["identity"]["coordinateReference"],
                   "sourceWindow": region["identity"]["spatialBounds"],
               }}
        rows.append(row)
    validate_groups(rows)
    return parent, rows, {"channelOrder": channel_order,
                         "continuousChannelIds": [key for key in channel_order if definitions[key]["type"] == "continuous"]}


def validate_groups(rows: list[dict]) -> None:
    _require(len(rows) == 64 and len({r["sampleId"] for r in rows}) == 64, "duplicate or missing sample")
    _require({s: sum(r["split"] == s for r in rows) for s in COUNTS} == COUNTS, "split count mismatch")
    # A new parent binding is provenance, not an exemption from capacity rules.
    for role in ("image", "conditionPack"):
        for field in ("path", "sha256"):
            values = [row[role][field] for row in rows]
            _require(len(set(values)) == 64, "duplicate capacity asset: " + role + "." + field)
    groups: dict[tuple, str] = {}
    for row in rows:
        group = row["grouping"]
        keys = {"image": row["image"]["sha256"], **{k: group[k] for k in
                 ("worldId", "theme", "instance", "conditionTensorContent")}}
        for kind, value in keys.items():
            _require(isinstance(value, str) and bool(value), "grouping identity missing")
            key = (kind, value)
            _require(key not in groups or groups[key] == row["split"], "cross-split identity leakage: " + kind)
            groups[key] = row["split"]
        box = group["sourceWindow"]
        _require(group["coordinateReference"] == "EPSG:4326", "unsupported source-window CRS")
        _require(all(type(box.get(k)) in (int, float) and math.isfinite(box[k]) for k in
                     ("west", "east", "south", "north")), "source window missing")
        _require(-180 <= box["west"] < box["east"] <= 180 and -90 <= box["south"] < box["north"] <= 90,
                 "invalid source window")
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            if a["split"] == b["split"]:
                continue
            x, y = a["grouping"]["sourceWindow"], b["grouping"]["sourceWindow"]
            overlap = min(x["east"], y["east"]) > max(x["west"], y["west"]) and \
                min(x["north"], y["north"]) > max(x["south"], y["south"])
            _require(not overlap, "cross-split source-window overlap")


def build_package(root: Path, *, parent_binding: dict | None = None) -> tuple[dict, dict[str, bytes]]:
    parent_binding = _parent_binding(parent_binding)
    parent, rows, channels = collect_parent_rows(root, parent_binding=parent_binding)
    artifacts = {"source-index.json": canonical_bytes({
        "schemaVersion": "ai-painter-stage4-v2-split-source-index-v1", "samples": rows,
        "sampleCount": 64, "parentSourceIndex": parent["sourcePackage"]["sourceIndex"],
    }) + b"\n"}
    for split in COUNTS:
        artifacts[f"splits/{split}.json"] = canonical_bytes({
            "schemaVersion": "ai-painter-stage4-v2-split-membership-v1", "split": split,
            "sampleIds": [r["sampleId"] for r in rows if r["split"] == split],
        }) + b"\n"
    identity_payload = {
        "schemaVersion": SCHEMA, "parentRelease": parent_binding,
        "sourceManifest": parent["sourcePackage"]["manifest"],
        "sourceIndex": parent["sourcePackage"]["sourceIndex"],
        "conditionContract": parent["conditionContractBinding"],
        "artifactHashes": {name: digest(data) for name, data in sorted(artifacts.items())},
        "selectionReproductionSha256": digest(canonical_bytes(rows)), "splitCounts": COUNTS,
        **channels,
    }
    identity = "stage4-v2-split64-" + digest(canonical_bytes(identity_payload))
    directory = f"{PACKAGE_ROOT}/{identity}"
    manifest = {
        "schemaVersion": SCHEMA, "packageId": identity, "datasetReleaseIdentity": identity,
        "status": "immutable_split_candidate_not_training_qualified", "immutable": True,
        "requirements": REQUIREMENTS, "identityPayload": identity_payload,
        "sampleCount": 64, "splitCounts": COUNTS,
        "sourceIndex": _binding(f"{directory}/source-index.json", artifacts["source-index.json"]),
        "splits": {s: _binding(f"{directory}/splits/{s}.json", artifacts[f"splits/{s}.json"]) for s in COUNTS},
        "qualification": {
            "exactIdentityAndWindowIsolationChecked": True,
            "transformedOrSemanticNearDuplicateQualified": False,
            "historicalExposureAudited": False, "trainingAllowed": False,
            "capabilityBindingRequired": True, "modelQualified": False,
        },
    }
    artifacts["manifest.json"] = canonical_bytes(manifest) + b"\n"
    return manifest, artifacts


def materialize_package(root: Path, *, parent_binding: dict | None = None) -> dict:
    manifest, artifacts = build_package(root, parent_binding=parent_binding)
    relative = f"{PACKAGE_ROOT}/{manifest['packageId']}"
    directory = project_file(root, relative)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / ".materialization.lock"
    # A crashed writer leaves a visible lock: no implicit deletion or takeover.
    with lock.open("x", encoding="utf-8") as stream:
        stream.write(str(os.getpid()))
        stream.flush()
        os.fsync(stream.fileno())
    try:
        # Verify all existing bytes before adding anything to a partial package.
        for name, data in artifacts.items():
            target = project_file(root, f"{relative}/{name}")
            if target.exists():
                _require(target.read_bytes() == data, "immutable package conflict: " + name)
        for name, data in artifacts.items():  # Manifest is the final commit marker.
            target = project_file(root, f"{relative}/{name}")
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                with target.open("xb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
        return _binding(f"{relative}/manifest.json", artifacts["manifest.json"])
    finally:
        lock.unlink()  # Only the exact ephemeral lock created above, never data.


def load_package(root: Path, binding: dict) -> tuple[dict, list[dict]]:
    manifest = bound_json(root, binding)
    _require(manifest.get("schemaVersion") == SCHEMA, "split package schema mismatch")
    # Never select the old default during a read. The immutable manifest itself
    # must bind the precise source version used to derive this candidate.
    parent_binding = manifest.get("identityPayload", {}).get("parentRelease")
    _require(parent_binding is not None, "split package parent release binding missing")
    expected, artifacts = build_package(root, parent_binding=parent_binding)
    _require(manifest == expected, "split package does not reproduce its parent identity")
    relative = f"{PACKAGE_ROOT}/{manifest['packageId']}"
    _require(binding["path"] == relative + "/manifest.json", "split package namespace mismatch")
    for name, data in artifacts.items():
        _require(project_file(root, relative + "/" + name).read_bytes() == data,
                 "split package bytes mismatch: " + name)
    rows = json.loads(artifacts["source-index.json"])["samples"]
    return manifest, rows


class SplitReleaseDataset:
    """CPU-readable candidate Dataset; it does not confer execution eligibility.

    Rows are selected from all four bound files, not historical approval flags.
    Frozen files are hashed at construction and again when consumed.
    """
    def __init__(self, root: Path, binding: dict, split: str, image_size: tuple[int, int]):
        _require(split in COUNTS, "unknown split")
        _require(image_size in ((256, 192), (512, 384), (1024, 768)), "unsupported resolution")
        self.root, self.binding = root.resolve(), deepcopy(binding)
        manifest, rows = load_package(self.root, binding)
        membership = bound_json(self.root, manifest["splits"][split])
        by_id = {row["sampleId"]: row for row in rows}
        self._rows = [deepcopy(by_id[key]) for key in membership["sampleIds"]]
        _require(all(row["split"] == split for row in self._rows), "Dataset split mismatch")
        self.split, self.image_size = split, image_size
        self.manifest = manifest
        self.selection_sha256 = digest(canonical_bytes(self._rows))

    @property
    def rows(self):
        return deepcopy(self._rows)

    def __len__(self):
        return len(self._rows)

    def __getitem__(self, index):
        import numpy as np
        import torch
        from PIL import Image
        row = self._rows[index]
        pack = bound_json(self.root, row["conditionPack"])
        contract = self.manifest["identityPayload"]
        _require([c["id"] for c in pack["channels"]] == contract["channelOrder"], "channel order changed")

        def pixels(binding, mode, resampling):
            with Image.open(io.BytesIO(read_bound(self.root, binding))) as image:
                _require(image.size == (1024, 768), "native image dimensions mismatch")
                return np.asarray(image.convert(mode).resize(self.image_size, resample=resampling),
                                  dtype=np.uint8).copy()

        image = pixels(row["image"], "RGB", Image.Resampling.LANCZOS)
        channels = [pixels(channel, "L", Image.Resampling.BILINEAR
                           if channel["id"] in contract["continuousChannelIds"] else Image.Resampling.NEAREST)
                    for channel in pack["channels"]]
        return {
            "sampleId": row["sampleId"], "split": self.split,
            "datasetReleaseIdentity": self.manifest["datasetReleaseIdentity"],
            "conditionLabel": row["conditionLabel"], "conditionPackPath": row["conditionPack"]["path"],
            "monsoonSeason": row["monsoonSeason"],
            "image": torch.from_numpy(image).permute(2, 0, 1).float().div(255.0),
            "conditions": torch.stack([torch.from_numpy(c).float().div(255.0) for c in channels]),
        }
