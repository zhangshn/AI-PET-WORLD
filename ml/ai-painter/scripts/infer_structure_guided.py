from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.training.dataset import image_tensor
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


COLORS = [(104, 184, 90), (42, 142, 196), (61, 205, 227), (231, 174, 70), (255, 220, 80), (120, 86, 54), (50, 160, 79), (132, 146, 171), (173, 99, 214), (77, 140, 225), (205, 75, 60), (234, 92, 155), (210, 177, 110), (120, 100, 220)]


def main() -> int:
    parser = ArgumentParser(description="Run structure-guided AI Painter inference.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    state = torch.load(args.checkpoint, map_location=device, weights_only=False)
    config = state["config"]
    model = build_structure_guided_unet(config).to(device)
    model.load_state_dict(state["model"])
    model.eval()
    sample = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    condition = torch.cat([image_tensor(sample / "masks_v1" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0).unsqueeze(0).to(device)
    with torch.inference_mode():
        rgb, structure_logits = model(condition)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rgb_pixels = rgb[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
    rgb_path = args.output_dir / "generated.png"
    Image.fromarray(rgb_pixels).save(rgb_path)
    preview = np.zeros((192, 256, 3), dtype=np.uint8)
    masks = torch.sigmoid(structure_logits[0]).cpu().numpy() >= 0.5
    for index, color in enumerate(COLORS):
        preview[masks[index]] = np.maximum(preview[masks[index]], np.asarray(color, dtype=np.uint8))
    structure_path = args.output_dir / "structure-preview.png"
    Image.fromarray(preview).save(structure_path)
    result = {"status": "completed", "sampleId": args.sample_id, "generated": str(rgb_path.resolve()), "structurePreview": str(structure_path.resolve()), "sha256": hashlib.sha256(rgb_path.read_bytes()).hexdigest(), "device": str(device)}
    (args.output_dir / "latest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
