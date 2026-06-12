from __future__ import annotations

from pathlib import Path

from .torch_runtime import require_torch


def save_checkpoint(path: Path, *, model, optimizer, epoch: int, step: int, loss: float, config: dict[str, object]) -> None:
    torch = require_torch()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    torch.save({
        "schemaVersion": "ai-painter-checkpoint-v0",
        "epoch": epoch, "step": step, "loss": loss,
        "model": model.state_dict(), "optimizer": optimizer.state_dict(), "config": config,
    }, temporary)
    temporary.replace(path)


def load_checkpoint(path: Path, *, model, optimizer=None, device="cpu") -> dict[str, object]:
    torch = require_torch()
    state = torch.load(path, map_location=device, weights_only=False)
    model.load_state_dict(state["model"])
    if optimizer is not None:
        optimizer.load_state_dict(state["optimizer"])
    return state
