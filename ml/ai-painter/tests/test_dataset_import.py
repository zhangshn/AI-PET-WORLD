import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.dataset import (
    audit_dataset,
    build_candidate,
    build_dataset_indexes,
    judge_candidate,
    register_source_originals,
    run_auto_annotation_pipeline,
)
from ai_painter.dataset.source_registry import load_registered_asset


class ModuleDAutoAnnotationTests(unittest.TestCase):
    def test_source_original_is_registered_and_immutable(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            image_path = _source(root, "scene-001")
            before = image_path.read_bytes()
            registry = register_source_originals(root)
            self.assertEqual(registry["sourceOriginalCount"], 1)
            self.assertEqual(image_path.read_bytes(), before)
            self.assertEqual(registry["assets"][0]["format"], "PNG")
            self.assertEqual(len(registry["assets"][0]["sha256"]), 64)

    def test_legacy_coarse_annotation_cannot_train(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            legacy = root / "accepted/dataset_v0/scene/world/old-001"
            legacy.mkdir(parents=True)
            (legacy / "metadata.json").write_text(
                json.dumps({"sampleId": "old-001", "status": "accepted"}), encoding="utf-8"
            )
            summary = build_dataset_indexes(root)
            self.assertEqual(summary["accepted"], 0)
            self.assertEqual(json.loads((root / "indexes/train.json").read_text())["sampleIds"], [])

    def test_auto_annotation_generates_blueprint_and_14_masks(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _source(root, "scene-001")
            result = run_auto_annotation_pipeline(root, "scene-001")
            self.assertEqual(result["status"], "accepted")
            self.assertEqual(tuple(result["files"]["masks"].keys()), V1_CONDITION_CHANNELS)
            self.assertEqual(result["judge"]["status"], "passed")
            self.assertEqual(audit_dataset(root)["status"], "passed")

    def test_abnormal_full_canvas_mask_is_rejected(self) -> None:
        candidate = _candidate()
        ImageDraw.Draw(candidate["masks"]["walkable"]).rectangle((0, 0, 255, 191), fill=255)
        report = judge_candidate(candidate)
        self.assertTrue(any("full-canvas" in error for error in report["errors"]))

    def test_huge_approximate_box_is_rejected(self) -> None:
        candidate = _candidate()
        candidate["blueprint"]["structures"].append({
            **candidate["blueprint"]["structures"][0],
            "id": "bad-box",
            "geometry": {"kind": "polygon", "points": [[0, 0], [255, 0], [255, 191], [0, 191]]},
        })
        report = judge_candidate(candidate)
        self.assertTrue(any("huge approximate box" in error for error in report["errors"]))

    def test_out_of_bounds_geometry_is_rejected(self) -> None:
        candidate = _candidate()
        candidate["blueprint"]["structures"][0]["geometry"] = {
            "kind": "polygon", "points": [[-1, 0], [10, 0], [10, 10]],
        }
        report = judge_candidate(candidate)
        self.assertTrue(any("out of bounds" in error for error in report["errors"]))

    def test_water_without_matching_shoreline_is_rejected(self) -> None:
        candidate = _candidate()
        candidate["masks"]["shoreline"] = Image.new("L", (256, 192), 0)
        report = judge_candidate(candidate)
        self.assertTrue(any("shoreline" in error for error in report["errors"]))

    def test_bad_road_structure_is_rejected(self) -> None:
        candidate = _candidate()
        candidate["masks"]["road_center"] = Image.new("L", (256, 192), 0)
        report = judge_candidate(candidate)
        self.assertTrue(any("road edge requires road center" in error for error in report["errors"]))

    def test_walkable_obstacle_conflict_is_rejected(self) -> None:
        candidate = _candidate()
        candidate["masks"]["walkable"] = candidate["masks"]["rock"].copy()
        report = judge_candidate(candidate)
        self.assertTrue(any("walkable conflicts" in error for error in report["errors"]))

    def test_low_confidence_sample_enters_quarantine(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _source(root, "scene-001")
            bad = _candidate(root, "scene-001")
            bad["blueprint"]["structures"][0]["confidence"] = 0.1
            with patch("ai_painter.dataset.auto_pipeline.build_candidate", return_value=bad):
                result = run_auto_annotation_pipeline(root, "scene-001")
            self.assertEqual(result["status"], "quarantined")
            self.assertTrue((root / "annotation-quarantine/scene-001/report.json").is_file())

    def test_judge_failed_sample_cannot_enter_index(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _source(root, "scene-001")
            result = run_auto_annotation_pipeline(root, "scene-001")
            quarantine = root / "annotation-quarantine/scene-001"
            quarantine.mkdir(parents=True)
            (quarantine / "report.json").write_text(json.dumps({"status": "quarantined"}), encoding="utf-8")
            summary = build_dataset_indexes(root)
            self.assertEqual(result["status"], "accepted")
            self.assertEqual(summary["accepted"], 0)

    def test_passed_samples_stably_enter_train_and_validation(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index in range(6):
                sample_id = f"scene-{index:03d}"
                _source(root, sample_id)
                self.assertEqual(run_auto_annotation_pipeline(root, sample_id)["status"], "accepted")
            first = build_dataset_indexes(root, 0.2)
            train_first = (root / "indexes/train.json").read_text(encoding="utf-8")
            second = build_dataset_indexes(root, 0.2)
            self.assertEqual(first, second)
            self.assertEqual(train_first, (root / "indexes/train.json").read_text(encoding="utf-8"))
            self.assertGreater(first["train"], 0)
            self.assertGreater(first["validation"], 0)


def _candidate(root: Path | None = None, sample_id: str = "scene-001") -> dict:
    if root is None:
        temporary = TemporaryDirectory()
        root = Path(temporary.name)
        _candidate._temporary = temporary
    _source(root, sample_id)
    register_source_originals(root)
    asset = load_registered_asset(root, sample_id)
    return build_candidate(asset)


def _source(root: Path, sample_id: str) -> Path:
    source_dir = root / "source-originals" / sample_id
    source_dir.mkdir(parents=True, exist_ok=True)
    path = source_dir / f"{sample_id}.png"
    if not path.exists():
        image = Image.new("RGB", (256, 192), (18, 22, 18))
        draw = ImageDraw.Draw(image)
        draw.polygon([(12, 8), (242, 10), (238, 178), (18, 180)], fill=(92, 155, 70))
        draw.rectangle((18, 18, 78, 58), fill=(55, 120, 185))
        draw.rectangle((42, 110, 178, 122), fill=(145, 118, 70))
        draw.ellipse((124, 48, 160, 84), fill=(48, 125, 55))
        draw.rectangle((138, 78, 146, 104), fill=(105, 60, 35))
        draw.rectangle((196, 126, 214, 142), fill=(120, 120, 118))
        draw.rectangle((86, 130, 126, 138), fill=(140, 95, 60))
        draw.rectangle((90, 112, 122, 130), fill=(170, 125, 85))
        draw.polygon([(84, 112), (106, 94), (128, 112)], fill=(150, 55, 45))
        image.save(path)
    sidecar = path.with_suffix(".source.json")
    sidecar.write_text(
        json.dumps({"source": "project-original-test", "license": "project-owned-training-ok"}),
        encoding="utf-8",
    )
    return path


if __name__ == "__main__":
    unittest.main()
