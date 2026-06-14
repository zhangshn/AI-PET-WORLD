from pathlib import Path
import sys
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.assets.visual_judge_b import judge_target_quality_proxy


class SingleAssetVisualJudgeBTests(unittest.TestCase):
    def test_flat_same_material_tree_is_rejected(self) -> None:
        sprite = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        draw = ImageDraw.Draw(sprite)
        draw.rectangle((56, 64, 72, 118), fill=(55, 100, 50, 255))
        draw.ellipse((24, 16, 104, 88), fill=(55, 100, 50, 255))
        alpha = sprite.getchannel("A")

        result = judge_target_quality_proxy(
            sprite,
            {"tree_trunk": alpha, "tree_crown": alpha},
            "tree",
            True,
        )

        self.assertEqual(result["status"], "failed")
        self.assertFalse(result["checks"]["palette_richness"])
        self.assertFalse(result["checks"]["material_layer_separation"])
        self.assertFalse(result["approvedForTraining"])
        self.assertEqual(result["vjB2LearnedJudgeStatus"], "not_implemented")


if __name__ == "__main__":
    unittest.main()
