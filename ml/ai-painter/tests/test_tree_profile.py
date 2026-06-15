from pathlib import Path
import sys
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.assets.tree_profile import build_tree_drawing_profile, compare_with_reference_profiles


class TreeProfileTests(unittest.TestCase):
    def test_profile_records_structure_and_source_parameters(self) -> None:
        sprite, masks = self._tree()
        profile = build_tree_drawing_profile(
            "tree-profile-test", sprite, masks, {"seed": 42, "trunkWidth": 8},
        )

        self.assertEqual(profile["sourceParameters"]["seed"], 42)
        self.assertTrue(profile["structure"]["trunkCrownConnected"])
        self.assertTrue(profile["structure"]["verticalOrderValid"])
        self.assertGreater(profile["crown"]["areaRatio"], profile["trunk"]["areaRatio"])

    def test_comparison_uses_reference_features_not_exact_pixels(self) -> None:
        sprite, masks = self._tree()
        reference = build_tree_drawing_profile("reference", sprite, masks)
        candidate = build_tree_drawing_profile("candidate", sprite, masks)

        rejected_sprite = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        rejected_trunk = Image.new("L", rejected_sprite.size, 0)
        rejected_crown = Image.new("L", rejected_sprite.size, 0)
        ImageDraw.Draw(rejected_sprite).rectangle((4, 60, 124, 72), fill=(40, 120, 50, 255))
        ImageDraw.Draw(rejected_crown).rectangle((4, 60, 124, 72), fill=255)
        rejected = build_tree_drawing_profile(
            "rejected", rejected_sprite, {"tree_trunk": rejected_trunk, "tree_crown": rejected_crown},
        )
        report = compare_with_reference_profiles(candidate, [reference], [rejected])

        self.assertEqual(report["recommendation"], "reference_match")
        self.assertEqual(report["nearestReferences"][0]["assetId"], "reference")
        self.assertGreaterEqual(report["similarityScore"], 0.99)

    @staticmethod
    def _tree():
        sprite = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        trunk = Image.new("L", sprite.size, 0)
        crown = Image.new("L", sprite.size, 0)
        ImageDraw.Draw(sprite).rectangle((58, 55, 70, 118), fill=(112, 67, 32, 255))
        ImageDraw.Draw(trunk).rectangle((58, 55, 70, 118), fill=255)
        ImageDraw.Draw(sprite).ellipse((24, 12, 104, 82), fill=(55, 130, 63, 255))
        ImageDraw.Draw(crown).ellipse((24, 12, 104, 82), fill=255)
        return sprite, {"tree_trunk": trunk, "tree_crown": crown}


if __name__ == "__main__":
    unittest.main()
