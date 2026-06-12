import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.dataset.v1_audit import audit_v1_dataset
from ai_painter.dataset.v1_review import confirm_v1_sample


class DatasetV1AuditTests(unittest.TestCase):
    def test_empty_dataset_reports_zero_counts(self) -> None:
        with TemporaryDirectory() as temporary:
            report = audit_v1_dataset(Path(temporary))
            self.assertEqual(report["totalScenes"], 0)
            self.assertEqual(report["trainableV1"], 0)
            self.assertEqual(report["blockedV1"], 0)

    def test_pending_v1_sample_is_blocked(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_sample(root, review=True)
            report = audit_v1_dataset(root)
            self.assertEqual(report["totalScenes"], 1)
            self.assertEqual(report["v1Drafts"], 1)
            self.assertEqual(report["trainableV1"], 0)
            self.assertEqual(report["blockedV1"], 1)

    def test_confirmed_v1_sample_is_trainable(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_sample(root, review=True)
            confirm_v1_sample(root, "sample-001")
            report = audit_v1_dataset(root)
            self.assertEqual(report["reviewedV1"], 1)
            self.assertEqual(report["trainableV1"], 1)
            self.assertEqual(report["blockedV1"], 0)

    def test_missing_mask_is_reported(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_sample(root, review=True)
            confirm_v1_sample(root, "sample-001")
            (sample / "masks_v1" / "grass.png").unlink()
            report = audit_v1_dataset(root)
            self.assertEqual(report["trainableV1"], 0)
            self.assertEqual(report["blockedV1"], 1)
            self.assertTrue(any("grass" in reason for reason in report["samples"][0]["blockingReasons"]))


def _stage_sample(root: Path, review: bool) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / "sample-001"
    sample.mkdir(parents=True)
    Image.new("RGB", (256, 192), (80, 120, 60)).save(sample / "target.png")
    (sample / "blueprint.json").write_text(json.dumps({"schemaVersion": "world-blueprint-v0"}), encoding="utf-8")
    (sample / "blueprint.v1.json").write_text(json.dumps(_v1(review)), encoding="utf-8")
    render_v1_masks_from_file(sample / "blueprint.v1.json", sample / "masks_v1")
    return sample


def _v1(review: bool) -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": "sample-001",
        "width": 256,
        "height": 192,
        "seed": 3,
        "styleId": "bright-healing-topdown-pixel-v0",
        "requiresManualReview": review,
        "manualReviewReasons": ["待复核"] if review else [],
        "structures": [
            {
                "id": f"{name}-1",
                "type": name,
                "geometry": {"kind": "rect", "x": 0, "y": 0, "width": 8, "height": 8},
                "layer": index + 1,
                "requiresManualReview": review,
                "manualReviewReasons": ["待复核"] if review else [],
                **({"depthValue": 128} if name == "depth" else {}),
            }
            for index, name in enumerate(V1_CONDITION_CHANNELS)
        ],
    }


if __name__ == "__main__":
    unittest.main()
