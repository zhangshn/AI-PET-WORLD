"""Separate, source-bound ecological input for the isolated CPU prototype."""
from __future__ import annotations

from ai_painter.complete_world.object_appearance_regime_input_cpu import (
    bound_regime, require, validate_regime,
)

ECOLOGIES = (
    "bamboo-grove", "dry-dipterocarp-woodland", "forested-low-mountain",
    "grassland-forest-transition", "seasonal-evergreen-semi-evergreen-forest",
    "tropical-forest-glade", "wet-season-drainage-hollow",
)


def encode_ecology(category):
    import torch
    require(type(category) is str and category in ECOLOGIES, "unknown or missing ecology")
    code = torch.zeros(len(ECOLOGIES), dtype=torch.float32, device="cpu")
    code[ECOLOGIES.index(category)] = 1
    return code


def validate_ecology(code):
    import torch
    require(type(code) is torch.Tensor and code.shape == (7,)
            and code.device.type == "cpu" and code.dtype == torch.float32
            and code.layout == torch.strided and code.is_contiguous()
            and not code.requires_grad and bool(torch.isfinite(code).all())
            and bool(((code == 0) | (code == 1)).all()) and float(code.sum()) == 1,
            "ecology must be a non-gradient contiguous CPU float32 seven-value one-hot")
    return code


def bound_ecology_regime(reader, record):
    """Reuse authentic seasonal/canonical provenance, then bind the second code.

    The reader must authenticate exact source SHA on every access. There is no
    caller flag granting source eligibility, execution or model qualification.
    """
    pack = reader.json(record["conditionPack"])
    task = reader.json(record["taskPackage"])
    season_code, season_facts = bound_regime(reader, record)
    require(pack == reader.json(record["conditionPack"])
            and task == reader.json(record["taskPackage"]), "ecology source changed during binding")
    ecology = pack["categoricalConditions"]["ecologyPlan"]
    require(ecology == task["directorPlan"]["singleMapEcologyPlan"], "ecology plan differs")
    category = ecology.get("landscapeType")
    code = encode_ecology(category)
    validate_regime(season_code)
    return season_code, code, {**season_facts, "ecology": category,
        "ecologyOrder": list(ECOLOGIES), "executionAuthorityGranted": False}
