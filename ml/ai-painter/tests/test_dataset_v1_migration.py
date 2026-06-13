import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.dataset.migration_v1 import inspect_v1_sample, migrate_dataset_v1
from ai_painter.dataset.v1_review import confirm_v1_sample


class DatasetV1MigrationTests(unittest.TestCase):
    def test_multiple_v0_samples_batch_migrate_successfully(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v0(root, "sample-001")
            _stage_v0(root, "sample-002", color=(80, 120, 180))
            result = migrate_dataset_v1(root)
            self.assertEqual(result["total"], 2)
            self.assertEqual(result["migrated"], 2)
            self.assertEqual(result["failed"], 0)
            self.assertEqual({item["status"] for item in result["results"]}, {"migrated"})

    def test_existing_v1_is_skipped_without_force(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root, ["sample-001"])
            original = (sample / "blueprint.v1.json").read_text(encoding="utf-8")
            result = migrate_dataset_v1(root, ["sample-001"])
            self.assertEqual(result["skipped"], 1)
            self.assertEqual((sample / "blueprint.v1.json").read_text(encoding="utf-8"), original)

    def test_single_failure_does_not_stop_batch(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v0(root, "sample-good")
            broken = _stage_v0(root, "sample-broken")
            (broken / "target.png").unlink()
            result = migrate_dataset_v1(root)
            self.assertEqual(result["migrated"], 1)
            self.assertEqual(result["failed"], 1)
            self.assertEqual(len(result["results"]), 2)

    def test_missing_target_fails_with_reason(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            (sample / "target.png").unlink()
            result = migrate_dataset_v1(root, ["sample-001"])
            self.assertEqual(result["failed"], 1)
            self.assertIn("target.png", result["results"][0]["reason"])

    def test_migrated_sample_stays_pending_and_has_no_review_record(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root, ["sample-001"])
            status = inspect_v1_sample(sample)
            blueprint = json.loads((sample / "blueprint.v1.json").read_text(encoding="utf-8"))
            self.assertEqual(status["status"], "review_pending")
            self.assertTrue(blueprint["requiresManualReview"])
            self.assertFalse((sample / "blueprint.v1.review.json").exists())

    def test_migration_generates_complete_14_channel_masks(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root, ["sample-001"])
            names = sorted(path.stem for path in (sample / "masks_v1").glob("*.png"))
            self.assertEqual(names, sorted(V1_CONDITION_CHANNELS))

    def test_default_migration_refuses_to_overwrite_review_record(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root, ["sample-001"])
            confirm_v1_sample(root, "sample-001", _submission(sample))
            result = migrate_dataset_v1(root, ["sample-001"])
            self.assertEqual(result["skipped"], 1)
            self.assertEqual(inspect_v1_sample(sample)["status"], "trainable")

    def test_force_still_refuses_to_overwrite_review_record(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root, ["sample-001"])
            confirm_v1_sample(root, "sample-001", _submission(sample))
            result = migrate_dataset_v1(root, ["sample-001"], force=True)
            self.assertEqual(result["failed"], 1)
            self.assertIn("review record", result["results"][0]["reason"])


def _stage_v0(root: Path, sample_id: str, color=(60, 120, 80)) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    sample.mkdir(parents=True)
    Image.new("RGB", (256, 192), color).save(sample / "target.png")
    (sample / "blueprint.json").write_text(_json(_v0(sample_id)), encoding="utf-8")
    return sample


def _v0(sample_id: str) -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v0",
        "sceneId": sample_id,
        "width": 256,
        "height": 192,
        "seed": 3,
        "styleId": "bright-healing-topdown-pixel-v0",
        "terrainRegions": [{"id": "grass-main", "terrain": "grass", "polygon": [[0, 0], [255, 0], [255, 191], [0, 191]]}],
        "waterBodies": [{"id": "pond-1", "polygon": [[10, 10], [70, 10], [70, 60], [10, 60]]}],
        "roads": [{"id": "road-1", "width": 10, "points": [[20, 191], [100, 120], [180, 90]]}],
        "objects": [{"id": "shelter-1", "kind": "shelter", "x": 110, "y": 70, "width": 32, "height": 28, "stage": 1}],
    }


def _submission(sample: Path) -> dict[str, object]:
    blueprint = json.loads((sample / "blueprint.v1.json").read_text(encoding="utf-8"))
    return {
        "sampleId": sample.name,
        "reviewer": "reviewer-a",
        "blueprintHash": _sha256(sample / "blueprint.v1.json"),
        "targetImageHash": _sha256(sample / "target.png"),
        "overallDecision": "approved",
        "overallConfirmation": True,
        "decisions": [
            {"structureId": item["id"], "type": item["type"], "decision": "approved", "reviewerNote": "确认"}
            for item in blueprint["structures"] if item["requiresManualReview"]
        ],
    }


def _json(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _sha256(path: Path) -> str:
    from hashlib import sha256
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    unittest.main()
