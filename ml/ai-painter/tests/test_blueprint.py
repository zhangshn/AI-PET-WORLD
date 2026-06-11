import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from ai_painter.blueprint.masks import MASK_NAMES, render_blueprint_masks
from ai_painter.blueprint.schema import load_blueprint


class BlueprintTests(unittest.TestCase):
    def test_valid_blueprint_renders_all_masks(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "blueprint.json"
            path.write_text(json.dumps(_blueprint()), encoding="utf-8")
            blueprint = load_blueprint(path)
            masks = render_blueprint_masks(blueprint, root / "masks")
            self.assertEqual(set(masks), set(MASK_NAMES))
            self.assertTrue(all(item.is_file() for item in masks.values()))

    def test_out_of_bounds_object_is_rejected(self) -> None:
        with TemporaryDirectory() as temporary:
            data = _blueprint()
            data["objects"][0]["x"] = 300
            path = Path(temporary) / "blueprint.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "outside the canvas"):
                load_blueprint(path)

    def test_object_extent_and_duplicate_ids_are_rejected(self) -> None:
        with TemporaryDirectory() as temporary:
            data = _blueprint()
            data["objects"][0]["x"] = 240
            data["objects"][0]["id"] = "road"
            path = Path(temporary) / "blueprint.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "extends beyond|duplicate"):
                load_blueprint(path)


def _blueprint() -> dict[str, object]:
    return {
        "schemaVersion": "world-blueprint-v0",
        "sceneId": "sample-001",
        "width": 256,
        "height": 192,
        "seed": 7,
        "styleId": "bright-healing-topdown-pixel-v0",
        "terrainRegions": [
            {"id": "grass", "terrain": "grass", "polygon": [[0, 0], [255, 0], [255, 191], [0, 191]]},
            {"id": "water", "terrain": "water", "polygon": [[220, 0], [255, 0], [255, 191], [220, 191]]},
        ],
        "roads": [{"id": "road", "width": 8, "points": [[10, 180], [120, 100]]}],
        "objects": [{"id": "home", "kind": "shelter", "x": 110, "y": 80, "width": 30, "height": 24, "stage": 1}],
    }


if __name__ == "__main__":
    unittest.main()
