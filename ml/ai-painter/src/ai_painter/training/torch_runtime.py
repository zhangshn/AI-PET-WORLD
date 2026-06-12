from __future__ import annotations


def require_torch():
    try:
        import torch
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "PyTorch is not installed in ml/ai-painter/.venv. "
            "Install a CUDA build compatible with the local RTX 5050 before training."
        ) from error
    return torch


def describe_torch_runtime() -> dict[str, object]:
    try:
        torch = require_torch()
    except RuntimeError as error:
        return {"ready": False, "reason": str(error), "device": None}
    cuda_ready = bool(torch.cuda.is_available())
    return {
        "ready": True,
        "torchVersion": torch.__version__,
        "cudaAvailable": cuda_ready,
        "device": torch.cuda.get_device_name(0) if cuda_ready else "cpu",
    }
