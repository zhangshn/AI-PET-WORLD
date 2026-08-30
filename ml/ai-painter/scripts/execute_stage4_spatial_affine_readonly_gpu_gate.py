from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid


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
GPU_RUNNER = (
    SCRIPT_DIR
    / "run_stage4_spatial_affine_decoder_readonly_gpu_qualification.py"
)
PREFLIGHT_PARENT = (
    PROJECT_ROOT
    / ".runtime"
    / "ai-painter"
    / "stage4-spatial-affine-readonly-gpu-preflights"
)
OUTPUT_PARENT_RELATIVE = Path(
    ".runtime/ai-painter/stage4-spatial-affine-readonly-gpu-qualifications"
)
MINIMUM_FREE_DISK_BYTES = 20 * 1024**3
MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT = 10
MAXIMUM_NONTRAINING_MEMORY_MIB = 3000
MINIMUM_FREE_GPU_MEMORY_MIB = 4096


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def local_run_id() -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S%f")[:-3]
    return f"spatial-affine-readonly-gpu-{stamp}-{uuid.uuid4().hex[:8]}"


def write_json_exclusive(path: Path, value: dict) -> None:
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def python_environment() -> dict[str, str]:
    env = dict(os.environ)
    values = [str(SOURCE_ROOT), str(SCRIPT_DIR)]
    if env.get("PYTHONPATH"):
        values.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(values)
    return env


def run_checked(command: list[str], *, timeout: int) -> subprocess.CompletedProcess[str]:
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
                    "stdout": completed.stdout,
                    "stderr": completed.stderr,
                },
                ensure_ascii=False,
            )
        )
    return completed


def resource_preflight() -> dict:
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
    parts = [part.strip() for part in gpu.stdout.strip().split(",")]
    if len(parts) != 5:
        raise RuntimeError("nvidia_smi_gpu_row_invalid")
    utilization = int(parts[1])
    used_mib = int(parts[2])
    free_mib = int(parts[3])
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
    rows = [row.strip() for row in compute.stdout.splitlines() if row.strip()]
    python_rows = [row for row in rows if "python" in row.casefold()]
    disk = shutil.disk_usage(PROJECT_ROOT)
    blockers = []
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
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-resource-preflight-v1",
        "status": "passed" if not blockers else "failed",
        "recordedAtUtc": utc_now(),
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


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--run-id")
    args = parser.parse_args()
    if Path.cwd().resolve() != PROJECT_ROOT.resolve():
        raise ValueError("spatial_affine_gate_project_root_mismatch")
    run_id = args.run_id or local_run_id()
    if not run_id.startswith("spatial-affine-readonly-gpu-"):
        raise ValueError("spatial_affine_gate_run_id_invalid")
    preflight_root = PREFLIGHT_PARENT / run_id
    PREFLIGHT_PARENT.mkdir(parents=True, exist_ok=True)
    preflight_root.mkdir(exist_ok=False)
    inactive = compile_spatial_affine_decoder_cpu_inactive_config(
        project_root=PROJECT_ROOT
    )
    inactive_path = preflight_root / "inactive-config.json"
    write_json_exclusive(inactive_path, inactive)
    formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
    positive = build_and_audit_all_modes()
    negative = run_negative_cases()
    cpu_report = {
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-entry-cpu-report-v1",
        "status": "passed",
        "positivePassed": len(positive),
        "positiveTotal": 4,
        "negativePassed": sum(1 for item in negative if item["passed"]),
        "negativeTotal": len(negative),
        "gpuStarted": False,
        "recordedAtUtc": utc_now(),
    }
    if cpu_report["positivePassed"] != 4 or cpu_report["negativePassed"] != len(negative):
        raise RuntimeError("spatial_affine_cpu_contract_gate_failed")
    write_json_exclusive(preflight_root / "cpu-report.json", cpu_report)
    preflight_output = (
        OUTPUT_PARENT_RELATIVE
        / f"{run_id}-trainer-preflight-nonexistent"
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
            str(
                PROJECT_ROOT
                / formal["modelBoundary"]["autoencoderCheckpointPath"]
            ),
            "--output-dir",
            str(PROJECT_ROOT / preflight_output),
            "--resolution-stage",
            "0",
            "--preflight-only",
            "--stage-control-dry-run",
        ],
        timeout=180,
    )
    write_json_exclusive(
        preflight_root / "trainer-preflight.json",
        {
            "schemaVersion": "stage4-spatial-affine-real-trainer-preflight-v1",
            "status": "passed",
            "stdout": trainer_preflight.stdout,
            "stderr": trainer_preflight.stderr,
            "gpuStarted": False,
            "ticketConsumed": False,
            "recordedAtUtc": utc_now(),
        },
    )
    resources = resource_preflight()
    write_json_exclusive(preflight_root / "resource-preflight.json", resources)
    output_relative = OUTPUT_PARENT_RELATIVE / run_id
    active, ticket = issue_and_consume_spatial_affine_internal_ticket(
        inactive,
        phase="readonly_gpu",
        dataset_package_id=formal["data"]["datasetPackageId"],
        run_id=run_id,
        output_namespace=output_relative.as_posix(),
        project_root=PROJECT_ROOT,
    )
    active_path = preflight_root / "active-config.json"
    write_json_exclusive(active_path, active)
    write_json_exclusive(
        preflight_root / "execution-state.json",
        {
            "schemaVersion": "stage4-spatial-affine-readonly-gpu-gate-state-v1",
            "status": "running",
            "phase": "readonly_gpu_qualification",
            "runId": run_id,
            "outputNamespace": output_relative.as_posix(),
            "internalTicket": ticket,
            "ownerAuthorizationRequired": False,
            "updatedAtUtc": utc_now(),
        },
    )
    completed = run_checked(
        [
            str(PYTHON),
            str(GPU_RUNNER),
            "--config",
            active_path.relative_to(PROJECT_ROOT).as_posix(),
            "--output-dir",
            output_relative.as_posix(),
        ],
        timeout=1800,
    )
    output_root = PROJECT_ROOT / output_relative
    terminal_path = output_root / "phase-terminal.json"
    terminal = json.loads(terminal_path.read_text(encoding="utf-8"))
    if terminal.get("status") != "stage4_spatial_affine_readonly_gpu_qualification_passed":
        raise RuntimeError("spatial_affine_readonly_gpu_terminal_failed")
    final_state = {
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-gate-state-v1",
        "status": "completed",
        "phase": "readonly_gpu_qualification_completed",
        "runId": run_id,
        "outputNamespace": output_relative.as_posix(),
        "terminalPath": terminal_path.relative_to(PROJECT_ROOT).as_posix(),
        "terminalStatus": terminal["status"],
        "stdout": completed.stdout,
        "ownerAuthorizationRequired": False,
        "updatedAtUtc": utc_now(),
    }
    state_path = preflight_root / "final-state.json"
    write_json_exclusive(state_path, final_state)
    print(json.dumps(final_state, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
