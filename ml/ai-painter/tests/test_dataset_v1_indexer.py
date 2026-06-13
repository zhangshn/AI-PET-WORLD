import json
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.dataset.migration_v1 import migrate_dataset_v1
from ai_painter.dataset.v1_indexer import build_trainable_v1_indexes
from ai_painter.dataset.v1_readiness import build_v1_readiness_report
from ai_painter.dataset.v1_review import confirm_v1_sample


class DatasetV1IndexReadinessTests(unittest.TestCase):
    def test_only_trainable_samples_enter_indexes(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _reviewed(root, "sample-001")
            _pending(root, "sample-002")
            result = build_trainable_v1_indexes(root)
            self.assertEqual(result["trainable"], 1)
            indexed = _read_index(root, "train") + _read_index(root, "validation")
            self.assertEqual(indexed, ["sample-001"])

    def test_pending_sample_in_manual_index_is_blocked(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _pending(root, "sample-001")
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", [])
            report = build_v1_readiness_report(root)
            self.assertTrue(any("non-trainable" in item for item in report["blockers"]))

    def test_train_and_validation_do_not_overlap_and_counts_match(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _reviewed(root, "sample-001")
            _reviewed(root, "sample-002")
            build_trainable_v1_indexes(root)
            train = _read_index(root, "train")
            validation = _read_index(root, "validation")
            self.assertFalse(set(train) & set(validation))
            self.assertEqual(_read_count(root, "train"), len(train))
            self.assertEqual(_read_count(root, "validation"), len(validation))
            self.assertGreaterEqual(len(validation), 1)

    def test_illegal_index_is_blocked_by_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _reviewed(root, "sample-001")
            _write_index(root, "train", ["missing-sample", "missing-sample"])
            _write_index(root, "validation", ["sample-001"])
            report = build_v1_readiness_report(root)
            self.assertTrue(any("duplicate" in item or "non-trainable" in item for item in report["blockers"]))

    def test_missing_mask_sample_does_not_enter_indexes(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _reviewed(root, "sample-001")
            (sample / "masks_v1" / "grass.png").unlink()
            result = build_trainable_v1_indexes(root)
            indexed = _read_index(root, "train") + _read_index(root, "validation")
            self.assertEqual(result["trainable"], 0)
            self.assertNotIn("sample-001", indexed)
            self.assertTrue(any("missing masks_v1/grass.png" in item for item in result["blockers"]))

    def test_engineering_and_first_training_statuses(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index in range(20):
                _reviewed(root, f"sample-{index:03d}", color=(40 + index, 90, 160))
            build_trainable_v1_indexes(root, validation_ratio=0.2)
            engineering = build_v1_readiness_report(root)
            self.assertEqual(engineering["readinessStatus"], "engineering_validation_ready")
            for index in range(20, 100):
                _reviewed(root, f"sample-{index:03d}", color=(40 + index % 150, 90 + index % 80, 120))
            build_trainable_v1_indexes(root, validation_ratio=0.2)
            first = build_v1_readiness_report(root)
            self.assertEqual(first["readinessStatus"], "first_training_ready")

    def test_duplicate_target_blocks_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _reviewed(root, "sample-001", color=(70, 90, 120))
            _reviewed(root, "sample-002", color=(70, 90, 120))
            build_trainable_v1_indexes(root)
            report = build_v1_readiness_report(root)
            self.assertTrue(report["duplicateTargets"])
            self.assertEqual(report["readinessStatus"], "not_ready")


def _reviewed(root: Path, sample_id: str, color=(80, 120, 60)) -> Path:
    sample = _stage(root, sample_id, color=color)
    migrate_dataset_v1(root, [sample_id])
    confirm_v1_sample(root, sample_id, _submission(sample))
    return sample


def _pending(root: Path, sample_id: str) -> None:
    _stage(root, sample_id)
    migrate_dataset_v1(root, [sample_id])


def _stage(root: Path, sample_id: str, color=(80, 120, 60)) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    sample.mkdir(parents=True)
    _target(sample / "target.png", color)
    (sample / "blueprint.json").write_text(_json(_v0(sample_id)), encoding="utf-8")
    return sample


def _target(path: Path, color: tuple[int, int, int]) -> None:
    image = Image.new("RGB", (256, 192), color)
    for x in range(0, 256, 8):
        for y in range(0, 192, 8):
            if (x + y) % 16 == 0:
                for dx in range(4):
                    for dy in range(4):
                        image.putpixel((x + dx, y + dy), (255 - color[0], 255 - color[1], 255 - color[2]))
    image.save(path)


def _v0(sample_id: str) -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v0", "sceneId": sample_id, "width": 256, "height": 192,
        "seed": 3, "styleId": "bright-healing-topdown-pixel-v0",
        "terrainRegions": [{"id": "grass-main", "terrain": "grass", "polygon": [[0, 0], [255, 0], [255, 191], [0, 191]]}],
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


def _write_index(root: Path, split: str, values: list[str]) -> None:
    (root / "indexes").mkdir(exist_ok=True)
    (root / "indexes" / f"{split}.json").write_text(json.dumps({"sampleIds": values, "count": len(values)}), encoding="utf-8")


def _read_index(root: Path, split: str) -> list[str]:
    return json.loads((root / "indexes" / f"{split}.json").read_text(encoding="utf-8"))["sampleIds"]


def _read_count(root: Path, split: str) -> int:
    return json.loads((root / "indexes" / f"{split}.json").read_text(encoding="utf-8"))["count"]


def _json(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _sha256(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    unittest.main()
