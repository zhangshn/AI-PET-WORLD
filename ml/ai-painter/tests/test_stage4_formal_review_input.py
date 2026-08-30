from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world.stage4_checkpoint_boundary_gate import (
    audit_route_boundary_from_rgb,
)
from ai_painter.complete_world.stage4_formal_review_input import (
    FormalReviewInputError,
    formal_review_boundary_inputs,
)


ROOT = Path(__file__).resolve().parents[3]
DATASET_MANIFEST = ROOT / (
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-"
    "2026-08-02T01-38-05-149Z/manifest.json"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def active_gate_config() -> dict:
    return {
        "training": {
            "finalRgbBoundaryCheckpointNonRegressionGate": {
                "contractVersion": (
                    "stage4-final-rgb-boundary-checkpoint-non-regression-v1"
                ),
                "enabled": True,
                "role": "checkpoint_eligibility_gate_only",
                "reviewContractId": "condition-semantic-boundary-contact-v3",
                "source": (
                    "normalized_final_rgb_and_same_record_formal_condition_mask"
                ),
                "metricOnly": True,
                "trainingLossContribution": False,
                "bestCheckpointMetricWeight": False,
            }
        }
    }


def sample_194() -> dict:
    manifest = json.loads(DATASET_MANIFEST.read_text(encoding="utf-8"))
    source_index = json.loads(
        (ROOT / manifest["sourceIndexPath"]).read_text(encoding="utf-8")
    )
    rows = [
        row
        for row in source_index["samples"]
        if row.get("conditionLabel") == "v7-complete-map-194"
    ]
    if len(rows) != 1:
        raise AssertionError("sample 194 formal identity is not unique")
    return rows[0]


def direct_formal_sharp(source: Path, target: Path) -> None:
    script = """
import sharp from "sharp";
const [sourcePath, outputPath] = process.argv.slice(1);
await sharp(sourcePath, { failOn: "error" })
  .removeAlpha()
  .resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest })
  .png()
  .toFile(outputPath);
""".strip()
    result = subprocess.run(
        [
            "node",
            "--input-type=module",
            "--eval",
            script,
            str(source),
            str(target),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)


class Stage4FormalReviewInputTests(unittest.TestCase):
    def test_quantization_and_sharp_normalization_are_byte_identical(self):
        row = sample_194()
        values = torch.linspace(-0.2, 1.2, 3 * 4 * 6).reshape(3, 4, 6)
        with tempfile.TemporaryDirectory(dir=ROOT / ".runtime") as temp:
            temp_path = Path(temp)
            result = formal_review_boundary_inputs(
                values,
                row,
                active_gate_config(),
                artifact_directory=temp_path,
                artifact_stem="formal-byte-identity",
                project_root=ROOT,
            )
            source = ROOT / result["identity"]["sourcePreviewPath"]
            normalized = ROOT / result["identity"]["normalizedReviewRgbPath"]

            expected_pixels = (
                values.detach()
                .clamp(0.0, 1.0)
                .mul(255)
                .byte()
                .permute(1, 2, 0)
                .cpu()
                .numpy()
            )
            expected_source = temp_path / "independent-source.png"
            Image.fromarray(expected_pixels).save(
                expected_source, format="PNG", optimize=True
            )
            self.assertEqual(source.read_bytes(), expected_source.read_bytes())

            expected_normalized = temp_path / "independent-normalized.png"
            direct_formal_sharp(expected_source, expected_normalized)
            self.assertEqual(
                normalized.read_bytes(), expected_normalized.read_bytes()
            )
            self.assertEqual(
                result["identity"]["normalizedReviewRgbSha256"],
                sha256(expected_normalized),
            )
            self.assertEqual(result["rgb"].shape, (1024 * 768, 3))
            self.assertEqual(result["rgb"].dtype, np.uint8)
            self.assertEqual(result["expected"].shape, (1024 * 768,))
            self.assertEqual(result["expected"].dtype, np.uint8)

    def test_windows_safe_sharp_normalization_preserves_long_artifact_identity(self):
        row = sample_194()
        values = torch.linspace(0.0, 1.0, 3 * 4 * 6).reshape(3, 4, 6)
        with tempfile.TemporaryDirectory(dir=ROOT / ".runtime") as temp:
            temp_path = Path(temp)
            long_directory = temp_path
            while len(str(long_directory / "long-path-source.png")) <= 300:
                long_directory /= "formal-review-long-path-segment"
            result = formal_review_boundary_inputs(
                values,
                row,
                active_gate_config(),
                artifact_directory=long_directory,
                artifact_stem="long-path",
                project_root=ROOT,
            )
            source = ROOT / result["identity"]["sourcePreviewPath"]
            normalized = ROOT / result["identity"]["normalizedReviewRgbPath"]
            self.assertGreater(len(str(normalized)), 300)
            self.assertTrue(source.is_file())
            self.assertTrue(normalized.is_file())

            short_source = temp_path / "short-source.png"
            short_source.write_bytes(source.read_bytes())
            expected_normalized = temp_path / "short-normalized.png"
            direct_formal_sharp(short_source, expected_normalized)
            self.assertEqual(normalized.read_bytes(), expected_normalized.read_bytes())
            self.assertEqual(
                result["identity"]["normalizedReviewRgbSha256"],
                sha256(expected_normalized),
            )

    def test_original_immutable_route_mask_and_season_feed_boundary_audit(self):
        row = sample_194()
        row["resizedTrainingRouteMask"] = [0]  # Must be ignored by design.
        rgb = torch.zeros(1, 3, 192, 256)
        with tempfile.TemporaryDirectory(dir=ROOT / ".runtime") as temp:
            result = formal_review_boundary_inputs(
                rgb,
                row,
                active_gate_config(),
                artifact_directory=temp,
                artifact_stem="official-mask-only",
                project_root=ROOT,
            )
            identity = result["identity"]
            mask_path = ROOT / identity["conditionMaskPath"]
            with Image.open(mask_path) as image:
                official_mask = (np.asarray(image).reshape(-1) > 0).astype(np.uint8)
            np.testing.assert_array_equal(result["expected"], official_mask)
            self.assertEqual(identity["conditionMaskSha256"], sha256(mask_path))
            self.assertEqual(result["season"], "wet_season")
            audit = audit_route_boundary_from_rgb(
                result["expected"],
                result["rgb"],
                result["width"],
                result["height"],
                season=result["season"],
            )
            self.assertEqual(
                audit["contractVersion"],
                "condition-semantic-boundary-contact-v3",
            )
            self.assertEqual(audit["requiredSides"], ["west"])
            self.assertFalse(audit["passed"])

    def test_tampered_mask_hash_is_rejected_before_artifact_write(self):
        row = sample_194()
        original_pack = json.loads(
            (ROOT / row["conditionPackPath"]).read_text(encoding="utf-8")
        )
        tampered_pack = copy.deepcopy(original_pack)
        route = next(
            channel
            for channel in tampered_pack["channels"]
            if channel["id"] == "terrain_path_ground"
        )
        route["sha256"] = "0" * 64
        with tempfile.TemporaryDirectory(dir=ROOT / ".runtime") as temp:
            temp_path = Path(temp)
            pack_path = temp_path / "condition-pack.json"
            pack_path.write_text(
                json.dumps(tampered_pack), encoding="utf-8"
            )
            invalid_row = copy.deepcopy(row)
            invalid_row["conditionPackPath"] = os.path.relpath(
                pack_path, ROOT
            ).replace("\\", "/")
            with self.assertRaisesRegex(
                FormalReviewInputError,
                "formal_review_route_mask_sha256_mismatch",
            ):
                formal_review_boundary_inputs(
                    torch.zeros(3, 2, 2),
                    invalid_row,
                    active_gate_config(),
                    artifact_directory=temp_path / "artifacts",
                    artifact_stem="tampered",
                    project_root=ROOT,
                )
            self.assertFalse((temp_path / "artifacts").exists())

    def test_gate_or_artifact_identity_cannot_be_reused_or_weakened(self):
        row = sample_194()
        config = active_gate_config()
        config["training"]["finalRgbBoundaryCheckpointNonRegressionGate"][
            "source"
        ] = "resized_training_tensor"
        with tempfile.TemporaryDirectory(dir=ROOT / ".runtime") as temp:
            with self.assertRaisesRegex(
                FormalReviewInputError,
                "formal_review_checkpoint_gate_source_invalid",
            ):
                formal_review_boundary_inputs(
                    torch.zeros(3, 2, 2),
                    row,
                    config,
                    artifact_directory=temp,
                    artifact_stem="wrong-source",
                    project_root=ROOT,
                )

            valid = active_gate_config()
            formal_review_boundary_inputs(
                torch.zeros(3, 2, 2),
                row,
                valid,
                artifact_directory=temp,
                artifact_stem="immutable",
                project_root=ROOT,
            )
            with self.assertRaisesRegex(
                FormalReviewInputError,
                "formal_review_source_preview_already_exists",
            ):
                formal_review_boundary_inputs(
                    torch.zeros(3, 2, 2),
                    row,
                    valid,
                    artifact_directory=temp,
                    artifact_stem="immutable",
                    project_root=ROOT,
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
