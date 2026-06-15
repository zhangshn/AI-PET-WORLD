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

    def test_sparse_tree_uses_explicit_edge_profile(self) -> None:
        sprite = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        trunk = Image.new("L", sprite.size, 0)
        crown = Image.new("L", sprite.size, 0)

        default = judge_target_quality_proxy(
            sprite,
            {"tree_trunk": trunk, "tree_crown": crown},
            "tree",
            True,
        )
        sparse = judge_target_quality_proxy(
            sprite,
            {"tree_trunk": trunk, "tree_crown": crown},
            "tree",
            True,
            "sparse_tree",
        )

        self.assertEqual(default["internalEdgeRange"], [0.07, 0.48])
        self.assertEqual(sparse["internalEdgeRange"], [0.07, 0.58])
        self.assertEqual(sparse["visualProfile"], "sparse_tree")


if __name__ == "__main__":
    unittest.main()
