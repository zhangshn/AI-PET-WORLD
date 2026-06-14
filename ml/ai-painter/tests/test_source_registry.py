import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.dataset.source_registry import register_source_originals


class SourceRegistryTests(unittest.TestCase):
    def test_source_original_is_registered_without_modifying_image(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source_dir = root / "source-originals" / "scene-001"
            source_dir.mkdir(parents=True)
            image_path = source_dir / "scene-001.png"
            Image.new("RGB", (256, 192), (32, 96, 64)).save(image_path)
            image_before = image_path.read_bytes()
            image_path.with_suffix(".source.json").write_text(
                json.dumps({"source": "project-original-test", "license": "project-owned"}),
                encoding="utf-8",
            )

            registry = register_source_originals(root)

            self.assertEqual(registry["sourceOriginalCount"], 1)
            self.assertEqual(image_path.read_bytes(), image_before)
            self.assertEqual(registry["assets"][0]["format"], "PNG")
            self.assertEqual(len(registry["assets"][0]["sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
