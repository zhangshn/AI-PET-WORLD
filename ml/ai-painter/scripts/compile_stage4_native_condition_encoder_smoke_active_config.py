from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter_native_condition_encoder_contract import (
    compile_native_condition_encoder_smoke_active_config,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inactive-config", type=Path, required=True)
    parser.add_argument("--smoke-contract", type=Path, required=True)
    parser.add_argument("--ticket-state", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("native condition encoder Smoke config output exists")
    active = compile_native_condition_encoder_smoke_active_config(
        json.loads(args.inactive_config.read_text(encoding="utf-8")),
        json.loads(args.smoke_contract.read_text(encoding="utf-8")),
        ticket_state=args.ticket_state,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(active, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "native_condition_encoder_smoke_active_config_compiled",
        "output": str(args.output),
        "ticketState": args.ticket_state,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
