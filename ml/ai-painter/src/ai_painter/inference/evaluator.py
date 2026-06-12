from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.training.checkpoint import load_checkpoint
from ai_painter.training.dataset import WorldSceneDataset
from ai_painter.training.losses import image_edges
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


def evaluate_checkpoint(*, checkpoint_path: Path, dataset_root: Path, split: str, output_dir: Path) -> dict[str, object]:
    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model_path = Path(str(checkpoint["config"]["modelConfig"]))
    model_config = json.loads(model_path.read_text(encoding="utf-8"))
    model = build_tiny_unet(model_config).to(device)
    load_checkpoint(checkpoint_path, model=model, device=device)
    model.eval()
    dataset = WorldSceneDataset(dataset_root, split)
    output_dir.mkdir(parents=True, exist_ok=True)
    samples: list[dict[str, object]] = []

    with torch.inference_mode():
        for item in dataset:
            prediction = model(item["condition"].unsqueeze(0).to(device))[0].clamp(0, 1).cpu()
            target = item["target"]
            mae = float(torch.nn.functional.l1_loss(prediction, target))
            mse = float(torch.nn.functional.mse_loss(prediction, target))
            psnr = 99.0 if mse == 0 else 10 * math.log10(1 / mse)
            prediction_edges = image_edges(prediction.unsqueeze(0), torch)
            target_edges = image_edges(target.unsqueeze(0), torch)
            edge_mae = float(torch.nn.functional.l1_loss(prediction_edges, target_edges))
            sharpness_ratio = float(prediction_edges.abs().mean() / target_edges.abs().mean().clamp_min(1e-8))
            image_path = output_dir / f"{item['sampleId']}.png"
            save_tensor_png(prediction, image_path)
            samples.append({
                "sampleId": item["sampleId"], "mae": mae, "psnr": psnr,
                "edgeMae": edge_mae, "sharpnessRatio": sharpness_ratio,
                "output": str(image_path.resolve()),
            })

    report = {
        "status": "completed", "split": split, "device": str(device),
        "sampleCount": len(samples),
        "meanMae": sum(float(item["mae"]) for item in samples) / len(samples),
        "meanPsnr": sum(float(item["psnr"]) for item in samples) / len(samples),
        "meanEdgeMae": sum(float(item["edgeMae"]) for item in samples) / len(samples),
        "meanSharpnessRatio": sum(float(item["sharpnessRatio"]) for item in samples) / len(samples),
        "samples": samples,
    }
    (output_dir / "evaluation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def save_tensor_png(tensor, path: Path) -> None:
    pixels = tensor.mul(255).byte().permute(1, 2, 0).numpy()
    Image.fromarray(np.asarray(pixels, dtype=np.uint8), mode="RGB").save(path, format="PNG")
