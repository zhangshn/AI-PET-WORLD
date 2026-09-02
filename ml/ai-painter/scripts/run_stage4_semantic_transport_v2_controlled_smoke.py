from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
from typing import Any

MODE_ID = "stage4_semantic_transport_v2_controlled_smoke"
MODE_STATUS = "local_ai_stage4_semantic_transport_v2_controlled_smoke_active"
PROGRAM_GRAPH_SCHEMA = "ai-painter-program-graph-manifest-v1"
PROGRAM_GRAPH_ID = "stage4-v2-controlled-smoke-program-graph-v1"
PYTHON_ADAPTER_PATH = Path(
    "ml/ai-painter/scripts/run_stage4_semantic_transport_v2_controlled_smoke.py"
)
PYTHON_TRAINING_ADAPTER_PATH = Path(
    "ml/ai-painter/scripts/stage4_semantic_transport_v2_controlled_smoke_training.py"
)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SEED = 20263722
PREVIEW_EPOCHS = [1, 5, 10, 20, 30]
RESOLUTION = {"width": 256, "height": 192}


_PROJECT_MODULES_LOADED = False


def _load_project_modules() -> None:
    global _PROJECT_MODULES_LOADED
    global ARCHITECTURE_ID
    global build_stage4_semantic_transport_v2_cpu_inactive_config
    global execution_action_values_for_stage_config
    global local_ai_ticket_bound_config_sha256
    global resolve_stage_execution_grant
    global validate_stage4_semantic_transport_v2_trainer_contract
    if _PROJECT_MODULES_LOADED:
        return
    from ai_painter_authorization_policy import (  # noqa: PLC0415
        execution_action_values_for_stage_config as imported_action_values,
        local_ai_ticket_bound_config_sha256 as imported_config_sha256,
        resolve_stage_execution_grant as imported_resolve_grant,
    )
    from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: PLC0415
        ARCHITECTURE_ID as imported_architecture_id,
        build_stage4_semantic_transport_v2_cpu_inactive_config as imported_config_builder,
        validate_stage4_semantic_transport_v2_trainer_contract as imported_trainer_contract,
    )
    execution_action_values_for_stage_config = imported_action_values
    local_ai_ticket_bound_config_sha256 = imported_config_sha256
    resolve_stage_execution_grant = imported_resolve_grant
    ARCHITECTURE_ID = imported_architecture_id
    build_stage4_semantic_transport_v2_cpu_inactive_config = imported_config_builder
    validate_stage4_semantic_transport_v2_trainer_contract = imported_trainer_contract
    _PROJECT_MODULES_LOADED = True


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected top-level JSON object: {path}")
    return value


def _inside(path: Path, parent: Path) -> bool:
    resolved = path.resolve()
    root = parent.resolve()
    return resolved == root or root in resolved.parents


def _resolve_binding_path(root: Path, logical_path: str) -> Path:
    candidate = (root / logical_path).resolve()
    runtime_root = (root / ".runtime").resolve()
    if not _inside(candidate, root) and not _inside(candidate, runtime_root):
        raise ValueError("V2 Smoke program graph path escapes project/runtime roots")
    if not candidate.is_file():
        raise ValueError("V2 Smoke program graph bound file is missing")
    return candidate


def validate_package_program_graph(
    *, root: Path, package_payload_path: Path, package_payload_sha256: str
) -> dict[str, Any]:
    payload_path = package_payload_path.resolve()
    runtime_root = (root / ".runtime").resolve()
    if not _inside(payload_path, root) and not _inside(payload_path, runtime_root):
        raise ValueError("V2 Smoke package payload path escapes project/runtime roots")
    if not payload_path.is_file() or sha256_file(payload_path) != package_payload_sha256:
        raise ValueError("V2 Smoke package payload identity mismatch")
    payload = read_json(payload_path)
    graph_binding = payload.get("programGraphManifest")
    program_lineage = payload.get("programLineage")
    if not isinstance(graph_binding, dict) or not isinstance(program_lineage, dict):
        raise ValueError("V2 Smoke package program graph boundary is missing")
    graph_path = _resolve_binding_path(root, str(graph_binding.get("path", "")))
    if sha256_file(graph_path) != graph_binding.get("sha256"):
        raise ValueError("V2 Smoke program graph manifest SHA-256 changed")
    graph = read_json(graph_path)
    if graph.get("schemaVersion") != PROGRAM_GRAPH_SCHEMA:
        raise ValueError("V2 Smoke program graph schema mismatch")
    if graph.get("status") != "immutable_program_graph_verified":
        raise ValueError("V2 Smoke program graph status mismatch")
    if graph.get("graphId") != PROGRAM_GRAPH_ID:
        raise ValueError("V2 Smoke program graph identity mismatch")
    core = {key: value for key, value in graph.items() if key != "graphContentSha256"}
    content_sha256 = hashlib.sha256(canonical_json(core).encode("utf-8")).hexdigest()
    if graph.get("graphContentSha256") != content_sha256:
        raise ValueError("V2 Smoke program graph content SHA-256 changed")
    files = graph.get("files")
    if not isinstance(files, list) or not files or graph.get("fileCount") != len(files):
        raise ValueError("V2 Smoke program graph file inventory is invalid")
    verified_files: dict[str, dict[str, Any]] = {}
    for item in files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise ValueError("V2 Smoke program graph file entry is invalid")
        logical_path = item["path"]
        if logical_path in verified_files:
            raise ValueError("V2 Smoke program graph contains a duplicate file")
        absolute = _resolve_binding_path(root, logical_path)
        observed_sha256 = sha256_file(absolute)
        if item.get("sha256") != observed_sha256:
            raise ValueError("V2 Smoke program graph file SHA-256 changed")
        if item.get("byteSize") != absolute.stat().st_size:
            raise ValueError("V2 Smoke program graph file size changed")
        verified_files[logical_path] = {
            "path": logical_path,
            "sha256": observed_sha256,
            "byteSize": absolute.stat().st_size,
        }
    entrypoints = graph.get("entrypoints")
    if not isinstance(entrypoints, list):
        raise ValueError("V2 Smoke program graph entrypoints are missing")
    entrypoint_by_role = {
        item.get("role"): item.get("path")
        for item in entrypoints
        if isinstance(item, dict)
    }
    for role, declared in program_lineage.items():
        if not isinstance(declared, dict):
            raise ValueError("V2 Smoke program lineage binding is invalid")
        file_entry = verified_files.get(declared.get("path"))
        if file_entry is None or file_entry["sha256"] != declared.get("sha256"):
            raise ValueError("V2 Smoke program graph/lineage binding mismatch")
        if entrypoint_by_role.get(role) != declared.get("path"):
            raise ValueError("V2 Smoke program graph entrypoint mismatch")
    if program_lineage.get("pythonAdapter", {}).get("path") != PYTHON_ADAPTER_PATH.as_posix():
        raise ValueError("V2 Smoke Python adapter identity mismatch")
    if program_lineage.get("pythonTrainingAdapter", {}).get("path") != PYTHON_TRAINING_ADAPTER_PATH.as_posix():
        raise ValueError("V2 Smoke Python training adapter identity mismatch")
    return {
        "packagePayload": {
            "path": project_path(root, payload_path),
            "sha256": package_payload_sha256,
        },
        "programGraphManifest": {
            "path": graph_binding["path"],
            "sha256": graph_binding["sha256"],
        },
        "programLineage": program_lineage,
        "graphContentSha256": content_sha256,
        "fileCount": len(files),
    }


def write_exclusive_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()


def json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256_json(value: dict[str, Any]) -> str:
    return hashlib.sha256(json_bytes(value)).hexdigest()


def ensure_immutable_json(path: Path, value: dict[str, Any]) -> None:
    expected = sha256_json(value)
    if path.exists():
        if not path.is_file() or sha256_file(path) != expected:
            raise ValueError(f"immutable derived Trainer evidence conflicts: {path}")
        return
    write_exclusive_json(path, value)
    if sha256_file(path) != expected:
        raise ValueError(f"immutable derived Trainer evidence read-back mismatch: {path}")


def invoke_test_hook(hooks: dict[str, Any] | None, name: str) -> None:
    hook = None if hooks is None else hooks.get(name)
    if callable(hook):
        hook()


def project_path(root: Path, path: Path) -> str:
    resolved = path.resolve()
    runtime_root = (root / ".runtime").resolve()
    if _inside(resolved, runtime_root):
        return (Path(".runtime") / resolved.relative_to(runtime_root)).as_posix()
    return resolved.relative_to(root.resolve()).as_posix()


def derived_config_contract(
    *, package_id: str, run_id: str, dataset_package_id: str, output_namespace: str
) -> dict[str, Any]:
    """Return the parent-ticket-bound core, excluding the consumption-file hash.

    The parent Smoke ticket signs this exact value before it is consumed.  The
    concrete active config subsequently binds the atomic parent-consumption
    artifact, but that artifact cannot be part of its own pre-consumption
    digest.  This non-circular core is therefore the durable replay boundary.
    """
    return {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-derived-config-contract-v1",
        "capabilityVersion": ARCHITECTURE_ID,
        "modeId": MODE_ID,
        "packageId": package_id,
        "runId": run_id,
        "datasetPackageId": dataset_package_id,
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SEED,
        "resolution": RESOLUTION,
        "epochCount": 30,
        "previewEpochs": PREVIEW_EPOCHS,
        "outputDirectory": output_namespace,
        "historicalDenoiserCheckpointAllowed": False,
        "outputReuseAllowed": False,
        "ownerAuthorizationRequired": False,
    }


def derived_config_contract_sha256(**values: str) -> str:
    payload = derived_config_contract(**values)
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def build_active_config(
    *,
    root: Path,
    base_config_path: Path,
    signed_ticket: dict[str, str],
    signed_consumption: dict[str, str],
    dataset_package_id: str,
    package_id: str,
    run_id: str,
    output_namespace: str,
    derived_ticket_id: str,
    expected_derived_config_contract_sha256: str,
    autoencoder_checkpoint_path: str,
    autoencoder_checkpoint_sha256: str,
    dataset_release_path: str,
    dataset_release_sha256: str,
    program_graph_audit: dict[str, Any],
) -> dict[str, Any]:
    base = read_json(base_config_path)
    support = build_stage4_semantic_transport_v2_cpu_inactive_config(root)
    config = {**base, **support}
    config.update({
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-active-config-v1",
        "modelId": "ai-painter-stage4-v2-controlled-smoke-candidate",
        "architectureVersion": ARCHITECTURE_ID,
        "status": "active_local_ai_internal_capability",
        "ownership": "project_owned_architecture_ai_assisted_cold_start_weights",
        "imageSize": {"width": 1024, "height": 768},
        "formalInferenceEligible": False,
        "packagePayload": program_graph_audit["packagePayload"],
        "programGraphManifest": program_graph_audit["programGraphManifest"],
        "programLineage": program_graph_audit["programLineage"],
        "programGraphAudit": {
            "graphContentSha256": program_graph_audit["graphContentSha256"],
            "fileCount": program_graph_audit["fileCount"],
        },
    })
    training = {**base.get("training", {}), **support["training"]}
    training.update({
        "trainingAuthorizationStatus": MODE_STATUS,
        "authorizedOverfitSampleId": SAMPLE_ID,
        "authorizedInitialization": "fixed_random_stage4_v2_denoiser_without_checkpoint",
        "seed": SEED,
        "denoiserEpochs": 30,
        "batchSize": 1,
        "resolutionStages": [
            {"width": 256, "height": 192},
            {"width": 512, "height": 384},
            {"width": 1024, "height": 768},
        ],
        "fixedEpochPreviewPolicy": {
            "smoke": PREVIEW_EPOCHS,
            "formalStage": [1, 5, 10, 20, 30, 40],
        },
        "stage4UnifiedTrainingPreviewSamplingContract": {
            "enabled": True,
            "status": "active_local_ai_internal_capability",
            "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
            "modelStateBinding": "current_epoch_denoiser_state_dict_v1",
            "seedBinding": "fixed_seed_20263722",
            "normalizationBinding": "current_run_train_split_latent_normalization_v1",
            "decodeBinding": "frozen_autoencoder_complete_rgb_decode_v1",
            "checkpointPreviewIdentityGate": "byte_exact_best_epoch_reproduction",
        },
        "dataCapacityDecision": {
            "capacity": 64,
            "splitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        },
        "stage4V2ControlledSmokeExecution": {
            "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-execution-binding-v1",
            "packageId": package_id,
            "runId": run_id,
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": SEED,
            "resolutionStage": 0,
            "resolution": RESOLUTION,
            "epochCount": 30,
            "previewEpochs": PREVIEW_EPOCHS,
            "derivedTrainerTicketId": derived_ticket_id,
            "autoencoderCheckpoint": {
                "path": autoencoder_checkpoint_path,
                "sha256": autoencoder_checkpoint_sha256,
            },
            "datasetRelease": {
                "path": dataset_release_path,
                "sha256": dataset_release_sha256,
            },
            "signedParentTicket": signed_ticket,
            "signedParentTicketConsumption": signed_consumption,
            "historicalDenoiserCheckpointAllowed": False,
            "outputReuseAllowed": False,
            "ownerAuthorizationRequired": False,
            "derivedConfigContract": derived_config_contract(
                package_id=package_id,
                run_id=run_id,
                dataset_package_id=dataset_package_id,
                output_namespace=output_namespace,
            ),
            "derivedConfigContractSha256": expected_derived_config_contract_sha256,
            "oneTimeConsumptionInheritedFromParent": True,
            "independentAuthorizationAuthority": False,
        },
    })
    config["training"] = training
    actions = execution_action_values_for_stage_config(config)
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(config),
        "datasetPackageId": dataset_package_id,
        "runId": run_id,
        "outputNamespace": output_namespace,
    }
    ticket_id = derived_ticket_id
    ticket = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-v2",
        "status": "issued_not_consumed",
        "ticketId": ticket_id,
        "modeId": MODE_ID,
        "capabilityAuthority": "local_ai_pet_world_program",
        "ownerAuthorizationRequired": False,
        "parentAtomicConsumptionRequired": True,
        "independentAuthorizationAuthority": False,
        "executionActions": actions,
        "binding": binding,
    }
    return {"config": config, "ticket": ticket, "binding": binding, "actions": actions}


def materialize(args: Any, _test_hooks: dict[str, Any] | None = None) -> dict[str, Any]:
    root = args.project_root.resolve()
    program_graph_audit = validate_package_program_graph(
        root=root,
        package_payload_path=args.package_payload,
        package_payload_sha256=args.package_payload_sha256,
    )
    _load_project_modules()
    program_graph_audit = validate_package_program_graph(
        root=root,
        package_payload_path=args.package_payload,
        package_payload_sha256=args.package_payload_sha256,
    )
    for file_path, expected, label in (
        (args.signed_ticket, args.signed_ticket_sha256, "signed Smoke ticket"),
        (args.signed_consumption, args.signed_consumption_sha256, "signed Smoke consumption"),
    ):
        if not file_path.is_file() or sha256_file(file_path) != expected:
            raise ValueError(f"{label} identity mismatch")
    built = build_active_config(
        root=root,
        base_config_path=args.base_config,
        signed_ticket={"path": project_path(root, args.signed_ticket), "sha256": args.signed_ticket_sha256},
        signed_consumption={"path": project_path(root, args.signed_consumption), "sha256": args.signed_consumption_sha256},
        dataset_package_id=args.dataset_package_id,
        package_id=args.package_id,
        run_id=args.run_id,
        output_namespace=args.output_namespace,
        derived_ticket_id=args.derived_ticket_id,
        expected_derived_config_contract_sha256=args.derived_config_contract_sha256,
        autoencoder_checkpoint_path=args.autoencoder_checkpoint_path,
        autoencoder_checkpoint_sha256=args.autoencoder_checkpoint_sha256,
        dataset_release_path=args.dataset_release_path,
        dataset_release_sha256=args.dataset_release_sha256,
        program_graph_audit=program_graph_audit,
    )
    ticket_path = args.active_config.parent / "trainer-capability-ticket.json"
    ticket_sha = sha256_json(built["ticket"])
    consumption = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-consumption-v2",
        "ticketId": built["ticket"]["ticketId"],
        "ticketSha256": ticket_sha,
        "oneTimeConsumption": True,
        "state": "consumed",
        "binding": built["binding"],
        "parentAtomicConsumption": built["config"]["training"]["stage4V2ControlledSmokeExecution"]["signedParentTicketConsumption"],
        "independentAuthorizationAuthority": False,
    }
    consumption_path = args.active_config.parent / "trainer-capability-ticket-consumption.json"
    consumption_sha = sha256_json(consumption)
    config = built["config"]
    config["training"]["localAiCapabilityTicket"] = {
        "ticketId": built["ticket"]["ticketId"],
        "ticketPath": project_path(root, ticket_path),
        "ticketSha256": ticket_sha,
        "consumptionPath": project_path(root, consumption_path),
        "consumptionSha256": consumption_sha,
        "executionState": "consumed",
        "status": MODE_STATUS,
        "executionActions": built["actions"],
        **built["binding"],
    }
    config_sha = sha256_json(config)
    prepare_path = args.active_config.parent / "trainer-materialization-prepare.json"
    commit_path = args.active_config.parent / "trainer-materialization-commit.json"
    prepare = {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-trainer-materialization-prepare-v1",
        "status": "prepared",
        "packageId": args.package_id,
        "runId": args.run_id,
        "derivedTrainerTicketId": args.derived_ticket_id,
        "parentAtomicConsumption": config["training"]["stage4V2ControlledSmokeExecution"]["signedParentTicketConsumption"],
        "artifacts": {
            "trainerTicket": {"path": project_path(root, ticket_path), "sha256": ticket_sha},
            "trainerTicketConsumption": {"path": project_path(root, consumption_path), "sha256": consumption_sha},
            "activeConfig": {"path": project_path(root, args.active_config), "sha256": config_sha},
        },
    }
    ensure_immutable_json(prepare_path, prepare)
    invoke_test_hook(_test_hooks, "afterPreparePersisted")
    ensure_immutable_json(ticket_path, built["ticket"])
    invoke_test_hook(_test_hooks, "afterTicketPersisted")
    ensure_immutable_json(consumption_path, consumption)
    invoke_test_hook(_test_hooks, "afterConsumptionPersisted")
    ensure_immutable_json(args.active_config, config)
    invoke_test_hook(_test_hooks, "afterConfigPersisted")
    commit = {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-trainer-materialization-commit-v1",
        "status": "committed",
        "packageId": args.package_id,
        "runId": args.run_id,
        "prepare": {"path": project_path(root, prepare_path), "sha256": sha256_file(prepare_path)},
        "artifacts": prepare["artifacts"],
        "parentAtomicConsumption": prepare["parentAtomicConsumption"],
    }
    invoke_test_hook(_test_hooks, "beforeCommitPersisted")
    ensure_immutable_json(commit_path, commit)
    validate_active_config(args.active_config, root)
    return {
        "status": "stage4_v2_controlled_smoke_active_config_materialized",
        "activeConfig": {"path": project_path(root, args.active_config), "sha256": config_sha},
        "trainerTicket": {"path": project_path(root, ticket_path), "sha256": ticket_sha},
        "trainerTicketConsumption": {"path": project_path(root, consumption_path), "sha256": consumption_sha},
        "materializationPrepare": {"path": project_path(root, prepare_path), "sha256": sha256_file(prepare_path)},
        "materializationCommit": {"path": project_path(root, commit_path), "sha256": sha256_file(commit_path)},
        "gpuStarted": False,
        "trainingStarted": False,
    }


def validate_active_config(config_path: Path, root: Path) -> dict[str, Any]:
    config = read_json(config_path)
    package_payload = config.get("packagePayload", {})
    audit = validate_package_program_graph(
        root=root,
        package_payload_path=_resolve_binding_path(
            root, str(package_payload.get("path", ""))
        ),
        package_payload_sha256=str(package_payload.get("sha256", "")),
    )
    if config.get("programGraphManifest") != audit["programGraphManifest"]:
        raise ValueError("V2 Smoke active config program graph binding mismatch")
    if config.get("programLineage") != audit["programLineage"]:
        raise ValueError("V2 Smoke active config program lineage mismatch")
    if config.get("programGraphAudit") != {
        "graphContentSha256": audit["graphContentSha256"],
        "fileCount": audit["fileCount"],
    }:
        raise ValueError("V2 Smoke active config program graph audit mismatch")
    _load_project_modules()
    if config.get("denoiserArchitecture") != ARCHITECTURE_ID:
        raise ValueError("V2 Smoke architecture mismatch")
    training = config.get("training", {})
    execution = training.get("stage4V2ControlledSmokeExecution", {})
    if training.get("trainingAuthorizationStatus") != MODE_STATUS:
        raise ValueError("V2 Smoke mode status mismatch")
    if execution.get("sampleId") != SAMPLE_ID or execution.get("sampleSplit") != "validation":
        raise ValueError("V2 Smoke fixed validation sample mismatch")
    if execution.get("seed") != SEED or execution.get("resolution") != RESOLUTION:
        raise ValueError("V2 Smoke fixed seed or resolution mismatch")
    if execution.get("epochCount") != 30 or execution.get("previewEpochs") != PREVIEW_EPOCHS:
        raise ValueError("V2 Smoke schedule mismatch")
    if execution.get("historicalDenoiserCheckpointAllowed") is not False:
        raise ValueError("V2 Smoke permits a historical Denoiser")
    contract = execution.get("derivedConfigContract")
    if contract != derived_config_contract(
        package_id=str(execution.get("packageId")),
        run_id=str(execution.get("runId")),
        dataset_package_id=str(contract.get("datasetPackageId")) if isinstance(contract, dict) else "",
        output_namespace=str(contract.get("outputDirectory")) if isinstance(contract, dict) else "",
    ):
        raise ValueError("V2 Smoke derived config contract mismatch")
    actual_contract_sha = hashlib.sha256(canonical_json(contract).encode("utf-8")).hexdigest()
    if actual_contract_sha != execution.get("derivedConfigContractSha256"):
        raise ValueError("V2 Smoke derived config contract SHA-256 mismatch")
    if execution.get("oneTimeConsumptionInheritedFromParent") is not True:
        raise ValueError("V2 Smoke derived ticket lacks parent atomic consumption")
    if execution.get("independentAuthorizationAuthority") is not False:
        raise ValueError("V2 Smoke derived ticket expands authority")
    ticket = training.get("localAiCapabilityTicket", {})
    if execution.get("derivedTrainerTicketId") != ticket.get("ticketId"):
        raise ValueError("V2 Smoke derived Trainer ticket identity mismatch")
    autoencoder = execution.get("autoencoderCheckpoint", {})
    if not isinstance(autoencoder.get("path"), str) or not isinstance(autoencoder.get("sha256"), str):
        raise ValueError("V2 Smoke Autoencoder checkpoint binding is missing")
    if sha256_file(root / autoencoder["path"]) != autoencoder["sha256"]:
        raise ValueError("V2 Smoke Autoencoder checkpoint binding changed")
    dataset_release = execution.get("datasetRelease", {})
    if not isinstance(dataset_release.get("path"), str) or not isinstance(dataset_release.get("sha256"), str):
        raise ValueError("V2 Smoke dataset release binding is missing")
    if sha256_file(root / dataset_release["path"]) != dataset_release["sha256"]:
        raise ValueError("V2 Smoke dataset release binding changed")
    validate_stage4_semantic_transport_v2_trainer_contract(config, root=root)
    grant = resolve_stage_execution_grant(config, project_root=root)
    required = {
        "load_autoencoder", "create_optimizer", "execute_backward",
        "mutate_model_weights", "write_smoke_checkpoint", "select_bound_sample",
    }
    if not required.issubset({action.value for action in grant.allowed_actions}):
        raise ValueError("V2 Smoke execution grant is incomplete")
    if grant.checkpoint_constraints.get("parentDenoiserAllowed") is not False:
        raise ValueError("V2 Smoke execution grant permits a parent Denoiser")
    return config


def run_trainer(args: Any) -> int:
    root = args.project_root.resolve()
    if sha256_file(args.config) != args.expected_config_sha256:
        raise ValueError("V2 Smoke active config changed after materialization")
    validate_active_config(args.config, root)
    # The frozen Trainer CLI still routes unknown Smoke modes through an old
    # R5 provenance branch.  V2 must never impersonate that historical
    # contract, so execution is delegated to an explicit lower-level adapter.
    from stage4_semantic_transport_v2_controlled_smoke_training import (
        execute_stage4_v2_controlled_smoke,
    )
    validate_active_config(args.config, root)
    return int(execute_stage4_v2_controlled_smoke(
        config_path=args.config,
        dataset_package_path=args.dataset_package,
        autoencoder_checkpoint_path=args.autoencoder_checkpoint,
        output_dir=args.output_dir,
        preflight_only=args.preflight_only,
    ))


def parse_args() -> Any:
    parser = ArgumentParser(description="Stage4 V2 controlled Smoke explicit execution adapter")
    parser.add_argument("--operation", choices=["materialize", "validate", "run"], required=True)
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--active-config", "--config", dest="config", type=Path)
    parser.add_argument("--base-config", type=Path, default=Path("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json"))
    parser.add_argument("--signed-ticket", type=Path)
    parser.add_argument("--signed-ticket-sha256")
    parser.add_argument("--signed-consumption", type=Path)
    parser.add_argument("--signed-consumption-sha256")
    parser.add_argument("--dataset-package-id")
    parser.add_argument("--package-id")
    parser.add_argument("--run-id")
    parser.add_argument("--output-namespace")
    parser.add_argument("--derived-ticket-id")
    parser.add_argument("--derived-config-contract-sha256")
    parser.add_argument("--autoencoder-checkpoint-path")
    parser.add_argument("--autoencoder-checkpoint-sha256")
    parser.add_argument("--dataset-release-path")
    parser.add_argument("--dataset-release-sha256")
    parser.add_argument("--package-payload", type=Path)
    parser.add_argument("--package-payload-sha256")
    parser.add_argument("--dataset-package", type=Path)
    parser.add_argument("--autoencoder-checkpoint", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--expected-config-sha256")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.operation == "materialize":
        args.active_config = args.config
        required = [args.config, args.signed_ticket, args.signed_ticket_sha256, args.signed_consumption, args.signed_consumption_sha256, args.dataset_package_id, args.package_id, args.run_id, args.output_namespace, args.derived_ticket_id, args.derived_config_contract_sha256, args.autoencoder_checkpoint_path, args.autoencoder_checkpoint_sha256, args.dataset_release_path, args.dataset_release_sha256, args.package_payload, args.package_payload_sha256]
        if any(value is None for value in required):
            raise ValueError("materialize operation arguments are incomplete")
        print(json.dumps(materialize(args), ensure_ascii=False, indent=2))
        return 0
    if args.operation == "validate":
        if args.config is None:
            raise ValueError("validate requires --config")
        validate_active_config(args.config, args.project_root.resolve())
        print(json.dumps({"status": "stage4_v2_controlled_smoke_active_config_valid"}))
        return 0
    required = [args.config, args.expected_config_sha256, args.dataset_package, args.autoencoder_checkpoint, args.output_dir]
    if any(value is None for value in required):
        raise ValueError("run operation arguments are incomplete")
    return run_trainer(args)


if __name__ == "__main__":
    raise SystemExit(main())
