from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.training.dataset import image_tensor
from ai_painter.training.rgb_refiner_model import build_rgb_refiner
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


def main() -> int:
    parser = ArgumentParser(description="Run local RGB detail refinement.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--structure-checkpoint", type=Path, required=True)
    parser.add_argument("--refiner-checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    structure_state = torch.load(args.structure_checkpoint, map_location=device, weights_only=False)
    structure_model = build_structure_guided_unet(structure_state["config"]).to(device)
    structure_model.load_state_dict(structure_state["model"])
    structure_model.eval()
    refiner_state = torch.load(args.refiner_checkpoint, map_location=device, weights_only=False)
    refiner = build_rgb_refiner(refiner_state["config"]).to(device)
    refiner.load_state_dict(refiner_state["model"])
    refiner.eval()
    sample = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    condition = torch.cat([image_tensor(sample / "masks_v1" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0).unsqueeze(0).to(device)
    with torch.inference_mode():
        base_rgb, _ = structure_model(condition)
        prediction = refiner(condition, base_rgb)
    pixels = prediction[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.asarray(pixels, dtype=np.uint8)).save(args.output)
    result = {"status": "completed", "sampleId": args.sample_id, "output": str(args.output.resolve()), "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "device": str(device)}
    args.output.with_suffix(".json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
