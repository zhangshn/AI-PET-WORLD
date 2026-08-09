from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806/request.json"
)
AUTHORIZATION_SHA256 = "1c497e6802da24bd6e16e3b981b7ff5438639047d04f3d9afa677bb33937efed"
IMPLEMENTATION_PATH = AUTHORIZATION_PATH.parent / "implementation-authorization-consumption.json"
IMPLEMENTATION_SHA256 = "7ed86af0f3fb94ef3585c83cb5511fbd72273da94fbb69bb594ab6f683f5ab7f"
COMMAND_REF = "owner-authorized-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806"
SCOPE = (
    "fix_only_two_diagnostic_success_status_bindings_sync_related_hashes_then_one_"
    "cpu_gate_preflights_and_one_30_epoch_bounded_gpu_smoke"
)
PREVIOUS_FAILURE_TERMINAL_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations/"
    "ai-assisted-v7-r5-stage4-bounded-repair-smoke-2026-08-05T15-36-34-038Z-finalization/"
    "phase-terminal.json"
)
PREVIOUS_FAILURE_TERMINAL_SHA256 = "c9804cd03a5ca706a0230a695a440c57adfe0d6d125e3a3495db1e109eb3cbc7"
INACTIVE_CONFIG_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/"
    "ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/"
    "inactive-config.json"
)
INACTIVE_CONFIG_SHA256 = "6bcc1a6f49b4e9fd5a7ac1eca5f25783445894097b22cf349e15b365cad07332"
SELECTION_PATH = INACTIVE_CONFIG_PATH.parent / "selection-contract.json"
SELECTION_SHA256 = "6b4b6c9e23836b2d483625594b254f725c1e0ebc799c54f20507210a9db8e228"
SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/"
    "v7-r5-stage4-diagnostic-evidence-bounded-repair-trainer-support-contract.json"
)
SUPPORT_SHA256 = "8b0bbd53283af7faff236797d51d418170e520da63522c2e91d07331432ac1b4"
BOUNDED_CPU_PATH = INACTIVE_CONFIG_PATH.parent / "cpu-positive-negative-regression.json"
BOUNDED_CPU_SHA256 = "975332317a237b7da5ad96c131d6420c5a9d8033790fcb113976e96544a7e05c"
BOUNDED_TERMINAL_PATH = INACTIVE_CONFIG_PATH.parent / "phase-terminal.json"
BOUNDED_TERMINAL_SHA256 = "7d602540466eb08a44985357508bd9f9fbcb981935dd031a3d1a2acafd3c6643"
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
TRAINER_SHA256 = "f9a6b6d6a7c7a4b5e5f98178ad5b2ec1696a33354fbf294b56d5ff1e90ee7ccc"
RUNNER_PATH = Path("scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs")
RUNNER_SHA256 = "4ca34148e3a6055ecc86049c7c93b3601755918db8b5790337da465154493a4b"
DATASET_MANIFEST_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
SOURCE_INDEX_PATH = DATASET_MANIFEST_PATH.parent / "source-index.json"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
STAGE0_MANIFEST_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/"
    "ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z-stage-0/manifest.json"
)
STAGE0_MANIFEST_SHA256 = "2dfcfd016734ef7d88e33d6f75b23b9d043df7d075b280827b304e1c89ede5ef"
STAGE0_CHECKPOINT_PATH = STAGE0_MANIFEST_PATH.parent / "complete-world-ai-assisted-conditional-denoiser.pt"
STAGE0_CHECKPOINT_SHA256 = "17c1d4e34e8e738bc042c0f99dad27afcc3bfd9337e3e220bc0e172c6e634453"
AUTOENCODER_CHECKPOINT_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
AUTOENCODER_CHECKPOINT_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_bounded_repair_smoke_preflight_only"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
CONDITION_LABEL = "v7-complete-map-194"
PREVIEWS = [1, 5, 10, 20, 30]
CONFIG_BOUND_AUTHORIZATION_MODE = "config_bound_immutable_owner_authorization_v1"
SAMPLE194_WEST_REQUEST_ID = (
    "owner-action-request-v7-r5-stage4-config-bound-runtime-path-fix-cpu-20260808-135613962"
)
SAMPLE194_WEST_AUTHORIZATION_PATH = Path(
    f".runtime/ai-painter/owner-action-requests/{SAMPLE194_WEST_REQUEST_ID}/request.json"
)
SAMPLE194_WEST_AUTHORIZATION_SHA256 = "1fb57e5f6c4596619646bd6706fc4dd37f2551419c2aca0a97bc705fe3ded15e"
SAMPLE194_WEST_IMPLEMENTATION_PATH = (
    SAMPLE194_WEST_AUTHORIZATION_PATH.parent / "implementation-authorization-consumption.json"
)
SAMPLE194_WEST_IMPLEMENTATION_SHA256 = "317bb99dca62fbaf8237916f5e6483f311e91aaaff284571798346c4d6b69029"
SAMPLE194_WEST_COMMAND_REF = (
    "owner-authorized-v7-r5-stage4-config-bound-runtime-path-fix-cpu-20260808-135613962"
)
SAMPLE194_WEST_SCOPE = (
    "fix_registered_runtime_path_identity_sync_stage4_hashes_and_run_one_complete_"
    "sample194_west_cpu_audit_only"
)
SAMPLE194_PREVIOUS_CPU_FAILURE_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-sample194-west-inactive-smoke-config-cpu-runs/"
    "ai-assisted-v7-r5-stage4-sample194-west-inactive-smoke-config-cpu-"
    "2026-08-08T05-00-05-771Z/phase-terminal.json"
)
SAMPLE194_PREVIOUS_CPU_FAILURE_SHA256 = (
    "a715be9dedfec7d1fb9f05d55c87d9f008bb98d0c3b53bc4bdaf055ae621b8b2"
)
PROJECT_RUNTIME_LOGICAL_ENTRY = ".runtime"
REGISTERED_HOT_RUNTIME_ROOT = "D:/AI-PET-WORLD-DATA/hot/runtime"
STORAGE_AUTHORITY_PATH = Path("docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md")
STORAGE_AUTHORITY_SHA256 = "5517383c6015bb727f76fa84348aa5abaf5ee1ee70a10a7d97c9d6a94350da5e"
ARCHITECTURE_AUTHORITY_PATH = Path("docs/ARCHITECTURE.md")
ARCHITECTURE_AUTHORITY_SHA256 = "99210b4762078f1912769d8eb655835de5e2cad27d587176b6ec54a1cbf3e86f"
INACTIVE_COMPILER_PATH = Path(
    "ml/ai-painter/scripts/check_ai_assisted_v7_r5_stage4_diagnostic_evidence_bounded_repair_cpu.py"
)
INACTIVE_COMPILER_BEFORE_SHA256 = "50337113d143eff5e5f4e0dc7f0daf467b6a9b3dfa6622d375c136eeae6d5c8e"
CPU_CHECKER_BEFORE_SHA256 = "88ab1a5d02ccd7ebea0aaa118f817f0f7d8a87c711269d58b34daea43b5113b5"
TRAINER_BEFORE_CONFIG_BOUND_SHA256 = "cbaf2e440d18fa780fd1bdb1252878745408e36797f263206deece587e66daf0"
SAMPLE194_CURRENT_TRAINER_SHA256 = "90dc6bb3c1da44e828ce94f0a51e5f58a91e052c9e822ae4b0579d94918e71e6"
SAMPLE194_CURRENT_INACTIVE_COMPILER_SHA256 = (
    "f754d24c147c114ae903623b1d7fc9b8e782fcf09fe00c4755e826da87e1b415"
)
SOURCE_INACTIVE_CONFIG_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/"
    "ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/"
    "inactive-config.json"
)
SOURCE_INACTIVE_CONFIG_SHA256 = "6bcc1a6f49b4e9fd5a7ac1eca5f25783445894097b22cf349e15b365cad07332"
SOURCE_SELECTION_PATH = SOURCE_INACTIVE_CONFIG_PATH.parent / "selection-contract.json"
SOURCE_SELECTION_SHA256 = "6b4b6c9e23836b2d483625594b254f725c1e0ebc799c54f20507210a9db8e228"
BOUNDARY_ANALYSIS_PATH = Path(
    ".runtime/ai-painter/local-ai-v7-r5-stage4-boundary-provenance-smoke-telemetry-readonly-analysis/"
    "local-ai-v7-r5-stage4-boundary-provenance-narrowed-review-identity-readonly-analysis-"
    "2026-08-08T03-57-39-860Z/analysis-report.json"
)
BOUNDARY_ANALYSIS_SHA256 = "e9f0519db4d2d0cb50c5c338d72166072b1c0ab4ca3554be3f46a3195a00496c"
TOPOLOGY_SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/"
    "v7-r5-stage4-sample-bound-topology-step-telemetry-support-contract.json"
)
TOPOLOGY_SUPPORT_SHA256 = "1e17fa7cdbae5e7d7189f6bb9e90fd47c16aba87fa4e56bb1d6100e19a6f0736"
TELEMETRY_LIBRARY_PATH = Path("scripts/lib/ai-assisted-v7-r5-stage4-step-telemetry.mjs")
TELEMETRY_LIBRARY_SHA256 = "b44197e9628a78cd8f2f66c6a80f2f935b070877ef1e1c4d1ab81b46f4d4a9a1"
CURRENT_RUNNER_SHA256 = "9089a664284e79d6232028f21fa2a219a9b59b77b465208adad9b8f76ffcbcd6"
CURRENT_EXECUTION_GUIDE_PATH = Path("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
CURRENT_EXECUTION_GUIDE_BEFORE_SHA256 = "4cd5c5dee989bf1495ca870391b749a3fcfad8bc0ea207645271808d5a3d8bf9"
SAMPLE194_IMAGE_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/"
    "images/complete-maps/ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6.png"
)
SAMPLE194_CONDITION_PACK_PATH = Path(
    ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/"
    "earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-08-01T15-47-45-117Z/"
    "complete-map-condition-task/compiled-conditions/condition-pack.json"
)
SAMPLE194_REQUIRED_SIDES = ["west"]
SAMPLE194_SEED = 20263722
SAMPLE194_OUTPUT_SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/"
    "v7-r5-stage4-sample194-west-inactive-smoke-config-cpu-support-contract.json"
)
GPU_REQUEST_ID = "owner-action-request-v7-r5-stage4-sample194-west-runner-telemetry-output-ownership-fix-gpu-smoke-20260808-150714877"
GPU_REQUEST_ROOT = Path(f".runtime/ai-painter/owner-action-requests/{GPU_REQUEST_ID}")
GPU_SOURCE_AUTHORIZATION_PATH = GPU_REQUEST_ROOT / "request.json"
GPU_SOURCE_AUTHORIZATION_SHA256 = "ce172a3d877a1e38629f918a3cbad6f061c11c43b0f52fa7de05741eff0effb7"
GPU_SOURCE_IMPLEMENTATION_PATH = GPU_REQUEST_ROOT / "implementation-authorization-consumption.json"
GPU_SOURCE_IMPLEMENTATION_SHA256 = "ca746a17de479b79cb83d6a461dd0b845ff1fcbbe5b82bccfe4082d5c47988d4"
GPU_PREFLIGHT_AUTHORIZATION_PATH = GPU_REQUEST_ROOT / "cpu-preflight-authorization.json"
GPU_PREFLIGHT_AUTHORIZATION_SHA256 = "3dbe11f0e5dd75e53db51af4f521044d055361c81214abd17a49d6099b502974"
GPU_PREFLIGHT_IMPLEMENTATION_PATH = GPU_REQUEST_ROOT / "preflight-implementation-consumption.json"
GPU_PREFLIGHT_IMPLEMENTATION_SHA256 = "7dc6c58d0898ba4f4d31eacf3f04fff6894e718db2aee3f5c68eb44831304d89"
GPU_AUTHORIZATION_PATH = GPU_REQUEST_ROOT / "gpu-intent-authorization.json"
GPU_AUTHORIZATION_SHA256 = "4da5b8cf0be812c28c04f808c2c5b99299409b02a3eede0737d594685a3d5430"
GPU_IMPLEMENTATION_PATH = GPU_REQUEST_ROOT / "training-implementation-consumption.json"
GPU_COMMAND_REF = "owner-authorized-v7-r5-stage4-sample194-west-runner-telemetry-output-ownership-fix-gpu-smoke-20260808-150714877"
GPU_SCOPE = (
    "fix_only_stage4_smoke_runner_checkpoint_hash_telemetry_output_ownership_sync_cpu_checker_"
    "and_dual_authorizations_run_one_cpu_gate_then_if_passed_one_gpu_smoke"
)
GPU_PREVIOUS_FAILURE_TERMINAL_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations/"
    "ai-assisted-v7-r5-stage4-bounded-repair-smoke-20260808-145157631-finalization/phase-terminal.json"
)
GPU_PREVIOUS_FAILURE_TERMINAL_SHA256 = "d33aeeb57dec24133cea8922d54567d8aa665013335d80d98f0396e427c7c3bc"
GPU_INACTIVE_CONFIG_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-sample194-west-config-bound-path-fix-cpu-runs/"
    "ai-assisted-v7-r5-stage4-sample194-west-config-bound-path-fix-cpu-"
    "2026-08-08T05-56-13-962Z/inactive-smoke-config.json"
)
GPU_INACTIVE_CONFIG_SHA256 = "e35632ab00c640a9b54fbdb49585480e61a36c5323cfb3e00de5ddc1a6745799"
GPU_INACTIVE_SUPPORT_PATH = SAMPLE194_OUTPUT_SUPPORT_PATH
GPU_INACTIVE_SUPPORT_SHA256 = "546ed64c2e7c83d8e6a03a2b3d510d19a2922fa8f9e4951f49407dcccab35054"
GPU_INACTIVE_CPU_REPORT_PATH = GPU_INACTIVE_CONFIG_PATH.parent / "cpu-positive-negative-regression.json"
GPU_INACTIVE_CPU_REPORT_SHA256 = "b7c6b543218e2829b1a0c22fd37f1f725929fbd1a4abc3d7b580115528e085f7"
GPU_INACTIVE_CPU_TERMINAL_PATH = GPU_INACTIVE_CONFIG_PATH.parent / "phase-terminal.json"
GPU_INACTIVE_CPU_TERMINAL_SHA256 = "bec6d25a1ecd6febc2bc006e245a6dfaa827f45ebd2228efc22cbd38ae0ace13"
GPU_RUNNER_SHA256 = "8581d8fbebf2a7e7f56e1113a0dee02bac08a813897fc30a41892fe224264215"
GPU_OUTPUT_RUN_ID = "ai-assisted-v7-r5-stage4-bounded-repair-smoke-20260808-150714877"
GPU_OUTPUT_DIRECTORY_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4-"
    f"bounded-repair-smoke/{GPU_OUTPUT_RUN_ID}"
)
GPU_RUNNER_CHECKPOINT_HASH_TELEMETRY_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4-"
    f"bounded-repair-smoke/runner-checkpoint-hash-telemetry/{GPU_OUTPUT_RUN_ID}.json"
)
GPU_OUTPUT_SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/v7-r5-stage4-sample194-west-gpu-smoke-support-contract-v4.json"
)


def main() -> int:
    parser = ArgumentParser(description="CPU-check the Stage 4 bounded-repair Smoke authorization gate.")
    parser.add_argument("--sample194-west", action="store_true")
    parser.add_argument("--sample194-west-gpu", action="store_true")
    parser.add_argument("--cross-domain", action="store_true")
    parser.add_argument("--root-authorization", type=Path)
    parser.add_argument("--preflight-authorization", type=Path)
    parser.add_argument("--gpu-authorization", type=Path)
    parser.add_argument("--inactive-config", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    if args.cross_domain:
        return run_cross_domain_gpu_gate(args)
    if args.sample194_west_gpu:
        return run_sample194_west_gpu_gate(args)
    if args.sample194_west:
        return run_sample194_west_config_bound_gate(args)
    try:
        validate_immutable_inputs()
        trainer = load_trainer()
        source = read_json(INACTIVE_CONFIG_PATH)
        package = read_json(DATASET_MANIFEST_PATH)
        config = preflight_config(source)
        trainer.validate_training_inputs(config, package)
        positive, negative = run_assertions(trainer, source, config, package)
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        report = build_report(positive, negative, failures)
        write_json_exclusive(args.report, report)
        if failures:
            write_json_exclusive(args.terminal, terminal_record(
                "stage4_bounded_repair_smoke_cpu_gate_failed_closed", failures, args
            ))
            return 1
        contract = support_contract(args, report)
        write_json_exclusive(args.contract, contract)
        write_json_exclusive(args.terminal, terminal_record(
            "stage4_bounded_repair_smoke_cpu_gate_passed_gpu_not_started", [], args
        ))
        print(json.dumps({
            "status": report["status"],
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(args.report),
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(args.terminal),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not resolved(args.terminal).exists():
            write_json_exclusive(args.terminal, {
                "schemaVersion": "stage4-bounded-repair-smoke-authorization-cpu-terminal-v1",
                "status": "stage4_bounded_repair_smoke_cpu_gate_execution_failed_closed",
                "blockers": [f"{type(error).__name__}: {error}"],
                **inactive_boundaries(),
            })
        raise


def run_sample194_west_config_bound_gate(args) -> int:
    try:
        if args.inactive_config is None:
            raise ValueError("sample194_west_inactive_config_output_missing")
        authorization, implementation = validate_sample194_west_bindings(args)
        trainer = load_trainer()
        compiler = load_inactive_compiler()
        source = read_json(SOURCE_INACTIVE_CONFIG_PATH)
        selection = read_json(SOURCE_SELECTION_PATH)
        package = read_json(DATASET_MANIFEST_PATH)
        stage0_manifest = read_json(STAGE0_MANIFEST_PATH)
        sample_identity = {
            "sampleId": SAMPLE_ID,
            "conditionLabel": CONDITION_LABEL,
            "sampleSplit": "validation",
            "seed": SAMPLE194_SEED,
            "requiredBoundarySides": list(SAMPLE194_REQUIRED_SIDES),
            "epochCount": 30,
            "evaluationInterval": 5,
            "requiredPreviewEpochs": list(PREVIEWS),
            "requiredDiagnosticMetricCount": 17,
            "imagePath": project_path(SAMPLE194_IMAGE_PATH),
            "conditionPackPath": project_path(SAMPLE194_CONDITION_PACK_PATH),
        }
        checkpoint_identity = {
            "stage0ManifestPath": project_path(STAGE0_MANIFEST_PATH),
            "stage0ManifestSha256": STAGE0_MANIFEST_SHA256,
            "stage0CheckpointPath": stage0_manifest["checkpointPath"],
            "stage0CheckpointSha256": stage0_manifest["checkpointSha256"],
        }
        topology_evidence = {
            "boundaryAnalysisPath": project_path(BOUNDARY_ANALYSIS_PATH),
            "boundaryAnalysisSha256": BOUNDARY_ANALYSIS_SHA256,
            "supportContractPath": project_path(TOPOLOGY_SUPPORT_PATH),
            "supportContractSha256": TOPOLOGY_SUPPORT_SHA256,
        }
        authorization_binding = config_bound_authorization_binding(args, authorization, implementation, stage0_manifest)
        config = compiler.compile_sample_bound_stage4_inactive_smoke_config(
            source,
            authorization_binding=authorization_binding,
            sample_identity=sample_identity,
            checkpoint_identity=checkpoint_identity,
            topology_evidence=topology_evidence,
        )
        preflight = sample194_west_preflight_config(config)
        topology = validate_sample194_west_preflight(trainer, preflight, package)
        positive, negative = sample194_west_assertions(
            trainer,
            compiler,
            source,
            selection,
            config,
            preflight,
            package,
            topology,
            args,
            stage0_manifest,
        )
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        report = sample194_west_report(args, positive, negative, failures, topology)
        if failures:
            write_json_exclusive(args.report, report)
            write_json_exclusive(args.terminal, sample194_west_terminal(
                "stage4_sample194_west_inactive_config_cpu_gate_failed_closed",
                failures,
                args,
            ))
            return 1

        write_json_exclusive(args.inactive_config, config)
        report["outputs"] = {
            "inactiveConfigPath": project_path(args.inactive_config),
            "inactiveConfigSha256": sha256_file(args.inactive_config),
        }
        write_json_exclusive(args.report, report)
        contract = sample194_west_support_contract(args, report)
        write_json_exclusive(args.contract, contract)
        terminal = sample194_west_terminal(
            "stage4_sample194_west_inactive_config_and_config_bound_cpu_gate_closed_success",
            [],
            args,
        )
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(args.terminal),
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if resolved(args.terminal).parent.is_dir() and not resolved(args.terminal).exists():
            write_json_exclusive(args.terminal, {
                "schemaVersion": "stage4-sample194-west-config-bound-cpu-terminal-v1",
                "status": "stage4_sample194_west_inactive_config_cpu_gate_execution_failed_closed",
                "blockers": [f"{type(error).__name__}: {error}"],
                "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                **inactive_boundaries(),
            })
        raise


def validate_sample194_west_bindings(args):
    for path, expected, code in (
        (SAMPLE194_WEST_AUTHORIZATION_PATH, SAMPLE194_WEST_AUTHORIZATION_SHA256, "authorization"),
        (SAMPLE194_WEST_IMPLEMENTATION_PATH, SAMPLE194_WEST_IMPLEMENTATION_SHA256, "implementation"),
        (
            SAMPLE194_PREVIOUS_CPU_FAILURE_PATH,
            SAMPLE194_PREVIOUS_CPU_FAILURE_SHA256,
            "previous_cpu_failure_terminal",
        ),
        (SOURCE_INACTIVE_CONFIG_PATH, SOURCE_INACTIVE_CONFIG_SHA256, "source_inactive_config"),
        (SOURCE_SELECTION_PATH, SOURCE_SELECTION_SHA256, "selection"),
        (BOUNDARY_ANALYSIS_PATH, BOUNDARY_ANALYSIS_SHA256, "boundary_analysis"),
        (TOPOLOGY_SUPPORT_PATH, TOPOLOGY_SUPPORT_SHA256, "topology_support"),
        (DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"),
        (SOURCE_INDEX_PATH, SOURCE_INDEX_SHA256, "source_index"),
        (STAGE0_MANIFEST_PATH, STAGE0_MANIFEST_SHA256, "stage0_manifest"),
        (STORAGE_AUTHORITY_PATH, STORAGE_AUTHORITY_SHA256, "storage_authority"),
        (ARCHITECTURE_AUTHORITY_PATH, ARCHITECTURE_AUTHORITY_SHA256, "architecture_authority"),
        (TRAINER_PATH, SAMPLE194_CURRENT_TRAINER_SHA256, "current_trainer"),
        (
            INACTIVE_COMPILER_PATH,
            SAMPLE194_CURRENT_INACTIVE_COMPILER_SHA256,
            "current_inactive_compiler",
        ),
        (RUNNER_PATH, CURRENT_RUNNER_SHA256, "runner"),
        (TELEMETRY_LIBRARY_PATH, TELEMETRY_LIBRARY_SHA256, "telemetry_library"),
        (CURRENT_EXECUTION_GUIDE_PATH, CURRENT_EXECUTION_GUIDE_BEFORE_SHA256, "current_execution_guide"),
    ):
        if not resolved(path).is_file() or sha256_file(path) != expected:
            raise ValueError(f"sample194_west_{code}_missing_or_changed")
    authorization = read_json(SAMPLE194_WEST_AUTHORIZATION_PATH)
    implementation = read_json(SAMPLE194_WEST_IMPLEMENTATION_PATH)
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("requestId") != SAMPLE194_WEST_REQUEST_ID
        or authorization.get("ownerDecision", {}).get("commandRef") != SAMPLE194_WEST_COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != SAMPLE194_WEST_SCOPE
    ):
        raise ValueError("sample194_west_authorization_identity_invalid")
    if (
        implementation.get("status")
        != "consumed_before_config_bound_stage4_smoke_preflight_and_evidence_writes"
        or implementation.get("authorizationSha256") != SAMPLE194_WEST_AUTHORIZATION_SHA256
        or implementation.get("commandRef") != SAMPLE194_WEST_COMMAND_REF
        or implementation.get("scope") != SAMPLE194_WEST_SCOPE
        or int(implementation.get("allowedImplementationCount", 0)) != 1
        or int(implementation.get("allowedConfigCompilationCount", 0)) != 1
        or int(implementation.get("allowedCpuRegressionCount", 0)) != 1
        or int(implementation.get("allowedCompleteCpuAuditCount", 0)) != 1
        or implementation.get("gpuExecutionConsumed") is not False
        or implementation.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("sample194_west_implementation_identity_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "modelId": "ai-pet-world-complete-world-ai-assisted-cold-start-v7",
        "fixedStageNumber": 4,
        "sampleId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "sampleSplit": "validation",
        "seed": SAMPLE194_SEED,
        "requiredBoundarySides": SAMPLE194_REQUIRED_SIDES,
        "epochCount": 30,
        "evaluationInterval": 5,
        "requiredPreviewEpochs": PREVIEWS,
        "requiredDiagnosticMetricCount": 17,
        "projectRuntimeLogicalEntry": PROJECT_RUNTIME_LOGICAL_ENTRY,
        "registeredHotRuntimeRoot": REGISTERED_HOT_RUNTIME_ROOT,
        "storageAuthorityPath": project_path(STORAGE_AUTHORITY_PATH),
        "storageAuthoritySha256": STORAGE_AUTHORITY_SHA256,
        "architectureAuthorityPath": project_path(ARCHITECTURE_AUTHORITY_PATH),
        "architectureAuthoritySha256": ARCHITECTURE_AUTHORITY_SHA256,
        "previousCpuFailureTerminalPath": project_path(SAMPLE194_PREVIOUS_CPU_FAILURE_PATH),
        "previousCpuFailureTerminalSha256": SAMPLE194_PREVIOUS_CPU_FAILURE_SHA256,
        "trainerPath": project_path(TRAINER_PATH),
        "trainerBeforeSha256": TRAINER_BEFORE_CONFIG_BOUND_SHA256,
        "inactiveCompilerPath": project_path(INACTIVE_COMPILER_PATH),
        "inactiveCompilerBeforeSha256": INACTIVE_COMPILER_BEFORE_SHA256,
        "cpuCheckerPath": project_path(Path(__file__)),
        "cpuCheckerBeforeSha256": CPU_CHECKER_BEFORE_SHA256,
        "runnerPath": project_path(RUNNER_PATH),
        "runnerSha256": CURRENT_RUNNER_SHA256,
        "telemetryLibraryPath": project_path(TELEMETRY_LIBRARY_PATH),
        "telemetryLibrarySha256": TELEMETRY_LIBRARY_SHA256,
        "sourceInactiveConfigPath": project_path(SOURCE_INACTIVE_CONFIG_PATH),
        "sourceInactiveConfigSha256": SOURCE_INACTIVE_CONFIG_SHA256,
        "selectionContractPath": project_path(SOURCE_SELECTION_PATH),
        "selectionContractSha256": SOURCE_SELECTION_SHA256,
        "boundaryAnalysisPath": project_path(BOUNDARY_ANALYSIS_PATH),
        "boundaryAnalysisSha256": BOUNDARY_ANALYSIS_SHA256,
        "topologyTelemetrySupportContractPath": project_path(TOPOLOGY_SUPPORT_PATH),
        "topologyTelemetrySupportContractSha256": TOPOLOGY_SUPPORT_SHA256,
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "sourceIndexPath": project_path(SOURCE_INDEX_PATH),
        "sourceIndexSha256": SOURCE_INDEX_SHA256,
        "stage0ManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "stage0ManifestSha256": STAGE0_MANIFEST_SHA256,
        "stage0CheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
        "stage0CheckpointSha256": STAGE0_CHECKPOINT_SHA256,
        "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
        "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
        "outputInactiveConfigPath": project_path(args.inactive_config),
        "outputCpuReportPath": project_path(args.report),
        "outputSupportContractPath": project_path(args.contract),
        "outputTerminalPath": project_path(args.terminal),
        "currentExecutionGuidePath": project_path(CURRENT_EXECUTION_GUIDE_PATH),
        "currentExecutionGuideBeforeSha256": CURRENT_EXECUTION_GUIDE_BEFORE_SHA256,
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"sample194_west_identity_{key}_invalid")
    if identity.get("resolutionStages") != [
        {"width": 256, "height": 192},
        {"width": 512, "height": 384},
        {"width": 1024, "height": 768},
    ]:
        raise ValueError("sample194_west_resolution_stages_invalid")
    resolution = authorization.get("resolution", {})
    for key in (
        "configBoundStage4SmokeAuthorization",
        "stage4BoundedSmokePreflightAuthorized",
        "registeredRuntimePathIdentityFixAuthorized",
        "trainerConfigBoundAuthorizationGateModificationAuthorized",
        "stage4InactiveConfigCompilerModificationAuthorized",
        "stage4CpuCheckerModificationAuthorized",
        "sample194WestInactiveConfigCompilationAuthorized",
        "singleCpuPositiveNegativeRegressionAuthorized",
        "completeCpuContractAuditAuthorized",
        "supportContractStorageAuthorized",
        "immutableRegressionReportStorageAuthorized",
        "immutableTerminalStorageAuthorized",
        "currentExecutionGuideModificationAuthorized",
        "legacyStage3CompatibilityRequired",
        "legacyStage4CompatibilityRequired",
        "checkpointIdentityBindingWithoutFileReadAuthorized",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"sample194_west_authorized_action_{key}_missing")
    for key in (
        "checkpointFileReadAuthorized",
        "checkpointDeserializationAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "backwardExecutionAuthorized",
        "modelWeightMutationAuthorized",
        "gpuUseAuthorized",
        "trainingAuthorized",
        "singleSampleGpuOverfitSmokeAuthorized",
        "reviewThresholdChangeAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
        "automaticRetryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"sample194_west_forbidden_action_{key}_open")
    for output in (args.inactive_config, args.report, args.contract, args.terminal):
        if resolved(output).exists():
            raise ValueError(f"sample194_west_output_already_exists:{project_path(output)}")
    output_parent = resolved(args.report).parent
    if not output_parent.is_dir() or resolved(args.inactive_config).parent != output_parent or resolved(args.terminal).parent != output_parent:
        raise ValueError("sample194_west_output_directory_not_precreated_or_inconsistent")
    if resolved(args.contract) != resolved(SAMPLE194_OUTPUT_SUPPORT_PATH):
        raise ValueError("sample194_west_support_contract_path_invalid")
    return authorization, implementation


def load_inactive_compiler():
    spec = importlib.util.spec_from_file_location("stage4_inactive_config_compiler", resolved(INACTIVE_COMPILER_PATH))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def config_bound_authorization_binding(args, authorization, implementation, stage0_manifest):
    return {
        "authorizationBindingMode": CONFIG_BOUND_AUTHORIZATION_MODE,
        "authorizationId": SAMPLE194_WEST_REQUEST_ID,
        "authorizationPath": project_path(SAMPLE194_WEST_AUTHORIZATION_PATH),
        "authorizationSha256": SAMPLE194_WEST_AUTHORIZATION_SHA256,
        "authorizationCommandRef": SAMPLE194_WEST_COMMAND_REF,
        "authorizationScope": SAMPLE194_WEST_SCOPE,
        "implementationConsumptionPath": project_path(SAMPLE194_WEST_IMPLEMENTATION_PATH),
        "implementationConsumptionSha256": SAMPLE194_WEST_IMPLEMENTATION_SHA256,
        "sourceConfigPath": project_path(SOURCE_INACTIVE_CONFIG_PATH),
        "sourceConfigSha256": SOURCE_INACTIVE_CONFIG_SHA256,
        "selectionContractPath": project_path(SOURCE_SELECTION_PATH),
        "selectionContractSha256": SOURCE_SELECTION_SHA256,
        "boundaryAnalysisPath": project_path(BOUNDARY_ANALYSIS_PATH),
        "boundaryAnalysisSha256": BOUNDARY_ANALYSIS_SHA256,
        "topologyTelemetrySupportContractPath": project_path(TOPOLOGY_SUPPORT_PATH),
        "topologyTelemetrySupportContractSha256": TOPOLOGY_SUPPORT_SHA256,
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "sourceIndexPath": project_path(SOURCE_INDEX_PATH),
        "sourceIndexSha256": SOURCE_INDEX_SHA256,
        "projectRuntimeLogicalEntry": PROJECT_RUNTIME_LOGICAL_ENTRY,
        "registeredHotRuntimeRoot": REGISTERED_HOT_RUNTIME_ROOT,
        "storageAuthorityPath": project_path(STORAGE_AUTHORITY_PATH),
        "storageAuthoritySha256": STORAGE_AUTHORITY_SHA256,
        "architectureAuthorityPath": project_path(ARCHITECTURE_AUTHORITY_PATH),
        "architectureAuthoritySha256": ARCHITECTURE_AUTHORITY_SHA256,
        "previousCpuFailureTerminalPath": project_path(SAMPLE194_PREVIOUS_CPU_FAILURE_PATH),
        "previousCpuFailureTerminalSha256": SAMPLE194_PREVIOUS_CPU_FAILURE_SHA256,
        "autoencoderCheckpointPath": stage0_manifest["autoencoderCheckpointPath"],
        "autoencoderCheckpointSha256": stage0_manifest["autoencoderCheckpointSha256"],
        "runnerPath": project_path(RUNNER_PATH),
        "runnerSha256": CURRENT_RUNNER_SHA256,
        "telemetryLibraryPath": project_path(TELEMETRY_LIBRARY_PATH),
        "telemetryLibrarySha256": TELEMETRY_LIBRARY_SHA256,
        "outputDirectoryPath": project_path(args.report.parent),
    }


def sample194_west_preflight_config(inactive_config):
    config = deepcopy(inactive_config)
    config["status"] = "stage4_bounded_repair_smoke_preflight_only"
    training = config["training"]
    training["trainingAuthorizationStatus"] = PREFLIGHT_STATUS
    training["stage4FullTrainingContract"]["status"] = "bounded_repair_smoke_preflight_only"
    training["r5Stage4BoundedRepairSmokeContract"]["status"] = "preflight_only"
    training["ownerTrainingAuthorization"]["status"] = PREFLIGHT_STATUS
    return config


def validate_sample194_west_preflight(trainer, config, package):
    trainer.validate_v7_r5_candidate_contract(config)
    trainer.validate_training_inputs(config, package)
    smoke = config["training"]["r5Stage4BoundedRepairSmokeContract"]
    evidence = {
        "enabled": True,
        "sampleId": smoke["sampleId"],
        "conditionPackPath": smoke["conditionPackPath"],
    }
    return trainer.validate_stage4_sample_bound_boundary_provenance(config, evidence)


def sample194_west_assertions(
    trainer,
    compiler,
    source,
    selection,
    config,
    preflight,
    package,
    topology,
    args,
    stage0_manifest,
):
    contract = trainer.validate_v7_r5_candidate_contract(config)
    training = config["training"]
    selected = selection["selectedValues"]
    trainer_source = resolved(TRAINER_PATH).read_text(encoding="utf-8")
    positive = {
        "inactiveCandidateContractAccepted": contract.get("status") == "r5_candidate_contract_valid_for_stage4_bounded_repair_not_active",
        "configBoundPreflightAccepted": accepted(lambda: validate_sample194_west_preflight(trainer, preflight, package)),
        "sample194IdentityBound": training["authorizedOverfitSampleId"] == SAMPLE_ID and training["authorizedOverfitConditionLabel"] == CONDITION_LABEL,
        "validationSplitBound": training["authorizedOverfitSampleSplit"] == "validation",
        "seedBound": training["seed"] == SAMPLE194_SEED,
        "westTopologyBound": training["authorizedBoundaryTopology"]["requiredBoundarySides"] == SAMPLE194_REQUIRED_SIDES,
        "worldFactConnectivityGeometryAgree": len(set(topology["sourceBoundarySides"].values())) == 1,
        "allThreeResolutionsVerified": len(topology["maskResolutionEvidence"]) == 3,
        "allResolutionMasksContactWestOnly": all(row["contactedSides"] == SAMPLE194_REQUIRED_SIDES for row in topology["maskResolutionEvidence"]),
        "conditionMaskIsValidatorOnly": topology["conditionMaskRole"] == "consistency_validation_only",
        "epochAndPreviewPolicyBound": training["r5Stage4BoundedRepairSmokeContract"]["epochCount"] == 30 and training["fixedEpochPreviewPolicy"]["smoke"] == PREVIEWS,
        "diagnosticMetricCountBound": training["r5Stage4BoundedRepairSmokeContract"]["requiredDiagnosticMetricCount"] == 17,
        "selectedObjectWeightPreserved": training["objectSemanticChannelWeights"]["object_rock"] == selected["objectRockRelativeMultiplier"]["selectedValue"],
        "selectedPathMassWeightPreserved": training["pathActivationMassCalibration"]["weight"] == selected["pathActivationMassCalibrationWeight"]["selectedValue"],
        "selectedBoundaryContactWeightPreserved": training["stage4RequiredBoundaryContact"]["weight"] == selected["requiredBoundaryContactLossWeight"]["selectedValue"],
        "reviewThresholdsPreserved": training["stage4FailureDiagnostics"]["reviewThresholdsModified"] is False,
        "failedPreviewPixelsNotTargets": training["stage4FailureDiagnostics"]["failedPreviewPixelsUsedAsTrainingTargets"] is False,
        "configRemainsInactive": config["status"].endswith("not_authorized") and training["trainingAuthorizationStatus"] == "not_authorized_candidate_only",
        "configBoundAuthorizationMode": training["ownerTrainingAuthorization"]["authorizationBindingMode"] == CONFIG_BOUND_AUTHORIZATION_MODE,
        "registeredRuntimeStorageIdentityBound": training["r5Stage4RegisteredRuntimeStorageIdentity"] == {
            "status": "bound_for_cpu_verification_not_active",
            "projectRuntimeLogicalEntry": PROJECT_RUNTIME_LOGICAL_ENTRY,
            "registeredHotRuntimeRoot": REGISTERED_HOT_RUNTIME_ROOT,
            "storageAuthorityPath": project_path(STORAGE_AUTHORITY_PATH),
            "storageAuthoritySha256": STORAGE_AUTHORITY_SHA256,
            "architectureAuthorityPath": project_path(ARCHITECTURE_AUTHORITY_PATH),
            "architectureAuthoritySha256": ARCHITECTURE_AUTHORITY_SHA256,
            "previousCpuFailureTerminalPath": project_path(SAMPLE194_PREVIOUS_CPU_FAILURE_PATH),
            "previousCpuFailureTerminalSha256": SAMPLE194_PREVIOUS_CPU_FAILURE_SHA256,
            "arbitraryExternalPathAuthorized": False,
            "absolutePathAuthorized": False,
            "parentTraversalAuthorized": False,
        },
        "logicalRuntimeResolvesToRegisteredHotRoot": resolved(Path(PROJECT_RUNTIME_LOGICAL_ENTRY)).resolve() == Path(REGISTERED_HOT_RUNTIME_ROOT).resolve(),
        "registeredRuntimeProjectFileAccepted": accepted(lambda: trainer.verify_config_bound_project_file(
            ROOT.resolve(),
            project_path(SOURCE_INACTIVE_CONFIG_PATH),
            SOURCE_INACTIVE_CONFIG_SHA256,
            "registered runtime positive regression",
        )),
        "ordinaryProjectFileAccepted": accepted(lambda: trainer.verify_config_bound_project_file(
            ROOT.resolve(),
            project_path(DATASET_MANIFEST_PATH),
            DATASET_MANIFEST_SHA256,
            "ordinary project positive regression",
        )),
        "allExecutionFlagsClosed": all(training["ownerTrainingAuthorization"][key] is False for key in (
            "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized",
            "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized", "fullTrainingAuthorized",
            "automaticRetryAuthorized", "strictRevalidationAuthorized", "validationAuthorized",
            "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized",
        )),
        "checkpointLoadingClosed": training["r5Stage4BoundedRepairCheckpointContinuation"]["loadingAuthorizedNow"] is False,
        "stage1AndStage2Closed": training["r5Stage4BoundedRepairSmokeContract"]["stage1Authorized"] is False and training["r5Stage4BoundedRepairSmokeContract"]["stage2Authorized"] is False,
        "stage1OrStage2InitializationClosed": training["r5Stage4BoundedRepairCheckpointContinuation"]["stage1OrStage2InitializationAuthorized"] is False,
        "checkpointIdentityBoundFromManifestWithoutFileHash": training["r5Stage4BoundedRepairCheckpointContinuation"]["sourceCheckpointSha256"] == stage0_manifest["checkpointSha256"],
        "autoencoderIdentityBoundFromManifestWithoutFileHash": training["ownerTrainingAuthorization"]["autoencoderCheckpointSha256"] == stage0_manifest["autoencoderCheckpointSha256"],
        "topologyGateBeforeModelAndCheckpoint": trainer_source.index("sample_bound_boundary_provenance = validate_stage4_sample_bound_boundary_provenance(") < trainer_source.index("model = build_complete_world_system(config).to(device)"),
        "legacyStage4HardcodedBranchPreserved": "V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_ID =" in trainer_source,
        "legacyCompilerEntryPreserved": callable(getattr(compiler, "compile_inactive_config", None)),
        "runnerAndTelemetryRemainBound": sha256_file(RUNNER_PATH) == CURRENT_RUNNER_SHA256 and sha256_file(TELEMETRY_LIBRARY_PATH) == TELEMETRY_LIBRARY_SHA256,
        "outputDirectoryPrecreatedAndBound": resolved(args.report).parent.is_dir() and project_path(args.report.parent) == read_json(SAMPLE194_WEST_AUTHORIZATION_PATH)["taskIdentity"]["outputDirectoryPath"],
        "cudaNotInitialized": compiler.torch.cuda.is_initialized() is False,
    }
    mutations = {
        "southTopologyRejected": lambda value: value["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=["south"]),
        "emptyTopologyRejected": lambda value: value["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=[]),
        "wrongSampleRejected": lambda value: value["training"].update(authorizedOverfitSampleId="wrong-sample"),
        "wrongConditionPackRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(conditionPackPath="wrong-condition-pack.json"),
        "seedMutationRejected": lambda value: value["training"].update(seed=SAMPLE194_SEED + 1),
        "authorizationModeMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(authorizationBindingMode="unknown"),
        "authorizationPathMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(authorizationPath="wrong.json"),
        "authorizationHashMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(authorizationSha256="0" * 64),
        "commandRefMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(authorizationCommandRef="wrong"),
        "scopeMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(authorizationScope="wrong"),
        "implementationHashMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(implementationConsumptionSha256="0" * 64),
        "logicalRuntimeIdentityMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(projectRuntimeLogicalEntry=".runtime-other"),
        "registeredHotRuntimeIdentityMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(registeredHotRuntimeRoot="D:/unregistered/runtime"),
        "storageAuthorityHashMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(storageAuthoritySha256="0" * 64),
        "previousCpuFailureHashMutationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(previousCpuFailureTerminalSha256="0" * 64),
        "checkpointLoadingRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(loadingAuthorizedNow=True),
        "optimizerRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True),
        "gpuRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True),
        "fullTrainingRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(fullTrainingAuthorized=True),
        "stage1Rejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage1Authorized=True),
        "stage2Rejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage2Authorized=True),
        "stage1Or2InitializationRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(stage1OrStage2InitializationAuthorized=True),
        "automaticRetryRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(automaticRetryAuthorized=True),
        "formalInferenceRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(formalInferenceAuthorized=True),
        "checkpointPromotionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointPromotionAuthorized=True),
        "reviewThresholdMutationRejected": lambda value: value["training"]["stage4FailureDiagnostics"].update(reviewThresholdsModified=True),
        "failedPreviewTargetRejected": lambda value: value["training"]["stage4FailureDiagnostics"].update(failedPreviewPixelsUsedAsTrainingTargets=True),
        "objectWeightMutationRejected": lambda value: value["training"]["objectSemanticChannelWeights"].update(object_rock=1.5),
        "pathMassWeightMutationRejected": lambda value: value["training"]["pathActivationMassCalibration"].update(weight=0.7),
        "boundaryContactWeightMutationRejected": lambda value: value["training"]["stage4RequiredBoundaryContact"].update(weight=0.5),
    }
    negative = {name: rejected_sample194_west(trainer, preflight, package, mutate) for name, mutate in mutations.items()}
    negative.update({
        "absoluteRuntimePathRejected": rejected_config_bound_project_file(
            trainer,
            str(resolved(SOURCE_INACTIVE_CONFIG_PATH).resolve()),
            SOURCE_INACTIVE_CONFIG_SHA256,
        ),
        "parentTraversalPathRejected": rejected_config_bound_project_file(
            trainer,
            ".runtime/../docs/ARCHITECTURE.md",
            ARCHITECTURE_AUTHORITY_SHA256,
        ),
        "runtimePrefixSpoofRejected": rejected_config_bound_project_file(
            trainer,
            ".runtime-spoof/ai-painter/source.json",
            SOURCE_INACTIVE_CONFIG_SHA256,
        ),
    })
    return positive, negative


def rejected_sample194_west(trainer, config, package, mutate):
    value = deepcopy(config)
    mutate(value)
    try:
        validate_sample194_west_preflight(trainer, value, package)
    except (ValueError, FileNotFoundError):
        return True
    return False


def rejected_config_bound_project_file(trainer, path_value, expected_sha256):
    try:
        trainer.verify_config_bound_project_file(
            ROOT.resolve(),
            path_value,
            expected_sha256,
            "path safety negative regression",
        )
    except (ValueError, FileNotFoundError):
        return True
    return False


def sample194_west_report(args, positive, negative, failures, topology):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-sample194-west-config-bound-cpu-regression-v1",
        "status": "passed_cpu_only_sample194_west_inactive_config_and_config_bound_gate_not_active" if not failures else "failed_cpu_only_sample194_west_config_bound_gate_closed",
        "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "generatedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "device": "cpu",
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "positiveAssertionsTotal": len(positive),
        "negativeAssertionsPassed": sum(negative.values()),
        "negativeAssertionsTotal": len(negative),
        "failures": failures,
        "topologyEvidence": topology,
        "inputs": {
            "authorizationPath": project_path(SAMPLE194_WEST_AUTHORIZATION_PATH),
            "authorizationSha256": SAMPLE194_WEST_AUTHORIZATION_SHA256,
            "implementationConsumptionPath": project_path(SAMPLE194_WEST_IMPLEMENTATION_PATH),
            "implementationConsumptionSha256": SAMPLE194_WEST_IMPLEMENTATION_SHA256,
            "previousCpuFailureTerminalPath": project_path(SAMPLE194_PREVIOUS_CPU_FAILURE_PATH),
            "previousCpuFailureTerminalSha256": SAMPLE194_PREVIOUS_CPU_FAILURE_SHA256,
            "projectRuntimeLogicalEntry": PROJECT_RUNTIME_LOGICAL_ENTRY,
            "registeredHotRuntimeRoot": REGISTERED_HOT_RUNTIME_ROOT,
            "storageAuthorityPath": project_path(STORAGE_AUTHORITY_PATH),
            "storageAuthoritySha256": STORAGE_AUTHORITY_SHA256,
            "architectureAuthorityPath": project_path(ARCHITECTURE_AUTHORITY_PATH),
            "architectureAuthoritySha256": ARCHITECTURE_AUTHORITY_SHA256,
            "sourceInactiveConfigPath": project_path(SOURCE_INACTIVE_CONFIG_PATH),
            "sourceInactiveConfigSha256": SOURCE_INACTIVE_CONFIG_SHA256,
            "selectionContractPath": project_path(SOURCE_SELECTION_PATH),
            "selectionContractSha256": SOURCE_SELECTION_SHA256,
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(TRAINER_PATH),
            "inactiveCompilerPath": project_path(INACTIVE_COMPILER_PATH),
            "inactiveCompilerSha256": sha256_file(INACTIVE_COMPILER_PATH),
            "cpuCheckerPath": project_path(Path(__file__)),
            "cpuCheckerSha256": sha256_file(Path(__file__)),
            "runnerPath": project_path(RUNNER_PATH),
            "runnerSha256": CURRENT_RUNNER_SHA256,
            "telemetryLibraryPath": project_path(TELEMETRY_LIBRARY_PATH),
            "telemetryLibrarySha256": TELEMETRY_LIBRARY_SHA256,
            "stage0CheckpointIdentitySource": project_path(STAGE0_MANIFEST_PATH),
            "checkpointFilesHashedOrLoadedByThisRun": False,
        },
        **inactive_boundaries(),
    }


def sample194_west_support_contract(args, report):
    return {
        "schemaVersion": "stage4-sample194-west-inactive-smoke-config-cpu-support-contract-v1",
        "status": "cpu_verified_sample194_west_inactive_config_and_config_bound_authorization_gate_not_active",
        "inactiveConfig": {"path": project_path(args.inactive_config), "sha256": sha256_file(args.inactive_config)},
        "cpuRegression": {"path": project_path(args.report), "sha256": sha256_file(args.report)},
        "trainer": {"path": project_path(TRAINER_PATH), "sha256": sha256_file(TRAINER_PATH)},
        "inactiveCompiler": {"path": project_path(INACTIVE_COMPILER_PATH), "sha256": sha256_file(INACTIVE_COMPILER_PATH)},
        "cpuChecker": {"path": project_path(Path(__file__)), "sha256": sha256_file(Path(__file__))},
        "runnerReadOnlyBinding": {"path": project_path(RUNNER_PATH), "sha256": CURRENT_RUNNER_SHA256},
        "capability": {
            "authorizationBindingMode": CONFIG_BOUND_AUTHORIZATION_MODE,
            "legacyStage3AndStage4CompatibilityPreserved": True,
            "sampleId": SAMPLE_ID,
            "seed": SAMPLE194_SEED,
            "requiredBoundarySides": SAMPLE194_REQUIRED_SIDES,
            "checkedResolutions": [
                {"width": 256, "height": 192},
                {"width": 512, "height": 384},
                {"width": 1024, "height": 768},
            ],
            "checkpointIdentityBoundFromManifestWithoutCheckpointRead": True,
            "completeCpuContractAuditPassed": True,
            "registeredRuntimePathIdentityVerified": True,
            "absoluteAndTraversalPathsRejected": True,
            "unregisteredExternalRuntimeIdentityRejected": True,
        },
        "nextIndependentAuthorization": "bind_current_runner_to_cpu_verified_sample194_west_config_and_execute_one_gpu_smoke_only",
        **inactive_boundaries(),
    }


def sample194_west_terminal(status, blockers, args):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-sample194-west-config-bound-cpu-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "inactiveConfigPath": project_path(args.inactive_config),
        "inactiveConfigSha256": sha256_file(args.inactive_config) if resolved(args.inactive_config).is_file() else None,
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(args.report) if resolved(args.report).is_file() else None,
        "supportContractPath": project_path(args.contract),
        "supportContractSha256": sha256_file(args.contract) if resolved(args.contract).is_file() else None,
        "blockers": blockers,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        "nextIndependentAuthorization": "bind_current_runner_to_cpu_verified_sample194_west_config_and_execute_one_gpu_smoke_only" if not blockers else None,
        **inactive_boundaries(),
    }


def run_sample194_west_gpu_gate(args) -> int:
    try:
        validate_sample194_west_gpu_bindings(args)
        trainer = load_trainer()
        inactive = read_json(GPU_INACTIVE_CONFIG_PATH)
        package = read_json(DATASET_MANIFEST_PATH)
        authorization = read_json(GPU_AUTHORIZATION_PATH)
        source_authorization = read_json(GPU_SOURCE_AUTHORIZATION_PATH)
        preflight = sample194_west_gpu_preflight_config(inactive)
        trainer.validate_training_inputs(preflight, package)
        identity = authorization["taskIdentity"]
        resolution = authorization["resolution"]
        stage0_manifest = read_json(STAGE0_MANIFEST_PATH)
        runner_source = resolved(RUNNER_PATH).read_text(encoding="utf-8")
        positive = {
            "sourceOwnerAuthorizationBound": authorization.get("sourceOwnerAuthorizationSha256") == GPU_SOURCE_AUTHORIZATION_SHA256,
            "previousFailedTerminalBound": (
                source_authorization.get("previousFailedExecution", {}).get("failureTerminalPath")
                == project_path(GPU_PREVIOUS_FAILURE_TERMINAL_PATH)
                and source_authorization.get("previousFailedExecution", {}).get("failureTerminalSha256")
                == GPU_PREVIOUS_FAILURE_TERMINAL_SHA256
                and source_authorization.get("previousFailedExecution", {}).get("closedNoRetry") is True
            ),
            "gpuAuthorizationIdentityBound": authorization.get("requestId") == GPU_REQUEST_ID,
            "currentInactiveConfigBound": identity.get("inactiveConfigSha256") == GPU_INACTIVE_CONFIG_SHA256,
            "currentInactiveSupportBound": sha256_file(GPU_INACTIVE_SUPPORT_PATH) == GPU_INACTIVE_SUPPORT_SHA256,
            "currentInactiveCpuReportBound": sha256_file(GPU_INACTIVE_CPU_REPORT_PATH) == GPU_INACTIVE_CPU_REPORT_SHA256,
            "currentInactiveCpuTerminalBound": sha256_file(GPU_INACTIVE_CPU_TERMINAL_PATH) == GPU_INACTIVE_CPU_TERMINAL_SHA256,
            "currentTrainerBound": identity.get("trainerSha256") == SAMPLE194_CURRENT_TRAINER_SHA256,
            "currentRunnerBound": identity.get("runnerSha256") == GPU_RUNNER_SHA256,
            "preflightTrainingInputsAccepted": accepted(lambda: trainer.validate_training_inputs(preflight, package)),
            "sample194Bound": identity.get("sampleId") == SAMPLE_ID,
            "seedBound": identity.get("seed") == SAMPLE194_SEED,
            "westBoundaryBound": identity.get("requiredBoundarySides") == SAMPLE194_REQUIRED_SIDES,
            "stage0OnlyBound": identity.get("fixedStageNumber") == 4 and identity.get("requiredSmokeStage1Authorized") is False and identity.get("requiredSmokeStage2Authorized") is False,
            "thirtyEpochBound": identity.get("epochCount") == 30,
            "previewPolicyBound": identity.get("requiredPreviewEpochs") == PREVIEWS,
            "diagnosticMetricCountBound": identity.get("requiredDiagnosticMetricCount") == 17,
            "outputDirectoryOwnerBound": (
                identity.get("outputRunId") == GPU_OUTPUT_RUN_ID
                and identity.get("outputDirectoryPath") == project_path(GPU_OUTPUT_DIRECTORY_PATH)
                and identity.get("runnerCheckpointHashTelemetryPath")
                == project_path(GPU_RUNNER_CHECKPOINT_HASH_TELEMETRY_PATH)
            ),
            "runnerTelemetryOutsideTrainerOutput": (
                resolved(GPU_OUTPUT_DIRECTORY_PATH)
                not in resolved(GPU_RUNNER_CHECKPOINT_HASH_TELEMETRY_PATH).parents
                and "path.join(MODEL_ROOT, \"runner-checkpoint-hash-telemetry\", `${runId}.json`)" in runner_source
                and "fs.mkdirSync(path.dirname(runnerCheckpointHashTelemetryPath), { recursive: true })" in runner_source
                and "fs.mkdirSync(runDir" not in runner_source
            ),
            "trainerOutputAndRunnerTelemetryAbsentBeforeExecution": (
                not resolved(GPU_OUTPUT_DIRECTORY_PATH).exists()
                and not resolved(GPU_RUNNER_CHECKPOINT_HASH_TELEMETRY_PATH).exists()
            ),
            "stage0CheckpointIdentityBoundWithoutFileRead": stage0_manifest.get("checkpointSha256") == STAGE0_CHECKPOINT_SHA256 and identity.get("stage0CheckpointSha256") == STAGE0_CHECKPOINT_SHA256,
            "autoencoderIdentityBoundWithoutFileRead": stage0_manifest.get("autoencoderCheckpointSha256") == AUTOENCODER_CHECKPOINT_SHA256 and identity.get("autoencoderCheckpointSha256") == AUTOENCODER_CHECKPOINT_SHA256,
            "executionActionsExplicitlyAuthorized": all(resolution.get(key) is True for key in (
                "checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized",
                "optimizerCreationAuthorized", "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
                "gpuUseAuthorized", "trainingAuthorized", "singleSampleGpuOverfitSmokeAuthorized",
            )),
            "downstreamActionsClosed": all(resolution.get(key) is False for key in (
                "stage4FullTrainingAuthorized", "stage1Authorized", "stage2Authorized", "strictRevalidationAuthorized",
                "formalInferenceAuthorized", "checkpointFormalPromotionAuthorized", "runtimeFrameAuthorized",
                "worldEntryAuthorized", "automaticRetryAuthorized",
            )),
            "gpuExecutionNotConsumed": not resolved(GPU_REQUEST_ROOT / "gpu-execution-authorization-consumption.json").exists(),
            "legacyStage4CheckerEntryPreserved": callable(run_sample194_west_config_bound_gate),
            "legacyStage4RunnerModePreserved": "--legacy-20260806" in resolved(RUNNER_PATH).read_text(encoding="utf-8"),
        }
        mutations = {
            "wrongSampleRejected": lambda value: value["training"].update(authorizedOverfitSampleId="wrong-sample"),
            "wrongSeedRejected": lambda value: value["training"].update(seed=20263723),
            "wrongBoundaryRejected": lambda value: value["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=["south"]),
            "stage1AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage1Authorized=True),
            "stage2AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage2Authorized=True),
            "stage1Or2InitializationRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(stage1OrStage2InitializationAuthorized=True),
            "fullTrainingRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(fullTrainingAuthorized=True),
            "retryRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(automaticRetryAuthorized=True),
            "formalInferenceRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(formalInferenceAuthorized=True),
            "checkpointPromotionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointPromotionAuthorized=True),
            "runtimeFrameRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(runtimeFrameAuthorized=True),
            "worldEntryRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(worldEntryAuthorized=True),
            "checkpointLoadingBeforeConsumptionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointLoadingAuthorized=True),
            "optimizerBeforeConsumptionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True),
            "gpuBeforeConsumptionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True),
        }
        negative = {
            name: rejected(trainer, preflight, package, mutate)
            for name, mutate in mutations.items()
        }
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        now = datetime.now(timezone.utc)
        report = {
            "schemaVersion": "stage4-sample194-west-gpu-smoke-authorization-cpu-regression-v1",
            "status": "passed_cpu_only_sample194_west_gpu_smoke_authorization_gate_gpu_not_started" if not failures else "failed_cpu_only_sample194_west_gpu_smoke_authorization_gate_closed",
            "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
            "generatedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "device": "cpu",
            "positive": positive,
            "negative": negative,
            "positiveAssertionsPassed": sum(positive.values()),
            "negativeAssertionsPassed": sum(negative.values()),
            "failures": failures,
            "inputs": {
                "authorizationPath": project_path(GPU_AUTHORIZATION_PATH),
                "authorizationSha256": GPU_AUTHORIZATION_SHA256,
                "implementationConsumptionPath": project_path(GPU_IMPLEMENTATION_PATH),
                "implementationConsumptionSha256": sha256_file(GPU_IMPLEMENTATION_PATH),
                "inactiveConfigPath": project_path(GPU_INACTIVE_CONFIG_PATH),
                "inactiveConfigSha256": GPU_INACTIVE_CONFIG_SHA256,
                "trainerPath": project_path(TRAINER_PATH),
                "trainerSha256": SAMPLE194_CURRENT_TRAINER_SHA256,
                "runnerPath": project_path(RUNNER_PATH),
                "runnerSha256": GPU_RUNNER_SHA256,
                "checkerPath": project_path(Path(__file__)),
                "checkerSha256": sha256_file(Path(__file__)),
            },
            **inactive_boundaries(),
        }
        write_json_exclusive(args.report, report)
        if failures:
            write_json_exclusive(args.terminal, gpu_cpu_terminal("stage4_sample194_west_gpu_smoke_cpu_gate_failed_closed", failures, args))
            return 1
        contract = {
            "schemaVersion": "stage4-sample194-west-gpu-smoke-support-contract-v1",
            "status": "cpu_verified_sample194_west_gpu_smoke_preflight_gate_execution_not_consumed",
            "authorization": {"path": project_path(GPU_AUTHORIZATION_PATH), "sha256": GPU_AUTHORIZATION_SHA256},
            "inactiveConfig": {"path": project_path(GPU_INACTIVE_CONFIG_PATH), "sha256": GPU_INACTIVE_CONFIG_SHA256},
            "trainer": {"path": project_path(TRAINER_PATH), "sha256": SAMPLE194_CURRENT_TRAINER_SHA256},
            "runner": {"path": project_path(RUNNER_PATH), "sha256": GPU_RUNNER_SHA256},
            "cpuRegression": {"path": project_path(args.report), "sha256": sha256_file(args.report)},
            "fixedExecution": {
                "sampleId": SAMPLE_ID,
                "seed": SAMPLE194_SEED,
                "requiredBoundarySides": SAMPLE194_REQUIRED_SIDES,
                "stageIndex": 0,
                "resolution": {"width": 256, "height": 192},
                "epochCount": 30,
                "previewEpochs": PREVIEWS,
                "diagnosticMetricCount": 17,
            },
            **inactive_boundaries(),
        }
        write_json_exclusive(args.contract, contract)
        write_json_exclusive(args.terminal, gpu_cpu_terminal("stage4_sample194_west_gpu_smoke_cpu_gate_passed_gpu_not_started", [], args))
        print(json.dumps({
            "status": report["status"],
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(args.report),
            "contractPath": project_path(args.contract),
            "contractSha256": sha256_file(args.contract),
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(args.terminal),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if resolved(args.terminal).parent.is_dir() and not resolved(args.terminal).exists():
            write_json_exclusive(args.terminal, gpu_cpu_terminal(
                "stage4_sample194_west_gpu_smoke_cpu_gate_execution_failed_closed",
                [f"{type(error).__name__}: {error}"],
                args,
            ))
        raise


def validate_sample194_west_gpu_bindings(args) -> None:
    for path, expected, code in (
        (GPU_SOURCE_AUTHORIZATION_PATH, GPU_SOURCE_AUTHORIZATION_SHA256, "source_authorization"),
        (GPU_SOURCE_IMPLEMENTATION_PATH, GPU_SOURCE_IMPLEMENTATION_SHA256, "source_implementation"),
        (GPU_PREFLIGHT_AUTHORIZATION_PATH, GPU_PREFLIGHT_AUTHORIZATION_SHA256, "preflight_authorization"),
        (GPU_PREFLIGHT_IMPLEMENTATION_PATH, GPU_PREFLIGHT_IMPLEMENTATION_SHA256, "preflight_implementation"),
        (GPU_AUTHORIZATION_PATH, GPU_AUTHORIZATION_SHA256, "gpu_authorization"),
        (GPU_PREVIOUS_FAILURE_TERMINAL_PATH, GPU_PREVIOUS_FAILURE_TERMINAL_SHA256, "previous_failure_terminal"),
        (GPU_INACTIVE_CONFIG_PATH, GPU_INACTIVE_CONFIG_SHA256, "inactive_config"),
        (GPU_INACTIVE_SUPPORT_PATH, GPU_INACTIVE_SUPPORT_SHA256, "inactive_support"),
        (GPU_INACTIVE_CPU_REPORT_PATH, GPU_INACTIVE_CPU_REPORT_SHA256, "inactive_cpu_report"),
        (GPU_INACTIVE_CPU_TERMINAL_PATH, GPU_INACTIVE_CPU_TERMINAL_SHA256, "inactive_cpu_terminal"),
        (TRAINER_PATH, SAMPLE194_CURRENT_TRAINER_SHA256, "trainer"),
        (RUNNER_PATH, GPU_RUNNER_SHA256, "runner"),
        (TELEMETRY_LIBRARY_PATH, TELEMETRY_LIBRARY_SHA256, "telemetry"),
        (DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"),
        (SOURCE_INDEX_PATH, SOURCE_INDEX_SHA256, "source_index"),
        (STAGE0_MANIFEST_PATH, STAGE0_MANIFEST_SHA256, "stage0_manifest"),
    ):
        if not resolved(path).is_file() or sha256_file(path) != expected:
            raise ValueError(f"sample194_west_gpu_{code}_missing_or_changed")
    authorization = read_json(GPU_AUTHORIZATION_PATH)
    implementation = read_json(GPU_IMPLEMENTATION_PATH)
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("requestId") != GPU_REQUEST_ID
        or authorization.get("ownerDecision", {}).get("commandRef") != GPU_COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != GPU_SCOPE
    ):
        raise ValueError("sample194_west_gpu_authorization_identity_invalid")
    if (
        implementation.get("status") != "consumed_before_config_bound_stage4_smoke_preflight_and_evidence_writes"
        or implementation.get("requestId") != GPU_REQUEST_ID
        or implementation.get("authorizationSha256") != GPU_AUTHORIZATION_SHA256
        or implementation.get("commandRef") != GPU_COMMAND_REF
        or implementation.get("scope") != GPU_SCOPE
        or int(implementation.get("allowedImplementationCount", 0)) != 1
        or int(implementation.get("allowedConfigCompilationCount", 0)) != 1
        or int(implementation.get("allowedCpuRegressionCount", 0)) != 1
        or implementation.get("gpuExecutionConsumed") is not False
        or implementation.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("sample194_west_gpu_implementation_identity_invalid")
    for output in (args.report, args.contract, args.terminal):
        if resolved(output).exists():
            raise ValueError(f"sample194_west_gpu_output_already_exists:{project_path(output)}")
    if not resolved(args.report).parent.is_dir() or resolved(args.terminal).parent != resolved(args.report).parent:
        raise ValueError("sample194_west_gpu_output_directory_not_precreated_or_inconsistent")
    if resolved(args.contract) != resolved(GPU_OUTPUT_SUPPORT_PATH):
        raise ValueError("sample194_west_gpu_support_contract_path_invalid")


def sample194_west_gpu_preflight_config(inactive: dict) -> dict:
    config = sample194_west_preflight_config(inactive)
    authorization = read_json(GPU_PREFLIGHT_AUTHORIZATION_PATH)
    nested = config["training"]["ownerTrainingAuthorization"]
    nested.update({
        "authorizationBindingMode": CONFIG_BOUND_AUTHORIZATION_MODE,
        "authorizationId": GPU_REQUEST_ID,
        "authorizationPath": project_path(GPU_PREFLIGHT_AUTHORIZATION_PATH),
        "authorizationSha256": GPU_PREFLIGHT_AUTHORIZATION_SHA256,
        "authorizationCommandRef": GPU_COMMAND_REF,
        "authorizationScope": GPU_SCOPE,
        "implementationConsumptionPath": project_path(GPU_PREFLIGHT_IMPLEMENTATION_PATH),
        "implementationConsumptionSha256": GPU_PREFLIGHT_IMPLEMENTATION_SHA256,
        "executionConsumptionPath": None,
        "executionConsumptionSha256": None,
        "runnerPath": project_path(RUNNER_PATH),
        "runnerSha256": GPU_RUNNER_SHA256,
        "sourceConfigPath": project_path(GPU_INACTIVE_CONFIG_PATH),
        "sourceConfigSha256": GPU_INACTIVE_CONFIG_SHA256,
        "outputDirectoryPath": authorization["taskIdentity"]["outputDirectoryPath"],
        "status": PREFLIGHT_STATUS,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    })
    return config


def gpu_cpu_terminal(status, blockers, args):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-sample194-west-gpu-smoke-authorization-cpu-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(args.report) if resolved(args.report).is_file() else None,
        "contractPath": project_path(args.contract),
        "contractSha256": sha256_file(args.contract) if resolved(args.contract).is_file() else None,
        "blockers": blockers,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def run_cross_domain_gpu_gate(args) -> int:
    try:
        records = validate_cross_domain_gpu_bindings(args)
        root_authorization, preflight_authorization, gpu_authorization = records
        identity = gpu_authorization["taskIdentity"]
        inactive = read_json(Path(identity["inactiveConfigPath"]))
        package = read_json(Path(identity["datasetManifestPath"]))
        trainer = load_trainer()
        preflight = cross_domain_preflight_config(
            inactive,
            args.preflight_authorization,
            preflight_authorization,
        )
        trainer.validate_training_inputs(preflight, package)
        positive = {
            "rootOwnerAuthorizationBound": (
                gpu_authorization.get("sourceOwnerAuthorizationPath") == project_path(args.root_authorization)
                and gpu_authorization.get("sourceOwnerAuthorizationSha256") == sha256_file(args.root_authorization)
            ),
            "candidateCpuEvidenceBound": all(
                resolved(Path(identity[path_key])).is_file()
                and sha256_file(Path(identity[path_key])) == identity[sha_key]
                for path_key, sha_key in (
                    ("inactiveConfigPath", "inactiveConfigSha256"),
                    ("selectionContractPath", "selectionContractSha256"),
                    ("candidateCpuReportPath", "candidateCpuReportSha256"),
                    ("candidateSupportContractPath", "candidateSupportContractSha256"),
                    ("candidateCpuTerminalPath", "candidateCpuTerminalSha256"),
                )
            ),
            "currentTrainerBound": identity.get("trainerSha256") == sha256_file(TRAINER_PATH),
            "currentRunnerBound": identity.get("runnerSha256") == sha256_file(RUNNER_PATH),
            "currentCheckerBound": identity.get("smokeCpuCheckerSha256") == sha256_file(Path(__file__)),
            "preflightTrainingInputsAccepted": accepted(lambda: trainer.validate_training_inputs(preflight, package)),
            "crossDomainContractAccepted": accepted(lambda: trainer.validate_v7_r5_stage4_cross_domain_visual_consistency_contract(preflight)),
            "sampleSeedWestBound": (
                identity.get("sampleId") == SAMPLE_ID
                and identity.get("seed") == SAMPLE194_SEED
                and identity.get("requiredBoundarySides") == SAMPLE194_REQUIRED_SIDES
            ),
            "singleStageThirtyEpochBound": (
                identity.get("fixedStageNumber") == 4
                and identity.get("epochCount") == 30
                and identity.get("requiredPreviewEpochs") == PREVIEWS
                and identity.get("requiredDiagnosticMetricCount") == 17
                and identity.get("requiredSmokeStage1Authorized") is False
                and identity.get("requiredSmokeStage2Authorized") is False
            ),
            "gpuExecutionNotConsumed": not resolved(args.gpu_authorization.parent / "gpu-execution-authorization-consumption.json").exists(),
            "legacyStage4CheckerEntriesPreserved": callable(run_sample194_west_gpu_gate) and callable(run_sample194_west_config_bound_gate),
            "legacyStage4RunnerModePreserved": "--legacy-20260806" in resolved(RUNNER_PATH).read_text(encoding="utf-8"),
            "frozenAnalyzerUnchanged": (
                sha256_file(Path(root_authorization["taskIdentity"]["frozenAnalyzerPath"]))
                == root_authorization["taskIdentity"]["frozenAnalyzerSha256"]
            ),
            "reviewThresholdsNotUsedAsTrainingTargets": (
                inactive["training"]["stage4CrossDomainVisualConsistency"]["machineReviewThresholdUsedAsTrainingTarget"] is False
                and inactive["training"]["stage4CrossDomainVisualConsistency"]["failedPreviewPixelsUsedAsTrainingTargets"] is False
            ),
        }
        mutations = {
            "wrongSampleRejected": lambda value: value["training"].update(authorizedOverfitSampleId="wrong-sample"),
            "wrongSeedRejected": lambda value: value["training"].update(seed=20263723),
            "wrongBoundaryRejected": lambda value: value["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=["east"]),
            "stage1AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage1Authorized=True),
            "stage2AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage2Authorized=True),
            "stage1Or2InitializationRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(stage1OrStage2InitializationAuthorized=True),
            "fullTrainingRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(fullTrainingAuthorized=True),
            "checkpointLoadingBeforeConsumptionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointLoadingAuthorized=True),
            "optimizerBeforeConsumptionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True),
            "gpuBeforeConsumptionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True),
            "formalInferenceRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(formalInferenceAuthorized=True),
            "checkpointPromotionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointPromotionAuthorized=True),
            "runtimeFrameRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(runtimeFrameAuthorized=True),
            "worldEntryRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(worldEntryAuthorized=True),
            "retryRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(automaticRetryAuthorized=True),
        }
        negative = {
            name: rejected(trainer, preflight, package, mutate)
            for name, mutate in mutations.items()
        }
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        now = datetime.now(timezone.utc)
        report = {
            "schemaVersion": "stage4-cross-domain-gpu-smoke-authorization-cpu-regression-v1",
            "status": "passed_cpu_only_sample194_west_gpu_smoke_authorization_gate_gpu_not_started" if not failures else "failed_cpu_only_sample194_west_gpu_smoke_authorization_gate_closed",
            "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
            "device": "cpu",
            "positive": positive,
            "negative": negative,
            "positiveAssertionsPassed": sum(positive.values()),
            "negativeAssertionsPassed": sum(negative.values()),
            "failures": failures,
            "inputs": {
                "authorizationPath": project_path(args.gpu_authorization),
                "authorizationSha256": sha256_file(args.gpu_authorization),
                "preflightAuthorizationPath": project_path(args.preflight_authorization),
                "preflightAuthorizationSha256": sha256_file(args.preflight_authorization),
                "inactiveConfigPath": identity["inactiveConfigPath"],
                "inactiveConfigSha256": identity["inactiveConfigSha256"],
                "trainerPath": project_path(TRAINER_PATH),
                "trainerSha256": sha256_file(TRAINER_PATH),
                "runnerPath": project_path(RUNNER_PATH),
                "runnerSha256": sha256_file(RUNNER_PATH),
                "checkerPath": project_path(Path(__file__)),
                "checkerSha256": sha256_file(Path(__file__)),
            },
            **inactive_boundaries(),
        }
        write_json_exclusive(args.report, report)
        if failures:
            write_json_exclusive(args.terminal, cross_domain_gpu_cpu_terminal(
                "stage4_sample194_west_gpu_smoke_cpu_gate_failed_closed", failures, args
            ))
            return 1
        contract = {
            "schemaVersion": "stage4-cross-domain-gpu-smoke-support-contract-v1",
            "status": "cpu_verified_sample194_west_gpu_smoke_preflight_gate_execution_not_consumed",
            "authorization": {"path": project_path(args.gpu_authorization), "sha256": sha256_file(args.gpu_authorization)},
            "preflightAuthorization": {"path": project_path(args.preflight_authorization), "sha256": sha256_file(args.preflight_authorization)},
            "inactiveConfig": {"path": identity["inactiveConfigPath"], "sha256": identity["inactiveConfigSha256"]},
            "trainer": {"path": project_path(TRAINER_PATH), "sha256": sha256_file(TRAINER_PATH)},
            "runner": {"path": project_path(RUNNER_PATH), "sha256": sha256_file(RUNNER_PATH)},
            "cpuRegression": {"path": project_path(args.report), "sha256": sha256_file(args.report)},
            "fixedExecution": {
                "sampleId": SAMPLE_ID,
                "seed": SAMPLE194_SEED,
                "requiredBoundarySides": SAMPLE194_REQUIRED_SIDES,
                "stageIndex": 0,
                "resolution": {"width": 256, "height": 192},
                "epochCount": 30,
                "previewEpochs": PREVIEWS,
                "diagnosticMetricCount": 17,
            },
            **inactive_boundaries(),
        }
        write_json_exclusive(args.contract, contract)
        write_json_exclusive(args.terminal, cross_domain_gpu_cpu_terminal(
            "stage4_sample194_west_gpu_smoke_cpu_gate_passed_gpu_not_started", [], args
        ))
        print(json.dumps({
            "status": report["status"],
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(args.report),
            "contractPath": project_path(args.contract),
            "contractSha256": sha256_file(args.contract),
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(args.terminal),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if resolved(args.terminal).parent.is_dir() and not resolved(args.terminal).exists():
            write_json_exclusive(args.terminal, cross_domain_gpu_cpu_terminal(
                "stage4_sample194_west_gpu_smoke_cpu_gate_execution_failed_closed",
                [f"{type(error).__name__}: {error}"],
                args,
            ))
        raise


def validate_cross_domain_gpu_bindings(args):
    if None in (args.root_authorization, args.preflight_authorization, args.gpu_authorization):
        raise ValueError("cross_domain_gpu_authorization_paths_missing")
    root_authorization = read_json(args.root_authorization)
    preflight = read_json(args.preflight_authorization)
    gpu = read_json(args.gpu_authorization)
    root_identity = root_authorization.get("taskIdentity", {})
    if root_authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("cross_domain_root_authorization_invalid")
    command_ref = root_authorization.get("ownerDecision", {}).get("commandRef")
    scope = root_authorization.get("ownerDecision", {}).get("scope")
    for path, record, active in (
        (args.preflight_authorization, preflight, False),
        (args.gpu_authorization, gpu, True),
    ):
        implementation_path = path.parent / ("training-implementation-consumption.json" if active else "preflight-implementation-consumption.json")
        if not resolved(implementation_path).is_file():
            raise ValueError("cross_domain_implementation_consumption_missing")
        implementation = read_json(implementation_path)
        if (
            record.get("status") != "resolved_owner_authorized"
            or record.get("requestId") != path.parent.name
            or record.get("ownerDecision", {}).get("commandRef") != command_ref
            or record.get("ownerDecision", {}).get("scope") != scope
            or implementation.get("status") != "consumed_before_config_bound_stage4_smoke_preflight_and_evidence_writes"
            or implementation.get("requestId") != record.get("requestId")
            or implementation.get("authorizationSha256") != sha256_file(path)
            or implementation.get("commandRef") != command_ref
            or implementation.get("scope") != scope
            or implementation.get("gpuExecutionConsumed") is not False
        ):
            raise ValueError("cross_domain_derived_authorization_identity_invalid")
        resolution = record.get("resolution", {})
        for flag in ("configBoundStage4SmokeAuthorization", "stage4BoundedSmokePreflightAuthorized", "registeredRuntimePathIdentityFixAuthorized"):
            if resolution.get(flag) is not True:
                raise ValueError(f"cross_domain_{flag}_missing")
        execution_flags = (
            "checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized",
            "optimizerCreationAuthorized", "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
            "gpuUseAuthorized", "trainingAuthorized", "singleSampleGpuOverfitSmokeAuthorized",
        )
        if any(resolution.get(flag) is not active for flag in execution_flags):
            raise ValueError("cross_domain_execution_boundary_invalid")
        for flag in ("reviewThresholdChangeAuthorized", "stage4FullTrainingAuthorized", "stage1Authorized", "stage2Authorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointFormalPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized"):
            if resolution.get(flag) is not False:
                raise ValueError(f"cross_domain_{flag}_opened")
        identity = record.get("taskIdentity", {})
        for key in ("sampleId", "seed", "requiredBoundarySides", "inactiveConfigPath", "inactiveConfigSha256", "trainerSha256", "runnerSha256"):
            if identity.get(key) != gpu.get("taskIdentity", {}).get(key):
                raise ValueError(f"cross_domain_preflight_gpu_identity_mismatch:{key}")
    gpu_identity = gpu["taskIdentity"]
    for path_key, sha_key in (
        ("inactiveConfigPath", "inactiveConfigSha256"),
        ("selectionContractPath", "selectionContractSha256"),
        ("candidateCpuReportPath", "candidateCpuReportSha256"),
        ("candidateSupportContractPath", "candidateSupportContractSha256"),
        ("candidateCpuTerminalPath", "candidateCpuTerminalSha256"),
        ("boundaryAnalysisPath", "boundaryAnalysisSha256"),
        ("topologyTelemetrySupportContractPath", "topologyTelemetrySupportContractSha256"),
        ("datasetManifestPath", "datasetManifestSha256"),
        ("sourceIndexPath", "sourceIndexSha256"),
        ("storageAuthorityPath", "storageAuthoritySha256"),
        ("architectureAuthorityPath", "architectureAuthoritySha256"),
        ("previousCpuFailureTerminalPath", "previousCpuFailureTerminalSha256"),
        ("stage0ManifestPath", "stage0ManifestSha256"),
        ("runnerPath", "runnerSha256"),
        ("trainerPath", "trainerSha256"),
        ("smokeCpuCheckerPath", "smokeCpuCheckerSha256"),
        ("telemetryLibraryPath", "telemetryLibrarySha256"),
    ):
        path = Path(gpu_identity[path_key])
        if not resolved(path).is_file() or sha256_file(path) != gpu_identity[sha_key]:
            raise ValueError(f"cross_domain_bound_file_missing_or_changed:{path_key}")
    if root_identity.get("successfulAnalysisTerminalSha256") != "a9796b35c2c2025677abfea3ee5e20f8077d96aac6f7cdfda1e59ee528d14c71":
        raise ValueError("cross_domain_successful_analysis_terminal_not_bound")
    for output in (args.report, args.contract, args.terminal):
        if resolved(output).exists():
            raise ValueError(f"cross_domain_gpu_cpu_output_already_exists:{project_path(output)}")
    if not resolved(args.report).parent.is_dir() or resolved(args.terminal).parent != resolved(args.report).parent:
        raise ValueError("cross_domain_gpu_cpu_output_directory_not_precreated")
    return root_authorization, preflight, gpu


def cross_domain_preflight_config(inactive, authorization_path, authorization):
    config = sample194_west_preflight_config(inactive)
    identity = authorization["taskIdentity"]
    training = config["training"]
    training["r5Stage4BoundedRepairSmokeContract"]["imagePath"] = identity["imagePath"]
    training["r5Stage4BoundedRepairSmokeContract"]["conditionPackPath"] = identity["conditionPackPath"]
    nested = training["ownerTrainingAuthorization"]
    nested.update({
        "authorizationBindingMode": CONFIG_BOUND_AUTHORIZATION_MODE,
        "authorizationId": authorization["requestId"],
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": sha256_file(authorization_path),
        "authorizationCommandRef": authorization["ownerDecision"]["commandRef"],
        "authorizationScope": authorization["ownerDecision"]["scope"],
        "implementationConsumptionPath": project_path(authorization_path.parent / "preflight-implementation-consumption.json"),
        "implementationConsumptionSha256": sha256_file(authorization_path.parent / "preflight-implementation-consumption.json"),
        "executionConsumptionPath": None,
        "executionConsumptionSha256": None,
        "sourceConfigPath": identity["sourceInactiveConfigPath"],
        "sourceConfigSha256": identity["sourceInactiveConfigSha256"],
        "selectionContractPath": identity["selectionContractPath"],
        "selectionContractSha256": identity["selectionContractSha256"],
        "boundaryAnalysisPath": identity["boundaryAnalysisPath"],
        "boundaryAnalysisSha256": identity["boundaryAnalysisSha256"],
        "topologyTelemetrySupportContractPath": identity["topologyTelemetrySupportContractPath"],
        "topologyTelemetrySupportContractSha256": identity["topologyTelemetrySupportContractSha256"],
        "datasetManifestPath": identity["datasetManifestPath"],
        "datasetManifestSha256": identity["datasetManifestSha256"],
        "sourceIndexPath": identity["sourceIndexPath"],
        "sourceIndexSha256": identity["sourceIndexSha256"],
        "projectRuntimeLogicalEntry": identity["projectRuntimeLogicalEntry"],
        "registeredHotRuntimeRoot": identity["registeredHotRuntimeRoot"],
        "storageAuthorityPath": identity["storageAuthorityPath"],
        "storageAuthoritySha256": identity["storageAuthoritySha256"],
        "architectureAuthorityPath": identity["architectureAuthorityPath"],
        "architectureAuthoritySha256": identity["architectureAuthoritySha256"],
        "previousCpuFailureTerminalPath": identity["previousCpuFailureTerminalPath"],
        "previousCpuFailureTerminalSha256": identity["previousCpuFailureTerminalSha256"],
        "autoencoderCheckpointPath": identity["autoencoderCheckpointPath"],
        "autoencoderCheckpointSha256": identity["autoencoderCheckpointSha256"],
        "runnerPath": identity["runnerPath"],
        "runnerSha256": identity["runnerSha256"],
        "telemetryLibraryPath": identity["telemetryLibraryPath"],
        "telemetryLibrarySha256": identity["telemetryLibrarySha256"],
        "outputDirectoryPath": identity["outputDirectoryPath"],
        "status": PREFLIGHT_STATUS,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    })
    return config


def cross_domain_gpu_cpu_terminal(status, blockers, args):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-cross-domain-gpu-smoke-authorization-cpu-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(args.report) if resolved(args.report).is_file() else None,
        "contractPath": project_path(args.contract),
        "contractSha256": sha256_file(args.contract) if resolved(args.contract).is_file() else None,
        "blockers": blockers,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def validate_immutable_inputs() -> None:
    for path, expected, code in (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (IMPLEMENTATION_PATH, IMPLEMENTATION_SHA256, "implementation"),
        (PREVIOUS_FAILURE_TERMINAL_PATH, PREVIOUS_FAILURE_TERMINAL_SHA256, "previous_failure_terminal"),
        (INACTIVE_CONFIG_PATH, INACTIVE_CONFIG_SHA256, "inactive_config"),
        (SELECTION_PATH, SELECTION_SHA256, "selection"),
        (SUPPORT_PATH, SUPPORT_SHA256, "support"),
        (BOUNDED_CPU_PATH, BOUNDED_CPU_SHA256, "bounded_cpu"),
        (BOUNDED_TERMINAL_PATH, BOUNDED_TERMINAL_SHA256, "bounded_terminal"),
        (TRAINER_PATH, TRAINER_SHA256, "trainer"),
        (RUNNER_PATH, RUNNER_SHA256, "runner"),
        (DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"),
        (SOURCE_INDEX_PATH, SOURCE_INDEX_SHA256, "source_index"),
        (STAGE0_MANIFEST_PATH, STAGE0_MANIFEST_SHA256, "stage0_manifest"),
    ):
        if not resolved(path).is_file() or sha256_file(path) != expected:
            raise ValueError(f"stage4_bounded_smoke_{code}_missing_or_changed")
    authorization = read_json(AUTHORIZATION_PATH)
    implementation = read_json(IMPLEMENTATION_PATH)
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("stage4_bounded_smoke_authorization_identity_invalid")
    if (
        implementation.get("status") != "consumed_before_seed_fix_authorization_binding_and_new_cpu_gate_writes"
        or implementation.get("authorizationSha256") != AUTHORIZATION_SHA256
        or implementation.get("commandRef") != COMMAND_REF
        or implementation.get("scope") != SCOPE
        or int(implementation.get("cpuRegressionExecutionCount", 0)) != 1
        or implementation.get("gpuExecutionConsumed") is not False
    ):
        raise ValueError("stage4_bounded_smoke_implementation_identity_invalid")
    previous_failure = read_json(PREVIOUS_FAILURE_TERMINAL_PATH)
    previous_binding = authorization.get("previousFailedExecution", {})
    if (
        previous_failure.get("status") != "stage4_bounded_repair_smoke_preflight_failed_closed"
        or previous_binding.get("failureTerminalPath") != project_path(PREVIOUS_FAILURE_TERMINAL_PATH)
        or previous_binding.get("failureTerminalSha256") != PREVIOUS_FAILURE_TERMINAL_SHA256
        or previous_binding.get("closedNoRetry") is not True
        or previous_binding.get("gpuExecutionAuthorizationConsumed") is not False
    ):
        raise ValueError("stage4_bounded_smoke_previous_failure_binding_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "inactiveConfigPath": project_path(INACTIVE_CONFIG_PATH),
        "inactiveConfigSha256": INACTIVE_CONFIG_SHA256,
        "selectionContractPath": project_path(SELECTION_PATH),
        "selectionContractSha256": SELECTION_SHA256,
        "trainerSupportContractPath": project_path(SUPPORT_PATH),
        "trainerSupportContractSha256": SUPPORT_SHA256,
        "trainerPath": project_path(TRAINER_PATH),
        "trainerBeforeSha256": "20da44f6365eacfcdeb41a01473f4557790ea8974c382927c044f1fc65448e85",
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "sourceIndexPath": project_path(SOURCE_INDEX_PATH),
        "sourceIndexSha256": SOURCE_INDEX_SHA256,
        "stage0ManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "stage0ManifestSha256": STAGE0_MANIFEST_SHA256,
        "stage0CheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
        "stage0CheckpointSha256": STAGE0_CHECKPOINT_SHA256,
        "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
        "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
        "sampleId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "sampleSplit": "validation",
        "epochCount": 30,
        "evaluationInterval": 5,
        "requiredPreviewEpochs": PREVIEWS,
        "requiredDiagnosticMetricCount": 17,
        "seed": 20263722,
        "derivedTrainingSeed": 20263722,
        "sourceInactiveConfigSeed": 20260722,
        "requiredImplementationConsumptionStatus": "consumed_before_seed_fix_authorization_binding_and_new_cpu_gate_writes",
        "requiredSmokeStage1Authorized": False,
        "requiredSmokeStage2Authorized": False,
        "requiredStage1OrStage2InitializationAuthorized": False,
        "requiredDiagnosticReportStatus": "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged",
        "requiredDiagnosticTerminalStatus": "r5_stage4_readonly_single_sample_gpu_diagnostic_completed_closed",
        "runnerPath": project_path(RUNNER_PATH),
        "runnerBeforeSha256": "037b8f728cbfd721306bc07d9b5ff09e69232ddaa3cc85b5e7a46baf6a913e84",
        "cpuCheckerPath": project_path(Path(__file__)),
        "cpuCheckerBeforeSha256": "f201dcba9dd80ea368a2ae9937453f736e25972252e9f7797d63f677730bd721",
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_bounded_smoke_identity_{key}_invalid")


def preflight_config(source: dict) -> dict:
    config = deepcopy(source)
    config["status"] = "stage4_bounded_repair_smoke_preflight_only"
    config["architectureVersion"] = (
        "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-"
        "stage4-diagnostic-evidence-bounded-smoke"
    )
    training = config["training"]
    training["seed"] = 20263722
    training["trainingAuthorizationStatus"] = PREFLIGHT_STATUS
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedOverfitConditionLabel"] = CONDITION_LABEL
    training["authorizedOverfitSampleSplit"] = "validation"
    training["authorizedInitialization"] = (
        "project_stage4_failed_stage0_checkpoint_continuation_nonformal_smoke"
    )
    training["fixedEpochPreviewPolicy"]["smoke"] = list(PREVIEWS)
    training["stage4FullTrainingContract"]["status"] = "bounded_repair_smoke_preflight_only"
    training["r5Stage4BoundedRepairCheckpointContinuation"] = {
        "sourceManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "sourceManifestSha256": STAGE0_MANIFEST_SHA256,
        "sourceCheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
        "sourceCheckpointSha256": STAGE0_CHECKPOINT_SHA256,
        "sourceArchitectureVersion": (
            "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-"
            "stage4-coverage-convergence-full-training"
        ),
        "loadingAuthorizedNow": False,
        "stage1OrStage2InitializationAuthorized": False,
    }
    training["r5Stage4BoundedRepairSmokeContract"] = {
        "status": "preflight_only",
        "stageIndex": 0,
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "evaluationInterval": 5,
        "requiredPreviewEpochs": list(PREVIEWS),
        "requiredDiagnosticMetricCount": 17,
        "sampleId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "sampleSplit": "validation",
        "nonFormalValidationSampleOverfit": True,
        "checkpointPromotionEligible": False,
        "automaticRetryAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "diagnostic_support_candidate_not_active",
        "objectSemanticDiagnostics": {
            "channels": ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
            "measurements": ["independent_loss", "gradient_contribution", "decoded_response"],
            "gradientTarget": "predicted_rgb_only",
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "conditionChannel": "terrain_path_ground",
            "measurements": ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"],
            "requiredBoundarySidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
            "preserveExistingPathLossWeights": True,
            "spatialGridSize": 4,
        },
        "reviewThresholdsModified": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "executionValuesSelected": False,
        "trainingConfigApplied": False,
        "checkpointFileReadAuthorized": False,
        "gpuUseAuthorized": False,
        "trainingAuthorized": False,
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": AUTHORIZATION_PATH.parent.name,
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "implementationConsumptionPath": project_path(IMPLEMENTATION_PATH),
        "implementationConsumptionSha256": IMPLEMENTATION_SHA256,
        "executionConsumptionPath": None,
        "executionConsumptionSha256": None,
        "sourceConfigPath": project_path(INACTIVE_CONFIG_PATH),
        "sourceConfigSha256": INACTIVE_CONFIG_SHA256,
        "selectionContractPath": project_path(SELECTION_PATH),
        "selectionContractSha256": SELECTION_SHA256,
        "trainerSupportContractPath": project_path(SUPPORT_PATH),
        "trainerSupportContractSha256": SUPPORT_SHA256,
        "boundedRepairCpuReportPath": project_path(BOUNDED_CPU_PATH),
        "boundedRepairCpuReportSha256": BOUNDED_CPU_SHA256,
        "boundedRepairTerminalPath": project_path(BOUNDED_TERMINAL_PATH),
        "boundedRepairTerminalSha256": BOUNDED_TERMINAL_SHA256,
        "stage0ManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "stage0ManifestSha256": STAGE0_MANIFEST_SHA256,
        "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
        "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "sourceIndexPath": project_path(SOURCE_INDEX_PATH),
        "sourceIndexSha256": SOURCE_INDEX_SHA256,
        "status": PREFLIGHT_STATUS,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    return config


def run_assertions(trainer, source, config, package):
    contract = trainer.validate_v7_r5_candidate_contract(config)
    positive = {
        "preflightTrainingInputsAccepted": accepted(lambda: trainer.validate_training_inputs(config, package)),
        "candidateContractAccepted": contract.get("status") == "r5_candidate_contract_valid_for_stage4_bounded_repair_not_active",
        "fixedValidationSampleBound": config["training"]["authorizedOverfitSampleId"] == SAMPLE_ID and config["training"]["authorizedOverfitSampleSplit"] == "validation",
        "epochCountBound": config["training"]["r5Stage4BoundedRepairSmokeContract"]["epochCount"] == 30,
        "previewEpochsBound": config["training"]["fixedEpochPreviewPolicy"]["smoke"] == PREVIEWS,
        "stage0OnlyBound": config["training"]["r5Stage4BoundedRepairSmokeContract"]["stageIndex"] == 0,
        "checkpointIdentityBoundWithoutRead": config["training"]["r5Stage4BoundedRepairCheckpointContinuation"]["sourceCheckpointSha256"] == STAGE0_CHECKPOINT_SHA256,
        "checkpointLoadingClosedDuringPreflight": config["training"]["r5Stage4BoundedRepairCheckpointContinuation"]["loadingAuthorizedNow"] is False,
        "optimizerClosedDuringPreflight": config["training"]["ownerTrainingAuthorization"]["optimizerCreationAuthorized"] is False,
        "gpuClosedDuringPreflight": config["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] is False,
        "fullTrainingClosed": config["training"]["ownerTrainingAuthorization"]["fullTrainingAuthorized"] is False,
        "stage1AndStage2Closed": config["training"]["r5Stage4BoundedRepairSmokeContract"]["stage1Authorized"] is False and config["training"]["r5Stage4BoundedRepairSmokeContract"]["stage2Authorized"] is False,
        "diagnosticMetricsConfigured": config["training"]["r5Stage4BoundedRepairSmokeContract"]["requiredDiagnosticMetricCount"] == 17,
        "reviewThresholdsPreserved": config["training"]["stage4FailureDiagnostics"]["reviewThresholdsModified"] is False,
        "legacyInactiveCandidateStillAccepted": accepted(lambda: trainer.validate_v7_r5_candidate_contract(source)),
    }
    mutations = {
        "activeStatusBeforeConsumptionRejected": lambda value: value["training"].update(trainingAuthorizationStatus="owner_authorized_v7_r5_stage4_bounded_repair_single_sample_gpu_smoke"),
        "checkpointLoadingDuringPreflightRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(loadingAuthorizedNow=True),
        "optimizerDuringPreflightRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True),
        "gpuDuringPreflightRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True),
        "wrongSampleRejected": lambda value: value["training"].update(authorizedOverfitSampleId="wrong-sample"),
        "trainSplitSubstitutionRejected": lambda value: value["training"].update(authorizedOverfitSampleSplit="train"),
        "epochMutationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(epochCount=31),
        "previewMutationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(requiredPreviewEpochs=[1, 10, 20, 30]),
        "stage1AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage1Authorized=True),
        "stage2AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage2Authorized=True),
        "stage1OrStage2InitializationRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(stage1OrStage2InitializationAuthorized=True),
        "fullTrainingAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(fullTrainingAuthorized=True),
        "retryAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(automaticRetryAuthorized=True),
        "formalInferenceAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(formalInferenceAuthorized=True),
        "checkpointPromotionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointPromotionAuthorized=True),
        "reviewThresholdMutationRejected": lambda value: value["training"]["stage4FailureDiagnostics"].update(reviewThresholdsModified=True),
        "failedPreviewTrainingTargetRejected": lambda value: value["training"]["stage4FailureDiagnostics"].update(failedPreviewPixelsUsedAsTrainingTargets=True),
    }
    negative = {
        name: rejected(trainer, config, package, mutate)
        for name, mutate in mutations.items()
    }
    return positive, negative


def rejected(trainer, config, package, mutate):
    value = deepcopy(config)
    mutate(value)
    try:
        trainer.validate_training_inputs(value, package)
    except ValueError:
        return True
    return False


def accepted(call):
    try:
        call()
    except ValueError:
        return False
    return True


def build_report(positive, negative, failures):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-bounded-repair-smoke-authorization-cpu-regression-v1",
        "status": (
            "passed_cpu_only_stage4_bounded_repair_smoke_authorization_gate_gpu_not_started"
            if not failures
            else "failed_cpu_only_stage4_bounded_repair_smoke_authorization_gate_closed"
        ),
        "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "generatedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "device": "cpu",
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "inputs": {
            "authorizationPath": project_path(AUTHORIZATION_PATH),
            "authorizationSha256": AUTHORIZATION_SHA256,
            "implementationConsumptionPath": project_path(IMPLEMENTATION_PATH),
            "implementationConsumptionSha256": IMPLEMENTATION_SHA256,
            "inactiveConfigPath": project_path(INACTIVE_CONFIG_PATH),
            "inactiveConfigSha256": INACTIVE_CONFIG_SHA256,
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": TRAINER_SHA256,
            "runnerPath": project_path(RUNNER_PATH),
            "runnerSha256": RUNNER_SHA256,
            "checkerPath": project_path(Path(__file__)),
            "checkerSha256": sha256_file(Path(__file__)),
        },
        **inactive_boundaries(),
    }


def support_contract(args, report):
    return {
        "schemaVersion": "stage4-bounded-repair-smoke-support-contract-v1",
        "status": "cpu_verified_preflight_gate_gpu_execution_not_consumed",
        "trainer": {"path": project_path(TRAINER_PATH), "sha256": TRAINER_SHA256},
        "runner": {"path": project_path(RUNNER_PATH), "sha256": RUNNER_SHA256},
        "cpuRegression": {"path": project_path(args.report), "sha256": sha256_file(args.report)},
        "fixedExecution": {
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "resolution": {"width": 256, "height": 192},
            "epochCount": 30,
            "previewEpochs": PREVIEWS,
            "diagnosticMetricCount": 17,
        },
        **inactive_boundaries(),
    }


def terminal_record(status, blockers, args):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-bounded-repair-smoke-authorization-cpu-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(args.report),
        "contractPath": project_path(args.contract) if resolved(args.contract).exists() else None,
        "contractSha256": sha256_file(args.contract) if resolved(args.contract).exists() else None,
        "blockers": blockers,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def inactive_boundaries():
    return {
        "gpuExecutionAuthorizationConsumed": False,
        "checkpointFileRead": False,
        "checkpointLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
        "automaticRetryStarted": False,
        "stage4FullTrainingStarted": False,
        "stage1Started": False,
        "stage2Started": False,
        "strictRevalidationStarted": False,
        "formalInferenceStarted": False,
        "checkpointPromoted": False,
        "runtimeFrameStarted": False,
        "worldEntryStarted": False,
    }


def load_trainer():
    spec = importlib.util.spec_from_file_location("stage4_bounded_smoke_trainer", resolved(TRAINER_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("stage4_bounded_smoke_trainer_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resolved(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def read_json(path: Path) -> dict:
    return json.loads(resolved(path).read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with resolved(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path: Path) -> str:
    return resolved(path).absolute().relative_to(ROOT.absolute()).as_posix()


def write_json_exclusive(path: Path, value: dict) -> None:
    output = resolved(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())
