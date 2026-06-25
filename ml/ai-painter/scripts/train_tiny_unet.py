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
    parser.add_argument("--model-config", type=Path)
    parser.add_argument("--initial-checkpoint", type=Path)
    parser.add_argument("--blueprint-version", choices=("v0", "v1"), default="v0")
    parser.add_argument("--allow-experimental-structural-data", action="store_true")
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
    model_config = args.model_config or args.config.parent / "model_tiny_unet_v0.json"
    config["modelConfig"] = str(model_config.resolve())
    config["blueprintVersion"] = args.blueprint_version
    config["allowExperimentalStructuralData"] = args.allow_experimental_structural_data
    result = train(
        config,
        dataset_root=args.dataset_root,
        output_dir=args.output_dir,
        max_epochs=args.max_epochs,
        initial_checkpoint=args.initial_checkpoint,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
