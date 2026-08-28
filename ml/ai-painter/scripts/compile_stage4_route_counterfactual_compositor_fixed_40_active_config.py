from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter_route_counterfactual_compositor_contract import (
    ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA,
    compile_route_counterfactual_compositor_smoke_active_config,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inactive-config", type=Path, required=True)
    parser.add_argument("--qualification-contract", type=Path, required=True)
    parser.add_argument("--ticket-state", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("route counterfactual fixed 40 output exists")
    qualification_contract = json.loads(
        args.qualification_contract.read_text(encoding="utf-8")
    )
    if qualification_contract.get("schemaVersion") != (
        ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA
    ):
        raise ValueError("route counterfactual fixed 40 contract is invalid")
    active = compile_route_counterfactual_compositor_smoke_active_config(
        json.loads(args.inactive_config.read_text(encoding="utf-8")),
        qualification_contract,
        ticket_state=args.ticket_state,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(active, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "status": (
                    "route_counterfactual_compositor_fixed_40_active_config_compiled"
                ),
                "output": str(args.output),
                "ticketState": args.ticket_state,
                "epochCount": 40,
                "previewEpochs": [1, 5, 10, 20, 30, 40],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
