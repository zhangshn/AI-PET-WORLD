from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter_route_counterfactual_compositor_contract import (
    compile_route_counterfactual_compositor_cpu_inactive_config,
)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.source_config.read_text(encoding="utf-8"))
    compiled = compile_route_counterfactual_compositor_cpu_inactive_config(source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(compiled, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "route_counterfactual_compositor_cpu_config_compiled",
        "output": args.output.as_posix(),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
