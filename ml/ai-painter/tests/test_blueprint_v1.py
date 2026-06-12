import json
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.blueprint.v0_to_v1 import convert_v0_file_to_v1
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_schema import load_v1_blueprint


class BlueprintV1Tests(unittest.TestCase):
    def test_valid_v1_blueprint_passes_and_renders_14_masks(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "blueprint.v1.json"
            path.write_text(json.dumps(_v1()), encoding="utf-8")
            blueprint = load_v1_blueprint(path)
            masks = render_v1_masks_from_file(path, root / "masks_v1")
            self.assertEqual(blueprint.schema_version, "world-blueprint-v1")
            self.assertEqual(tuple(masks), V1_CONDITION_CHANNELS)
            self.assertEqual(len(masks), 14)
            for mask in masks.values():
                with Image.open(mask) as image:
                    self.assertEqual(image.size, (256, 192))

    def test_invalid_schema_type_bounds_size_and_duplicates_are_rejected(self) -> None:
        cases = [
            ("schemaVersion", "world-blueprint-v0", "schemaVersion"),
            ("structures.0.type", "unknown", "type must be"),
            ("structures.0.geometry.x", 300, "outside"),
            ("structures.0.geometry.width", -1, "positive"),
            ("structures.1.id", "grass-1", "duplicate"),
        ]
        for dotted, value, message in cases:
            with self.subTest(dotted=dotted):
                data = _v1()
                _set(data, dotted, value)
                with TemporaryDirectory() as temporary:
                    path = Path(temporary) / "blueprint.v1.json"
                    path.write_text(json.dumps(data), encoding="utf-8")
                    with self.assertRaisesRegex(ValueError, message):
                        load_v1_blueprint(path)

    def test_v0_to_v1_conversion_is_stable_and_preserves_sources(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "blueprint.json"
            target = root / "target.png"
            source.write_text(json.dumps(_v0()), encoding="utf-8")
            Image.new("RGB", (256, 192), (80, 120, 60)).save(target)
            source_hash = sha256(source.read_bytes()).hexdigest()
            target_hash = sha256(target.read_bytes()).hexdigest()
            first = convert_v0_file_to_v1(source)
            second = convert_v0_file_to_v1(source)
            self.assertEqual(first, second)
            self.assertEqual(sha256(source.read_bytes()).hexdigest(), source_hash)
            self.assertEqual(sha256(target.read_bytes()).hexdigest(), target_hash)
            self.assertTrue(first["requiresManualReview"])
            self.assertTrue(_has_review(first, "shoreline"))
            self.assertTrue(_has_review(first, "tree_trunk"))
            self.assertTrue(_has_review(first, "shelter_wall"))
            self.assertTrue(_has_review(first, "shelter_roof"))
            self.assertFalse(any(item["type"] == "construction_material" for item in first["structures"]))

    def test_mask_hash_is_stable(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "blueprint.v1.json"
            path.write_text(json.dumps(_v1()), encoding="utf-8")
            first = render_v1_masks_from_file(path, root / "first")
            second = render_v1_masks_from_file(path, root / "second")
            self.assertEqual(
                {name: sha256(file.read_bytes()).hexdigest() for name, file in first.items()},
                {name: sha256(file.read_bytes()).hexdigest() for name, file in second.items()},
            )


def _has_review(data: dict[str, object], structure_type: str) -> bool:
    structures = data["structures"]
    assert isinstance(structures, list)
    return any(item["type"] == structure_type and item["requiresManualReview"] for item in structures)


def _set(data: dict[str, object], dotted: str, value: object) -> None:
    current: object = data
    parts = dotted.split(".")
    for part in parts[:-1]:
        current = current[int(part)] if part.isdigit() else current[part]  # type: ignore[index]
    if parts[-1].isdigit():
        current[int(parts[-1])] = value  # type: ignore[index]
    else:
        current[parts[-1]] = value  # type: ignore[index]


def _v1() -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v1", "sceneId": "sample-001", "width": 256, "height": 192,
        "seed": 3, "styleId": "bright-healing-topdown-pixel-v0", "requiresManualReview": True,
        "manualReviewReasons": ["测试草案"], "structures": [
            {"id": "grass-1", "type": "grass", "geometry": {"kind": "polygon", "points": [[0, 0], [255, 0], [255, 191], [0, 191]]}, "layer": 1, "requiresManualReview": False, "manualReviewReasons": []},
            {"id": "water-1", "type": "water_body", "geometry": {"kind": "rect", "x": 220, "y": 0, "width": 36, "height": 192}, "layer": 2, "requiresManualReview": False, "manualReviewReasons": []},
        ],
    }


def _v0() -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v0", "sceneId": "sample-001", "width": 256, "height": 192,
        "seed": 3, "styleId": "bright-healing-topdown-pixel-v0",
        "terrainRegions": [
            {"id": "grass", "terrain": "grass", "polygon": [[0, 0], [255, 0], [255, 191], [0, 191]]},
            {"id": "water", "terrain": "water", "polygon": [[220, 0], [255, 0], [255, 191], [220, 191]]},
        ],
        "roads": [{"id": "road", "width": 8, "points": [[12, 180], [120, 100]]}],
        "objects": [
            {"id": "tree", "kind": "tree", "x": 40, "y": 40, "width": 24, "height": 32},
            {"id": "home", "kind": "shelter", "x": 110, "y": 80, "width": 30, "height": 24, "stage": 1},
        ],
    }


if __name__ == "__main__":
    unittest.main()
