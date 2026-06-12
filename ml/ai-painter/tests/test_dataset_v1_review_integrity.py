import json
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.dataset.v1_review import confirm_v1_sample
from ai_painter.training import dataset as dataset_module


class DatasetV1ReviewIntegrityTests(unittest.TestCase):
    def setUp(self) -> None:
        dataset_module.require_torch = lambda: FakeTorch()

    def test_all_pending_structures_approved_succeeds(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            record = confirm_v1_sample(root, "sample-001", _submission(root))
            self.assertEqual(record["maskCount"], 14)
            self.assertEqual(len(record["confirmedStructureIds"]), 14)

    def test_empty_submission_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            with self.assertRaisesRegex(ValueError, "submission"):
                confirm_v1_sample(root, "sample-001", {})

    def test_empty_reviewer_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["reviewer"] = ""
            with self.assertRaisesRegex(ValueError, "reviewer"):
                confirm_v1_sample(root, "sample-001", submission)

    def test_missing_structure_decision_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["decisions"] = submission["decisions"][:-1]
            with self.assertRaisesRegex(ValueError, "missing review decision"):
                confirm_v1_sample(root, "sample-001", submission)

    def test_duplicate_structure_decision_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["decisions"].append(dict(submission["decisions"][0]))
            with self.assertRaisesRegex(ValueError, "duplicate"):
                confirm_v1_sample(root, "sample-001", submission)

    def test_unknown_structure_decision_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["decisions"][0]["structureId"] = "missing-structure"
            with self.assertRaisesRegex(ValueError, "unknown structure"):
                confirm_v1_sample(root, "sample-001", submission)

    def test_rejected_decision_fails(self) -> None:
        self._decision_fails("rejected")

    def test_needs_correction_decision_fails(self) -> None:
        self._decision_fails("needs_correction")

    def test_blueprint_hash_mismatch_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["blueprintHash"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "blueprint hash mismatch"):
                confirm_v1_sample(root, "sample-001", submission)

    def test_target_hash_mismatch_fails(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["targetImageHash"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "target"):
                confirm_v1_sample(root, "sample-001", submission)

    def test_modified_blueprint_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            data = _read(sample / "blueprint.v1.json")
            data["seed"] = 9
            _write(sample / "blueprint.v1.json", data)
            self._dataset_fails(root, "blueprint hash mismatch")

    def test_replaced_target_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            Image.new("RGB", (256, 192), (10, 20, 30)).save(sample / "target.png")
            self._dataset_fails(root, "target.png hash mismatch")

    def test_modified_target_bytes_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            with (sample / "target.png").open("ab") as handle:
                handle.write(b"x")
            self._dataset_fails(root, "target.png hash mismatch")

    def test_replaced_mask_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            Image.new("L", (256, 192), 0).save(sample / "masks_v1" / "grass.png")
            self._dataset_fails(root, "mask hash mismatch")

    def test_modified_mask_bytes_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            with (sample / "masks_v1" / "grass.png").open("ab") as handle:
                handle.write(b"x")
            self._dataset_fails(root, "mask hash mismatch")

    def test_deleted_mask_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            (sample / "masks_v1" / "grass.png").unlink()
            self._dataset_fails(root, "missing mask file")

    def test_unknown_extra_mask_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            Image.new("L", (256, 192), 0).save(sample / "masks_v1" / "unknown.png")
            self._dataset_fails(root, "unknown mask file")

    def test_mask_size_change_after_review_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            Image.new("L", (16, 16), 0).save(sample / "masks_v1" / "grass.png")
            self._dataset_fails(root, "mask hash mismatch|mask size mismatch")

    def test_mask_count_not_14_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            record = _read(sample / "blueprint.v1.review.json")
            record["maskCount"] = 13
            _write(sample / "blueprint.v1.review.json", record)
            self._dataset_fails(root, "mask count")

    def test_old_record_cannot_cover_new_blueprint(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            data = _read(sample / "blueprint.v1.json")
            data["styleId"] = "new-style"
            _write(sample / "blueprint.v1.json", data)
            self._dataset_fails(root, "blueprint hash mismatch")

    def test_unresolved_review_after_record_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            data = _read(sample / "blueprint.v1.json")
            data["requiresManualReview"] = True
            data["structures"][0]["requiresManualReview"] = True
            _write(sample / "blueprint.v1.json", data)
            record = _read(sample / "blueprint.v1.review.json")
            record["blueprintHash"] = _sha256_file(sample / "blueprint.v1.json")
            _write(sample / "blueprint.v1.review.json", record)
            self._dataset_fails(root, "requires manual review")

    def test_missing_review_record_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            (sample / "blueprint.v1.review.json").unlink()
            self._dataset_fails(root, "missing or invalid")

    def test_broken_review_record_json_blocks_dataset(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            sample = _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            (sample / "blueprint.v1.review.json").write_text("{", encoding="utf-8")
            self._dataset_fails(root, "missing or invalid")

    def test_normal_reviewed_dataset_still_outputs_14_channels(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            confirm_v1_sample(root, "sample-001", _submission(root))
            item = dataset_module.WorldSceneDataset(root, "train", blueprint_version="v1")[0]
            self.assertEqual(item["condition"].shape, (14, 192, 256))

    def _decision_fails(self, decision: str) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _stage(root)
            submission = _submission(root)
            submission["decisions"][0]["decision"] = decision
            with self.assertRaisesRegex(ValueError, "blocks training"):
                confirm_v1_sample(root, "sample-001", submission)

    def _dataset_fails(self, root: Path, message: str) -> None:
        with self.assertRaisesRegex(ValueError, message):
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


def _stage(root: Path) -> Path:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / "sample-001"
    sample.mkdir(parents=True)
    Image.new("RGB", (256, 192), (80, 120, 60)).save(sample / "target.png")
    _write(sample / "blueprint.v1.json", _blueprint())
    render_v1_masks_from_file(sample / "blueprint.v1.json", sample / "masks_v1")
    (root / "indexes").mkdir()
    (root / "indexes" / "train.json").write_text(json.dumps({"sampleIds": ["sample-001"]}), encoding="utf-8")
    return sample


def _submission(root: Path) -> dict[str, object]:
    sample = root / "accepted" / "dataset_v0" / "scene" / "world" / "sample-001"
    blueprint = _read(sample / "blueprint.v1.json")
    return {
        "sampleId": "sample-001",
        "reviewer": "reviewer-a",
        "blueprintHash": _sha256_file(sample / "blueprint.v1.json"),
        "targetImageHash": _sha256_file(sample / "target.png"),
        "overallDecision": "approved",
        "overallConfirmation": True,
        "decisions": [
            {"structureId": item["id"], "type": item["type"], "decision": "approved", "reviewerNote": "确认"}
            for item in blueprint["structures"]
        ],
    }


def _blueprint() -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": "sample-001",
        "width": 256,
        "height": 192,
        "seed": 3,
        "styleId": "bright-healing-topdown-pixel-v0",
        "requiresManualReview": True,
        "manualReviewReasons": ["待复核"],
        "structures": [
            {
                "id": f"{name}-1",
                "type": name,
                "geometry": {"kind": "rect", "x": 0, "y": 0, "width": 8, "height": 8},
                "layer": index + 1,
                "requiresManualReview": True,
                "manualReviewReasons": ["待复核"],
                **({"depthValue": 128} if name == "depth" else {}),
            }
            for index, name in enumerate(V1_CONDITION_CHANNELS)
        ],
    }


def _read(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, data: dict[str, object]) -> None:
    path.write_text(_json(data), encoding="utf-8")


def _json(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    unittest.main()
