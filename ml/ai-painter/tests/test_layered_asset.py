import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image, ImageDraw

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.assets import build_layered_asset


class LayeredAssetTests(unittest.TestCase):
    def test_layers_generate_same_source_sprite_and_masks(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            trunk = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
            ImageDraw.Draw(trunk).rectangle((14, 16, 18, 29), fill=(110, 62, 31, 255))
            trunk.save(root / "trunk.png")
            crown = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
            ImageDraw.Draw(crown).ellipse((5, 2, 27, 22), fill=(48, 142, 61, 255))
            crown.save(root / "crown.png")
            manifest = root / "asset.json"
            manifest.write_text(json.dumps({
                "schemaVersion": "layered-pixel-asset-v1",
                "assetId": "tree-test-001", "category": "tree",
                "size": [32, 32], "anchor": [16, 29],
                "layers": [
                    {"id": "trunk", "file": "trunk.png", "channel": "tree_trunk", "zIndex": 10},
                    {"id": "crown", "file": "crown.png", "channel": "tree_crown", "zIndex": 20},
                ],
            }), encoding="utf-8")

            result = build_layered_asset(manifest, root / "accepted")

            output = root / "accepted/tree-test-001"
            self.assertTrue((output / "sprite.png").is_file())
            self.assertTrue((output / "masks/tree_trunk.png").is_file())
            self.assertTrue((output / "masks/tree_crown.png").is_file())
            self.assertTrue((output / "masks/object_alpha.png").is_file())
            self.assertEqual(result["annotationSource"], "layer_alpha_same_source")
            self.assertTrue(result["trainable"])
            self.assertEqual(result["quality"]["technicalGate"], "passed")

    def test_non_alpha_layer_is_rejected(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            Image.new("RGB", (16, 16), "green").save(root / "flat.png")
            manifest = root / "asset.json"
            manifest.write_text(json.dumps({
                "schemaVersion": "layered-pixel-asset-v1",
                "assetId": "bad-asset", "category": "tree",
                "size": [16, 16], "anchor": [8, 15],
                "layers": [{"id": "crown", "file": "flat.png", "channel": "tree_crown", "zIndex": 1}],
            }), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "有效 Alpha"):
                build_layered_asset(manifest, root / "accepted")

    def test_engineering_asset_is_not_trainable(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            Image.new("RGBA", (8, 8), (20, 80, 30, 255)).save(root / "layer.png")
            manifest = root / "asset.json"
            manifest.write_text(json.dumps({
                "schemaVersion": "layered-pixel-asset-v1",
                "assetId": "engineering-tree", "category": "tree",
                "admission": "engineering_only",
                "size": [8, 8], "anchor": [4, 7],
                "layers": [{"id": "crown", "file": "layer.png", "channel": "tree_crown", "zIndex": 1}],
            }), encoding="utf-8")

            result = build_layered_asset(manifest, root / "engineering")

            self.assertFalse(result["trainable"])
            self.assertEqual(result["admission"], "engineering_only")

    def test_candidate_asset_is_not_trainable(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            Image.new("RGBA", (8, 8), (20, 80, 30, 255)).save(root / "layer.png")
            manifest = root / "asset.json"
            manifest.write_text(json.dumps({
                "schemaVersion": "layered-pixel-asset-v1",
                "assetId": "candidate-tree", "category": "tree",
                "admission": "candidate",
                "size": [8, 8], "anchor": [4, 7],
                "layers": [{"id": "crown", "file": "layer.png", "channel": "tree_crown", "zIndex": 1}],
            }), encoding="utf-8")
            result = build_layered_asset(manifest, root / "candidate")
            self.assertFalse(result["trainable"])
            self.assertEqual(result["admission"], "candidate")
            self.assertEqual(result["quality"]["visualGate"], "pending")
            self.assertFalse(result["quality"]["approvedForTraining"])


if __name__ == "__main__":
    unittest.main()
