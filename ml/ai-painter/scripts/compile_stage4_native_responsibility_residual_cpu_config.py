from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter_native_responsibility_residual_contract import (
    compile_native_responsibility_residual_cpu_inactive_config,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("native responsibility residual output exists")
    config = compile_native_responsibility_residual_cpu_inactive_config(
        json.loads(args.source_config.read_text(encoding="utf-8"))
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "native_responsibility_residual_cpu_config_compiled",
        "output": str(args.output),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
