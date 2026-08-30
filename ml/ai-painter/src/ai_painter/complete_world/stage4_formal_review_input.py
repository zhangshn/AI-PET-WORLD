"""Build the exact final-RGB inputs used by the formal Stage 4 route review.

The formal JavaScript review does not inspect the floating-point training tensor
or the resized training-condition tensor.  It inspects a PNG-quantized RGB
preview normalized by Sharp to 1024x768 and the original
``terrain_path_ground`` PNG referenced by the immutable condition pack.

This module deliberately delegates the normalization encode to the project's
installed Node/Sharp runtime.  That avoids silently substituting Pillow's PNG
encoder or nearest-neighbour coordinate convention for the formal review
implementation in ``scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs``.
It owns no model, loss, optimizer, checkpoint, or review threshold.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any, Mapping

import numpy as np
from PIL import Image


FORMAL_REVIEW_INPUT_SCHEMA_VERSION = "stage4-formal-review-boundary-input-v1"
FORMAL_REVIEW_WIDTH = 1024
FORMAL_REVIEW_HEIGHT = 768
FORMAL_REVIEW_RESIZE_KERNEL = "nearest"
FORMAL_REVIEW_SOURCE_QUANTIZATION = "uint8_png_rgb"
FORMAL_REVIEW_NORMALIZER = (
    "sharp_remove_alpha_resize_1024x768_fit_fill_kernel_nearest_png"
)
FORMAL_BOUNDARY_REVIEW_CONTRACT = "condition-semantic-boundary-contact-v3"
CHECKPOINT_GATE_CONTRACT = "stage4-final-rgb-boundary-checkpoint-non-regression-v1"
_ARTIFACT_STEM = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


class FormalReviewInputError(ValueError):
    """Raised when formal review identity cannot be reproduced exactly."""


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _project_path(path: Path, project_root: Path) -> str:
    return os.path.relpath(path, project_root).replace("\\", "/")


def _resolve_project_path(value: str | os.PathLike[str], project_root: Path) -> Path:
    """Resolve lexically so a registered Windows ``.runtime`` mapping is valid."""

    raw = os.fspath(value)
    candidate = Path(
        os.path.abspath(raw if os.path.isabs(raw) else os.path.join(project_root, raw))
    )
    root_text = os.path.normcase(os.path.abspath(project_root))
    candidate_text = os.path.normcase(os.path.abspath(candidate))
    try:
        inside = os.path.commonpath((root_text, candidate_text)) == root_text
    except ValueError as error:
        raise FormalReviewInputError("formal_review_path_outside_project") from error
    if not inside:
        raise FormalReviewInputError("formal_review_path_outside_project")
    return candidate


def _checkpoint_gate(config: Mapping[str, Any]) -> Mapping[str, Any]:
    training = config.get("training")
    if not isinstance(training, Mapping):
        raise FormalReviewInputError("formal_review_training_contract_missing")
    gate = training.get("finalRgbBoundaryCheckpointNonRegressionGate")
    if not isinstance(gate, Mapping):
        raise FormalReviewInputError("formal_review_checkpoint_gate_missing")
    required = {
        "contractVersion": CHECKPOINT_GATE_CONTRACT,
        "enabled": True,
        "role": "checkpoint_eligibility_gate_only",
        "reviewContractId": FORMAL_BOUNDARY_REVIEW_CONTRACT,
        "source": "normalized_final_rgb_and_same_record_formal_condition_mask",
        "metricOnly": True,
        "trainingLossContribution": False,
        "bestCheckpointMetricWeight": False,
    }
    for key, expected in required.items():
        if gate.get(key) != expected:
            raise FormalReviewInputError(f"formal_review_checkpoint_gate_{key}_invalid")
    return gate


def _quantized_rgb(predicted_rgb: Any) -> np.ndarray:
    """Mirror Trainer ``save_tensor_png`` through and including ``Tensor.byte``."""

    if not all(
        hasattr(predicted_rgb, name)
        for name in ("detach", "clamp", "mul", "byte", "permute", "cpu", "numpy")
    ):
        raise FormalReviewInputError("formal_review_rgb_tensor_required")
    tensor = predicted_rgb.detach()
    if tensor.ndim == 4:
        if int(tensor.shape[0]) != 1:
            raise FormalReviewInputError("formal_review_rgb_batch_must_be_one")
        tensor = tensor[0]
    if tensor.ndim != 3 or int(tensor.shape[0]) != 3:
        raise FormalReviewInputError("formal_review_rgb_shape_invalid")
    pixels = (
        tensor.clamp(0.0, 1.0)
        .mul(255)
        .byte()
        .permute(1, 2, 0)
        .cpu()
        .numpy()
    )
    return np.ascontiguousarray(pixels, dtype=np.uint8)


def _write_source_preview(pixels: np.ndarray, output_path: Path) -> None:
    if output_path.exists():
        raise FormalReviewInputError("formal_review_source_preview_already_exists")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(output_path, format="PNG", optimize=True)


def _normalize_with_formal_sharp(
    source_path: Path, output_path: Path, project_root: Path
) -> None:
    if output_path.exists():
        raise FormalReviewInputError("formal_review_normalized_preview_already_exists")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    script = """
import sharp from "sharp";
const [sourcePath, outputPath] = process.argv.slice(1);
await sharp(sourcePath, { failOn: "error" })
  .removeAlpha()
  .resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest })
  .png()
  .toFile(outputPath);
""".strip()
    # libvips/Sharp can still reject long Windows paths even when Python and
    # Node's filesystem APIs can access the same project artifact.  Keep the
    # authoritative source and result in their immutable project namespace,
    # but perform only Sharp's codec operation inside a short system-temporary
    # directory.  Copying bytes in and out does not change quantization,
    # resize, PNG encoding, or the final evidence identity.
    try:
        with tempfile.TemporaryDirectory(
            prefix="ai-painter-formal-sharp-"
        ) as temporary_directory:
            temporary_root = Path(temporary_directory)
            short_source_path = temporary_root / "source.png"
            short_output_path = temporary_root / "normalized.png"
            short_source_path.write_bytes(source_path.read_bytes())
            result = subprocess.run(
                [
                    "node",
                    "--input-type=module",
                    "--eval",
                    script,
                    str(short_source_path),
                    str(short_output_path),
                ],
                cwd=project_root,
                check=False,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0 or not short_output_path.is_file():
                detail = (result.stderr or result.stdout).strip()[-500:]
                raise FormalReviewInputError(
                    f"formal_review_sharp_normalization_failed:{detail}"
                )
            with output_path.open("xb") as output_handle:
                output_handle.write(short_output_path.read_bytes())
    except FormalReviewInputError:
        output_path.unlink(missing_ok=True)
        raise
    except FileExistsError as error:
        raise FormalReviewInputError(
            "formal_review_normalized_preview_already_exists"
        ) from error
    except (OSError, subprocess.TimeoutExpired) as error:
        output_path.unlink(missing_ok=True)
        raise FormalReviewInputError("formal_review_sharp_normalizer_unavailable") from error


def _load_condition_identity(
    row: Mapping[str, Any], project_root: Path
) -> tuple[dict[str, Any], np.ndarray]:
    condition_pack_value = row.get("conditionPackPath")
    if not isinstance(condition_pack_value, str) or not condition_pack_value:
        raise FormalReviewInputError("formal_review_condition_pack_path_missing")
    condition_pack_path = _resolve_project_path(condition_pack_value, project_root)
    if not condition_pack_path.is_file():
        raise FormalReviewInputError("formal_review_condition_pack_missing")
    condition_pack_bytes = condition_pack_path.read_bytes()
    try:
        condition_pack = json.loads(condition_pack_bytes)
    except json.JSONDecodeError as error:
        raise FormalReviewInputError("formal_review_condition_pack_json_invalid") from error
    if not isinstance(condition_pack, dict):
        raise FormalReviewInputError("formal_review_condition_pack_object_required")
    channels = condition_pack.get("channels")
    if not isinstance(channels, list) or len(channels) != 23:
        raise FormalReviewInputError("formal_review_condition_pack_23_channels_required")
    canvas = condition_pack.get("canvas")
    if not isinstance(canvas, Mapping) or (
        int(canvas.get("width", 0)) != FORMAL_REVIEW_WIDTH
        or int(canvas.get("height", 0)) != FORMAL_REVIEW_HEIGHT
    ):
        raise FormalReviewInputError("formal_review_condition_canvas_invalid")
    matches = [item for item in channels if item.get("id") == "terrain_path_ground"]
    if len(matches) != 1:
        raise FormalReviewInputError("formal_review_route_channel_identity_invalid")
    channel = matches[0]
    if (
        channel.get("kind") != "binary_mask"
        or channel.get("dtype") != "uint8"
        or channel.get("shape") != [1, FORMAL_REVIEW_HEIGHT, FORMAL_REVIEW_WIDTH]
    ):
        raise FormalReviewInputError("formal_review_route_channel_contract_invalid")
    channel_path = _resolve_project_path(channel.get("path", ""), project_root)
    if not channel_path.is_file():
        raise FormalReviewInputError("formal_review_route_mask_missing")
    channel_sha256 = _sha256_file(channel_path)
    if channel.get("sha256") != channel_sha256:
        raise FormalReviewInputError("formal_review_route_mask_sha256_mismatch")
    with Image.open(channel_path) as image:
        if image.size != (FORMAL_REVIEW_WIDTH, FORMAL_REVIEW_HEIGHT):
            raise FormalReviewInputError("formal_review_route_mask_size_invalid")
        mask_pixels = np.asarray(image)
    if mask_pixels.ndim == 3:
        mask_pixels = mask_pixels[:, :, 0]
    if mask_pixels.ndim != 2:
        raise FormalReviewInputError("formal_review_route_mask_channels_invalid")
    expected_mask = np.ascontiguousarray(mask_pixels.reshape(-1) > 0, dtype=np.uint8)

    row_world_id = row.get("conditionWorldId")
    if row_world_id is not None and condition_pack.get("worldId") != row_world_id:
        raise FormalReviewInputError("formal_review_condition_world_id_mismatch")
    season = (row.get("classification") or {}).get("monsoonSeason")
    if season not in {
        "dry_season",
        "dry_to_wet_transition",
        "wet_season",
        "wet_to_dry_transition",
    }:
        raise FormalReviewInputError("formal_review_monsoon_season_invalid")
    identity = {
        "conditionPackId": condition_pack.get("conditionPackId"),
        "conditionPackPath": _project_path(condition_pack_path, project_root),
        "conditionPackSha256": hashlib.sha256(condition_pack_bytes).hexdigest(),
        "conditionMaskPath": _project_path(channel_path, project_root),
        "conditionMaskSha256": channel_sha256,
        "conditionWorldId": condition_pack.get("worldId"),
        "conditionTick": condition_pack.get("tick"),
        "season": season,
    }
    return identity, expected_mask


def formal_review_boundary_inputs(
    predicted_rgb: Any,
    row: Mapping[str, Any],
    config: Mapping[str, Any],
    *,
    artifact_directory: str | os.PathLike[str],
    artifact_stem: str,
    project_root: str | os.PathLike[str] | None = None,
) -> dict[str, Any]:
    """Materialize and bind inputs for ``audit_route_boundary_from_rgb``.

    ``rgb`` is an ``(1024*768, 3)`` ``numpy.uint8`` array and ``expected`` is a
    flattened ``numpy.uint8`` binary mask.  Both can be passed directly to the
    checkpoint boundary gate without consulting a resized training tensor.
    """

    if not isinstance(row, Mapping):
        raise FormalReviewInputError("formal_review_source_row_invalid")
    if not isinstance(config, Mapping):
        raise FormalReviewInputError("formal_review_config_invalid")
    if not _ARTIFACT_STEM.fullmatch(artifact_stem):
        raise FormalReviewInputError("formal_review_artifact_stem_invalid")
    root = Path(os.path.abspath(project_root or Path.cwd()))
    _checkpoint_gate(config)
    identity, expected_mask = _load_condition_identity(row, root)
    pixels = _quantized_rgb(predicted_rgb)
    source_height, source_width = pixels.shape[:2]
    output_directory = _resolve_project_path(artifact_directory, root)
    output_directory.mkdir(parents=True, exist_ok=True)
    source_path = output_directory / f"{artifact_stem}-source.png"
    normalized_path = output_directory / f"{artifact_stem}-1024x768.png"
    _write_source_preview(pixels, source_path)
    try:
        _normalize_with_formal_sharp(source_path, normalized_path, root)
    except Exception:
        source_path.unlink(missing_ok=True)
        raise
    with Image.open(normalized_path) as normalized_image:
        normalized_rgb = np.asarray(normalized_image.convert("RGB"), dtype=np.uint8)
    if normalized_rgb.shape != (FORMAL_REVIEW_HEIGHT, FORMAL_REVIEW_WIDTH, 3):
        raise FormalReviewInputError("formal_review_normalized_rgb_shape_invalid")
    normalized_rgb = np.ascontiguousarray(normalized_rgb.reshape(-1, 3))
    source_sha256 = _sha256_file(source_path)
    normalized_sha256 = _sha256_file(normalized_path)
    identity.update(
        {
            "sampleId": row.get("sampleId"),
            "sampleSplit": row.get("split"),
            "conditionLabel": row.get("conditionLabel"),
            "sourcePreviewPath": _project_path(source_path, root),
            "sourcePreviewSha256": source_sha256,
            "normalizedReviewRgbPath": _project_path(normalized_path, root),
            "normalizedReviewRgbSha256": normalized_sha256,
            "normalization": {
                "width": FORMAL_REVIEW_WIDTH,
                "height": FORMAL_REVIEW_HEIGHT,
                "resizeKernel": FORMAL_REVIEW_RESIZE_KERNEL,
                "sourceQuantization": FORMAL_REVIEW_SOURCE_QUANTIZATION,
                "normalizer": FORMAL_REVIEW_NORMALIZER,
                "sourceWidth": int(source_width),
                "sourceHeight": int(source_height),
            },
        }
    )
    return {
        "schemaVersion": FORMAL_REVIEW_INPUT_SCHEMA_VERSION,
        "status": "formal_review_boundary_inputs_materialized",
        "reviewContractId": FORMAL_BOUNDARY_REVIEW_CONTRACT,
        "checkpointGateContractVersion": CHECKPOINT_GATE_CONTRACT,
        "width": FORMAL_REVIEW_WIDTH,
        "height": FORMAL_REVIEW_HEIGHT,
        "season": identity["season"],
        "rgb": normalized_rgb,
        "expected": expected_mask,
        "identity": identity,
    }
