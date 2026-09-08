from __future__ import annotations

from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from ai_painter.complete_world import split_release as release


def fixture_rows():
    rows = []
    for split, count in release.COUNTS.items():
        for _ in range(count):
            i = len(rows)
            sha = hashlib.sha256(str(i).encode()).hexdigest()
            rows.append({"sampleId": f"fixture-{i}", "split": split, "ordinal": i + 1,
                         "image": {"path": f"images/{i}.png", "sha256": sha},
                         "conditionPack": {"path": f"packs/{i}.json", "sha256": sha},
                         "conditionLabel": f"condition-{i}", "monsoonSeason": "wet_season",
                         "grouping": {"worldId": f"world-{i}", "theme": sha, "instance": sha,
                                      "conditionTensorContent": sha, "coordinateReference": "EPSG:4326",
                                      "sourceWindow": {"west": i, "east": i + 0.5, "south": 0, "north": 1}}})
    return rows


class SplitReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="stage4-split-unit-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.rows = fixture_rows()
        self.parent = {"sourcePackage": {"manifest": {"path": "parent-manifest.json", "sha256": "a" * 64},
                                          "sourceIndex": {"path": "parent-index.json", "sha256": "b" * 64}},
                       "conditionContractBinding": {"path": "condition.json", "sha256": "c" * 64}}
        self.channels = {"channelOrder": [f"channel-{i}" for i in range(23)],
                         "continuousChannelIds": ["channel-1"]}
        # Package mechanics use synthetic rows. The separate CPU check exercises
        # collect_parent_rows against all 64 real parent assets without mocks.
        self.collector = patch.object(release, "collect_parent_rows", side_effect=lambda _, **kwargs: (
            deepcopy(self.parent), deepcopy(self.rows), deepcopy(self.channels)))
        self.collector.start()
        self.addCleanup(self.collector.stop)

    def test_package_has_four_independent_files_and_is_byte_idempotent(self):
        binding = release.materialize_package(self.root)
        manifest, rows = release.load_package(self.root, binding)
        self.assertEqual(binding, release.materialize_package(self.root))
        self.assertEqual(len(rows), 64)
        self.assertEqual(set(manifest["splits"]), set(release.COUNTS))
        self.assertEqual(len(list((self.root / Path(binding["path"]).parent).rglob("*.json"))), 6)
        self.assertFalse(manifest["qualification"]["trainingAllowed"])
        self.assertFalse(manifest["qualification"]["historicalExposureAudited"])

    def test_split_bytes_tampered_are_not_overwritten_or_read(self):
        binding = release.materialize_package(self.root)
        manifest = release.bound_json(self.root, binding)
        target = self.root / manifest["splits"]["train"]["path"]
        target.write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "bytes mismatch"):
            release.load_package(self.root, binding)
        with self.assertRaisesRegex(ValueError, "immutable package conflict"):
            release.materialize_package(self.root)
        self.assertEqual(target.read_bytes(), b"tampered")

    def test_missing_split_fails_reader(self):
        binding = release.materialize_package(self.root)
        manifest = release.bound_json(self.root, binding)
        (self.root / manifest["splits"]["challenge"]["path"]).unlink()
        with self.assertRaises(FileNotFoundError):
            release.load_package(self.root, binding)

    def test_partial_package_without_commit_marker_can_be_completed(self):
        binding = release.materialize_package(self.root)
        (self.root / binding["path"]).unlink()
        with self.assertRaises(FileNotFoundError):
            release.load_package(self.root, binding)
        self.assertEqual(release.materialize_package(self.root), binding)

    def test_conflicting_or_crashed_writer_is_not_taken_over(self):
        binding = release.materialize_package(self.root)
        lock = self.root / Path(binding["path"]).parent / ".materialization.lock"
        lock.write_text("fixture active or indeterminate writer", encoding="utf-8")
        with self.assertRaises(FileExistsError):
            release.materialize_package(self.root)
        self.assertTrue(lock.exists())

    def test_relabelled_qualification_is_rejected_even_with_new_outer_hash(self):
        binding = release.materialize_package(self.root)
        target = self.root / binding["path"]
        value = release.bound_json(self.root, binding)
        value["qualification"]["trainingAllowed"] = True
        data = release.canonical_bytes(value)
        target.write_bytes(data)
        binding["sha256"] = release.digest(data)
        with self.assertRaisesRegex(ValueError, "parent identity"):
            release.load_package(self.root, binding)

    def test_dataset_uses_exact_split_order_and_defensive_row_copies(self):
        binding = release.materialize_package(self.root)
        datasets = {s: release.SplitReleaseDataset(self.root, binding, s, (256, 192)) for s in release.COUNTS}
        self.assertEqual({s: len(ds) for s, ds in datasets.items()}, release.COUNTS)
        selected = [r for ds in datasets.values() for r in ds.rows]
        self.assertEqual(selected, self.rows)
        self.assertEqual(release.digest(release.canonical_bytes(selected)),
                         datasets["train"].manifest["identityPayload"]["selectionReproductionSha256"])
        datasets["train"].rows[0]["split"] = "validation"
        self.assertEqual(datasets["train"].rows[0]["split"], "train")

    def test_row_change_creates_another_identity(self):
        first, _ = release.build_package(self.root)
        self.rows[0]["image"]["sha256"] = "d" * 64
        second, _ = release.build_package(self.root)
        self.assertNotEqual(first["datasetReleaseIdentity"], second["datasetReleaseIdentity"])

    def test_explicit_successor_parent_is_used_for_build_and_read_without_default_fallback(self):
        successor = {"path": "data/next-parent.json", "sha256": "d" * 64}
        replacement_rows = deepcopy(self.rows)
        replacement_rows[48]["sampleId"] = "replacement-validation"
        replacement_rows[48]["image"]["sha256"] = "e" * 64
        original = release.materialize_package(self.root)
        original_bytes = (self.root / original["path"]).read_bytes()

        def collect(_, parent_binding=None):
            rows = replacement_rows if parent_binding == successor else self.rows
            return deepcopy(self.parent), deepcopy(rows), deepcopy(self.channels)

        with patch.object(release, "collect_parent_rows", side_effect=collect) as collector:
            candidate = release.materialize_package(self.root, parent_binding=successor)
            self.assertNotEqual(candidate["path"], original["path"])
            manifest, rows = release.load_package(self.root, candidate)
            self.assertEqual(manifest["identityPayload"]["parentRelease"], successor)
            self.assertEqual(rows[48]["sampleId"], "replacement-validation")
            dataset = release.SplitReleaseDataset(self.root, candidate, "validation", (256, 192))
            self.assertEqual(dataset.rows[0]["sampleId"], "replacement-validation")
            self.assertFalse(manifest["qualification"]["trainingAllowed"])
            self.assertTrue(all(call.kwargs.get("parent_binding") == successor
                                for call in collector.call_args_list))
        self.assertEqual((self.root / original["path"]).read_bytes(), original_bytes)

    def test_explicit_parent_failure_does_not_read_the_legacy_parent(self):
        successor = {"path": "data/missing-parent.json", "sha256": "d" * 64}
        with patch.object(release, "collect_parent_rows", side_effect=FileNotFoundError("parent missing")) as collector:
            with self.assertRaisesRegex(FileNotFoundError, "parent missing"):
                release.build_package(self.root, parent_binding=successor)
            self.assertEqual(collector.call_count, 1)
            self.assertEqual(collector.call_args.kwargs["parent_binding"], successor)

    def test_missing_parent_in_manifest_cannot_inherit_the_default(self):
        binding = release.materialize_package(self.root)
        manifest = release.bound_json(self.root, binding)
        del manifest["identityPayload"]["parentRelease"]
        data = release.canonical_bytes(manifest)
        (self.root / binding["path"]).write_bytes(data)
        binding["sha256"] = release.digest(data)
        with self.assertRaisesRegex(ValueError, "parent release binding missing"):
            release.load_package(self.root, binding)

    def test_incomplete_explicit_binding_is_not_a_default_request(self):
        for binding in ({}, {"path": "parent.json"}, {"sha256": "d" * 64},
                        {"path": "parent.json", "sha256": "d" * 64, "trainingAllowed": True}):
            with self.subTest(binding=binding), self.assertRaisesRegex(ValueError, "explicit path"):
                release.build_package(self.root, parent_binding=binding)

    def test_same_split_duplicate_assets_cannot_count_twice(self):
        for role in ("image", "conditionPack"):
            for field in ("path", "sha256"):
                rows = deepcopy(self.rows)
                rows[1][role][field] = rows[0][role][field]
                with self.subTest(role=role, field=field), self.assertRaisesRegex(ValueError, "duplicate capacity asset"):
                    release.validate_groups(rows)

    def test_grouping_rejects_cross_split_aliases(self):
        for kind in ("worldId", "theme", "instance", "conditionTensorContent"):
            with self.subTest(kind=kind):
                rows = deepcopy(self.rows)
                rows[48]["grouping"][kind] = rows[0]["grouping"][kind]
                with self.assertRaisesRegex(ValueError, "cross-split identity leakage"):
                    release.validate_groups(rows)

    def test_positive_area_overlap_fails_but_touching_edges_do_not(self):
        rows = deepcopy(self.rows)
        rows[48]["grouping"]["sourceWindow"] = {"west": 0.5, "east": 0.75, "south": 0, "north": 1}
        release.validate_groups(rows)
        rows[48]["grouping"]["sourceWindow"]["west"] = 0.49
        with self.assertRaisesRegex(ValueError, "source-window overlap"):
            release.validate_groups(rows)

    def test_invalid_crs_window_and_duplicate_sample_are_rejected(self):
        for mutation in (lambda r: r[0]["grouping"].update(coordinateReference="unknown"),
                         lambda r: r[0]["grouping"]["sourceWindow"].update(west=float("nan")),
                         lambda r: r[1].update(sampleId=r[0]["sampleId"])):
            rows = deepcopy(self.rows)
            mutation(rows)
            with self.assertRaises(ValueError):
                release.validate_groups(rows)

    def test_paths_do_not_accept_traversal_absolute_or_latest(self):
        for value in ("../escape", "a/../escape", "C:/escape", "C:escape", "/escape", "a\\b", "latest.json"):
            with self.subTest(path=value), self.assertRaises(ValueError):
                release.project_file(self.root, value)

    def test_file_byte_binding_is_not_satisfied_by_a_json_self_claim(self):
        file = self.root / "asset.json"
        file.write_text('{"sha256":"' + "a" * 64 + '"}')
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            release.read_bound(self.root, {"path": "asset.json", "sha256": "a" * 64})

    def test_dataset_tensor_geometry_and_typed_sampling(self):
        import numpy as np
        from PIL import Image
        binding = release.materialize_package(self.root)
        dataset = release.SplitReleaseDataset(self.root, binding, "train", (256, 192))
        array = np.zeros((768, 1024), dtype=np.uint8)
        array[:, 511:] = 255
        stream = io.BytesIO()
        Image.fromarray(array).save(stream, format="PNG")
        image_bytes = stream.getvalue()
        pack = {"channels": [{"id": key, "path": key + ".png", "sha256": "e" * 64}
                             for key in self.channels["channelOrder"]]}
        with patch.object(release, "read_bound", side_effect=lambda _, b:
                          json.dumps(pack).encode() if b["path"].startswith("packs/") else image_bytes):
            item = dataset[0]
        self.assertEqual(tuple(item["conditions"].shape), (23, 192, 256))
        self.assertEqual(tuple(item["image"].shape), (3, 192, 256))
        self.assertEqual(item["split"], "train")
        self.assertEqual(set(item["conditions"][0].unique().tolist()), {0.0, 1.0})
        self.assertGreater(len(item["conditions"][1].unique()), 2)


class SourceReleaseRoutingTests(unittest.TestCase):
    """File-level provenance tests: no mocked reader, model or training data.

    Image/channel files are labelled synthetic byte fixtures, not qualified PNG
    assets. Actual tensor decoding remains covered by the real-parent CPU check.
    """
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="stage4-source-routing-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        order = [f"channel-{i}" for i in range(23)]
        self.condition = self.write("condition.json", {
            "tensorContract": {"channelOrder": order},
            "channelDefinitions": [{"id": key, "type": "binary"} for key in order],
        })
        self.samples, self.entries, self.contributions = [], [], []
        for i, row in enumerate(fixture_rows()):
            image = self.write(f"images/{i}.png", f"synthetic image {i}".encode())
            channel_bytes = self.write(f"channels/{i}.png", f"synthetic condition {i}".encode())
            channels = [{**channel_bytes, "id": key, "shape": [1, 768, 1024],
                         "dtype": "uint8", "valueRange": [0, 255]} for key in order]
            pack = self.write(f"packs/{i}.json", {"channels": channels})
            structures = {"themeArchitectureIdentity": row["grouping"]["theme"],
                          "instanceDetailIdentity": row["grouping"]["instance"]}
            record = self.write(f"records/{i}.json", {"conditionBinding": {"structuralIdentities": structures}})
            region = {"identity": {"coordinateReference": "EPSG:4326", "spatialBounds": row["grouping"]["sourceWindow"]}}
            region["packageSha256"] = release.digest(release.canonical_bytes(region))
            region_binding = self.write(f"regions/{i}.json", region)
            evidence = self.write(f"contributions/{i}.json", {"conditionPackFileSha256": pack["sha256"]})
            self.samples.append({"sampleId": row["sampleId"], "split": row["split"],
                                 "imagePath": image["path"], "imageSha256": image["sha256"],
                                 "conditionPackPath": pack["path"], "v7CapacityContributionPath": evidence["path"],
                                 "v7CapacityContributionSha256": evidence["sha256"],
                                 "realEarthRegionSourcePackagePath": region_binding["path"],
                                 "realEarthRegionSourcePackageSha256": region["packageSha256"],
                                 "sourceRecordPath": record["path"], "sourceRecordSha256": record["sha256"],
                                 "structuralIdentities": structures, "conditionLabel": row["conditionLabel"],
                                 "conditionWorldId": row["grouping"]["worldId"]})
            self.entries.append({"sampleId": row["sampleId"], "split": row["split"], "ordinal": i + 1,
                                 "sourceSampleIndex": i, "sourceContributionIndex": i,
                                 "image": image, "conditionPack": pack, "contribution": evidence})
            self.contributions.append({"sampleId": row["sampleId"], "split": row["split"]})

    def write(self, logical, value):
        data = value if isinstance(value, bytes) else release.canonical_bytes(value) + b"\n"
        target = self.root / logical
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(data)
        return {"path": logical, "sha256": release.digest(data)}

    def source_release(self, version, *, samples=None, entries=None, contributions=None, source_package_id=None):
        samples = self.samples if samples is None else samples
        source = self.write(f"sources/{version}/source-index.json", {
            "schemaVersion": "ai-assisted-cold-start-dataset-source-index-v1", "sampleCount": len(samples),
            "packageId": version if source_package_id is None else source_package_id,
            "samples": samples, "v7CapacityContributions": self.contributions if contributions is None else contributions,
        })
        manifest = self.write(f"sources/{version}/manifest.json", {
            "schemaVersion": "ai-assisted-cold-start-dataset-package-v1", "packageId": version,
            "sourceIndexPath": source["path"], "sampleCount": len(samples),
        })
        parent = {"schemaVersion": "ai-painter-stage4-v2-dataset-release-contract-v1",
                  "immutable": True, "status": "verified_dataset_release",
                  "sourcePackage": {"packageId": version, "packageSampleCount": len(samples),
                                    "manifest": manifest, "sourceIndex": source},
                  "conditionContractBinding": self.condition,
                  "releaseScope": {"splitCounts": release.COUNTS},
                  "samples": self.entries if entries is None else entries}
        return self.write(f"releases/{version}.json", parent)

    def test_two_real_file_versions_select_their_own_rows_and_keep_the_other_63(self):
        original_parent = self.source_release("original")
        original = release.materialize_package(self.root, parent_binding=original_parent)
        original_bytes = (self.root / original["path"]).read_bytes()
        _, original_rows = release.load_package(self.root, original)
        replacement_image = self.write("images/replacement.png", b"synthetic replacement validation image")
        replacement = deepcopy(self.samples[48])
        replacement.update(sampleId="replacement-validation", imagePath=replacement_image["path"],
                           imageSha256=replacement_image["sha256"])
        entries, contributions = deepcopy(self.entries), deepcopy(self.contributions)
        entries[48].update(sampleId=replacement["sampleId"], sourceSampleIndex=64, image=replacement_image)
        contributions[48]["sampleId"] = replacement["sampleId"]
        next_parent = self.source_release("successor", samples=[*self.samples, replacement],
                                         entries=entries, contributions=contributions)
        successor = release.materialize_package(self.root, parent_binding=next_parent)
        manifest, rows = release.load_package(self.root, successor)
        self.assertNotEqual(successor, original)
        self.assertEqual([row for i, row in enumerate(rows) if i != 48],
                         [row for i, row in enumerate(original_rows) if i != 48])
        self.assertEqual(rows[48]["sampleId"], replacement["sampleId"])
        self.assertEqual(manifest["splitCounts"], release.COUNTS)
        self.assertFalse(manifest["qualification"]["trainingAllowed"])
        self.assertFalse(manifest["qualification"]["transformedOrSemanticNearDuplicateQualified"])
        self.assertEqual((self.root / original["path"]).read_bytes(), original_bytes)
        dataset = release.SplitReleaseDataset(self.root, successor, "validation", (256, 192))
        self.assertEqual(dataset.rows[0]["sampleId"], replacement["sampleId"])
        self.assertEqual(release.materialize_package(self.root, parent_binding=next_parent), successor)

    def test_explicit_source_hash_and_counts_are_checked_without_fallback(self):
        good = self.source_release("valid")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            release.build_package(self.root, parent_binding={**good, "sha256": "f" * 64})
        parent = release.bound_json(self.root, good)
        parent["sourcePackage"]["packageSampleCount"] += 1
        wrong = self.write("releases/wrong-count.json", parent)
        with self.assertRaisesRegex(ValueError, "source capacity mismatch"):
            release.build_package(self.root, parent_binding=wrong)
        self.assertFalse((self.root / release.PACKAGE_ROOT).exists())

    def test_missing_explicit_source_does_not_touch_original_release(self):
        parent = self.source_release("valid")
        package = release.materialize_package(self.root, parent_binding=parent)
        before = (self.root / package["path"]).read_bytes()
        with self.assertRaises(FileNotFoundError):
            release.materialize_package(self.root, parent_binding={"path": "releases/missing.json", "sha256": "a" * 64})
        self.assertEqual((self.root / package["path"]).read_bytes(), before)
        self.assertEqual(len(list((self.root / release.PACKAGE_ROOT).iterdir())), 1)

    def test_source_index_cannot_use_python_negative_indexing(self):
        entries = deepcopy(self.entries)
        entries[0]["sourceSampleIndex"] = -64
        parent = self.source_release("negative-index", entries=entries)
        with self.assertRaisesRegex(ValueError, "source sample index outside"):
            release.build_package(self.root, parent_binding=parent)

    def test_source_index_package_identity_must_match_its_manifest(self):
        parent = self.source_release("mismatched-package", source_package_id="another-package")
        with self.assertRaisesRegex(ValueError, "source index package identity mismatch"):
            release.build_package(self.root, parent_binding=parent)
        self.assertFalse((self.root / release.PACKAGE_ROOT).exists())

    def test_cli_rejects_a_half_binding_before_creating_output(self):
        script = Path(__file__).resolve().parents[1] / "scripts" / "materialize_stage4_v2_split_release.py"
        for args in (("--parent-release", "missing.json"), ("--parent-sha256", "a" * 64)):
            result = subprocess.run([sys.executable, "-B", str(script), "--materialize", *args],
                                    cwd=self.root, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertIn("must be supplied together", result.stderr)
            self.assertFalse((self.root / release.PACKAGE_ROOT).exists())


if __name__ == "__main__":
    unittest.main()
