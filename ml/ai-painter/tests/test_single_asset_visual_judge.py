import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image, ImageDraw

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.assets import judge_single_asset


class SingleAssetVisualJudgeTests(unittest.TestCase):
    def test_simple_palette_candidate_fails_without_training_approval(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            ImageDraw.Draw(image).rectangle((32, 24, 95, 111), fill=(30, 100, 40, 255))
            image.save(root / "sprite.png")
            (root / "metadata.json").write_text(json.dumps({
                "assetId": "simple-tree",
                "category": "tree",
                "annotationSource": "layer_alpha_same_source",
                "quality": {"technicalGate": "passed"},
                "masks": {
                    "tree_trunk": {"path": "tree_trunk.png"},
                    "tree_crown": {"path": "tree_crown.png"},
                },
            }), encoding="utf-8")
            masks = root / "masks"
            masks.mkdir()
            mask = image.getchannel("A")
            mask.save(masks / "tree_trunk.png")
            mask.save(masks / "tree_crown.png")

            result = judge_single_asset(root)

            self.assertEqual(result["status"], "failed")
            self.assertFalse(result["checks"]["palette_depth"])
            self.assertEqual(result["vjB"]["status"], "failed")
            self.assertFalse(result["vjB"]["checks"]["vj_a_passed"])
            self.assertEqual(result["vjB"]["vjB2LearnedJudgeStatus"], "not_implemented")
            self.assertFalse(result["approvedForTraining"])
            self.assertTrue((root / "visual-review.json").is_file())


if __name__ == "__main__":
    unittest.main()
