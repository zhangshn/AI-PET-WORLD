from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageStat

from ai_painter.blueprint.schema import Blueprint, load_blueprint

from .metadata import SampleMetadata, load_metadata


@dataclass(frozen=True)
class StagedSample:
    directory: Path
    metadata: SampleMetadata
    blueprint: Blueprint
    image_path: Path
    blueprint_path: Path


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    errors: tuple[str, ...]
    sample: StagedSample | None


def validate_staged_sample(sample_dir: Path) -> ValidationResult:
    errors: list[str] = []
    metadata_path = sample_dir / "metadata.json"
    if not metadata_path.is_file():
        return ValidationResult(False, ("metadata.json is required",), None)

    try:
        metadata = load_metadata(metadata_path)
    except (OSError, ValueError) as error:
        return ValidationResult(False, (str(error),), None)

    if metadata.sample_id != sample_dir.name:
        errors.append("sampleId must match the incoming directory name")
    image_path = _safe_child(sample_dir, metadata.target_image, errors)
    blueprint_path = _safe_child(sample_dir, metadata.blueprint_file, errors)
    if image_path is None or blueprint_path is None:
        return ValidationResult(False, tuple(errors), None)

    if not image_path.is_file():
        errors.append("target image does not exist")
    if not blueprint_path.is_file():
        errors.append("blueprint file does not exist")
    if errors:
        return ValidationResult(False, tuple(errors), None)

    try:
        blueprint = load_blueprint(blueprint_path)
    except (OSError, ValueError) as error:
        return ValidationResult(False, (str(error),), None)
    if blueprint.scene_id != metadata.sample_id:
        errors.append("blueprint sceneId must match metadata sampleId")
    errors.extend(_validate_image(image_path, blueprint.width, blueprint.height))
    sample = StagedSample(sample_dir, metadata, blueprint, image_path, blueprint_path)
    return ValidationResult(not errors, tuple(errors), sample if not errors else None)


def _safe_child(root: Path, relative: str, errors: list[str]) -> Path | None:
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        errors.append(f"path escapes sample directory: {relative}")
        return None
    return candidate


def _validate_image(path: Path, width: int, height: int) -> list[str]:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            if image.format != "PNG":
                return ["v0 target image must be PNG"]
            source_ratio = image.width / image.height
            target_ratio = width / height
            if abs(source_ratio - target_ratio) > 0.02:
                return ["target image aspect ratio must match 4:3"]
            rgb = image.convert("RGB")
            grayscale = rgb.convert("L")
            extrema = grayscale.getextrema()
            contrast_range = extrema[1] - extrema[0]
            channel_deviation = sum(ImageStat.Stat(rgb).stddev) / 3
            colors = rgb.resize((64, 48)).getcolors(maxcolors=64 * 48)
            if colors is not None and len(colors) < 16:
                return ["target image has insufficient color variation"]
            if contrast_range < 24 or channel_deviation < 8:
                return ["target image has insufficient visual contrast"]
    except (OSError, ValueError) as error:
        return [f"target image is invalid: {error}"]
    return []
