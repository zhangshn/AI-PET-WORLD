from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training import describe_torch_runtime, train


def main() -> int:
    parser = ArgumentParser(description="Train the self-developed AI-PET-WORLD Tiny U-Net.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=Path("ml/ai-painter/configs/training_v0.json"))
    parser.add_argument("--output-dir", type=Path, default=Path(".runtime/ai-painter/training-v0"))
    parser.add_argument("--max-epochs", type=int)
    parser.add_argument("--check-runtime", action="store_true")
    args = parser.parse_args()
    runtime = describe_torch_runtime()
    if args.check_runtime:
        print(json.dumps(runtime, ensure_ascii=False, indent=2))
        return 0 if runtime["ready"] else 2
    if not runtime["ready"]:
        print(json.dumps(runtime, ensure_ascii=False, indent=2))
        return 2
    config = json.loads(args.config.read_text(encoding="utf-8"))
    config["modelConfig"] = str((args.config.parent / "model_tiny_unet_v0.json").resolve())
    result = train(config, dataset_root=args.dataset_root, output_dir=args.output_dir, max_epochs=args.max_epochs)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
