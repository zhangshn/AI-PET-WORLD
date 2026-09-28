"""Synthetic binding tests, never evidence of real training or GPU inference."""
import base64
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
import unittest
import zlib

from test_stage4_v17_responsibility_artifact import fixture as responsibility_fixture, SCHEMA_PATH
from ai_painter.complete_world.stage4_v17_candidate_manifest import (
    build_candidate_manifest, validate_candidate_manifest,
)


def png(width, height, color):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    pixels = (b"\0" + bytes(color) * width) * height
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b""))


def fixture(schema_path=SCHEMA_PATH):
    interface, _, archive, evidence = responsibility_fixture(schema_path)
    schema = json.loads(interface["schema_bytes"])
    sources = {evidence["tensorArchive"]["path"]: archive}

    def bind(path, data):
        sources[path] = data
        return {"path": path, "sha256": sha256(data).hexdigest()}

    trusted = {"runId": "synthetic-run", "packageId": "synthetic-package",
               "modelStateSha256": "c" * 64, "discriminatorStateSha256": "d" * 64,
               "selectedEpoch": 3, "selectedScore": 0.125,
               "precisionExecutionPlan": {"fixtureOnly": True, "dtype": "bfloat16"},
               "orderedValidationRows": []}
    for key in ("executionPackage", "trainingTerminal", "datasetManifest", "checkpoint", "inferenceReport"):
        trusted[key] = bind("sources/" + key + ".json", json.dumps({"syntheticSource": key}).encode())
    reference = bind("sources/reference.png", png(1024, 768, (0, 0, 0)))
    masks = [{"role": role, **bind("sources/" + role + ".raw", bytes([index]) * 16)}
             for index, role in enumerate(schema["candidateArtifacts"]["objectMasks"]["roles"])]
    responsibilities = []
    for index in range(schema["candidateCount"]):
        condition = bind(f"sources/condition-{index}.json", json.dumps({
            "schemaVersion": schema["candidateArtifacts"]["conditionPack"]["schemaVersion"],
            "channelCount": 23, "fixtureOnly": True, "sample": index}).encode())
        row = {"sampleId": f"synthetic-sample-{index}", "worldId": f"synthetic-world-{index}",
               "regionId": f"synthetic-region-{index}", "tick": index,
               "factHash": sha256(f"synthetic-facts-{index}".encode()).hexdigest(),
               "visualFactManifestSha256": sha256(f"synthetic-visual-facts-{index}".encode()).hexdigest(),
               "referenceRgb": reference, "conditionPack": condition, "objectMasks": masks,
               "candidateRgb": {**bind(f"sources/candidate-{index}.png", png(256, 192, (index, 0, 0))),
                                "role": "complete_rgb_candidate", "width": 256, "height": 192}}
        trusted["orderedValidationRows"].append(deepcopy(row))
        role_evidence = deepcopy(evidence)
        role_evidence.update({key: row[key] for key in (
            "worldId", "regionId", "tick", "factHash", "visualFactManifestSha256")})
        role_evidence["conditionPackSha256"] = condition["sha256"]
        responsibilities.append(role_evidence)
    options = {"trusted_context": trusted, "source_bytes": sources, **interface}
    manifest = build_candidate_manifest(responsibility_evidence=responsibilities,
        recorded_at_utc="2026-01-01T00:00:00Z", **options)
    return options, responsibilities, manifest


def emit_fixture(directory, schema_path):
    options, _, manifest = fixture(schema_path)
    root = Path(directory)
    with (root / "manifest.json").open("x", encoding="utf-8") as stream:
        json.dump(manifest, stream, allow_nan=False)
    with (root / "interface.json").open("xb") as stream:
        stream.write(options["schema_bytes"])
    with (root / "bindings.json").open("x", encoding="utf-8") as stream:
        json.dump({"trustedContext": options["trusted_context"],
                   "schemaSha256": options["schema_sha256"],
                   "candidatePackSchemaVersion": options["candidate_pack_schema_version"],
                   "sourceBase64": {key: base64.b64encode(value).decode("ascii")
                                    for key, value in options["source_bytes"].items()}}, stream)


class CandidateManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.options, cls.responsibilities, cls.manifest = fixture()

    def validate(self, manifest=None, **overrides):
        return validate_candidate_manifest(self.manifest if manifest is None else manifest,
                                           **(self.options | overrides))

    def test_real_producer_validates_without_mutating_trusted_inputs(self):
        before = deepcopy(self.options["trusted_context"])
        result = self.validate()
        self.assertEqual(result, self.manifest)
        self.assertEqual([row["sampleIndex"] for row in result["candidates"]], list(range(8)))
        result["candidates"][0]["candidateRgb"]["width"] = 1
        self.assertEqual(self.options["trusted_context"], before)
        self.assertEqual(self.manifest["candidates"][0]["candidateRgb"]["width"], 256)

    def test_schema_sha_and_v17_version_required(self):
        with self.assertRaisesRegex(ValueError, "interface SHA"):
            self.validate(schema_sha256="0" * 64)
        with self.assertRaisesRegex(ValueError, "pack schema"):
            self.validate(candidate_pack_schema_version="old-v16")
        with self.assertRaisesRegex(ValueError, "pack schema"):
            self.validate(self.manifest | {"schemaVersion": "old-v16"})

    def test_every_trusted_top_level_identity_is_bound(self):
        for key in self.options["trusted_context"]:
            if key == "orderedValidationRows":
                continue
            trusted = deepcopy(self.options["trusted_context"])
            value = trusted[key]
            trusted[key] = ({**value, "sha256": "f" * 64} if isinstance(value, dict) and "sha256" in value
                            else {"other": True} if isinstance(value, dict)
                            else value + 1 if type(value) in (int, float)
                            else "f" * 64 if key.endswith("Sha256") else "other")
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "identity equation"):
                self.validate(trusted_context=trusted)
        with self.assertRaises(ValueError):
            self.validate(trusted_context={})

    def test_all_seven_responsibility_identities_are_bound(self):
        for key in ("worldId", "regionId", "tick", "factHash", "visualFactManifestSha256",
                    "conditionPackSha256", "modelStateSha256"):
            changed = deepcopy(self.manifest)
            changed["candidates"][0]["responsibilityEvidence"][key] = 99 if key == "tick" else "f" * 64
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "identity equation"):
                self.validate(changed)

    def test_count_order_uniqueness_split_and_dimensions(self):
        changes = []
        missing = deepcopy(self.manifest)
        missing["candidates"].pop()
        changes.append(missing)
        for key, value in (("sampleIndex", 1), ("sampleId", "synthetic-sample-1"), ("split", "train")):
            changed = deepcopy(self.manifest)
            changed["candidates"][0][key] = value
            changes.append(changed)
        swapped = deepcopy(self.manifest)
        swapped["candidates"][0], swapped["candidates"][1] = swapped["candidates"][1], swapped["candidates"][0]
        changes.append(swapped)
        for value in changes:
            with self.assertRaises(ValueError):
                self.validate(value)
        duplicate = deepcopy(self.manifest)
        duplicate_trusted = deepcopy(self.options["trusted_context"])
        duplicate["candidates"][1]["sampleId"] = duplicate["candidates"][0]["sampleId"]
        duplicate_trusted["orderedValidationRows"][1]["sampleId"] = duplicate["candidates"][0]["sampleId"]
        with self.assertRaisesRegex(ValueError, "unique"):
            self.validate(duplicate, trusted_context=duplicate_trusted)
        trusted = deepcopy(self.options["trusted_context"])
        trusted["orderedValidationRows"][0]["candidateRgb"]["width"] = 255
        with self.assertRaisesRegex(ValueError, "RGB width"):
            build_candidate_manifest(trusted_context=trusted, responsibility_evidence=self.responsibilities,
                recorded_at_utc="2026-01-01T00:00:00Z", **{k: v for k, v in self.options.items() if k != "trusted_context"})

    def test_source_bytes_recomputed_for_each_binding_category(self):
        paths = [self.manifest[key]["path"] for key in (
            "executionPackage", "trainingTerminal", "datasetManifest", "checkpoint", "inferenceReport")]
        candidate = self.manifest["candidates"][0]
        paths.extend(candidate[key]["path"] for key in ("candidateRgb", "referenceRgb", "conditionPack"))
        paths.extend(item["path"] for item in candidate["objectMasks"])
        paths.append(candidate["responsibilityEvidence"]["tensorArchive"]["path"])
        for path in paths:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "source byte SHA"):
                self.validate(source_bytes=self.options["source_bytes"] | {path: b"tampered"})

    def test_extra_roles_mask_order_and_role_archive_hash(self):
        changed = deepcopy(self.manifest)
        changed["candidates"][0]["responsibilityEvidence"]["roleSha256"]["extra"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "role SHA"):
            self.validate(changed)
        for extra in (True, False):
            trusted = deepcopy(self.options["trusted_context"])
            masks = trusted["orderedValidationRows"][0]["objectMasks"]
            if extra:
                masks.append(deepcopy(masks[0]))
            else:
                masks.reverse()
            with self.assertRaisesRegex(ValueError, "mask"):
                build_candidate_manifest(trusted_context=trusted, responsibility_evidence=self.responsibilities,
                    recorded_at_utc="2026-01-01T00:00:00Z", **{k: v for k, v in self.options.items() if k != "trusted_context"})

    def test_boundary_precision_timestamp_and_required_fields(self):
        changes = [self.manifest | {"executionBoundary": {**self.manifest["executionBoundary"], "qualificationGranted": True}},
                   self.manifest | {"executionBoundary": {**self.manifest["executionBoundary"], "optimizerSteps": False}},
                   self.manifest | {"recordedAtUtc": "2026-02-30T00:00:00Z"}]
        changed = deepcopy(self.manifest)
        changed["candidates"][0]["artifactIdentity"]["precisionExecutionPlan"] = {}
        changes.append(changed)
        changed = deepcopy(self.manifest)
        del changed["inferenceReport"]
        changes.append(changed)
        for changed in changes:
            with self.assertRaises(ValueError):
                self.validate(changed)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--emit-fixture":
        emit_fixture(sys.argv[2], sys.argv[3])
    else:
        unittest.main()
