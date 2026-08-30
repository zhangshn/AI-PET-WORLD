from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Mapping

from ai_painter_full_backbone_spatial_affine_contract import (
    build_full_backbone_spatial_affine_controlled_smoke_config_template,
    issue_and_consume_full_backbone_spatial_affine_controlled_smoke_ticket,
    validate_full_backbone_spatial_affine_controlled_smoke_config,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def _read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON object required: {path}")
    return value


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _project_relative(path: Path) -> str:
    # Keep the logical project path stable.  ``.runtime`` is an intentionally
    # registered directory link whose physical target is on another volume;
    # resolving it before deriving the project-relative identity would turn a
    # valid ``F:\\...\\.runtime`` path into ``D:\\...`` and lose the formal
    # logical evidence identity.
    candidate = path if path.is_absolute() else PROJECT_ROOT / path
    lexical = Path(os.path.abspath(candidate))
    relative = lexical.relative_to(PROJECT_ROOT)
    if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
        raise ValueError("project-relative path identity is invalid")
    return relative.as_posix()


def _display_path(path: Path) -> str:
    try:
        return _project_relative(path)
    except ValueError:
        return str(path.resolve())


def main() -> int:
    parser = ArgumentParser(
        description=(
            "Materialize the immutable full-backbone spatial-affine controlled "
            "Smoke preflight template or atomically consumed active config."
        )
    )
    parser.add_argument("--operation", choices=("template", "consume", "validate"), required=True)
    parser.add_argument("--run-id")
    parser.add_argument("--output-namespace")
    parser.add_argument("--compiled-contract", type=Path)
    parser.add_argument("--compiled-contract-sha256")
    parser.add_argument("--dataset-package-id")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    if args.operation == "validate":
        if args.config is None:
            raise ValueError("--config is required for validate")
        result = validate_full_backbone_spatial_affine_controlled_smoke_config(
            _read_json(args.config),
            project_root=PROJECT_ROOT,
            require_execution_ticket=True,
        )
        print(json.dumps(result, ensure_ascii=False))
        return 0

    for name, value in (
        ("--run-id", args.run_id),
        ("--output-namespace", args.output_namespace),
        ("--compiled-contract", args.compiled_contract),
        ("--compiled-contract-sha256", args.compiled_contract_sha256),
        ("--output", args.output),
    ):
        if value is None or value == "":
            raise ValueError(f"{name} is required for {args.operation}")

    contract_path = args.compiled_contract.resolve()
    output_path = args.output.resolve()
    if not contract_path.is_file():
        raise ValueError("compiled controlled Smoke contract is missing")
    contract_relative = _project_relative(args.compiled_contract)
    if args.operation == "template":
        config = build_full_backbone_spatial_affine_controlled_smoke_config_template(
            run_id=args.run_id,
            output_namespace=args.output_namespace,
            compiled_contract_path=contract_relative,
            compiled_contract_sha256=args.compiled_contract_sha256,
            project_root=PROJECT_ROOT,
        )
        _write_json_exclusive(output_path, config)
        print(
            json.dumps(
                {
                    "status": "preflight_template_materialized_without_ticket",
                    "configPath": _display_path(args.output),
                    "configSha256": _sha256(output_path),
                    "internalTicketIssued": False,
                    "gpuStarted": False,
                    "trainingStarted": False,
                },
                ensure_ascii=False,
            )
        )
        return 0

    if not args.dataset_package_id:
        raise ValueError("--dataset-package-id is required for consume")
    active, ticket = (
        issue_and_consume_full_backbone_spatial_affine_controlled_smoke_ticket(
            dataset_package_id=args.dataset_package_id,
            run_id=args.run_id,
            output_namespace=args.output_namespace,
            compiled_contract_path=contract_relative,
            compiled_contract_sha256=args.compiled_contract_sha256,
            project_root=PROJECT_ROOT,
        )
    )
    _write_json_exclusive(output_path, active)
    print(
        json.dumps(
            {
                "status": "active_config_materialized_with_consumed_internal_ticket",
                "configPath": _display_path(args.output),
                "configSha256": _sha256(output_path),
                "ticket": ticket,
                "gpuStarted": False,
                "trainingStarted": False,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
