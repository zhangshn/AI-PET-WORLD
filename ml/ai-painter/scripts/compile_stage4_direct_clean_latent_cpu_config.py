from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter_direct_clean_latent_contract import (
    compile_direct_clean_latent_cpu_inactive_config,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("direct clean-latent output config already exists")
    source = json.loads(args.source.read_text(encoding="utf-8"))
    compiled = compile_direct_clean_latent_cpu_inactive_config(source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(compiled, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "direct_clean_latent_cpu_inactive_config_compiled",
        "output": str(args.output),
        "activationGate": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
