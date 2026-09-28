"""Pure CPU V17 responsibility archive codec; no files, inference or qualification.

The caller reads the bound interface and archive bytes, supplies independently
verified expected identity, and owns any exclusive artifact write. Successful
decoding proves byte/identity consistency only, never model or review eligibility.
"""
from __future__ import annotations

import hashlib
import json
import re
import zlib
from collections.abc import Mapping

import numpy as np


INTERFACE_ID = "stage4-mvp-structured-object-v17-review-pack-schema-v1"
FORMAT = "zlib_compressed_float32_le_chw_concat_v1"
IDENTITY_FIELDS = ("worldId", "regionId", "tick", "factHash", "visualFactManifestSha256",
                   "conditionPackSha256", "modelStateSha256")
ROLE_IDS = frozenset(("terrain_path_ground", "terrain_water", "terrain_shoreline",
                      "object_footprints", "object_tree", "object_rock", "object_vegetation"))


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _valid_sha(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _path(value):
    _require(isinstance(value, str) and value and "\\" not in value
             and ":" not in value and not any(ord(c) < 32 for c in value)
             and all(p not in ("", ".", "..", "latest", "latest.json")
                     for p in value.split("/")), "archive path must be explicit project-relative")


def _identity(value):
    _require(isinstance(value, Mapping) and all(k in value for k in IDENTITY_FIELDS),
             "expected identity fields missing")
    for key in ("worldId", "regionId"):
        _require(isinstance(value[key], str) and value[key].strip(), "invalid " + key)
    _require(type(value["tick"]) is int and 0 <= value["tick"] <= 2**53 - 1,
             "tick must be a nonnegative interoperable integer")
    _require(all(_valid_sha(value[k]) for k in IDENTITY_FIELDS[3:]), "invalid identity SHA-256")
    return {k: value[k] for k in IDENTITY_FIELDS}


def load_interface(schema_bytes, schema_sha256, candidate_pack_schema_version):
    """Require the caller-bound interface, never a default or inferred schema."""
    _require(isinstance(schema_bytes, bytes) and _valid_sha(schema_sha256)
             and _sha(schema_bytes) == schema_sha256, "interface SHA-256 mismatch")
    schema = json.loads(schema_bytes)
    _require(schema.get("schemaVersion") == INTERFACE_ID, "unsupported interface")
    _require(schema.get("candidatePackSchemaVersion") == candidate_pack_schema_version
             and isinstance(candidate_pack_schema_version, str), "candidate pack schema mismatch")
    roles = schema.get("requiredResponsibilityIds")
    _require(isinstance(roles, list) and len(roles) == 7 and set(roles) == ROLE_IDS,
             "interface responsibility roles differ")
    spec = schema.get("responsibilityEvidence", {})
    _require(all(key in spec.get("requiredFields", []) for key in IDENTITY_FIELDS),
             "interface identity fields missing")
    _require(spec.get("tensorFormat") == FORMAT
             and spec.get("tensorShapePerRole") == [8, 192, 256]
             and spec.get("responsibilityImplementationMode") == "declared_shared_substrate"
             and spec.get("roleSha256Rule") == "sha256_of_each_uncompressed_float32_le_chw_role_slice"
             and spec.get("archiveRule") == "decompress_then_verify_exact_size_order_and_each_role_sha256",
             "unsupported responsibility tensor interface")
    return schema


def encode_responsibility_artifact(tensors, *, identity, archive_path, schema_bytes,
                                   schema_sha256, candidate_pack_schema_version):
    """Return (zlib bytes, evidence); accepts CPU torch or numpy float tensors."""
    schema = load_interface(schema_bytes, schema_sha256, candidate_pack_schema_version)
    identity = _identity(identity)
    _path(archive_path)
    roles = schema["requiredResponsibilityIds"]
    _require(isinstance(tensors, Mapping) and set(tensors) == set(roles), "tensor roles differ")
    slices, hashes = [], {}
    for role in roles:
        tensor = tensors[role]
        if not isinstance(tensor, np.ndarray):
            import torch
            _require(isinstance(tensor, torch.Tensor) and tensor.device.type == "cpu"
                     and tensor.is_floating_point(), "requires a CPU floating tensor")
            tensor = tensor.detach().to(dtype=torch.float32).numpy()
        _require(tensor.shape == (1, 8, 192, 256) and tensor.dtype.kind == "f",
                 "role tensor shape or dtype differs: " + role)
        with np.errstate(over="ignore", invalid="ignore"):
            array = np.asarray(tensor, dtype="<f4", order="C")
        _require(bool(np.isfinite(array).all()), "nonfinite float32 tensor: " + role)
        raw = array.tobytes(order="C")
        slices.append(raw)
        hashes[role] = _sha(raw)
    archive = zlib.compress(b"".join(slices))
    spec = schema["responsibilityEvidence"]
    evidence = {**identity,
                "responsibilityImplementationMode": spec["responsibilityImplementationMode"],
                "tensorArchive": {"path": archive_path, "sha256": _sha(archive)},
                "tensorFormat": spec["tensorFormat"],
                "tensorShapePerRole": list(spec["tensorShapePerRole"]),
                "roleOrder": list(roles), "roleSha256": hashes}
    return archive, evidence


def decode_responsibility_artifact(archive_bytes, evidence, *, expected_identity,
                                   schema_bytes, schema_sha256, candidate_pack_schema_version):
    """Verify all seven slices before returning independent float32 CHW arrays."""
    schema = load_interface(schema_bytes, schema_sha256, candidate_pack_schema_version)
    expected = _identity(expected_identity)
    spec, roles = schema["responsibilityEvidence"], schema["requiredResponsibilityIds"]
    _require(isinstance(evidence, Mapping) and all(k in evidence for k in spec["requiredFields"]),
             "responsibility evidence fields missing")
    _require(_identity(evidence) == expected, "responsibility identity mismatch")
    for key in ("tensorFormat", "tensorShapePerRole", "responsibilityImplementationMode"):
        _require(evidence[key] == spec[key], key + " differs")
    _require(evidence["roleOrder"] == roles, "role order differs")
    hashes = evidence["roleSha256"]
    _require(isinstance(hashes, Mapping) and set(hashes) == set(roles)
             and all(_valid_sha(v) for v in hashes.values()), "role SHA-256 map differs")
    binding = evidence["tensorArchive"]
    _require(isinstance(binding, Mapping) and set(binding) == {"path", "sha256"},
             "archive binding differs")
    _path(binding["path"])
    _require(isinstance(archive_bytes, bytes) and _valid_sha(binding["sha256"])
             and _sha(archive_bytes) == binding["sha256"], "archive SHA-256 mismatch")
    role_size = 8 * 192 * 256 * 4
    expected_size = role_size * len(roles)
    inflater = zlib.decompressobj()
    try:
        raw = inflater.decompress(archive_bytes, expected_size + 1)
    except zlib.error as error:
        raise ValueError("invalid zlib archive") from error
    _require(len(raw) == expected_size and inflater.eof
             and not inflater.unused_data and not inflater.unconsumed_tail,
             "archive size, termination or trailing bytes differ")
    result = {}
    for index, role in enumerate(roles):
        part = raw[index * role_size:(index + 1) * role_size]
        _require(_sha(part) == hashes[role], "role SHA-256 mismatch: " + role)
        values = np.frombuffer(part, dtype="<f4").reshape(8, 192, 256)
        _require(bool(np.isfinite(values).all()), "nonfinite archive tensor: " + role)
        result[role] = values.copy()
    return result
