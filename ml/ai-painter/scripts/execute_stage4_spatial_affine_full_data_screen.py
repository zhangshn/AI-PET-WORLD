from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Any
from uuid import uuid4


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SOURCE_ROOT = PROJECT_ROOT / "ml" / "ai-painter" / "src"
for entry in (SOURCE_ROOT, SCRIPT_DIR):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

from ai_painter_spatial_affine_decoder_contract import (
    compile_spatial_affine_decoder_cpu_inactive_config,
    issue_and_consume_spatial_affine_internal_ticket,
    load_spatial_affine_formal_objective_contract,
)
from check_stage4_spatial_affine_decoder_cpu import (
    build_and_audit_all_modes,
    run_negative_cases,
)


PYTHON = PROJECT_ROOT / "ml" / "ai-painter" / ".venv" / "Scripts" / "python.exe"
TRAINER = SCRIPT_DIR / "train_ai_assisted_conditional_denoiser.py"
REVIEW_RUNNER = (
    PROJECT_ROOT
    / "scripts"
    / "run-ai-painter-stage4-spatial-affine-screen-review.mjs"
)
EXECUTION_PARENT = (
    PROJECT_ROOT
    / ".runtime"
    / "ai-painter"
    / "stage4-spatial-affine-full-data-screen-executions"
)
PREFLIGHT_PARENT = (
    PROJECT_ROOT
    / ".runtime"
    / "ai-painter"
    / "stage4-spatial-affine-full-data-screen-preflights"
)
TRAINING_PARENT_RELATIVE = Path(
    ".runtime/ai-painter/stage4-spatial-affine-full-data-screens"
)
MINIMUM_FREE_DISK_BYTES = 20 * 1024**3
MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT = 10
MAXIMUM_NONTRAINING_MEMORY_MIB = 3000
MINIMUM_FREE_GPU_MEMORY_MIB = 4096
HEARTBEAT_INTERVAL_SECONDS = 10


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def shanghai_now() -> str:
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="milliseconds")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected_json_object:{path}")
    return value


def write_json_exclusive(path: Path, value: dict[str, Any]) -> None:
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid4().hex}.tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        for attempt in range(8):
            try:
                os.replace(temporary, path)
                return
            except PermissionError:
                if attempt == 7:
                    raise
                time.sleep(0.05 * (attempt + 1))
    finally:
        if temporary.exists():
            temporary.unlink()


def python_environment() -> dict[str, str]:
    env = dict(os.environ)
    values = [str(SOURCE_ROOT), str(SCRIPT_DIR)]
    if env.get("PYTHONPATH"):
        values.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(values)
    return env


def run_checked(
    command: list[str],
    *,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        env=python_environment(),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "subprocess_failed:"
            + json.dumps(
                {
                    "command": command,
                    "returnCode": completed.returncode,
                    "stdout": completed.stdout[-12000:],
                    "stderr": completed.stderr[-12000:],
                },
                ensure_ascii=False,
            )
        )
    return completed


def resource_preflight() -> dict[str, Any]:
    if not PYTHON.is_file():
        raise RuntimeError("project_python_missing")
    cuda = run_checked(
        [
            str(PYTHON),
            "-c",
            (
                "import json,torch; print(json.dumps({"
                "'torchVersion':torch.__version__,"
                "'cudaAvailable':torch.cuda.is_available(),"
                "'cudaVersion':torch.version.cuda,"
                "'deviceCount':torch.cuda.device_count()}))"
            ),
        ],
        timeout=60,
    )
    cuda_value = json.loads(cuda.stdout.strip().splitlines()[-1])
    gpu = subprocess.run(
        [
            "nvidia-smi",
            "--query-gpu=name,utilization.gpu,memory.used,memory.free,memory.total",
            "--format=csv,noheader,nounits",
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if gpu.returncode != 0:
        raise RuntimeError(f"nvidia_smi_failed:{gpu.stderr}")
    parts = [part.strip() for part in gpu.stdout.strip().splitlines()[0].split(",")]
    if len(parts) != 5:
        raise RuntimeError("nvidia_smi_gpu_row_invalid")
    compute = subprocess.run(
        [
            "nvidia-smi",
            "--query-compute-apps=pid,process_name,used_gpu_memory",
            "--format=csv,noheader,nounits",
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if compute.returncode != 0:
        raise RuntimeError(f"nvidia_smi_compute_query_failed:{compute.stderr}")
    rows = [row.strip() for row in compute.stdout.splitlines() if row.strip()]
    python_rows = [row for row in rows if "python" in row.casefold()]
    utilization = int(parts[1])
    used_mib = int(parts[2])
    free_mib = int(parts[3])
    disk = shutil.disk_usage(PROJECT_ROOT)
    blockers: list[str] = []
    if cuda_value.get("cudaAvailable") is not True:
        blockers.append("cuda_unavailable")
    if utilization > MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT:
        blockers.append("gpu_utilization_above_idle_limit")
    if used_mib > MAXIMUM_NONTRAINING_MEMORY_MIB:
        blockers.append("nontraining_gpu_memory_above_limit")
    if free_mib < MINIMUM_FREE_GPU_MEMORY_MIB:
        blockers.append("free_gpu_memory_below_limit")
    if python_rows:
        blockers.append("python_gpu_process_present")
    if disk.free < MINIMUM_FREE_DISK_BYTES:
        blockers.append("free_disk_below_limit")
    result = {
        "schemaVersion": "stage4-spatial-affine-full-data-screen-resource-preflight-v1",
        "status": "passed" if not blockers else "failed",
        "recordedAtUtc": utc_now(),
        "recordedAtAsiaShanghai": shanghai_now(),
        "python": {"path": str(PYTHON), **cuda_value},
        "gpu": {
            "name": parts[0],
            "utilizationPercent": utilization,
            "usedMemoryMiB": used_mib,
            "freeMemoryMiB": free_mib,
            "totalMemoryMiB": int(parts[4]),
            "pythonComputeProcesses": python_rows,
        },
        "disk": {"freeBytes": disk.free, "minimumFreeBytes": MINIMUM_FREE_DISK_BYTES},
        "limits": {
            "maximumIdleGpuUtilizationPercent": MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT,
            "maximumNontrainingMemoryMiB": MAXIMUM_NONTRAINING_MEMORY_MIB,
            "minimumFreeGpuMemoryMiB": MINIMUM_FREE_GPU_MEMORY_MIB,
        },
        "blockers": blockers,
    }
    if blockers:
        raise RuntimeError("resource_preflight_failed:" + ",".join(blockers))
    return result


def progress_projection(
    *,
    run_id: str,
    phase: str,
    status: str,
    worker_pid: int,
    trainer_pid: int | None,
    training_progress: dict[str, Any] | None = None,
    review_progress: dict[str, Any] | None = None,
) -> dict[str, Any]:
    live = (training_progress or {}).get("liveProgress") or {}
    epoch = live.get("epoch")
    epoch_target = live.get("epochTarget")
    optimizer_step = live.get("optimizerStep")
    optimizer_step_target = live.get("optimizerStepTarget")
    percentage = live.get("percentage")
    if phase == "automatic_machine_review" and review_progress:
        completed = review_progress.get("completedPreviewCount")
        target = review_progress.get("previewCount")
        percentage = (
            round(float(completed) / float(target) * 100.0, 4)
            if isinstance(completed, int) and isinstance(target, int) and target > 0
            else None
        )
    return {
        "schemaVersion": "stage4-spatial-affine-full-data-screen-execution-progress-v1",
        "status": status,
        "phase": phase,
        "runId": run_id,
        "workerPid": worker_pid,
        "trainerPid": trainer_pid,
        "epoch": epoch,
        "epochTarget": epoch_target,
        "batch": live.get("batch"),
        "batchTarget": live.get("batchTarget"),
        "optimizerStep": optimizer_step,
        "optimizerStepTarget": optimizer_step_target,
        "percentage": percentage,
        "etaSeconds": live.get("etaSeconds"),
        "loss": live.get("rollingEpochLoss") or live.get("batchLoss"),
        "trainingProgressUpdatedAtUtc": (training_progress or {}).get("updatedAtUtc"),
        "reviewProgress": review_progress,
        "updatedAtUtc": utc_now(),
        "updatedAtAsiaShanghai": shanghai_now(),
    }


def persist_runtime_projection(
    execution_root: Path,
    projection: dict[str, Any],
) -> None:
    write_json_atomic(execution_root / "progress.json", projection)
    write_json_atomic(
        execution_root / "heartbeat.json",
        {
            "schemaVersion": "stage4-spatial-affine-full-data-screen-heartbeat-v1",
            "status": "alive" if projection["status"] == "running" else projection["status"],
            "runId": projection["runId"],
            "phase": projection["phase"],
            "workerPid": projection["workerPid"],
            "trainerPid": projection["trainerPid"],
            "recordedAtUtc": utc_now(),
            "recordedAtAsiaShanghai": shanghai_now(),
        },
    )
    write_json_atomic(
        execution_root / "execution-state.json",
        {
            "schemaVersion": "stage4-spatial-affine-full-data-screen-execution-state-v1",
            "executionState": projection["status"],
            "activeRole": projection["phase"],
            "runId": projection["runId"],
            "workerPid": projection["workerPid"],
            "trainerPid": projection["trainerPid"],
            "trainingProgressPath": (
                f"{TRAINING_PARENT_RELATIVE.as_posix()}/{projection['runId']}/progress.json"
            ),
            "progressPath": (execution_root / "progress.json").relative_to(PROJECT_ROOT).as_posix(),
            "heartbeatPath": (execution_root / "heartbeat.json").relative_to(PROJECT_ROOT).as_posix(),
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
            "updatedAtUtc": utc_now(),
            "updatedAtAsiaShanghai": shanghai_now(),
        },
    )


def monitor_process(
    process: subprocess.Popen[Any],
    *,
    execution_root: Path,
    training_root: Path,
    run_id: str,
    phase: str,
) -> int:
    while True:
        training_progress = None
        review_progress = None
        training_progress_path = training_root / "progress.json"
        review_progress_path = training_root / "review-progress.json"
        try:
            if training_progress_path.is_file():
                training_progress = read_json(training_progress_path)
        except (OSError, ValueError, json.JSONDecodeError):
            training_progress = None
        try:
            if review_progress_path.is_file():
                review_progress = read_json(review_progress_path)
        except (OSError, ValueError, json.JSONDecodeError):
            review_progress = None
        persist_runtime_projection(
            execution_root,
            progress_projection(
                run_id=run_id,
                phase=phase,
                status="running",
                worker_pid=os.getpid(),
                trainer_pid=process.pid if phase == "training" else None,
                training_progress=training_progress,
                review_progress=review_progress,
            ),
        )
        return_code = process.poll()
        if return_code is not None:
            return return_code
        time.sleep(HEARTBEAT_INTERVAL_SECONDS)


def finalize_failure(
    execution_root: Path,
    *,
    run_id: str,
    phase: str,
    error: BaseException,
    ticket_consumed: bool,
    training_root: Path,
) -> None:
    evidence: dict[str, Any] = {}
    for name in ("trainer-stdout.log", "trainer-stderr.log", "review-stdout.log", "review-stderr.log"):
        path = execution_root / name
        if path.is_file():
            evidence[name] = {
                "path": path.relative_to(PROJECT_ROOT).as_posix(),
                "sha256": sha256_file(path),
            }
    finalization = {
        "schemaVersion": "stage4-spatial-affine-full-data-screen-worker-finalization-v1",
        "executionState": "failed_closed",
        "status": "stage4_spatial_affine_full_data_screen_infrastructure_failure",
        "runId": run_id,
        "failedPhase": phase,
        "errorType": type(error).__name__,
        "error": str(error),
        "ticketConsumed": ticket_consumed,
        "trainingOutputPath": training_root.relative_to(PROJECT_ROOT).as_posix(),
        "automaticRetryAllowed": False,
        "ownerAuthorizationRequired": False,
        "evidence": evidence,
        "recordedAtUtc": utc_now(),
        "recordedAtAsiaShanghai": shanghai_now(),
    }
    finalization_path = execution_root / "finalization.json"
    write_json_atomic(finalization_path, finalization)
    terminal = {
        "schemaVersion": "stage4-spatial-affine-full-data-screen-worker-terminal-v1",
        "executionState": "failed_closed",
        "status": finalization["status"],
        "runId": run_id,
        "finalizationPath": finalization_path.relative_to(PROJECT_ROOT).as_posix(),
        "finalizationSha256": sha256_file(finalization_path),
        "automaticRetryAllowed": False,
        "recordedAtUtc": utc_now(),
        "recordedAtAsiaShanghai": shanghai_now(),
    }
    write_json_atomic(execution_root / "phase-terminal.json", terminal)
    projection = progress_projection(
        run_id=run_id,
        phase=phase,
        status="failed_closed",
        worker_pid=os.getpid(),
        trainer_pid=None,
    )
    persist_runtime_projection(execution_root, projection)


def execute(run_id: str) -> dict[str, Any]:
    if Path.cwd().resolve() != PROJECT_ROOT.resolve():
        raise ValueError("spatial_affine_screen_project_root_mismatch")
    if not run_id.startswith("spatial-affine-screen-"):
        raise ValueError("spatial_affine_screen_run_id_invalid")
    execution_root = EXECUTION_PARENT / run_id
    preflight_root = PREFLIGHT_PARENT / run_id
    training_relative = TRAINING_PARENT_RELATIVE / run_id
    training_root = PROJECT_ROOT / training_relative
    for target in (execution_root, preflight_root, training_root):
        if target.exists():
            raise ValueError(f"spatial_affine_screen_output_reuse_forbidden:{target}")
    EXECUTION_PARENT.mkdir(parents=True, exist_ok=True)
    PREFLIGHT_PARENT.mkdir(parents=True, exist_ok=True)
    (PROJECT_ROOT / TRAINING_PARENT_RELATIVE).mkdir(parents=True, exist_ok=True)
    execution_root.mkdir(exist_ok=False)
    preflight_root.mkdir(exist_ok=False)
    phase = "cpu_contract_gate"
    ticket_consumed = False
    persist_runtime_projection(
        execution_root,
        progress_projection(
            run_id=run_id,
            phase=phase,
            status="running",
            worker_pid=os.getpid(),
            trainer_pid=None,
        ),
    )
    try:
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=PROJECT_ROOT
        )
        inactive_path = preflight_root / "inactive-config.json"
        write_json_exclusive(inactive_path, inactive)
        formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
        positive = build_and_audit_all_modes()
        negative = run_negative_cases()
        cpu_report = {
            "schemaVersion": "stage4-spatial-affine-full-data-screen-entry-cpu-report-v1",
            "status": "passed",
            "positivePassed": len(positive),
            "positiveTotal": 4,
            "negativePassed": sum(1 for item in negative if item["passed"]),
            "negativeTotal": len(negative),
            "gpuStarted": False,
            "recordedAtUtc": utc_now(),
            "recordedAtAsiaShanghai": shanghai_now(),
        }
        if cpu_report["positivePassed"] != 4 or cpu_report["negativePassed"] != len(negative):
            raise RuntimeError("spatial_affine_cpu_contract_gate_failed")
        write_json_exclusive(preflight_root / "cpu-report.json", cpu_report)

        phase = "trainer_readonly_preflight"
        persist_runtime_projection(
            execution_root,
            progress_projection(
                run_id=run_id,
                phase=phase,
                status="running",
                worker_pid=os.getpid(),
                trainer_pid=None,
            ),
        )
        preflight_output = (
            TRAINING_PARENT_RELATIVE / f"{run_id}-trainer-preflight-nonexistent"
        )
        trainer_preflight = run_checked(
            [
                str(PYTHON),
                str(TRAINER),
                "--config",
                str(inactive_path),
                "--dataset-package",
                str(PROJECT_ROOT / formal["data"]["datasetManifestPath"]),
                "--autoencoder-checkpoint",
                str(PROJECT_ROOT / formal["modelBoundary"]["autoencoderCheckpointPath"]),
                "--output-dir",
                str(PROJECT_ROOT / preflight_output),
                "--resolution-stage",
                "0",
                "--preflight-only",
                "--stage-control-dry-run",
            ],
            timeout=300,
        )
        write_json_exclusive(
            preflight_root / "trainer-preflight.json",
            {
                "schemaVersion": "stage4-spatial-affine-full-data-screen-trainer-preflight-v1",
                "status": "passed",
                "stdout": trainer_preflight.stdout,
                "stderr": trainer_preflight.stderr,
                "gpuStarted": False,
                "ticketConsumed": False,
                "recordedAtUtc": utc_now(),
                "recordedAtAsiaShanghai": shanghai_now(),
            },
        )

        phase = "resource_preflight"
        resources = resource_preflight()
        write_json_exclusive(preflight_root / "resource-preflight.json", resources)

        phase = "internal_ticket_consumption"
        active, ticket = issue_and_consume_spatial_affine_internal_ticket(
            inactive,
            phase="full_data_screen",
            dataset_package_id=formal["data"]["datasetPackageId"],
            run_id=run_id,
            output_namespace=training_relative.as_posix(),
            project_root=PROJECT_ROOT,
        )
        ticket_consumed = True
        active_path = preflight_root / "active-config.json"
        write_json_exclusive(active_path, active)
        write_json_exclusive(preflight_root / "internal-ticket-identity.json", ticket)

        phase = "training"
        trainer_command = [
            str(PYTHON),
            str(TRAINER),
            "--config",
            str(active_path),
            "--dataset-package",
            str(PROJECT_ROOT / formal["data"]["datasetManifestPath"]),
            "--autoencoder-checkpoint",
            str(PROJECT_ROOT / formal["modelBoundary"]["autoencoderCheckpointPath"]),
            "--output-dir",
            str(training_root),
            "--resolution-stage",
            "0",
        ]
        with (
            (execution_root / "trainer-stdout.log").open("x", encoding="utf-8", newline="\n") as stdout,
            (execution_root / "trainer-stderr.log").open("x", encoding="utf-8", newline="\n") as stderr,
        ):
            trainer = subprocess.Popen(
                trainer_command,
                cwd=PROJECT_ROOT,
                env=python_environment(),
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                text=True,
            )
            return_code = monitor_process(
                trainer,
                execution_root=execution_root,
                training_root=training_root,
                run_id=run_id,
                phase=phase,
            )
        if return_code != 0:
            raise RuntimeError(f"trainer_failed_with_exit_code:{return_code}")
        manifest_path = training_root / "manifest.json"
        if not manifest_path.is_file():
            raise RuntimeError("trainer_completed_without_manifest")

        phase = "automatic_machine_review"
        with (
            (execution_root / "review-stdout.log").open("x", encoding="utf-8", newline="\n") as stdout,
            (execution_root / "review-stderr.log").open("x", encoding="utf-8", newline="\n") as stderr,
        ):
            review = subprocess.Popen(
                ["node", str(REVIEW_RUNNER), "--run-id", run_id],
                cwd=PROJECT_ROOT,
                env=dict(os.environ),
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                text=True,
            )
            return_code = monitor_process(
                review,
                execution_root=execution_root,
                training_root=training_root,
                run_id=run_id,
                phase=phase,
            )
        if return_code != 0:
            raise RuntimeError(f"automatic_review_failed_with_exit_code:{return_code}")
        training_terminal_path = training_root / "phase-terminal.json"
        if not training_terminal_path.is_file():
            raise RuntimeError("automatic_review_completed_without_terminal")
        training_terminal = read_json(training_terminal_path)
        if training_terminal.get("executionState") != "completed":
            raise RuntimeError("automatic_review_terminal_not_completed")

        phase = "completed"
        finalization = {
            "schemaVersion": "stage4-spatial-affine-full-data-screen-worker-finalization-v1",
            "executionState": "completed",
            "status": training_terminal.get("status"),
            "runId": run_id,
            "trainingTerminalPath": training_terminal_path.relative_to(PROJECT_ROOT).as_posix(),
            "trainingTerminalSha256": sha256_file(training_terminal_path),
            "trainingManifestPath": manifest_path.relative_to(PROJECT_ROOT).as_posix(),
            "trainingManifestSha256": sha256_file(manifest_path),
            "ticketConsumed": True,
            "automaticRetryAllowed": False,
            "ownerAuthorizationRequired": False,
            "recordedAtUtc": utc_now(),
            "recordedAtAsiaShanghai": shanghai_now(),
        }
        finalization_path = execution_root / "finalization.json"
        write_json_exclusive(finalization_path, finalization)
        terminal = {
            "schemaVersion": "stage4-spatial-affine-full-data-screen-worker-terminal-v1",
            "executionState": "completed",
            "status": finalization["status"],
            "runId": run_id,
            "finalizationPath": finalization_path.relative_to(PROJECT_ROOT).as_posix(),
            "finalizationSha256": sha256_file(finalization_path),
            "trainingTerminalPath": finalization["trainingTerminalPath"],
            "trainingTerminalSha256": finalization["trainingTerminalSha256"],
            "recordedAtUtc": utc_now(),
            "recordedAtAsiaShanghai": shanghai_now(),
        }
        terminal_path = execution_root / "phase-terminal.json"
        write_json_exclusive(terminal_path, terminal)
        final_progress = progress_projection(
            run_id=run_id,
            phase="completed",
            status="completed",
            worker_pid=os.getpid(),
            trainer_pid=None,
            training_progress=(
                read_json(training_root / "progress.json")
                if (training_root / "progress.json").is_file()
                else None
            ),
            review_progress=(
                read_json(training_root / "review-progress.json")
                if (training_root / "review-progress.json").is_file()
                else None
            ),
        )
        persist_runtime_projection(execution_root, final_progress)
        return terminal
    except BaseException as error:
        finalize_failure(
            execution_root,
            run_id=run_id,
            phase=phase,
            error=error,
            ticket_consumed=ticket_consumed,
            training_root=training_root,
        )
        raise


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    terminal = execute(args.run_id)
    print(json.dumps(terminal, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
