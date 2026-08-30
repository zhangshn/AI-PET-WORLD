from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from pathlib import PureWindowsPath
import re
import shutil
import subprocess
import sys
from typing import Any, Callable, Mapping
import uuid


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SOURCE_ROOT = PROJECT_ROOT / "ml" / "ai-painter" / "src"
for entry in (SOURCE_ROOT, SCRIPT_DIR):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

from ai_painter_full_backbone_spatial_affine_contract import (
    ARCHITECTURE_ID,
    CAPABILITY_VERSION,
    READONLY_GPU_OUTPUT_ROOT,
    issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket,
    validate_full_backbone_spatial_affine_readonly_gpu_config,
)
from ai_painter_spatial_affine_decoder_contract import (
    load_spatial_affine_formal_objective_contract,
)


PYTHON = PROJECT_ROOT / "ml" / "ai-painter" / ".venv" / "Scripts" / "python.exe"
CPU_CHECKER = SCRIPT_DIR / "check_stage4_full_backbone_spatial_affine_cpu.py"
GPU_RUNNER = (
    SCRIPT_DIR
    / "run_stage4_full_backbone_spatial_affine_readonly_gpu_qualification.py"
)
ATTEMPT_ROOT_RELATIVE = Path(
    ".runtime/ai-painter/"
    "stage4-full-backbone-spatial-affine-readonly-gpu-attempts"
)
OUTPUT_ROOT_RELATIVE = Path(READONLY_GPU_OUTPUT_ROOT)
MINIMUM_FREE_DISK_BYTES = 20 * 1024**3
MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT = 10
MAXIMUM_NONQUALIFICATION_GPU_MEMORY_MIB = 3000
MINIMUM_FREE_GPU_MEMORY_MIB = 4096
MAXIMUM_IDLE_PROCESS_SM_UTILIZATION_PERCENT = 10
_SAFE_RUN_ID = re.compile(
    r"full-backbone-spatial-affine-readonly-gpu-"
    r"[0-9]{8}-[0-9]{9}-[0-9a-f]{8}"
)


class GateExecutionError(RuntimeError):
    def __init__(self, result: Mapping[str, Any]):
        super().__init__(str(result.get("error", "readonly_gpu_gate_failed")))
        self.result = dict(result)


class GatePreflightError(RuntimeError):
    def __init__(self, report: Mapping[str, Any]):
        blockers = report.get("blockers", [])
        super().__init__("preflight_failed:" + ",".join(blockers))
        self.report = dict(report)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def new_run_id() -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S%f")[:-3]
    return (
        f"full-backbone-spatial-affine-readonly-gpu-{stamp}-"
        f"{uuid.uuid4().hex[:8]}"
    )


def validate_run_id(run_id: str) -> str:
    if not isinstance(run_id, str) or _SAFE_RUN_ID.fullmatch(run_id) is None:
        raise ValueError("full_backbone_readonly_gpu_gate_run_id_invalid")
    return run_id


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def _under(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def project_path(path: Path, project_root: Path = PROJECT_ROOT) -> str:
    """Return a stable project path while treating .runtime junctions as roots."""

    root = project_root.resolve()
    resolved = path.resolve()
    runtime_alias = project_root / ".runtime"
    runtime_physical = runtime_alias.resolve()
    if resolved == runtime_physical or _under(resolved, runtime_physical):
        return (
            Path(".runtime") / resolved.relative_to(runtime_physical)
        ).as_posix()
    if resolved == root or _under(resolved, root):
        return resolved.relative_to(root).as_posix()
    raise ValueError("full_backbone_readonly_gpu_gate_path_outside_project")


def resolve_project_file(
    relative_path: str,
    *,
    project_root: Path = PROJECT_ROOT,
) -> Path:
    relative = Path(relative_path)
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in {"", ".", ".."} for part in relative.parts)
    ):
        raise ValueError("full_backbone_readonly_gpu_gate_relative_file_invalid")
    if relative.parts[0].casefold() == ".runtime":
        runtime_physical = (project_root / ".runtime").resolve()
        resolved = (project_root / relative).resolve()
        if resolved != runtime_physical and not _under(resolved, runtime_physical):
            raise ValueError("full_backbone_readonly_gpu_gate_runtime_path_escape")
    else:
        root = project_root.resolve()
        resolved = (project_root / relative).resolve()
        if resolved != root and not _under(resolved, root):
            raise ValueError("full_backbone_readonly_gpu_gate_project_path_escape")
    if not resolved.is_file():
        raise ValueError("full_backbone_readonly_gpu_gate_bound_file_missing")
    return resolved


def binding(path: Path, project_root: Path = PROJECT_ROOT) -> dict[str, str]:
    return {
        "path": project_path(path, project_root),
        "sha256": sha256_file(path),
    }


def python_environment(project_root: Path = PROJECT_ROOT) -> dict[str, str]:
    env = dict(os.environ)
    source_root = project_root / "ml" / "ai-painter" / "src"
    script_root = project_root / "ml" / "ai-painter" / "scripts"
    entries = [str(source_root), str(script_root)]
    if env.get("PYTHONPATH"):
        entries.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(entries)
    return env


def run_checked(
    command: list[str],
    *,
    project_root: Path = PROJECT_ROOT,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        command,
        cwd=project_root,
        env=python_environment(project_root),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "full_backbone_readonly_gpu_gate_subprocess_failed:"
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


def run_cpu_gate(
    project_root: Path = PROJECT_ROOT,
    *,
    command_runner: Callable[..., subprocess.CompletedProcess[str]] = run_checked,
) -> dict[str, Any]:
    python = project_root / "ml" / "ai-painter" / ".venv" / "Scripts" / "python.exe"
    checker = (
        project_root
        / "ml"
        / "ai-painter"
        / "scripts"
        / CPU_CHECKER.name
    )
    completed = command_runner(
        [str(python), str(checker)],
        project_root=project_root,
        timeout=600,
    )
    report = json.loads(completed.stdout)
    boundary = report.get("executionBoundary")
    if (
        report.get("status") != "passed"
        or report.get("positivePassed") != report.get("positiveTotal")
        or report.get("negativePassed") != report.get("negativeTotal")
        or not isinstance(boundary, dict)
        or any(boundary.values())
    ):
        raise RuntimeError("full_backbone_readonly_gpu_gate_cpu_contract_failed")
    return report


def run_python_cuda_preflight(
    project_root: Path = PROJECT_ROOT,
    *,
    command_runner: Callable[..., subprocess.CompletedProcess[str]] = run_checked,
) -> dict[str, Any]:
    python = project_root / "ml" / "ai-painter" / ".venv" / "Scripts" / "python.exe"
    probe = (
        "import json,sys,torch;"
        "print(json.dumps({"
        "'pythonVersion':sys.version.split()[0],"
        "'torchVersion':torch.__version__,"
        "'cudaBuildVersion':torch.version.cuda,"
        "'cudaAvailable':torch.cuda.is_available(),"
        "'cudaDeviceCount':torch.cuda.device_count() if torch.cuda.is_available() else 0"
        "}))"
    )
    completed = command_runner(
        [str(python), "-c", probe],
        project_root=project_root,
        timeout=120,
    )
    details = json.loads(completed.stdout)
    blockers: list[str] = []
    if details.get("cudaAvailable") is not True:
        blockers.append("cuda_unavailable")
    if details.get("cudaDeviceCount") != 1:
        blockers.append("cuda_device_count_not_exactly_one")
    report = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-python-cuda-preflight-v1"
        ),
        "status": "passed" if not blockers else "failed",
        "details": details,
        "blockers": blockers,
        "gpuWorkloadStarted": False,
        "recordedAtUtc": utc_now(),
    }
    if blockers:
        raise GatePreflightError(report)
    return report


_COMPUTE_RISK_TOKENS = (
    "python",
    "pythonw",
    "torch",
    "torchrun",
    "pytorch",
    "train",
    "accelerate",
    "deepspeed",
    "jupyter",
    "cuda",
    "blender",
    "render",
    "comfy",
    "ollama",
    "diffusion",
)
_KNOWN_WINDOWS_GRAPHICS_PROCESSES = {
    "applicationframehost.exe",
    "chatgpt.exe",
    "chrome.exe",
    "code.exe",
    "crossdeviceresume.exe",
    "dwm.exe",
    "explorer.exe",
    "logioptionsplus_agent.exe",
    "msedgewebview2.exe",
    "notepad.exe",
    "nvcontainer.exe",
    "nvidia overlay.exe",
    "phoneexperiencehost.exe",
    "qq.exe",
    "searchhost.exe",
    "shellexperiencehost.exe",
    "shellhost.exe",
    "startmenuexperiencehost.exe",
    "systemsettings.exe",
    "tabtip.exe",
    "textinputhost.exe",
    "v2rayn.exe",
}
_UNKNOWN_NVIDIA_NAMES = {
    "",
    "[insufficient permissions]",
    "insufficient permissions",
    "[unknown]",
    "unknown",
    "[n/a]",
    "n/a",
}


def _parse_optional_int(value: str) -> int | None:
    normalized = value.strip().casefold()
    if normalized in {"", "-", "n/a", "[n/a]", "not supported"}:
        return None
    match = re.search(r"-?\d+", normalized)
    if match is None:
        return None
    return int(match.group(0))


def parse_nvidia_compute_processes(stdout: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in stdout.splitlines():
        line = raw.strip()
        if not line or line.casefold().startswith("no running"):
            continue
        parts = [part.strip() for part in line.split(",", 2)]
        if len(parts) != 3 or not parts[0].isdigit():
            rows.append(
                {
                    "raw": line,
                    "parseStatus": "invalid",
                    "pid": None,
                    "nvidiaProcessName": None,
                    "usedGpuMemoryMiB": None,
                }
            )
            continue
        rows.append(
            {
                "raw": line,
                "parseStatus": "parsed",
                "pid": int(parts[0]),
                "nvidiaProcessName": parts[1],
                "usedGpuMemoryMiB": _parse_optional_int(parts[2]),
                "usedGpuMemoryRaw": parts[2],
            }
        )
    return rows


def parse_nvidia_pmon_processes(stdout: str) -> dict[int, dict[str, Any]]:
    rows: dict[int, dict[str, Any]] = {}
    for raw in stdout.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 5 or not parts[1].isdigit():
            continue
        pid = int(parts[1])
        rows[pid] = {
            "gpuIndex": _parse_optional_int(parts[0]),
            "pid": pid,
            "processType": parts[2].upper(),
            "smUtilizationPercent": _parse_optional_int(parts[3]),
            "memoryUtilizationPercent": _parse_optional_int(parts[4]),
            "command": parts[-1] if len(parts) >= 6 else None,
            "raw": line,
        }
    return rows


def _windows_basename(value: str | None) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    return PureWindowsPath(value.strip()).name.casefold()


def query_wmi_process_identities(
    pids: list[int],
    *,
    project_root: Path,
    process_runner: Callable[..., subprocess.CompletedProcess[str]],
) -> tuple[dict[int, dict[str, Any]], dict[str, Any]]:
    if not pids:
        return {}, {"status": "not_required", "requestedPids": []}
    safe_pids = sorted(set(int(pid) for pid in pids if int(pid) > 0))
    pid_literal = ",".join(str(pid) for pid in safe_pids)
    script = (
        "$ErrorActionPreference='Stop';"
        f"$ids=@({pid_literal});"
        "$rows=@(Get-CimInstance Win32_Process -ErrorAction Stop | "
        "Where-Object { $ids -contains [int]$_.ProcessId } | "
        "Select-Object ProcessId,Name,ExecutablePath,CommandLine);"
        "ConvertTo-Json -InputObject $rows -Compress"
    )
    completed = process_runner(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    if completed.returncode != 0:
        return {}, {
            "status": "failed",
            "requestedPids": safe_pids,
            "error": completed.stderr.strip(),
        }
    try:
        payload = json.loads(completed.stdout) if completed.stdout.strip() else []
    except json.JSONDecodeError:
        return {}, {
            "status": "failed_invalid_json",
            "requestedPids": safe_pids,
        }
    if not isinstance(payload, list):
        return {}, {
            "status": "failed_invalid_shape",
            "requestedPids": safe_pids,
            "expectedJsonShape": "array",
        }
    identities: dict[int, dict[str, Any]] = {}
    for row in payload:
        if not isinstance(row, Mapping):
            continue
        pid = row.get("ProcessId")
        if isinstance(pid, int) and pid in safe_pids:
            identities[pid] = {
                "processId": pid,
                "name": row.get("Name"),
                "executablePath": row.get("ExecutablePath"),
                "commandLine": row.get("CommandLine"),
            }
    return identities, {
        "status": "completed",
        "jsonShape": "array",
        "requestedPids": safe_pids,
        "resolvedPids": sorted(identities),
    }


def classify_gpu_processes(
    compute_rows: list[dict[str, Any]],
    pmon_rows: Mapping[int, Mapping[str, Any]],
    wmi_rows: Mapping[int, Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    classified: list[dict[str, Any]] = []
    blockers: list[str] = []
    for row in compute_rows:
        reasons: list[str] = []
        pid = row.get("pid")
        pmon = pmon_rows.get(pid, {}) if isinstance(pid, int) else {}
        wmi = wmi_rows.get(pid, {}) if isinstance(pid, int) else {}
        nvidia_name = str(row.get("nvidiaProcessName") or "")
        unresolved_nvidia_name = nvidia_name.casefold() in _UNKNOWN_NVIDIA_NAMES
        resolved_name = (
            _windows_basename(wmi.get("executablePath"))
            or _windows_basename(wmi.get("name"))
            or ("" if unresolved_nvidia_name else _windows_basename(nvidia_name))
        )
        identity_text = " ".join(
            str(value or "").casefold()
            for value in (
                resolved_name,
                nvidia_name,
                wmi.get("executablePath"),
                wmi.get("commandLine"),
                pmon.get("command"),
            )
        )
        process_type = str(pmon.get("processType") or "").upper()
        sm_utilization = pmon.get("smUtilizationPercent")
        used_memory = row.get("usedGpuMemoryMiB")
        risk_identity = any(token in identity_text for token in _COMPUTE_RISK_TOKENS)
        known_graphics = resolved_name in _KNOWN_WINDOWS_GRAPHICS_PROCESSES
        has_graphics_context = "G" in process_type
        has_compute_context = "C" in process_type

        if row.get("parseStatus") != "parsed" or not isinstance(pid, int):
            reasons.append("unparseable_nvidia_compute_process_row")
        if unresolved_nvidia_name and not resolved_name:
            reasons.append("unresolved_gpu_process_identity")
        if isinstance(used_memory, int) and used_memory > 0:
            reasons.append("quantified_foreign_gpu_memory")
        if risk_identity:
            reasons.append("training_or_compute_process_identity")
        if has_compute_context and not has_graphics_context:
            reasons.append("compute_only_gpu_context")
        if (
            isinstance(sm_utilization, int)
            and sm_utilization > MAXIMUM_IDLE_PROCESS_SM_UTILIZATION_PERCENT
        ):
            reasons.append("per_process_sm_utilization_above_idle_limit")
        if not process_type and not known_graphics:
            reasons.append("gpu_process_type_unresolved")
        if process_type and not has_graphics_context and not has_compute_context:
            reasons.append("gpu_process_type_unknown")

        blocking = bool(reasons)
        if blocking:
            blockers.extend(reasons)
        classified.append(
            {
                "pid": pid,
                "nvidiaProcessName": nvidia_name,
                "resolvedProcessName": resolved_name or None,
                "usedGpuMemoryMiB": used_memory,
                "usedGpuMemoryRaw": row.get("usedGpuMemoryRaw"),
                "pmonType": process_type or None,
                "pmonSmUtilizationPercent": sm_utilization,
                "wmiIdentity": dict(wmi) if wmi else None,
                "classification": (
                    "conflicting_compute" if blocking else "idle_wddm_graphics"
                ),
                "blockingReasons": reasons,
            }
        )
    return classified, sorted(set(blockers))


def resource_preflight(
    project_root: Path = PROJECT_ROOT,
    *,
    process_runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    disk_usage: Callable[[Path], Any] = shutil.disk_usage,
) -> dict[str, Any]:
    gpu = process_runner(
        [
            "nvidia-smi",
            "--query-gpu=name,utilization.gpu,memory.used,memory.free,memory.total",
            "--format=csv,noheader,nounits",
        ],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    compute = process_runner(
        [
            "nvidia-smi",
            "--query-compute-apps=pid,process_name,used_gpu_memory",
            "--format=csv,noheader,nounits",
        ],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    pmon = process_runner(
        ["nvidia-smi", "pmon", "-c", "1", "-s", "um"],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    blockers: list[str] = []
    gpu_rows = [row.strip() for row in gpu.stdout.splitlines() if row.strip()]
    if gpu.returncode != 0:
        blockers.append("nvidia_smi_gpu_query_failed")
    if len(gpu_rows) != 1:
        blockers.append("gpu_inventory_not_exactly_one")
    gpu_identity: dict[str, Any] = {}
    if len(gpu_rows) == 1:
        parts = [part.strip() for part in gpu_rows[0].split(",")]
        if len(parts) != 5:
            blockers.append("nvidia_smi_gpu_row_invalid")
        else:
            try:
                utilization = int(parts[1])
                used_mib = int(parts[2])
                free_mib = int(parts[3])
                total_mib = int(parts[4])
            except ValueError:
                blockers.append("nvidia_smi_gpu_values_invalid")
            else:
                gpu_identity = {
                    "name": parts[0],
                    "utilizationPercent": utilization,
                    "usedMemoryMiB": used_mib,
                    "freeMemoryMiB": free_mib,
                    "totalMemoryMiB": total_mib,
                }
                if utilization > MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT:
                    blockers.append("gpu_utilization_above_idle_limit")
                if used_mib > MAXIMUM_NONQUALIFICATION_GPU_MEMORY_MIB:
                    blockers.append("nonqualification_gpu_memory_above_limit")
                if free_mib < MINIMUM_FREE_GPU_MEMORY_MIB:
                    blockers.append("free_gpu_memory_below_limit")
    if compute.returncode != 0:
        blockers.append("nvidia_smi_compute_process_query_failed")
    compute_rows = parse_nvidia_compute_processes(compute.stdout)
    pmon_rows = parse_nvidia_pmon_processes(pmon.stdout)
    if pmon.returncode != 0 and compute_rows:
        blockers.append("nvidia_smi_pmon_query_failed")
    unresolved_pids = [
        row["pid"]
        for row in compute_rows
        if isinstance(row.get("pid"), int)
        and str(row.get("nvidiaProcessName") or "").casefold()
        in _UNKNOWN_NVIDIA_NAMES
    ]
    wmi_rows, wmi_report = query_wmi_process_identities(
        unresolved_pids,
        project_root=project_root,
        process_runner=process_runner,
    )
    if unresolved_pids and wmi_report["status"] != "completed":
        blockers.append("wmi_gpu_process_resolution_failed")
    classified_processes, process_blockers = classify_gpu_processes(
        compute_rows,
        pmon_rows,
        wmi_rows,
    )
    blockers.extend(process_blockers)
    project_disk = disk_usage(project_root)
    runtime_physical = (project_root / ".runtime").resolve()
    runtime_disk = disk_usage(runtime_physical)
    if project_disk.free < MINIMUM_FREE_DISK_BYTES:
        blockers.append("project_free_disk_below_limit")
    if runtime_disk.free < MINIMUM_FREE_DISK_BYTES:
        blockers.append("runtime_free_disk_below_limit")
    report = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-resource-preflight-v1"
        ),
        "status": "passed" if not blockers else "failed",
        "gpu": {
            **gpu_identity,
            "processClassificationContract": (
                "windows_wddm_pmon_wmi_compute_conflict_v1"
            ),
            "computeProcesses": classified_processes,
            "wmiReconciliation": wmi_report,
            "safeWddmGraphicsProcessCount": sum(
                row["classification"] == "idle_wddm_graphics"
                for row in classified_processes
            ),
            "conflictingComputeProcessCount": sum(
                row["classification"] == "conflicting_compute"
                for row in classified_processes
            ),
        },
        "disk": {
            "projectPath": str(project_root.resolve()),
            "projectFreeBytes": int(project_disk.free),
            "runtimePhysicalPath": str(runtime_physical),
            "runtimeFreeBytes": int(runtime_disk.free),
            "minimumFreeBytes": MINIMUM_FREE_DISK_BYTES,
        },
        "limits": {
            "maximumIdleGpuUtilizationPercent": (
                MAXIMUM_IDLE_GPU_UTILIZATION_PERCENT
            ),
            "maximumNonqualificationGpuMemoryMiB": (
                MAXIMUM_NONQUALIFICATION_GPU_MEMORY_MIB
            ),
            "minimumFreeGpuMemoryMiB": MINIMUM_FREE_GPU_MEMORY_MIB,
            "maximumIdleProcessSmUtilizationPercent": (
                MAXIMUM_IDLE_PROCESS_SM_UTILIZATION_PERCENT
            ),
        },
        "blockers": sorted(set(blockers)),
        "gpuWorkloadStarted": False,
        "recordedAtUtc": utc_now(),
    }
    if report["blockers"]:
        raise GatePreflightError(report)
    return report


def collect_program_bindings(
    project_root: Path,
) -> dict[str, dict[str, str]]:
    scripts = project_root / "ml" / "ai-painter" / "scripts"
    source = project_root / "ml" / "ai-painter" / "src"
    paths = {
        "fullBackboneContractProgram": (
            scripts / "ai_painter_full_backbone_spatial_affine_contract.py"
        ),
        "authorizationPolicyProgram": scripts / "ai_painter_authorization_policy.py",
        "modeRegistryProgram": scripts / "ai_painter_stage_mode_registry.py",
        "gpuRunnerProgram": scripts / GPU_RUNNER.name,
        "outerGateProgram": scripts / Path(__file__).name,
        "cpuCheckerProgram": (
            scripts / "check_stage4_full_backbone_spatial_affine_cpu.py"
        ),
        "formalObjectiveLoaderProgram": (
            scripts / "ai_painter_spatial_affine_decoder_contract.py"
        ),
        "trainerCheckpointLoaderProgram": (
            scripts / "train_ai_assisted_conditional_denoiser.py"
        ),
        "executionGrantProgram": scripts / "ai_painter_execution_grant.py",
        "stateHashProgram": scripts / "ai_painter_preview_reproduction.py",
        "modelFactoryProgram": (
            source / "ai_painter" / "complete_world" / "model.py"
        ),
        "datasetProgram": (
            source / "ai_painter" / "complete_world" / "dataset.py"
        ),
        "completeWorldExportProgram": (
            source / "ai_painter" / "complete_world" / "__init__.py"
        ),
    }
    return {label: binding(path, project_root) for label, path in paths.items()}


def collect_frozen_input_bindings(
    active_config: Mapping[str, Any],
    *,
    project_root: Path,
) -> dict[str, dict[str, str]]:
    result = collect_program_bindings(project_root)
    evidence = active_config.get("evidenceBindings")
    if not isinstance(evidence, Mapping):
        raise ValueError("full_backbone_readonly_gpu_gate_evidence_bindings_missing")
    entries = {
        "cpuSupportTerminal": evidence.get("cpuSupportTerminal"),
        "formalObjectiveContract": evidence.get("formalObjectiveContract"),
        "datasetManifest": {
            "path": evidence.get("approved64Selection", {}).get(
                "datasetManifestPath"
            ),
            "sha256": evidence.get("approved64Selection", {}).get(
                "datasetManifestSha256"
            ),
        },
        "sourceIndex": {
            "path": evidence.get("approved64Selection", {}).get(
                "sourceIndexPath"
            ),
            "sha256": evidence.get("approved64Selection", {}).get(
                "sourceIndexSha256"
            ),
        },
        "autoencoderCheckpoint": {
            "path": evidence.get("autoencoderCheckpointIdentity", {}).get("path"),
            "sha256": evidence.get("autoencoderCheckpointIdentity", {}).get(
                "sha256"
            ),
        },
    }
    qualification_samples = evidence.get("qualificationSamples")
    if not isinstance(qualification_samples, Mapping):
        raise ValueError(
            "full_backbone_readonly_gpu_gate_qualification_samples_missing"
        )
    for role in ("firstTrain", "fixedValidation"):
        sample = qualification_samples.get(role)
        if not isinstance(sample, Mapping):
            raise ValueError(
                f"full_backbone_readonly_gpu_gate_{role}_sample_binding_missing"
            )
        entries[f"{role}SourceRecord"] = {
            "path": sample.get("sourceRecordPath"),
            "sha256": sample.get("sourceRecordSha256"),
        }
        entries[f"{role}ConditionPack"] = {
            "path": sample.get("conditionPackPath"),
            "sha256": sample.get("conditionPackSha256"),
        }
    for label, expected in entries.items():
        if not isinstance(expected, Mapping):
            raise ValueError(
                f"full_backbone_readonly_gpu_gate_{label}_binding_missing"
            )
        path = resolve_project_file(
            str(expected.get("path", "")), project_root=project_root
        )
        observed = binding(path, project_root)
        if observed["sha256"] != expected.get("sha256"):
            raise ValueError(
                f"full_backbone_readonly_gpu_gate_{label}_sha256_mismatch"
            )
        result[label] = observed
    return result


def verify_frozen_bindings(
    bindings: Mapping[str, Mapping[str, str]],
    *,
    project_root: Path,
) -> None:
    for label, expected in bindings.items():
        if not isinstance(expected, Mapping):
            raise ValueError(
                f"full_backbone_readonly_gpu_gate_{label}_freeze_invalid"
            )
        path = resolve_project_file(
            str(expected.get("path", "")), project_root=project_root
        )
        observed = binding(path, project_root)
        if observed != dict(expected):
            raise ValueError(
                f"full_backbone_readonly_gpu_gate_{label}_changed_during_execution"
            )


def _verify_ticket_files(
    ticket: Mapping[str, Any],
    *,
    project_root: Path,
) -> dict[str, dict[str, str]]:
    if (
        ticket.get("executionState") != "consumed"
        or ticket.get("executionActions")
        != [
            "inspect_autoencoder_identity",
            "inspect_checkpoint_identity",
            "load_autoencoder",
        ]
    ):
        raise ValueError("full_backbone_readonly_gpu_gate_ticket_not_consumed")
    ticket_path = resolve_project_file(
        str(ticket.get("ticketPath", "")), project_root=project_root
    )
    consumption_path = resolve_project_file(
        str(ticket.get("consumptionPath", "")), project_root=project_root
    )
    ticket_binding = binding(ticket_path, project_root)
    consumption_binding = binding(consumption_path, project_root)
    if (
        ticket_binding["sha256"] != ticket.get("ticketSha256")
        or consumption_binding["sha256"] != ticket.get("consumptionSha256")
    ):
        raise ValueError("full_backbone_readonly_gpu_gate_ticket_sha256_mismatch")
    return {"ticket": ticket_binding, "consumption": consumption_binding}


def invoke_gpu_runner(
    *,
    project_root: Path,
    config_path: Path,
    config_sha256: str,
    execution_claim_path: Path,
    execution_claim_sha256: str,
    output_relative: Path,
    command_runner: Callable[..., subprocess.CompletedProcess[str]] = run_checked,
) -> subprocess.CompletedProcess[str]:
    python = project_root / "ml" / "ai-painter" / ".venv" / "Scripts" / "python.exe"
    runner = (
        project_root
        / "ml"
        / "ai-painter"
        / "scripts"
        / GPU_RUNNER.name
    )
    return command_runner(
        [
            str(python),
            str(runner),
            "--config",
            project_path(config_path, project_root),
            "--config-sha256",
            config_sha256,
            "--execution-claim",
            project_path(execution_claim_path, project_root),
            "--execution-claim-sha256",
            execution_claim_sha256,
            "--output-dir",
            output_relative.as_posix(),
        ],
        project_root=project_root,
        timeout=1800,
    )


def _write_output_failure_terminal_if_needed(
    *,
    output_dir: Path,
    run_id: str,
    failure_report: dict[str, str],
    project_root: Path,
) -> dict[str, str] | None:
    if not output_dir.is_dir():
        return None
    terminal_path = output_dir / "phase-terminal.json"
    if terminal_path.exists():
        return None
    terminal = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-terminal-v1"
        ),
        "executionState": "failed_closed",
        "status": (
            "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_failed"
        ),
        "runId": run_id,
        "failureReport": failure_report,
        "ownerAuthorizationRequired": False,
        "recordedAtUtc": utc_now(),
    }
    write_json_exclusive(terminal_path, terminal)
    return binding(terminal_path, project_root)


def validate_runner_success(
    *,
    runner_terminal_path: Path,
    output_dir: Path,
    run_id: str,
    started_binding: Mapping[str, str],
    active_binding: Mapping[str, str],
    claim_consumption_binding: Mapping[str, str],
    ticket: Mapping[str, Any],
    project_root: Path,
) -> dict[str, Any]:
    expected_report_path = output_dir / "gpu-diagnostic-report.json"
    expected_state_path = output_dir / "model-state-hashes.json"
    expected_gradient_path = output_dir / "gradient-evidence.json"
    expected_telemetry_path = output_dir / "cuda-telemetry.json"
    runner_terminal = json.loads(runner_terminal_path.read_text(encoding="utf-8"))
    expected_ticket = {
        key: ticket[key]
        for key in (
            "ticketId",
            "ticketPath",
            "ticketSha256",
            "consumptionPath",
            "consumptionSha256",
        )
    }
    if (
        runner_terminal.get("schemaVersion")
        != "stage4-full-backbone-spatial-affine-readonly-gpu-terminal-v1"
        or runner_terminal.get("executionState") != "completed"
        or runner_terminal.get("status")
        != "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_passed"
        or runner_terminal.get("runId") != run_id
        or runner_terminal.get("executionClaim") != dict(started_binding)
        or runner_terminal.get("executionClaimConsumption")
        != dict(claim_consumption_binding)
        or runner_terminal.get("activeConfig") != dict(active_binding)
        or runner_terminal.get("internalCapabilityTicket") != expected_ticket
        or runner_terminal.get("ownerAuthorizationRequired") is not False
    ):
        raise RuntimeError("full_backbone_readonly_gpu_runner_terminal_failed")
    diagnostic = runner_terminal.get("gpuDiagnosticReport")
    if not isinstance(diagnostic, Mapping):
        raise RuntimeError("full_backbone_readonly_gpu_report_binding_missing")
    diagnostic_path = resolve_project_file(
        str(diagnostic.get("path", "")), project_root=project_root
    )
    if diagnostic_path.resolve() != expected_report_path.resolve():
        raise RuntimeError("full_backbone_readonly_gpu_report_cross_run_path")
    diagnostic_binding = binding(diagnostic_path, project_root)
    if diagnostic_binding != dict(diagnostic):
        raise RuntimeError("full_backbone_readonly_gpu_report_sha256_mismatch")
    report = json.loads(diagnostic_path.read_text(encoding="utf-8"))
    safety = report.get("safety")
    expected_safety_keys = {
        "denoiserCheckpointRead",
        "historicalCheckpointRead",
        "failedCheckpointRead",
        "optimizerCreated",
        "backwardExecuted",
        "weightsModified",
        "checkpointWritten",
        "smokeStarted",
        "trainingStarted",
    }
    if (
        report.get("schemaVersion")
        != "stage4-full-backbone-spatial-affine-readonly-gpu-report-v1"
        or report.get("status") != "passed"
        or report.get("runId") != run_id
        or report.get("architectureId") != ARCHITECTURE_ID
        or report.get("capabilityVersion") != CAPABILITY_VERSION
        or report.get("executionClaim") != dict(started_binding)
        or report.get("executionClaimConsumption")
        != dict(claim_consumption_binding)
        or report.get("config") != dict(active_binding)
        or report.get("internalCapabilityTicket") != dict(ticket)
        or not isinstance(safety, Mapping)
        or set(safety) != expected_safety_keys
        or any(safety[key] is not False for key in expected_safety_keys)
    ):
        raise RuntimeError("full_backbone_readonly_gpu_report_identity_invalid")
    state_binding = report.get("modelStateHashes")
    if not isinstance(state_binding, Mapping):
        raise RuntimeError("full_backbone_readonly_gpu_state_binding_missing")
    state_path = resolve_project_file(
        str(state_binding.get("path", "")), project_root=project_root
    )
    if state_path.resolve() != expected_state_path.resolve():
        raise RuntimeError("full_backbone_readonly_gpu_state_cross_run_path")
    if binding(state_path, project_root) != dict(state_binding):
        raise RuntimeError("full_backbone_readonly_gpu_state_sha256_mismatch")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state_hash_keys = (
        "denoiserBefore",
        "denoiserAfter",
        "autoencoderBefore",
        "autoencoderAfter",
    )
    if (
        state.get("schemaVersion")
        != "stage4-full-backbone-spatial-affine-readonly-gpu-state-hashes-v1"
        or any(
            not isinstance(state.get(key), str)
            or re.fullmatch(r"[0-9a-f]{64}", state[key]) is None
            for key in state_hash_keys
        )
        or state.get("denoiserBefore") != state.get("denoiserAfter")
        or state.get("autoencoderBefore") != state.get("autoencoderAfter")
        or any(
            state.get(key) is not True
            for key in (
                "denoiserUnchanged",
                "autoencoderUnchanged",
                "allParameterGradFieldsRemainNone",
            )
        )
    ):
        raise RuntimeError("full_backbone_readonly_gpu_state_changed")
    artifact_contracts = {
        "gradientEvidence": (
            expected_gradient_path,
            "stage4-full-backbone-spatial-affine-readonly-gpu-gradient-evidence-v1",
        ),
        "cudaTelemetry": (
            expected_telemetry_path,
            "stage4-full-backbone-spatial-affine-readonly-gpu-cuda-telemetry-v1",
        ),
    }
    loaded_artifacts: dict[str, tuple[dict[str, str], dict[str, Any]]] = {}
    for field, (expected_path, schema_version) in artifact_contracts.items():
        artifact_binding = report.get(field)
        if (
            not isinstance(artifact_binding, Mapping)
            or runner_terminal.get(field) != dict(artifact_binding)
        ):
            raise RuntimeError(
                f"full_backbone_readonly_gpu_{field}_binding_missing"
            )
        artifact_path = resolve_project_file(
            str(artifact_binding.get("path", "")), project_root=project_root
        )
        if artifact_path.resolve() != expected_path.resolve():
            raise RuntimeError(
                f"full_backbone_readonly_gpu_{field}_cross_run_path"
            )
        observed = binding(artifact_path, project_root)
        artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
        if (
            observed != dict(artifact_binding)
            or artifact.get("schemaVersion") != schema_version
        ):
            raise RuntimeError(
                f"full_backbone_readonly_gpu_{field}_identity_invalid"
            )
        loaded_artifacts[field] = (observed, artifact)
    gradient = loaded_artifacts["gradientEvidence"][1]
    samples = gradient.get("samples")
    if (
        gradient.get("status") != "passed"
        or not isinstance(samples, list)
        or len(samples) != 2
        or [sample.get("role") for sample in samples]
        != ["first_formal_train_record", "fixed_validation_sample_194"]
        or [sample.get("sampleId") for sample in samples]
        != [
            "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
            "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        ]
        or any(
            sample.get("affineParameterTensorCount") != 24
            or sample.get("affineParameterCount") != 745472
            or sample.get("affineParameterObjectIdentityCount") != 24
            or sample.get("allParameterGradFieldsRemainNone") is not True
            or sample.get("conditionGradient", {}).get(
                "all23ChannelsFiniteNonzero"
            )
            is not True
            or len(
                sample.get("conditionGradient", {}).get(
                    "perChannelMaximumAbsoluteGradient", []
                )
            )
            != 23
            or len(sample.get("affineParameterGradients", [])) != 24
            or any(
                item.get("finite") is not True
                or item.get("nonzero") is not True
                or item.get("gammaFiniteNonzero") is not True
                or item.get("betaFiniteNonzero") is not True
                for item in sample.get("affineParameterGradients", [])
            )
            for sample in samples
        )
    ):
        raise RuntimeError("full_backbone_readonly_gpu_gradient_evidence_invalid")
    telemetry = loaded_artifacts["cudaTelemetry"][1]
    if (
        telemetry.get("status") != "completed"
        or not isinstance(telemetry.get("deviceName"), str)
        or not telemetry["deviceName"]
        or not isinstance(telemetry.get("peakGpuMemoryBytes"), int)
        or telemetry["peakGpuMemoryBytes"] <= 0
        or not isinstance(telemetry.get("durationSeconds"), (int, float))
        or telemetry["durationSeconds"] < 0
    ):
        raise RuntimeError("full_backbone_readonly_gpu_cuda_telemetry_invalid")
    return {
        "runnerTerminal": binding(runner_terminal_path, project_root),
        "gpuDiagnosticReport": diagnostic_binding,
        "modelStateHashes": dict(state_binding),
        "gradientEvidence": loaded_artifacts["gradientEvidence"][0],
        "cudaTelemetry": loaded_artifacts["cudaTelemetry"][0],
    }


def execute_readonly_gpu_gate(
    run_id: str,
    *,
    project_root: Path = PROJECT_ROOT,
    cpu_gate: Callable[[Path], dict[str, Any]] = run_cpu_gate,
    cuda_preflight: Callable[[Path], dict[str, Any]] = run_python_cuda_preflight,
    resource_gate: Callable[[Path], dict[str, Any]] = resource_preflight,
    ticket_issuer: Callable[..., tuple[dict, dict]] = (
        issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket
    ),
    config_validator: Callable[..., dict] = (
        validate_full_backbone_spatial_affine_readonly_gpu_config
    ),
    frozen_binding_builder: Callable[..., dict[str, dict[str, str]]] = (
        collect_frozen_input_bindings
    ),
    program_binding_builder: Callable[
        [Path], dict[str, dict[str, str]]
    ] = collect_program_bindings,
    gpu_invoker: Callable[..., subprocess.CompletedProcess[str]] = invoke_gpu_runner,
) -> dict[str, Any]:
    run_id = validate_run_id(run_id)
    root = project_root.resolve()
    attempt_dir = project_root / ATTEMPT_ROOT_RELATIVE / run_id
    output_relative = OUTPUT_ROOT_RELATIVE / run_id
    output_dir = project_root / output_relative
    attempt_dir.parent.mkdir(parents=True, exist_ok=True)
    try:
        attempt_dir.mkdir(exist_ok=False)
    except FileExistsError as error:
        prior_terminal = attempt_dir / "phase-terminal.json"
        result: dict[str, Any] = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1"
            ),
            "executionState": "rejected_duplicate_run_id",
            "status": (
                "stage4_full_backbone_spatial_affine_readonly_gpu_gate_"
                "duplicate_run_id_rejected"
            ),
            "runId": run_id,
            "error": "full_backbone_readonly_gpu_gate_attempt_reuse_forbidden",
            "ownerAuthorizationRequired": False,
        }
        if prior_terminal.is_file():
            result["existingAttemptTerminal"] = binding(prior_terminal, root)
        raise GateExecutionError(result) from error
    step = "execution_claim"
    claim_path = attempt_dir / "execution-claim.json"
    failure_path = attempt_dir / "failure-report.json"
    terminal_path = attempt_dir / "phase-terminal.json"
    active_path = attempt_dir / "active-config.json"
    runner_path = root / "ml" / "ai-painter" / "scripts" / GPU_RUNNER.name
    launcher_path = root / "ml" / "ai-painter" / "scripts" / Path(__file__).name
    existing_bindings: dict[str, Any] = {}
    try:
        if output_dir.exists():
            raise ValueError("full_backbone_readonly_gpu_gate_output_reuse_forbidden")
        claim = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-v1"
            ),
            "status": "claimed_once",
            "runId": run_id,
            "architectureId": ARCHITECTURE_ID,
            "capabilityVersion": CAPABILITY_VERSION,
            "outputNamespace": output_relative.as_posix(),
            "launcher": binding(launcher_path, root),
            "launcherProcessId": os.getpid(),
            "gpuRunner": binding(runner_path, root),
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
            "claimedAtUtc": utc_now(),
        }
        write_json_exclusive(claim_path, claim)
        existing_bindings["executionClaim"] = binding(claim_path, root)

        step = "pre_cpu_program_freeze"
        pre_cpu_programs = program_binding_builder(root)
        verify_frozen_bindings(pre_cpu_programs, project_root=root)

        step = "cpu_contract_gate"
        cpu_report = cpu_gate(root)
        cpu_path = attempt_dir / "cpu-gate-report.json"
        write_json_exclusive(cpu_path, cpu_report)
        existing_bindings["cpuGateReport"] = binding(cpu_path, root)
        step = "post_cpu_program_recheck"
        verify_frozen_bindings(pre_cpu_programs, project_root=root)

        step = "python_cuda_preflight"
        cuda_path = attempt_dir / "python-cuda-preflight.json"
        try:
            cuda_report = cuda_preflight(root)
        except GatePreflightError as error:
            write_json_exclusive(cuda_path, error.report)
            existing_bindings["pythonCudaPreflight"] = binding(cuda_path, root)
            raise
        write_json_exclusive(cuda_path, cuda_report)
        existing_bindings["pythonCudaPreflight"] = binding(cuda_path, root)

        step = "resource_preflight"
        resource_path = attempt_dir / "resource-preflight.json"
        try:
            resource_report = resource_gate(root)
        except GatePreflightError as error:
            write_json_exclusive(resource_path, error.report)
            existing_bindings["resourcePreflight"] = binding(resource_path, root)
            raise
        write_json_exclusive(resource_path, resource_report)
        existing_bindings["resourcePreflight"] = binding(resource_path, root)

        step = "local_ticket_issue_and_consume"
        formal = load_spatial_affine_formal_objective_contract(root)
        active, ticket = ticket_issuer(
            dataset_package_id=formal["data"]["datasetPackageId"],
            run_id=run_id,
            output_namespace=output_relative.as_posix(),
            project_root=root,
        )
        if (
            active.get("ownerAuthorizationRequired") is not False
            or active.get("ownerResponseRequired") is not False
        ):
            raise ValueError("full_backbone_readonly_gpu_gate_owner_boundary_changed")
        config_validator(active, project_root=root, require_execution_ticket=True)
        ticket_bindings = _verify_ticket_files(ticket, project_root=root)
        existing_bindings.update(ticket_bindings)
        write_json_exclusive(active_path, active)
        active_binding = binding(active_path, root)
        existing_bindings["activeConfig"] = active_binding

        step = "immutable_input_freeze"
        frozen_inputs = frozen_binding_builder(active, project_root=root)
        for label, expected in pre_cpu_programs.items():
            if frozen_inputs.get(label) != expected:
                raise ValueError(
                    f"full_backbone_readonly_gpu_gate_{label}_changed_during_cpu_gate"
                )
        verify_frozen_bindings(frozen_inputs, project_root=root)

        step = "runner_claim_frozen"
        started_path = attempt_dir / "execution-started.json"
        claim_consumption_path = attempt_dir / "execution-claim-consumption.json"
        started = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-execution-started-v1"
            ),
            "status": "runner_claimed_not_replayable",
            "runId": run_id,
            "outputNamespace": output_relative.as_posix(),
            "ticketId": ticket["ticketId"],
            "bindings": existing_bindings,
            "frozenInputs": frozen_inputs,
            "gpuRunner": binding(runner_path, root),
            "claimConsumptionPath": project_path(claim_consumption_path, root),
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
            "startedAtUtc": utc_now(),
        }
        write_json_exclusive(started_path, started)
        started_binding = binding(started_path, root)
        existing_bindings["executionStarted"] = started_binding

        step = "readonly_gpu_runner"
        completed = gpu_invoker(
            project_root=root,
            config_path=active_path,
            config_sha256=active_binding["sha256"],
            execution_claim_path=started_path,
            execution_claim_sha256=started_binding["sha256"],
            output_relative=output_relative,
        )
        if not claim_consumption_path.is_file():
            raise RuntimeError("full_backbone_readonly_gpu_claim_not_consumed")
        claim_consumption = json.loads(
            claim_consumption_path.read_text(encoding="utf-8")
        )
        if (
            claim_consumption.get("schemaVersion")
            != (
                "stage4-full-backbone-spatial-affine-readonly-gpu-"
                "execution-claim-consumption-v1"
            )
            or claim_consumption.get("status") != "consumed_once"
            or claim_consumption.get("runId") != run_id
            or claim_consumption.get("executionClaim") != started_binding
        ):
            raise RuntimeError("full_backbone_readonly_gpu_claim_consumption_invalid")
        existing_bindings["executionClaimConsumption"] = binding(
            claim_consumption_path, root
        )
        verify_frozen_bindings(frozen_inputs, project_root=root)
        verify_frozen_bindings(
            {
                "activeConfig": active_binding,
                "ticket": ticket_bindings["ticket"],
                "consumption": ticket_bindings["consumption"],
                "gpuRunner": binding(runner_path, root),
                "executionStarted": started_binding,
            },
            project_root=root,
        )
        runner_terminal_path = output_dir / "phase-terminal.json"
        if not runner_terminal_path.is_file():
            raise RuntimeError("full_backbone_readonly_gpu_runner_terminal_missing")
        runner_result = validate_runner_success(
            runner_terminal_path=runner_terminal_path,
            output_dir=output_dir,
            run_id=run_id,
            started_binding=started_binding,
            active_binding=active_binding,
            claim_consumption_binding=existing_bindings[
                "executionClaimConsumption"
            ],
            ticket=ticket,
            project_root=root,
        )
        runner_terminal_binding = runner_result["runnerTerminal"]
        diagnostic_binding = runner_result["gpuDiagnosticReport"]

        step = "gate_terminal"
        gate_terminal = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-gate-terminal-v1"
            ),
            "executionState": "completed",
            "status": (
                "stage4_full_backbone_spatial_affine_readonly_gpu_gate_completed"
            ),
            "runId": run_id,
            "architectureId": ARCHITECTURE_ID,
            "capabilityVersion": CAPABILITY_VERSION,
            "outputNamespace": output_relative.as_posix(),
            "gpuQualificationTerminal": runner_terminal_binding,
            "gpuDiagnosticReport": diagnostic_binding,
            "evidence": existing_bindings,
            "runnerStdoutSha256": hashlib.sha256(
                completed.stdout.encode("utf-8")
            ).hexdigest(),
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
            "recordedAtUtc": utc_now(),
        }
        write_json_exclusive(terminal_path, gate_terminal)
        result = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1"
            ),
            "executionState": "completed",
            "status": gate_terminal["status"],
            "runId": run_id,
            "outputNamespace": output_relative.as_posix(),
            "attemptTerminal": binding(terminal_path, root),
            "gpuQualificationTerminal": runner_terminal_binding,
            "gpuDiagnosticReport": diagnostic_binding,
            "ownerAuthorizationRequired": False,
        }
        return result
    except Exception as error:
        failure = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-failure-report-v1"
            ),
            "status": "failed_closed",
            "runId": run_id,
            "failedStep": step,
            "errorType": type(error).__name__,
            "error": str(error),
            "outputNamespace": output_relative.as_posix(),
            "evidenceAvailableBeforeFailure": existing_bindings,
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
            "recordedAtUtc": utc_now(),
        }
        write_json_exclusive(failure_path, failure)
        failure_binding = binding(failure_path, root)
        output_failure = _write_output_failure_terminal_if_needed(
            output_dir=output_dir,
            run_id=run_id,
            failure_report=failure_binding,
            project_root=root,
        )
        failed_terminal = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-gate-terminal-v1"
            ),
            "executionState": "failed_closed",
            "status": (
                "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed"
            ),
            "runId": run_id,
            "failedStep": step,
            "failureReport": failure_binding,
            "outputFailureTerminal": output_failure,
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
            "recordedAtUtc": utc_now(),
        }
        write_json_exclusive(terminal_path, failed_terminal)
        result = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1"
            ),
            "executionState": "failed_closed",
            "status": failed_terminal["status"],
            "runId": run_id,
            "failedStep": step,
            "error": str(error),
            "attemptTerminal": binding(terminal_path, root),
            "failureReport": failure_binding,
            "ownerAuthorizationRequired": False,
        }
        raise GateExecutionError(result) from error


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--run-id")
    args = parser.parse_args()
    run_id = args.run_id or new_run_id()
    try:
        result = execute_readonly_gpu_gate(run_id)
    except GateExecutionError as error:
        print(json.dumps(error.result, ensure_ascii=False, indent=2), flush=True)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
