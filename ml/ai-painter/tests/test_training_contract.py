import ast
import json
from pathlib import Path
import unittest

from ai_painter.training.dataset import MASK_NAMES, load_split
from ai_painter.training.torch_runtime import describe_torch_runtime


ROOT = Path(__file__).resolve().parents[1]


class TrainingContractTests(unittest.TestCase):
    def test_condition_channel_order_is_fixed(self):
        self.assertEqual(MASK_NAMES, ("grass", "water", "road", "tree", "rock", "shelter", "walkable", "depth"))

    def test_model_config_matches_dataset_contract(self):
        config = json.loads((ROOT / "configs/model_tiny_unet_v0.json").read_text(encoding="utf-8"))
        self.assertEqual(config["inputChannels"], len(MASK_NAMES))
        self.assertEqual(config["outputChannels"], 3)
        self.assertEqual((config["imageWidth"], config["imageHeight"]), (256, 192))

    def test_training_sources_parse_without_torch_installed(self):
        for path in (ROOT / "src/ai_painter/training").glob("*.py"):
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

    def test_runtime_check_reports_missing_dependency_cleanly(self):
        runtime = describe_torch_runtime()
        self.assertIn("ready", runtime)


if __name__ == "__main__":
    unittest.main()
