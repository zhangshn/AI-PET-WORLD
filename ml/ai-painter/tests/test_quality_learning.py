import json
import ast
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_painter.dataset.hashing import sha256_file
from ai_painter.quality_learning import inspect_quality_dataset
from ai_painter.quality_learning.model import build_quality_judge_model


class QualityLearningTests(unittest.TestCase):
    def test_empty_dataset_is_blocked(self) -> None:
        with TemporaryDirectory() as temporary:
            report = inspect_quality_dataset(Path(temporary))
            self.assertFalse(report["ready"])
            self.assertEqual(report["counts"], {})
            self.assertEqual(len(report["blockersZh"]), 2)

    def test_valid_self_owned_sample_is_counted(self) -> None:
        with TemporaryDirectory() as temporary:
            sample = Path(temporary) / "samples" / "tree-good-001"
            sample.mkdir(parents=True)
            image_path = sample / "sprite.png"
            Image.new("RGB", (128, 128), (40, 120, 55)).save(image_path)
            (sample / "label.json").write_text(json.dumps({
                "schemaVersion": "vj-b2-quality-sample-v1",
                "sampleId": "tree-good-001",
                "category": "tree",
                "qualityLabel": "acceptable",
                "sourceKind": "self_owned_project_asset",
                "imageSha256": sha256_file(image_path),
                "evidenceZh": ["材质层次达到项目目标。"],
                "lineage": {
                    "sourceAssetId": "tree-good-source-001",
                    "variationKind": "original",
                    "creationMethod": "project_layered_asset",
                },
            }, ensure_ascii=False), encoding="utf-8")
            report = inspect_quality_dataset(Path(temporary))
            self.assertEqual(report["counts"]["acceptable"], 1)
            self.assertFalse(report["ready"])

    def test_model_source_is_lazy_without_torch_import(self) -> None:
        self.assertTrue(callable(build_quality_judge_model))

    def test_quality_learning_sources_and_scripts_parse(self) -> None:
        root = Path(__file__).resolve().parents[1]
        paths = list((root / "src/ai_painter/quality_learning").glob("*.py"))
        paths += [root / "scripts/train_vj_b2.py", root / "scripts/judge_vj_b2.py"]
        for path in paths:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

    def test_duplicate_image_is_rejected(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index in (1, 2):
                sample = root / "samples" / f"tree-bad-{index:03d}"
                sample.mkdir(parents=True)
                image_path = sample / "sprite.png"
                Image.new("RGB", (128, 128), (20, 70, 30)).save(image_path)
                (sample / "label.json").write_text(json.dumps({
                    "schemaVersion": "vj-b2-quality-sample-v1",
                    "sampleId": sample.name,
                    "category": "tree",
                    "qualityLabel": "unacceptable",
                    "sourceKind": "self_owned_project_asset",
                    "imageSha256": sha256_file(image_path),
                    "evidenceZh": ["重复测试样本。"],
                    "lineage": {
                        "sourceAssetId": f"source-{index}",
                        "variationKind": "duplicate_test",
                        "creationMethod": "unit_test",
                    },
                }, ensure_ascii=False), encoding="utf-8")
            report = inspect_quality_dataset(root)
            self.assertEqual(report["counts"]["unacceptable"], 1)
            self.assertEqual(len(report["errors"]), 1)
            self.assertIn("完全重复", report["errors"][0]["reasonZh"])

    def test_missing_lineage_is_rejected(self) -> None:
        with TemporaryDirectory() as temporary:
            sample = Path(temporary) / "samples" / "tree-bad-001"
            sample.mkdir(parents=True)
            image_path = sample / "sprite.png"
            Image.new("RGB", (128, 128), (20, 80, 30)).save(image_path)
            (sample / "label.json").write_text(json.dumps({
                "schemaVersion": "vj-b2-quality-sample-v1",
                "sampleId": sample.name,
                "category": "tree",
                "qualityLabel": "unacceptable",
                "sourceKind": "self_owned_project_asset",
                "imageSha256": sha256_file(image_path),
                "evidenceZh": ["缺少来源谱系。"],
            }, ensure_ascii=False), encoding="utf-8")
            report = inspect_quality_dataset(Path(temporary))
            self.assertEqual(len(report["errors"]), 1)
            self.assertIn("lineage", report["errors"][0]["reasonZh"])


if __name__ == "__main__":
    unittest.main()
