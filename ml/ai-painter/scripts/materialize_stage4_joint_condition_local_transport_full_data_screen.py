from __future__ import annotations

from argparse import ArgumentParser, Namespace
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Mapping, Sequence

from ai_painter_joint_condition_local_transport_contract import (
    ARCHITECTURE_ID,
    FULL_DATA_SCREEN_OUTPUT_ROOT,
    build_joint_condition_local_transport_full_data_screen_config_template,
    issue_and_consume_joint_condition_local_transport_full_data_screen_ticket,
    validate_joint_condition_local_transport_full_data_screen_config,
)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
WORK_ROOT = Path(".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-work")


def build_parser() -> ArgumentParser:
    parser = ArgumentParser(description="Materialize one isolated joint-condition local-transport 24-Epoch full-data screen config.")
    parser.add_argument("--operation", choices=("template", "consume", "validate"), required=True)
    parser.add_argument("--run-id")
    parser.add_argument("--output-namespace")
    parser.add_argument("--inactive-contract", type=Path)
    parser.add_argument("--inactive-contract-sha256")
    parser.add_argument("--dataset-package-id")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path)
    return parser


def execute_operation(args: Namespace, *, project_root: Path = PROJECT_ROOT) -> dict:
    root = Path(os.path.abspath(project_root))
    if args.operation == "validate":
        if args.config is None:
            raise ValueError("--config is required for validate")
        config_path = _inside(root, args.config)
        result = validate_joint_condition_local_transport_full_data_screen_config(
            _read(config_path), project_root=root, require_execution_ticket=True
        )
        return dict(result)

    for name, value in (
        ("--run-id", args.run_id), ("--output-namespace", args.output_namespace),
        ("--inactive-contract", args.inactive_contract),
        ("--inactive-contract-sha256", args.inactive_contract_sha256), ("--output", args.output),
    ):
        if value is None or value == "":
            raise ValueError(f"{name} is required for {args.operation}")
    output = _inside(root, args.output)
    if output.exists():
        raise FileExistsError(f"full-data screen config already exists: {_relative(root, output)}")
    contract = _inside(root, args.inactive_contract)
    if not contract.is_file() or _sha(contract) != args.inactive_contract_sha256:
        raise ValueError("inactive full-data screen contract identity mismatch")
    expected_namespace = f"{FULL_DATA_SCREEN_OUTPUT_ROOT}/{args.run_id}"
    if Path(args.output_namespace).as_posix() != expected_namespace:
        raise ValueError("full-data screen output namespace mismatch")
    kwargs = dict(
        run_id=args.run_id, output_namespace=args.output_namespace,
        inactive_contract_path=_relative(root, contract),
        inactive_contract_sha256=args.inactive_contract_sha256, project_root=root,
    )
    if args.operation == "template":
        expected = (WORK_ROOT / args.run_id / "preflight-config.json").as_posix()
        if _relative(root, output) != expected:
            raise ValueError("preflight config must use the isolated full-data screen work root")
        config = build_joint_condition_local_transport_full_data_screen_config_template(**kwargs)
        ticket = None
    else:
        if not args.dataset_package_id:
            raise ValueError("--dataset-package-id is required for consume")
        if _relative(root, output) != f"{expected_namespace}/active-config.json":
            raise ValueError("active config must use the isolated full-data screen run root")
        config, ticket = issue_and_consume_joint_condition_local_transport_full_data_screen_ticket(
            dataset_package_id=args.dataset_package_id, **kwargs
        )
    if config.get("denoiserArchitecture") != ARCHITECTURE_ID:
        raise ValueError("full-data screen architecture identity mismatch")
    _write_exclusive(output, config)
    return {
        "status": "full_data_screen_preflight_template_materialized" if ticket is None else "full_data_screen_active_config_materialized_with_consumed_internal_ticket",
        "configPath": _relative(root, output), "configSha256": _sha(output),
        "candidateIdentity": ARCHITECTURE_ID, "ticket": ticket,
        "optimizerCreated": False, "gpuStarted": False, "trainingStarted": False,
    }


def _inside(root: Path, value: Path) -> Path:
    candidate = value if value.is_absolute() else root / value
    lexical = Path(os.path.abspath(candidate))
    lexical.relative_to(root)
    return lexical


def _relative(root: Path, value: Path) -> str:
    return Path(os.path.abspath(value)).relative_to(root).as_posix()


def _read(value: Path) -> dict:
    result = json.loads(value.read_text(encoding="utf-8-sig"))
    if not isinstance(result, dict):
        raise ValueError("JSON object required")
    return result


def _sha(value: Path) -> str:
    return hashlib.sha256(value.read_bytes()).hexdigest()


def _write_exclusive(value: Path, body: Mapping[str, Any]) -> None:
    value.parent.mkdir(parents=True, exist_ok=True)
    with value.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(dict(body), ensure_ascii=False, indent=2) + "\n")
        handle.flush(); os.fsync(handle.fileno())


def main(argv: Sequence[str] | None = None) -> int:
    print(json.dumps(execute_operation(build_parser().parse_args(argv)), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
