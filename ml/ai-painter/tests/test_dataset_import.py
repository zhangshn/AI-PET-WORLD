import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image, ImageDraw

from ai_painter.dataset import audit_dataset, build_dataset_indexes, import_sample


class DatasetImportTests(unittest.TestCase):
    def test_import_creates_normalized_sample_masks_and_hashes(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_sample(root, "sample-001")
            result = import_sample(root, "sample-001")
            self.assertEqual(result["status"], "accepted")
            self.assertEqual(len(result["files"]["targetImage"]["sha256"]), 64)
            self.assertEqual(len(result["files"]["masks"]), 8)
            with Image.open(root / "accepted/dataset_v0/images/sample-001.png") as image:
                self.assertEqual(image.size, (256, 192))

    def test_index_split_is_stable(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index in range(20):
                sample_id = f"sample-{index:03d}"
                _stage_sample(root, sample_id)
                self.assertEqual(import_sample(root, sample_id)["status"], "accepted")
            first = build_dataset_indexes(root, 0.2)
            train_first = (root / "indexes/train.json").read_text(encoding="utf-8")
            second = build_dataset_indexes(root, 0.2)
            self.assertEqual(first, second)
            self.assertEqual(train_first, (root / "indexes/train.json").read_text(encoding="utf-8"))
            self.assertEqual(first["accepted"], 20)

    def test_existing_sample_cannot_be_silently_overwritten(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_sample(root, "sample-001")
            self.assertEqual(import_sample(root, "sample-001")["status"], "accepted")
            result = import_sample(root, "sample-001")
            self.assertEqual(result["status"], "rejected")
            self.assertIn("immutable", result["errors"][0])

    def test_audit_rejects_tampered_accepted_image(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_sample(root, "sample-001")
            self.assertEqual(import_sample(root, "sample-001")["status"], "accepted")
            image_path = root / "accepted/dataset_v0/images/sample-001.png"
            image_path.write_bytes(image_path.read_bytes() + b"tampered")
            result = audit_dataset(root)
            self.assertEqual(result["status"], "failed")
            self.assertTrue(any("SHA-256 mismatch" in error for error in result["errors"]))

    def test_flat_placeholder_image_is_rejected(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_sample(root, "sample-001")
            Image.new("RGB", (512, 384), (88, 145, 75)).save(
                root / "incoming/sample-001/target.png"
            )
            result = import_sample(root, "sample-001")
            self.assertEqual(result["status"], "rejected")
            self.assertTrue(any("variation" in error for error in result["errors"]))


def _stage_sample(root: Path, sample_id: str) -> None:
    sample_dir = root / "incoming" / sample_id
    sample_dir.mkdir(parents=True)
    image = Image.new("RGB", (512, 384), (88, 145, 75))
    draw = ImageDraw.Draw(image)
    for x in range(0, 512, 32):
        for y in range(0, 384, 32):
            draw.rectangle(
                (x, y, x + 31, y + 31),
                fill=((40 + x) % 255, (70 + y) % 255, (x + y) % 255),
            )
    image.save(sample_dir / "target.png")
    blueprint = {
        "schemaVersion": "world-blueprint-v0", "sceneId": sample_id,
        "width": 256, "height": 192, "seed": 3,
        "styleId": "bright-healing-topdown-pixel-v0",
        "terrainRegions": [{"id": "grass", "terrain": "grass", "polygon": [[0, 0], [255, 0], [255, 191], [0, 191]]}],
        "roads": [{"id": "road", "width": 8, "points": [[12, 180], [120, 100]]}],
        "objects": [{"id": "home", "kind": "shelter", "x": 110, "y": 80, "width": 30, "height": 24, "stage": 1}],
    }
    metadata = {
        "schemaVersion": "training-sample-metadata-v0", "sampleId": sample_id,
        "datasetVersion": "ai-painter-dataset-v0", "targetImage": "target.png",
        "blueprintFile": "blueprint.json",
        "source": {"kind": "ai_assisted_manual_creation", "toolName": "manual-tool",
                   "createdAt": "2026-06-12", "licenseBasis": "project-owned",
                   "humanApproved": True, "directCopyProhibited": True},
        "review": {"reviewer": "test-reviewer", "reviewedAt": "2026-06-12",
                   "rightsApproved": True, "blueprintApproved": True,
                   "visualQualityApproved": True},
        "notes": "test sample",
    }
    (sample_dir / "blueprint.json").write_text(json.dumps(blueprint), encoding="utf-8")
    (sample_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
