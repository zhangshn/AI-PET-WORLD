from argparse import ArgumentParser
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.training.local_patch_dataset import read_image
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


CATEGORIES = ("building", "tree", "road", "shoreline")


def main() -> int:
    parser = ArgumentParser(description="Infer local assets and compose them by same-source masks.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--base-image", type=Path, required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    torch = require_torch(); device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_root.mkdir(parents=True, exist_ok=True)
    composite = Image.open(args.base_image).convert("RGB")
    results = {}
    for category in CATEGORIES:
        category_root = args.dataset_root / category
        validation_ids = json.loads((category_root / "validation.json").read_text(encoding="utf-8"))["sampleIds"]
        sample_id = next((value for value in validation_ids if value.startswith(args.source_id + "-")), None)
        if sample_id is None:
            raise ValueError(f"missing validation patch for {category}: {args.source_id}")
        sample = category_root / "samples" / sample_id
        metadata = json.loads((sample / "metadata.json").read_text(encoding="utf-8"))
        checkpoint = torch.load(args.model_root / category / "best.pt", map_location=device, weights_only=False)
        model = build_tiny_unet(checkpoint["config"]).to(device); model.load_state_dict(checkpoint["model"]); model.eval()
        condition = torch.cat([read_image(sample / "masks" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0).unsqueeze(0).to(device)
        with torch.inference_mode():
            prediction = model(condition)[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
        patch = Image.fromarray(np.asarray(prediction, dtype=np.uint8))
        patch_path = args.output_root / f"{category}.png"; patch.save(patch_path)
        focus = np.maximum.reduce([np.array(Image.open(sample / "masks" / f"{name}.png").convert("L")) for name in metadata["focusChannels"]])
        alpha = Image.fromarray(focus).filter(ImageFilter.GaussianBlur(radius=3))
        composite.paste(patch, (metadata["x"], metadata["y"]), alpha)
        results[category] = {"sampleId": sample_id, "output": str(patch_path.resolve()), "region": {key: metadata[key] for key in ("x", "y", "size")}}
    composite_path = args.output_root / "composite.png"; composite.save(composite_path)
    result = {"status": "completed", "composite": str(composite_path.resolve()), "categories": results, "device": str(device)}
    (args.output_root / "latest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
