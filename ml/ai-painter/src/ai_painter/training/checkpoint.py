from __future__ import annotations

from pathlib import Path
import os
import time
from uuid import uuid4

from .torch_runtime import require_torch


def save_checkpoint(path: Path, *, model, optimizer, epoch: int, step: int, loss: float, config: dict[str, object]) -> None:
    torch = require_torch()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    torch.save({
        "schemaVersion": "ai-painter-checkpoint-v0",
        "epoch": epoch, "step": step, "loss": loss,
        "model": model.state_dict(), "optimizer": optimizer.state_dict(), "config": config,
    }, temporary)
    replace_with_retry(temporary, path)


def replace_with_retry(source: Path, target: Path) -> None:
    last_error: PermissionError | None = None
    for attempt in range(8):
        try:
            os.replace(source, target)
            return
        except PermissionError as error:
            last_error = error
            time.sleep(0.15 * (attempt + 1))
    if source.exists():
        try:
            if target.exists():
                target.unlink()
            source.replace(target)
            return
        except PermissionError as error:
            last_error = error
    if last_error is not None:
        raise last_error


def load_checkpoint(path: Path, *, model, optimizer=None, device="cpu") -> dict[str, object]:
    torch = require_torch()
    state = torch.load(path, map_location=device, weights_only=False)
    model.load_state_dict(state["model"])
    if optimizer is not None:
        optimizer.load_state_dict(state["optimizer"])
    return state
