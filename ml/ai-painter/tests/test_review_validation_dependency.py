"""Prevent read-only training validation from pulling in annotation writers."""
import os
from pathlib import Path
import subprocess
import sys
import unittest


class ReviewValidationDependencyTests(unittest.TestCase):
    def test_training_reader_does_not_import_annotation_writers(self) -> None:
        source = Path(__file__).resolve().parents[1] / "src"
        result = subprocess.run(
            [sys.executable, "-c", "\n".join([
                "import sys",
                "from ai_painter.training.dataset import WorldSceneDataset",
                "assert not any(n.startswith('ai_painter.dataset') for n in sys.modules)",
                "assert 'ai_painter.blueprint.v1_masks' not in sys.modules",
                "assert 'torch' not in sys.modules",
            ])],
            env={**os.environ, "PYTHONPATH": str(source)},
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_existing_review_api_uses_same_validator(self) -> None:
        from ai_painter.blueprint.review_validation import validate_v1_review_record
        from ai_painter.dataset import v1_review

        self.assertIs(v1_review.validate_v1_review_record, validate_v1_review_record)
