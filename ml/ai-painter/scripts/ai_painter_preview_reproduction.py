from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import os

import torch


@contextmanager
def fixed_preview_determinism_scope(enabled: bool = True):
    """Limit strict CUDA determinism to fixed-preview sampling and restore training state."""
    if not enabled:
        yield
        return
    previous_debug_mode = torch.get_deterministic_debug_mode()
    previous_cudnn_deterministic = bool(torch.backends.cudnn.deterministic)
    previous_cudnn_benchmark = bool(torch.backends.cudnn.benchmark)
    previous_workspace = os.environ.get("CUBLAS_WORKSPACE_CONFIG")
    try:
        os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
        torch.use_deterministic_algorithms(True)
        yield
    finally:
        torch.set_deterministic_debug_mode(previous_debug_mode)
        torch.backends.cudnn.deterministic = previous_cudnn_deterministic
        torch.backends.cudnn.benchmark = previous_cudnn_benchmark
        if previous_workspace is None:
            os.environ.pop("CUBLAS_WORKSPACE_CONFIG", None)
        else:
            os.environ["CUBLAS_WORKSPACE_CONFIG"] = previous_workspace


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def tensor_sha256(tensor) -> str:
    value = tensor.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(value.dtype).encode("ascii"))
    digest.update(json.dumps(list(value.shape), separators=(",", ":")).encode("ascii"))
    digest.update(value.numpy().tobytes(order="C"))
    return digest.hexdigest()


def compare_preview_reproduction_identities(source: dict, reproduced: dict) -> dict:
    fields = (
        "denoiserStateSha256",
        "conditionTensorSha256",
        "rgbTensorSha256",
        "latentNormalizationSha256",
        "previewSha256",
    )
    matches = {field: source.get(field) == reproduced.get(field) for field in fields}
    return {
        "schemaVersion": "ai-painter-preview-reproduction-comparison-v1",
        "fields": list(fields),
        "matches": matches,
        "allMatched": all(matches.values()),
    }
