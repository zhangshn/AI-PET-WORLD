from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import sys

import torch

from execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate import (
    GatePreflightError,
    resource_preflight,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def main() -> int:
    parser = ArgumentParser(
        description=(
            "Run the corrected Windows WDDM/CUDA/disk resource preflight for "
            "the full-backbone controlled Smoke without starting a GPU workload."
        )
    )
    parser.parse_args()
    try:
        report = resource_preflight(PROJECT_ROOT)
    except GatePreflightError as error:
        report = dict(error.report)
        report["python"] = {
            "version": sys.version.split()[0],
            "torchVersion": torch.__version__,
            "cudaBuildVersion": torch.version.cuda,
            "cudaAvailable": torch.cuda.is_available(),
            "cudaDeviceCount": (
                torch.cuda.device_count() if torch.cuda.is_available() else 0
            ),
        }
        print(json.dumps(report, ensure_ascii=False), flush=True)
        return 1
    report = dict(report)
    report["schemaVersion"] = (
        "stage4-full-backbone-spatial-affine-controlled-smoke-"
        "resource-preflight-v1"
    )
    report["python"] = {
        "version": sys.version.split()[0],
        "torchVersion": torch.__version__,
        "cudaBuildVersion": torch.version.cuda,
        "cudaAvailable": torch.cuda.is_available(),
        "cudaDeviceCount": (
            torch.cuda.device_count() if torch.cuda.is_available() else 0
        ),
    }
    if not report["python"]["cudaAvailable"]:
        report["status"] = "failed"
        report["blockers"] = sorted(
            set([*report.get("blockers", []), "torch_cuda_unavailable"])
        )
        print(json.dumps(report, ensure_ascii=False), flush=True)
        return 1
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
