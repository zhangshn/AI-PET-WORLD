"""Synthetic codec evidence only. CLI emits the real Python producer for Node tests."""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import sys
import unittest
import zlib

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
from ai_painter.complete_world.stage4_v17_responsibility_artifact import (
    encode_responsibility_artifact, decode_responsibility_artifact,
)

SCHEMA_PATH = ROOT / "data/ai-painter/system-governance/stage4-mvp-structured-object-v17-review-pack-schema-v1.json"
IDENTITY = {"worldId": "synthetic-codec-only", "regionId": "synthetic-region", "tick": 23,
            "factHash": "e" * 64,
            "visualFactManifestSha256": "a" * 64, "conditionPackSha256": "b" * 64,
            "modelStateSha256": "c" * 64}


def fixture(schema_path=SCHEMA_PATH):
    schema_bytes = Path(schema_path).read_bytes()
    schema = json.loads(schema_bytes)
    interface = {"schema_bytes": schema_bytes, "schema_sha256": sha256(schema_bytes).hexdigest(),
                 "candidate_pack_schema_version": schema["candidatePackSchemaVersion"]}
    tensors = {}
    for index, role in enumerate(schema["requiredResponsibilityIds"]):
        values = (np.arange(8 * 192 * 256, dtype=np.float32) / 1024 + index * 16).reshape(1, 8, 192, 256)
        values.flat[0] = -0.0
        tensors[role] = values
    archive, evidence = encode_responsibility_artifact(
        tensors, identity=IDENTITY, archive_path="test-fixtures/roles.zlib", **interface)
    return interface, tensors, archive, evidence


def emit_fixture(directory, schema_path):
    """Called by Node in a fresh temporary directory, never a production root."""
    root = Path(directory)
    interface, _, archive, evidence = fixture(schema_path)
    target = root / evidence["tensorArchive"]["path"]
    target.parent.mkdir(parents=True)
    with target.open("xb") as stream:
        stream.write(archive)
    with (root / "interface.json").open("xb") as stream:
        stream.write(interface["schema_bytes"])
    with (root / "fixture.json").open("x", encoding="utf-8") as stream:
        json.dump({"evidence": evidence, "expectedIdentity": IDENTITY,
                   "schemaSha256": interface["schema_sha256"],
                   "candidatePackSchemaVersion": interface["candidate_pack_schema_version"]}, stream)


class ResponsibilityCodecTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.interface, cls.tensors, cls.archive, cls.evidence = fixture()

    def decode(self, archive=None, evidence=None, **kwargs):
        return decode_responsibility_artifact(
            self.archive if archive is None else archive,
            self.evidence if evidence is None else evidence,
            expected_identity=kwargs.pop("expected_identity", IDENTITY),
            **(self.interface | kwargs))

    def test_exact_float32_chw_round_trip_and_source_unchanged(self):
        before = {role: tensor.tobytes() for role, tensor in self.tensors.items()}
        decoded = self.decode()
        self.assertEqual(list(decoded), self.evidence["roleOrder"])
        for role, values in decoded.items():
            self.assertEqual(values.shape, (8, 192, 256))
            self.assertEqual(values.tobytes(), self.tensors[role][0].astype("<f4").tobytes())
            self.assertEqual(before[role], self.tensors[role].tobytes())

    def test_noncontiguous_big_endian_and_cpu_bfloat16(self):
        import torch
        tensors = {role: values.astype(">f4")[..., ::-1] for role, values in self.tensors.items()}
        role = self.evidence["roleOrder"][0]
        tensors[role] = torch.ones((1, 8, 192, 256), dtype=torch.bfloat16)
        archive, evidence = encode_responsibility_artifact(
            tensors, identity=IDENTITY, archive_path="roles.zlib", **self.interface)
        decoded = self.decode(archive, evidence)
        np.testing.assert_array_equal(decoded[role], np.ones((8, 192, 256)))
        other = self.evidence["roleOrder"][1]
        self.assertFalse(tensors[other].flags.c_contiguous)
        np.testing.assert_array_equal(decoded[other], tensors[other][0])

    def test_wrong_role_shape_nonfinite_and_float32_overflow_rejected(self):
        role = self.evidence["roleOrder"][0]
        variants = []
        variants.extend([np.zeros((8, 192, 256), dtype="f4"),
                         np.zeros((1, 8, 192, 256), dtype="i4")])
        variants.extend(np.full((1, 8, 192, 256), value, dtype="f8")
                        for value in (float("nan"), float("inf"), 1e100))
        for value in variants:
            with self.subTest(shape=value.shape, dtype=str(value.dtype)), self.assertRaises(ValueError):
                encode_responsibility_artifact(self.tensors | {role: value}, identity=IDENTITY,
                    archive_path="roles.zlib", **self.interface)
        for tensors in ({}, self.tensors | {"extra": self.tensors[role]}):
            with self.assertRaises(ValueError):
                encode_responsibility_artifact(tensors, identity=IDENTITY,
                    archive_path="roles.zlib", **self.interface)

    def test_metadata_and_all_expected_identities_are_checked(self):
        changes = {"roleOrder": list(reversed(self.evidence["roleOrder"])),
                   "tensorShapePerRole": [1, 8, 192, 256], "tensorFormat": "other",
                   "responsibilityImplementationMode": "single_model",
                   "roleSha256": self.evidence["roleSha256"] | {"extra": "0" * 64}}
        for key, value in changes.items():
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.decode(evidence=self.evidence | {key: value})
        for key in IDENTITY:
            expected = IDENTITY | {key: 24 if key == "tick" else "different" if key in ("worldId", "regionId") else "d" * 64}
            with self.subTest(identity=key), self.assertRaisesRegex(ValueError, "identity mismatch"):
                self.decode(expected_identity=expected)
            missing = dict(IDENTITY)
            del missing[key]
            with self.subTest(missing_identity=key), self.assertRaises(ValueError):
                self.decode(expected_identity=missing)
        for key, value in (("regionId", ""), ("factHash", "not-a-sha")):
            with self.subTest(invalid_identity=key), self.assertRaises(ValueError):
                self.decode(expected_identity=IDENTITY | {key: value})
        with self.assertRaises(ValueError):
            self.decode(expected_identity=IDENTITY | {"tick": True})

    def test_interface_archive_and_role_hashes_are_recomputed(self):
        with self.assertRaisesRegex(ValueError, "interface SHA"):
            self.decode(schema_sha256="0" * 64)
        with self.assertRaisesRegex(ValueError, "pack schema"):
            self.decode(candidate_pack_schema_version="old-v16")
        with self.assertRaisesRegex(ValueError, "archive SHA"):
            self.decode(archive=self.archive[:-1])
        evidence = deepcopy(self.evidence)
        evidence["roleSha256"][evidence["roleOrder"][0]] = "0" * 64
        with self.assertRaisesRegex(ValueError, "role SHA"):
            self.decode(evidence=evidence)

    def test_bounded_decompression_truncation_trailing_and_nonfinite(self):
        raw = zlib.decompress(self.archive)
        archives = [zlib.compress(raw[:-4]), zlib.compress(raw + b"\0" * 4),
                    self.archive[:-1], self.archive + b"extra", self.archive + zlib.compress(b"other")]
        for archive in archives:
            evidence = deepcopy(self.evidence)
            evidence["tensorArchive"]["sha256"] = sha256(archive).hexdigest()
            with self.subTest(size=len(archive)), self.assertRaises(ValueError):
                self.decode(archive, evidence)
        raw = bytearray(raw)
        raw[:4] = bytes.fromhex("0000c07f")
        archive = zlib.compress(raw)
        evidence = deepcopy(self.evidence)
        evidence["tensorArchive"]["sha256"] = sha256(archive).hexdigest()
        evidence["roleSha256"][evidence["roleOrder"][0]] = sha256(raw[:8*192*256*4]).hexdigest()
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            self.decode(archive, evidence)

    def test_explicit_relative_archive_path_required(self):
        for value in ("../escape", "/absolute", "C:/absolute", "a\\b", "a:ads", "latest/file"):
            evidence = deepcopy(self.evidence)
            evidence["tensorArchive"]["path"] = value
            with self.subTest(path=value), self.assertRaisesRegex(ValueError, "path"):
                self.decode(evidence=evidence)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--emit-fixture":
        emit_fixture(sys.argv[2], sys.argv[3])
    else:
        unittest.main()
