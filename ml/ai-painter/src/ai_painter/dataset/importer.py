from __future__ import annotations

import json
from pathlib import Path

from .layout import DatasetLayout


def import_sample(dataset_root: Path, sample_id: str) -> dict[str, object]:
    """Legacy incoming samples are diagnostics only and never enter formal training."""
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    report = {
        "sampleId": sample_id,
        "status": "rejected",
        "trainingEligible": False,
        "errors": [
            "legacy incoming import is not a formal v1 training path; use source-originals automatic annotation pipeline",
        ],
    }
    path = layout.rejected / f"{sample_id}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report
