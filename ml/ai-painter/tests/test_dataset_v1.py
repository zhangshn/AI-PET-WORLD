import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.dataset.v1_review import confirm_v1_sample
from ai_painter.training import dataset as dataset_module


class DatasetV1Tests(unittest.TestCase):
    def setUp(self) -> None:
        dataset_module.require_torch = lambda: FakeTorch()

    def test_v1_dataset_outputs_14_channel_condition_when_experimental_review_allowed(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v1_sample(root, review=True)
            dataset = dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1", allow_manual_review=True)
            item = dataset[0]
            self.assertEqual(item["condition"].shape, (14, 192, 256))
            self.assertEqual(item["target"].shape, (3, 192, 256))

    def test_confirmed_v1_dataset_outputs_14_channels(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v1_sample(root, review=True)
            confirm_v1_sample(root, "sample-001")
            dataset = dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1")
            self.assertEqual(dataset[0]["condition"].shape, (14, 192, 256))

    def test_missing_or_wrong_sized_mask_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v1_sample(root, review=True)
            confirm_v1_sample(root, "sample-001")
            (sample / "masks_v1" / "grass.png").unlink()
            with self.assertRaises(FileNotFoundError):
                dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1")[0]
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v1_sample(root, review=True)
            confirm_v1_sample(root, "sample-001")
            Image.new("L", (16, 16), 255).save(sample / "masks_v1" / "grass.png")
            with self.assertRaisesRegex(ValueError, "256x192"):
                dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1")[0]

    def test_review_pending_sample_is_blocked_from_official_training(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage_v1_sample(root, review=True)
            with self.assertRaisesRegex(ValueError, "requires manual review"):
                dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1")[0]

    def test_v1_review_hash_mismatch_is_blocked(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage_v1_sample(root, review=True)
            confirm_v1_sample(root, "sample-001")
            data = json.loads((sample / "blueprint.v1.json").read_text(encoding="utf-8"))
            data["seed"] = 99
            (sample / "blueprint.v1.json").write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1")[0]


class FakeTensor:
    def __init__(self, shape: tuple[int, ...]) -> None:
        self.shape = shape

    def permute(self, *order: int):
        return FakeTensor(tuple(self.shape[index] for index in order))

    def float(self):
        return self

    def div(self, _value: float):
        return self


class FakeTorch:
    def from_numpy(self, pixels):
        return FakeTensor(tuple(pixels.shape))

    def cat(self, tensors, dim: int = 0):
        values = list(tensors)
        shape = list(values[0].shape)
        shape[dim] = sum(item.shape[dim] for item in values)
        return FakeTensor(tuple(shape))


def _stage_v1_sample(root: Path, review: bool) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / "sample-001"
    sample.mkdir(parents=True)
    Image.new("RGB", (256, 192), (80, 120, 60)).save(sample / "target.png")
    blueprint = _v1(review)
    (sample / "blueprint.v1.json").write_text(json.dumps(blueprint), encoding="utf-8")
    render_v1_masks_from_file(sample / "blueprint.v1.json", sample / "masks_v1")
    (root / "indexes").mkdir()
    (root / "indexes" / "train.json").write_text(json.dumps({"sampleIds": ["sample-001"]}), encoding="utf-8")
    return sample


def _v1(review: bool) -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v1", "sceneId": "sample-001", "width": 256, "height": 192,
        "seed": 3, "styleId": "bright-healing-topdown-pixel-v0", "requiresManualReview": review,
        "manualReviewReasons": ["待复核"] if review else [], "structures": [
            {"id": f"{name}-1", "type": name, "geometry": {"kind": "rect", "x": 0, "y": 0, "width": 8, "height": 8}, "layer": index + 1, "requiresManualReview": review, "manualReviewReasons": ["待复核"] if review else [], **({"depthValue": 128} if name == "depth" else {})}
            for index, name in enumerate(V1_CONDITION_CHANNELS)
        ],
    }


if __name__ == "__main__":
    unittest.main()
