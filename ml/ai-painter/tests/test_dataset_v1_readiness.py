import json
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.dataset.v1_readiness import build_v1_readiness_report
from ai_painter.dataset.v1_review import confirm_v1_sample


class DatasetV1ReadinessTests(unittest.TestCase):
    def test_empty_dataset_is_not_ready(self) -> None:
        with TemporaryDirectory() as temporary:
            report = build_v1_readiness_report(Path(temporary))
            self.assertFalse(report["readyForFirstTraining"])
            self.assertIn("no accepted scene samples found", report["blockers"])

    def test_reviewed_train_and_validation_samples_are_ready(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root, "sample-001", color=(40, 90, 160))
            _stage(root, "sample-002", color=(160, 90, 40))
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", ["sample-002"])
            report = build_v1_readiness_report(root)
            self.assertTrue(report["readyForFirstTraining"])
            self.assertEqual(report["trainableSampleCount"], 2)
            self.assertEqual(report["splits"]["splits"]["train"]["count"], 1)
            self.assertEqual(report["channelSummary"]["grass"]["emptySamples"], 0)

    def test_missing_validation_index_blocks_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root, "sample-001")
            _write_index(root, "train", ["sample-001"])
            report = build_v1_readiness_report(root)
            self.assertFalse(report["readyForFirstTraining"])
            self.assertTrue(any("validation" in value for value in report["blockers"]))

    def test_duplicate_target_hash_blocks_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root, "sample-001", color=(80, 120, 60))
            _stage(root, "sample-002", color=(80, 120, 60))
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", ["sample-002"])
            report = build_v1_readiness_report(root)
            self.assertFalse(report["readyForFirstTraining"])
            self.assertTrue(report["duplicateTargets"])

    def test_index_referencing_non_trainable_sample_blocks_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root, "sample-001")
            _stage(root, "sample-002", review=False)
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", ["sample-002"])
            report = build_v1_readiness_report(root)
            self.assertFalse(report["readyForFirstTraining"])
            self.assertTrue(any("non-trainable" in value for value in report["blockers"]))

    def test_trainable_sample_omitted_from_index_blocks_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root, "sample-001")
            _stage(root, "sample-002", color=(120, 50, 140))
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", [])
            report = build_v1_readiness_report(root)
            self.assertFalse(report["readyForFirstTraining"])
            self.assertTrue(any("omitted" in value for value in report["blockers"]))

    def test_low_contrast_target_blocks_readiness(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root, "sample-001", flat=True)
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", ["sample-001"])
            report = build_v1_readiness_report(root)
            self.assertFalse(report["readyForFirstTraining"])
            self.assertTrue(any("contrast" in value for value in report["blockers"]))

    def test_empty_channel_is_warning_not_blocker(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root, "sample-001")
            (sample / "masks_v1" / "construction_material.png").unlink()
            Image.new("L", (256, 192), 0).save(sample / "masks_v1" / "construction_material.png")
            record = json.loads((sample / "blueprint.v1.review.json").read_text(encoding="utf-8"))
            record["masks"]["construction_material"]["sha256"] = _sha256(sample / "masks_v1" / "construction_material.png")
            (sample / "blueprint.v1.review.json").write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            _write_index(root, "train", ["sample-001"])
            _write_index(root, "validation", ["sample-001"])
            report = build_v1_readiness_report(root)
            self.assertTrue(any("construction_material" in value for value in report["warnings"]))


def _stage(root: Path, sample_id: str, *, color=(60, 120, 180), review: bool = True, flat: bool = False) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    sample.mkdir(parents=True)
    _target(sample / "target.png", color, flat)
    blueprint = _blueprint(sample_id)
    _write_json(sample / "blueprint.v1.json", blueprint)
    render_v1_masks_from_file(sample / "blueprint.v1.json", sample / "masks_v1")
    if review:
        confirm_v1_sample(root, sample_id, _submission(sample))
    return sample


def _target(path: Path, color: tuple[int, int, int], flat: bool) -> None:
    image = Image.new("RGB", (256, 192), color)
    if not flat:
        for x in range(0, 256, 8):
            for y in range(0, 192, 8):
                if (x + y) % 16 == 0:
                    for dx in range(4):
                        for dy in range(4):
                            image.putpixel((x + dx, y + dy), (255 - color[0], 255 - color[1], 255 - color[2]))
    image.save(path)


def _blueprint(sample_id: str) -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": sample_id,
        "width": 256,
        "height": 192,
        "seed": 3,
        "styleId": "bright-healing-topdown-pixel-v0",
        "requiresManualReview": True,
        "manualReviewReasons": ["待复核"],
        "structures": [
            {"id": f"{name}-1", "type": name, "geometry": {"kind": "rect", "x": index + 1, "y": index + 1, "width": 8, "height": 8}, "layer": index + 1, "requiresManualReview": True, "manualReviewReasons": ["待复核"], **({"depthValue": 128} if name == "depth" else {})}
            for index, name in enumerate(V1_CONDITION_CHANNELS)
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


def _write_index(root: Path, split: str, sample_ids: list[str]) -> None:
    (root / "indexes").mkdir(parents=True, exist_ok=True)
    _write_json(root / "indexes" / f"{split}.json", {"schemaVersion": "dataset-index-v0", "split": split, "sampleIds": sample_ids, "count": len(sample_ids)})


def _write_json(path: Path, data: dict[str, object]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _sha256(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    unittest.main()
