import json
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.dataset.migration_v1 import migrate_dataset_v1, scan_v1_samples
from ai_painter.dataset.v1_review import confirm_v1_sample


class DatasetV1BatchMigrationTests(unittest.TestCase):
    def test_multiple_v0_samples_migrate_successfully(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v0(root, "sample-001")
            _stage_v0(root, "sample-002")
            result = migrate_dataset_v1(root)
            self.assertEqual(result["migrated"], 2)
            self.assertEqual(result["failed"], 0)

    def test_existing_v1_is_skipped_without_force(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root)
            before = _sha256(sample / "blueprint.v1.json")
            result = migrate_dataset_v1(root)
            self.assertEqual(result["skipped"], 1)
            self.assertEqual(_sha256(sample / "blueprint.v1.json"), before)

    def test_one_failure_does_not_abort_batch(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v0(root, "sample-001")
            broken = _stage_v0(root, "sample-002")
            (broken / "target.png").unlink()
            result = migrate_dataset_v1(root)
            self.assertEqual(result["migrated"], 1)
            self.assertEqual(result["failed"], 1)

    def test_missing_target_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            (sample / "target.png").unlink()
            result = migrate_dataset_v1(root)
            self.assertEqual(result["failed"], 1)
            self.assertIn("target", result["results"][0]["reason"])

    def test_migration_keeps_sample_pending_and_generates_14_masks(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            result = migrate_dataset_v1(root)
            self.assertEqual(result["results"][0]["status"], "migrated")
            blueprint = json.loads((sample / "blueprint.v1.json").read_text(encoding="utf-8"))
            self.assertTrue(blueprint["requiresManualReview"])
            self.assertTrue((sample / "migration.v1.json").is_file())
            self.assertEqual(len(list((sample / "masks_v1").glob("*.png"))), len(V1_CONDITION_CHANNELS))

    def test_review_record_is_never_overwritten(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root)
            confirm_v1_sample(root, "sample-001", _submission(sample))
            before = _sha256(sample / "blueprint.v1.review.json")
            result = migrate_dataset_v1(root, ["sample-001"], force=True)
            self.assertEqual(result["failed"], 1)
            self.assertEqual(_sha256(sample / "blueprint.v1.review.json"), before)

    def test_force_required_to_overwrite_v1_draft(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v0(root, "sample-001")
            migrate_dataset_v1(root)
            (sample / "blueprint.json").write_text(_json(_v0("sample-001", seed=99)), encoding="utf-8")
            skipped = migrate_dataset_v1(root)
            self.assertEqual(skipped["skipped"], 1)
            forced = migrate_dataset_v1(root, ["sample-001"], force=True)
            self.assertEqual(forced["migrated"], 1)

    def test_scan_reports_status_counts(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v0(root, "sample-001")
            _stage_v0(root, "sample-002")
            migrate_dataset_v1(root, ["sample-001"])
            statuses = {item["sampleId"]: item["status"] for item in scan_v1_samples(root)}
            self.assertEqual(statuses["sample-001"], "review_pending")
            self.assertEqual(statuses["sample-002"], "v0_only")


def _stage_v0(root: Path, sample_id: str) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    sample.mkdir(parents=True)
    Image.new("RGB", (256, 192), (80, 120, 60)).save(sample / "target.png")
    (sample / "blueprint.json").write_text(_json(_v0(sample_id)), encoding="utf-8")
    return sample


def _v0(sample_id: str, seed: int = 3) -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v0",
        "sceneId": sample_id,
        "width": 256,
        "height": 192,
        "seed": seed,
        "styleId": "bright-healing-topdown-pixel-v0",
        "terrainRegions": [
            {"id": "grass-main", "terrain": "grass", "polygon": [[0, 0], [255, 0], [255, 191], [0, 191]]},
            {"id": "water-1", "terrain": "water", "polygon": [[0, 150], [120, 150], [120, 191], [0, 191]]},
        ],
        "roads": [{"id": "road-1", "width": 10, "points": [[20, 191], [100, 120], [180, 90]]}],
        "objects": [
            {"id": "tree-1", "kind": "tree", "x": 40, "y": 40, "width": 16, "height": 22},
            {"id": "rock-1", "kind": "rock", "x": 160, "y": 120, "width": 14, "height": 10},
            {"id": "shelter-1", "kind": "shelter", "x": 110, "y": 70, "width": 32, "height": 28, "stage": 1},
        ],
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
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    unittest.main()
