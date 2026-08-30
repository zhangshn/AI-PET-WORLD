from __future__ import annotations

from argparse import ArgumentParser, Namespace
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
from typing import Any, Callable, Mapping, Sequence

from ai_painter_joint_condition_local_transport_contract import ARCHITECTURE_ID


PROJECT_ROOT = Path(__file__).resolve().parents[3]
MINIMUM_FREE_GPU_MEMORY_BYTES = 4 * 1024**3
MINIMUM_FREE_DISK_BYTES = 2 * 1024**3
RESOURCE_BOUNDARY_ID = "stage4-joint-condition-local-transport-resource-boundary-v1"
_LEGACY_CANDIDATE_IDENTITIES = frozenset(
    {
        "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
        "stage4-full-backbone-spatial-affine-controlled-smokes",
    }
)


class ResourcePreflightError(RuntimeError):
    def __init__(self, report: Mapping[str, Any]):
        self.report = dict(report)
        super().__init__(str(self.report.get("blockers", ["resource_preflight_failed"])))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_candidate_identity(candidate_identity: str) -> None:
    if candidate_identity in _LEGACY_CANDIDATE_IDENTITIES:
        raise ValueError("exited spatial-affine candidate identity is forbidden")
    if candidate_identity != ARCHITECTURE_ID:
        raise ValueError("joint local-transport candidate identity mismatch")


def _read_cuda_snapshot() -> dict[str, Any]:
    # Import torch only inside the CUDA command.  This module never imports the
    # Trainer, constructs a model, creates an optimizer, or allocates a tensor.
    import torch

    if not torch.cuda.is_available():
        raise RuntimeError("torch CUDA is unavailable")
    device_index = 0
    free_bytes, total_bytes = torch.cuda.mem_get_info(device_index)
    properties = torch.cuda.get_device_properties(device_index)
    return {
        "pythonTorchCudaAvailable": True,
        "torchVersion": str(torch.__version__),
        "cudaRuntimeVersion": str(torch.version.cuda),
        "deviceIndex": device_index,
        "deviceName": str(torch.cuda.get_device_name(device_index)),
        "deviceCapability": list(torch.cuda.get_device_capability(device_index)),
        "freeGpuMemoryBytes": int(free_bytes),
        "totalGpuMemoryBytes": int(total_bytes),
        "deviceTotalMemoryBytes": int(properties.total_memory),
        "torchAllocatedBytes": int(torch.cuda.memory_allocated(device_index)),
        "torchReservedBytes": int(torch.cuda.memory_reserved(device_index)),
    }


def cuda_resource_report(
    *,
    candidate_identity: str = ARCHITECTURE_ID,
    snapshot_loader: Callable[[], Mapping[str, Any]] = _read_cuda_snapshot,
) -> dict[str, Any]:
    _validate_candidate_identity(candidate_identity)
    blockers: list[str] = []
    try:
        snapshot = dict(snapshot_loader())
    except Exception as error:
        snapshot = {"queryError": f"{type(error).__name__}: {error}"}
        blockers.append("python_torch_cuda_unavailable")
    free_bytes = snapshot.get("freeGpuMemoryBytes")
    if not isinstance(free_bytes, int) or isinstance(free_bytes, bool):
        blockers.append("free_gpu_memory_unavailable")
    elif free_bytes < MINIMUM_FREE_GPU_MEMORY_BYTES:
        blockers.append("free_gpu_memory_below_4096_mib")
    report = {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-controlled-smoke-"
            "cuda-resource-preflight-v1"
        ),
        "status": "passed" if not blockers else "failed",
        "command": "cuda-resource",
        "candidateIdentity": candidate_identity,
        "resourceBoundaryId": RESOURCE_BOUNDARY_ID,
        "gpu": snapshot,
        "limits": {
            "minimumFreeGpuMemoryBytes": MINIMUM_FREE_GPU_MEMORY_BYTES,
            "minimumFreeGpuMemoryMiB": 4096,
        },
        "blockers": sorted(set(blockers)),
        "modelConstructed": False,
        "optimizerCreated": False,
        "gpuWorkloadStarted": False,
        "trainingStarted": False,
        "recordedAtUtc": _utc_now(),
    }
    if blockers:
        raise ResourcePreflightError(report)
    return report


def disk_capacity_report(
    *,
    project_root: Path = PROJECT_ROOT,
    candidate_identity: str = ARCHITECTURE_ID,
    disk_usage_loader: Callable[[Path], Any] = shutil.disk_usage,
) -> dict[str, Any]:
    _validate_candidate_identity(candidate_identity)
    root = Path(project_root).resolve()
    if not root.is_dir():
        raise ValueError("project root is missing")
    runtime_logical = root / ".runtime"
    if not runtime_logical.is_dir():
        raise ValueError("registered .runtime directory is missing")
    runtime_physical = runtime_logical.resolve()
    project_usage = disk_usage_loader(root)
    runtime_usage = disk_usage_loader(runtime_physical)
    project_free = int(project_usage.free)
    runtime_free = int(runtime_usage.free)
    blockers: list[str] = []
    if project_free < MINIMUM_FREE_DISK_BYTES:
        blockers.append("project_free_disk_below_2_gib")
    if runtime_free < MINIMUM_FREE_DISK_BYTES:
        blockers.append("runtime_free_disk_below_2_gib")
    report = {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-controlled-smoke-"
            "disk-capacity-preflight-v1"
        ),
        "status": "passed" if not blockers else "failed",
        "command": "disk-capacity",
        "candidateIdentity": candidate_identity,
        "resourceBoundaryId": RESOURCE_BOUNDARY_ID,
        "disk": {
            "projectPath": str(root),
            "projectFreeBytes": project_free,
            "runtimePhysicalPath": str(runtime_physical),
            "runtimeFreeBytes": runtime_free,
        },
        "limits": {
            "minimumFreeDiskBytes": MINIMUM_FREE_DISK_BYTES,
            "controlledSmokeOutputDirectoryHardLimitMiB": 64,
        },
        "blockers": sorted(set(blockers)),
        "modelConstructed": False,
        "optimizerCreated": False,
        "gpuWorkloadStarted": False,
        "trainingStarted": False,
        "recordedAtUtc": _utc_now(),
    }
    if blockers:
        raise ResourcePreflightError(report)
    return report


def build_parser() -> ArgumentParser:
    parser = ArgumentParser(
        description=(
            "Read-only CUDA and disk gates for the joint-condition local-transport "
            "30-Epoch controlled Smoke."
        )
    )
    parser.add_argument("command", choices=("cuda-resource", "disk-capacity"))
    parser.add_argument("--candidate-identity", default=ARCHITECTURE_ID)
    return parser


def execute_command(
    args: Namespace,
    *,
    project_root: Path = PROJECT_ROOT,
    cuda_snapshot_loader: Callable[[], Mapping[str, Any]] = _read_cuda_snapshot,
    disk_usage_loader: Callable[[Path], Any] = shutil.disk_usage,
) -> dict[str, Any]:
    if args.command == "cuda-resource":
        return cuda_resource_report(
            candidate_identity=args.candidate_identity,
            snapshot_loader=cuda_snapshot_loader,
        )
    return disk_capacity_report(
        project_root=project_root,
        candidate_identity=args.candidate_identity,
        disk_usage_loader=disk_usage_loader,
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = execute_command(args)
    except ResourcePreflightError as error:
        print(json.dumps(error.report, ensure_ascii=False))
        return 2
    except Exception as error:
        print(
            json.dumps(
                {
                    "schemaVersion": (
                        "stage4-joint-condition-local-transport-controlled-smoke-"
                        "resource-preflight-error-v1"
                    ),
                    "status": "failed",
                    "command": args.command,
                    "candidateIdentity": args.candidate_identity,
                    "blockers": [f"{type(error).__name__}: {error}"],
                    "modelConstructed": False,
                    "optimizerCreated": False,
                    "gpuWorkloadStarted": False,
                    "trainingStarted": False,
                },
                ensure_ascii=False,
            )
        )
        return 2
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
