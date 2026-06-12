from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.training.checkpoint import load_checkpoint
from ai_painter.training.dataset import MASK_NAMES, image_tensor
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


def run_inference(*, checkpoint_path: Path, dataset_root: Path, sample_id: str, output_path: Path) -> dict[str, object]:
    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    training_config = checkpoint.get("config", {})
    model_config_path = Path(str(training_config["modelConfig"]))
    model_config = json.loads(model_config_path.read_text(encoding="utf-8"))
    model = build_tiny_unet(model_config).to(device)
    load_checkpoint(checkpoint_path, model=model, device=device)
    model.eval()

    sample_dir = dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    if not sample_dir.is_dir():
        raise FileNotFoundError(f"scene sample not found: {sample_id}")
    condition = torch.cat([
        image_tensor(sample_dir / "masks" / f"{name}.png", "L", torch)
        for name in MASK_NAMES
    ], dim=0).unsqueeze(0).to(device)

    with torch.inference_mode():
        prediction = model(condition)[0].clamp(0, 1).mul(255).byte().cpu()
    pixels = prediction.permute(1, 2, 0).numpy()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.asarray(pixels, dtype=np.uint8), mode="RGB").save(output_path, format="PNG")
    image_bytes = output_path.read_bytes()
    result = {
        "status": "completed",
        "sampleId": sample_id,
        "checkpoint": str(checkpoint_path.resolve()),
        "output": str(output_path.resolve()),
        "width": int(pixels.shape[1]),
        "height": int(pixels.shape[0]),
        "sha256": hashlib.sha256(image_bytes).hexdigest(),
        "device": str(device),
    }
    output_path.with_suffix(".json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_path.parent / "latest.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result
