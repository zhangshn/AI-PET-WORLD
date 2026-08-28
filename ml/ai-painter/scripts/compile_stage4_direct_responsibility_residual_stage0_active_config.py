from __future__ import annotations

from argparse import ArgumentParser
import json
import os
from pathlib import Path
import time

from ai_painter_direct_responsibility_residual_contract import (
    compile_direct_responsibility_residual_stage0_active_config,
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_exclusive(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    with temporary.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    if path.exists():
        temporary.unlink()
        raise FileExistsError(f"output already exists: {path}")
    os.replace(temporary, path)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--inactive-config", type=Path, required=True)
    parser.add_argument("--stage0-contract", type=Path, required=True)
    parser.add_argument("--ticket-state", choices=("preflight_unconsumed", "consumed"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    config = compile_direct_responsibility_residual_stage0_active_config(
        read_json(args.inactive_config),
        read_json(args.stage0_contract),
        ticket_state=args.ticket_state,
    )
    write_exclusive(args.output, config)
    print(json.dumps({
        "status": "direct_responsibility_residual_stage0_active_config_compiled",
        "output": str(args.output),
        "ticketState": args.ticket_state,
        "ownerAuthorizationRequired": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

