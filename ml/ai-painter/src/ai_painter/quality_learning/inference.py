from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image

from ai_painter.dataset.hashing import sha256_file
from .model import build_quality_judge_model


def judge_with_learned_model(image_path: Path, model_dir: Path) -> dict[str, Any]:
    import numpy as np
    import torch

    manifest_path = model_dir / "model-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    weights_path = model_dir / manifest["weights"]["path"]
    if sha256_file(weights_path) != manifest["weights"]["sha256"]:
        raise ValueError("VJ-B2 模型权重哈希不一致")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_quality_judge_model().to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=True))
    model.eval()
    with Image.open(image_path) as source:
        image = source.convert("RGB").resize((128, 128), Image.Resampling.NEAREST)
    array = np.asarray(image, dtype=np.float32) / 127.5 - 1.0
    tensor = torch.from_numpy(array).permute(2, 0, 1).unsqueeze(0).to(device)
    with torch.no_grad():
        probability = torch.softmax(model(tensor), dim=1)[0, 1].item()
    threshold = float(manifest["acceptableThreshold"])
    return {
        "schemaVersion": "vj-b2-inference-v1",
        "status": "passed" if probability >= threshold else "failed",
        "acceptableProbability": round(probability, 6),
        "threshold": threshold,
        "modelWeightsSha256": manifest["weights"]["sha256"],
        "approvedForTraining": False,
    }
