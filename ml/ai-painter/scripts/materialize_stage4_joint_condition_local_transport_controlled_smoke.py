from __future__ import annotations

from argparse import ArgumentParser, Namespace
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Mapping, Sequence

from ai_painter_joint_condition_local_transport_contract import (
    ARCHITECTURE_ID,
    build_joint_condition_local_transport_controlled_smoke_config_template,
    issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket,
    validate_joint_condition_local_transport_controlled_smoke_config,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
_TEMPLATE_WORK_ROOT = Path(
    ".runtime/ai-painter/stage4-joint-condition-local-transport-smoke-work"
)
_LEGACY_CANDIDATE_TOKENS = (
    "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
    "stage4-full-backbone-spatial-affine-controlled-smokes",
    "stage4FullBackboneSpatialAffineSmokeContract",
    "fullBackboneSpatialAffineContract",
)


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


def _project_relative(path: Path, project_root: Path) -> str:
    # Preserve the logical .runtime identity even when it is a directory link.
    root = Path(os.path.abspath(project_root))
    candidate = path if path.is_absolute() else root / path
    lexical = Path(os.path.abspath(candidate))
    relative = lexical.relative_to(root)
    if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
        raise ValueError("project-relative path identity is invalid")
    return relative.as_posix()


def _display_path(path: Path, project_root: Path) -> str:
    try:
        return _project_relative(path, project_root)
    except ValueError:
        return str(path.resolve())


def _assert_new_candidate_identity(config: Mapping[str, Any]) -> None:
    if (
        config.get("architectureVersion")
        != "joint-condition-local-transport-denoiser-v1"
        or config.get("denoiserArchitecture") != ARCHITECTURE_ID
    ):
        raise ValueError("joint local-transport candidate architecture identity changed")
    smoke_contract = config.get("jointConditionLocalTransportContract")
    if (
        not isinstance(smoke_contract, Mapping)
        or smoke_contract.get("capabilityVersion") != ARCHITECTURE_ID
        or smoke_contract.get("architectureId") != ARCHITECTURE_ID
    ):
        raise ValueError("joint local-transport candidate capability identity changed")
    serialized = json.dumps(dict(config), ensure_ascii=False, sort_keys=True)
    for token in _LEGACY_CANDIDATE_TOKENS:
        if token in serialized:
            raise ValueError(
                "joint local-transport materializer rejected an exited candidate identity"
            )


def build_parser() -> ArgumentParser:
    parser = ArgumentParser(
        description=(
            "Materialize the immutable joint-condition local-transport 30-Epoch "
            "controlled Smoke preflight template or one-ticket active config."
        )
    )
    parser.add_argument(
        "--operation", choices=("template", "consume", "validate"), required=True
    )
    parser.add_argument("--run-id")
    parser.add_argument("--output-namespace")
    parser.add_argument("--compiled-contract", type=Path)
    parser.add_argument("--compiled-contract-sha256")
    parser.add_argument("--dataset-package-id")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path)
    return parser


def execute_operation(args: Namespace, *, project_root: Path = PROJECT_ROOT) -> dict:
    # Keep one lexical spelling for containment checks.  On Windows, resolving a
    # TemporaryDirectory may expand only one side of an 8.3 path alias.
    root = Path(os.path.abspath(project_root))
    if args.operation == "validate":
        if args.config is None:
            raise ValueError("--config is required for validate")
        _project_relative(args.config, root)
        config = _read_json(args.config if args.config.is_absolute() else root / args.config)
        _assert_new_candidate_identity(config)
        result = validate_joint_condition_local_transport_controlled_smoke_config(
            config,
            project_root=root,
            require_execution_ticket=True,
        )
        return dict(result)

    for name, value in (
        ("--run-id", args.run_id),
        ("--output-namespace", args.output_namespace),
        ("--compiled-contract", args.compiled_contract),
        ("--compiled-contract-sha256", args.compiled_contract_sha256),
        ("--output", args.output),
    ):
        if value is None or value == "":
            raise ValueError(f"{name} is required for {args.operation}")

    contract_relative = _project_relative(args.compiled_contract, root)
    contract_path = root / contract_relative
    if not contract_path.is_file():
        raise ValueError("compiled controlled Smoke contract is missing")
    output_relative = _project_relative(args.output, root)
    output_path = root / output_relative
    if output_path.exists():
        raise FileExistsError(f"controlled Smoke config already exists: {output_relative}")

    if args.operation == "template":
        expected_template = (
            _TEMPLATE_WORK_ROOT / args.run_id / "preflight-config.json"
        ).as_posix()
        if output_relative != expected_template:
            raise ValueError(
                "joint local-transport template must use its isolated Smoke work root"
            )
        config = build_joint_condition_local_transport_controlled_smoke_config_template(
            run_id=args.run_id,
            output_namespace=args.output_namespace,
            compiled_contract_path=contract_relative,
            compiled_contract_sha256=args.compiled_contract_sha256,
            project_root=root,
        )
        _assert_new_candidate_identity(config)
        _write_json_exclusive(output_path, config)
        return {
            "status": (
                "stage4_joint_condition_local_transport_preflight_template_"
                "materialized_without_ticket"
            ),
            "configPath": _display_path(args.output, root),
            "configSha256": _sha256(output_path),
            "candidateIdentity": ARCHITECTURE_ID,
            "internalTicketIssued": False,
            "optimizerCreated": False,
            "gpuStarted": False,
            "trainingStarted": False,
        }

    if not args.dataset_package_id:
        raise ValueError("--dataset-package-id is required for consume")
    expected_active = Path(args.output_namespace) / "active-config.json"
    if output_relative != expected_active.as_posix():
        raise ValueError(
            "joint local-transport active config must use its isolated run root"
        )
    active, ticket = (
        issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket(
            dataset_package_id=args.dataset_package_id,
            run_id=args.run_id,
            output_namespace=args.output_namespace,
            compiled_contract_path=contract_relative,
            compiled_contract_sha256=args.compiled_contract_sha256,
            project_root=root,
        )
    )
    _assert_new_candidate_identity(active)
    _write_json_exclusive(output_path, active)
    return {
        "status": (
            "stage4_joint_condition_local_transport_active_config_"
            "materialized_with_consumed_internal_ticket"
        ),
        "configPath": _display_path(args.output, root),
        "configSha256": _sha256(output_path),
        "candidateIdentity": ARCHITECTURE_ID,
        "ticket": ticket,
        "optimizerCreated": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    result = execute_operation(args, project_root=PROJECT_ROOT)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
