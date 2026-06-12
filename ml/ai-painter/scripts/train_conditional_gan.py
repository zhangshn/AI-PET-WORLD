from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.gan_trainer import train_gan


def main() -> int:
    parser = ArgumentParser(description="Train the local conditional pixel-world GAN.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=Path("ml/ai-painter/configs/training_v0.json"))
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--model-config", type=Path, default=Path("ml/ai-painter/configs/model_tiny_unet_gan_v0.json"))
    parser.add_argument("--epochs", type=int, default=200)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    config["modelConfig"] = str(args.model_config.resolve())
    result = train_gan(config, dataset_root=args.dataset_root, output_dir=args.output_dir, epochs=args.epochs)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
